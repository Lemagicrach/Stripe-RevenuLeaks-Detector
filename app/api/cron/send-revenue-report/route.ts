// app/api/cron/send-revenue-report/route.ts
//
// This route is intended to run on a weekly schedule. It sends a summary
// of revenue alerts to each paid user. For each user on a paid plan,
// it aggregates revenue signals detected during the last seven days and
// queues a simple text email in the `email_queue` table. Free/starter
// users are skipped. The route requires the CRON_SECRET header for
// authorization to avoid unauthorised triggering.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server-clients';

// Helper function to queue an email in the email_queue table. The exact
// column names may vary in your schema; adjust as needed. At minimum
// `to`, `subject` and `body` are provided, along with optional user_id
// and send_at to schedule immediate dispatch.
async function queueEmail({
  userId,
  to,
  subject,
  body,
}: {
  userId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('email_queue').insert({
    user_id: userId,
    to,
    subject,
    body,
    send_at: new Date().toISOString(),
    // Additional fields like status/default can be left for database defaults
  });
  if (error) {
    console.error(`Failed to queue email to ${to}:`, error);
  }
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  // Require CRON_SECRET in the Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Determine the cutoff date for the weekly report (7 days ago)
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all user profiles with a paid plan. We treat 'starter' and 'free'
  // as free tiers; everything else is considered paid. Include email and
  // subscription_tier so we can determine the plan name. Note: adjust
  // column names if your schema differs.
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id, email, plan, subscription_tier')
    .neq('plan', 'starter');

  if (profilesError) {
    console.error('Failed to fetch profiles', profilesError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ success: true, queued: 0 });
  }

  let queuedEmails = 0;
  for (const profile of profiles) {
    const userId = profile.id;
    const email: string | null = (profile as any).email || null;
    const plan = (profile.plan || profile.subscription_tier || 'starter').toLowerCase();

    // Skip if user has no email or is on free plan (starter/free)
    if (!email) continue;
    if (plan === 'starter' || plan === 'free') continue;

    // Fetch signals detected in the last 7 days for this user
    const { data: signals, error: signalsError } = await supabase
      .from('revenue_signals')
      .select('*')
      .eq('user_id', userId)
      .gte('detected_at', sevenDaysAgo);

    if (signalsError) {
      console.error(`Failed to fetch signals for user ${userId}:`, signalsError);
      continue;
    }

    if (!signals || signals.length === 0) {
      // No new signals this week; nothing to send.
      continue;
    }

    // Build a simple text body summarising the signals. We group by
    // signal type and list each occurrence with the detection date and
    // description. You could make this HTML or use a templating engine.
    let bodyLines: string[] = [];
    bodyLines.push('Hello,');
    bodyLines.push('');
    bodyLines.push('Here is your weekly revenue alert summary from RevPilot:');
    bodyLines.push('');
    for (const signal of signals) {
      const date = new Date(signal.detected_at).toLocaleDateString();
      if (signal.type === 'churn_spike') {
        const value = signal.value !== null ? `${signal.value.toFixed(1)}%` : '';
        bodyLines.push(`• [${date}] Churn spike: churn increased by ${value}`);
      } else if (signal.type === 'payment_failure') {
        const val = signal.value ?? 'multiple';
        bodyLines.push(`• [${date}] Payment failures: ${val} failed payments detected`);
      } else {
        bodyLines.push(`• [${date}] ${signal.type}`);
      }
    }
    bodyLines.push('');
    bodyLines.push('To view details and take action, please sign in to your RevPilot dashboard.');
    bodyLines.push('');
    bodyLines.push('— The RevPilot Team');

    const subject = 'Your weekly revenue alerts';
    const body = bodyLines.join('\n');

    await queueEmail({ userId, to: email, subject, body });
    queuedEmails++;
  }

  return NextResponse.json({ success: true, queued: queuedEmails });
}
