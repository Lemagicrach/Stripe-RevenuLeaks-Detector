import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { detectRevenueSignals } from '@/lib/revenue-signals';

/**
 * API route to fetch revenue leak alerts for the authenticated user.
 *
 * This endpoint checks the user's subscription tier and returns any
 * detected revenue signals. For free/starter plans, the response
 * contains a restricted flag instructing the frontend to blur the
 * alerts card and prompt the user to upgrade. For paid tiers, it
 * triggers the signal detection logic and returns the stored signals.
 */
export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient();

  // Get current authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { state: 'unauthorized', error: authError?.message || 'No user session' },
      { status: 401 },
    );
  }

  // Fetch user's profile to determine their plan / subscription tier.
  // We attempt to read from the user_profiles table if available,
  // falling back to the subscription_tier field if defined on the profile.
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, plan, subscription_tier')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { state: 'error', error: profileError?.message || 'Profile not found' },
      { status: 500 },
    );
  }

  // Normalize tier/plan names: some parts of the app use 'starter'/'professional'
  // while the Stripe integration uses 'free'/'pro'. Treat 'starter' and 'free'
  // as free-tier plans and all others as paid.
  const tier = (profile.plan ||
    profile.subscription_tier ||
    'starter') as string;
  const normalizedTier = tier.toLowerCase();
  const isFreePlan =
    normalizedTier === 'starter' ||
    normalizedTier === 'free';

  if (isFreePlan) {
    // Do not expose alerts for free plans. The frontend should blur content.
    return NextResponse.json({ restricted: true });
  }

  // Run detection logic to insert any new signals.
  // The detection function is idempotent: it only inserts alerts when thresholds are crossed.
  try {
    await detectRevenueSignals(user.id);
  } catch (err: any) {
    // Log detection errors but continue to serve existing alerts.
    console.error('Revenue signal detection failed:', err);
  }

  // Retrieve the most recent signals for the user.
  const { data: signals, error: signalsError } = await supabase
    .from('revenue_signals')
    .select('*')
    .eq('user_id', user.id)
    .order('detected_at', { ascending: false });

  if (signalsError) {
    return NextResponse.json(
      { state: 'error', error: signalsError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    restricted: false,
    signals: signals || [],
  });
}