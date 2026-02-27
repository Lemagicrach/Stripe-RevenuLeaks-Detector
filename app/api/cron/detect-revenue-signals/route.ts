// app/api/cron/detect-revenue-signals/route.ts
//
// This endpoint runs as a backend cron job to detect revenue leak signals
// across all active Stripe connections. It should be scheduled daily
// (or at whatever frequency makes sense) using your deployment platform's
// cron scheduler. The route verifies the CRON_SECRET header before
// executing and rate limits requests. For each unique user with an
// active connection, it invokes the signal detection logic defined in
// `lib/revenue-signals.ts`. Any new signals are persisted automatically
// via the helper functions in that module.

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { detectRevenueSignals } from '@/lib/revenue-signals';
import { getSupabaseAdminClient } from '@/lib/server-clients';

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  // Optionally rate limit to avoid abuse. If a response is returned
  // here, it means the request exceeded the allowed limit and should
  // simply return that response to the client.
  const rateLimitResponse = await withRateLimit(req, 'cron-detect-signals');
  if (rateLimitResponse) return rateLimitResponse;

  // Enforce authentication via CRON_SECRET. Only callers that know
  // this secret are allowed to trigger the job. The secret must be
  // provided in the Authorization header as `Bearer <secret>`.
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all active Stripe connections. We only care about the user_id
  // column, so grouping by user avoids duplicate processing when a user
  // has multiple connections (e.g. multiple Stripe accounts connected).
  const { data: connections, error } = await supabase
    .from('stripe_connections')
    .select('user_id')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch active connections', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  // Build a unique set of user IDs to process. Using a Set ensures
  // uniqueness even if the underlying query returns duplicates.
  const userIds = connections
    .map((c: any) => c.user_id)
    .filter((id: any): id is string => typeof id === 'string' && id.length > 0);
  const uniqueUserIds = Array.from(new Set(userIds));

  let processed = 0;
  for (const userId of uniqueUserIds) {
    try {
      // Detect and persist signals for this user. New signals are stored
      // in the `revenue_signals` table. The detection function internally
      // decides when to create signals based on churn spikes and payment
      // failure rates.
      await detectRevenueSignals(String(userId));
      processed++;
    } catch (err) {
      console.error(`Failed to detect signals for user ${userId}:`, err);
    }
  }

  return NextResponse.json({ success: true, processed });
}
