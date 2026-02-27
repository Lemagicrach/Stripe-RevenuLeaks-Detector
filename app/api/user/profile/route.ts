import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'
import { getSupabaseAdminClient } from '@/lib/server-clients'

/**
 * GET /api/user/profile
 *
 * Returns the authenticated user's profile, including subscription tier,
 * full name and the Stripe account ID if a connection exists.
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    // Apply a rate limit using the 'metrics' rate limiter as a baseline
    const rl = await withRateLimit(req, 'metrics')
    if (rl) return rl

    // Get the current authenticated user via Supabase session cookies
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { state: 'unauthorized', message: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Fetch the user's profile record
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier, full_name')
      .eq('user_id', user.id)
      .limit(1)

    if (profileError) {
      console.error('user/profile: profile error', profileError)
      return NextResponse.json({ state: 'error', message: 'Database error' }, { status: 500 })
    }

    const profile = profiles?.[0] || null
    // Fallbacks if the profile record is missing
    const subscriptionTier = profile?.subscription_tier || 'starter'
    const fullName = profile?.full_name || (user.user_metadata?.full_name as string) || user.email || 'User'

    // Determine the active Stripe account ID (if any)
    const { data: connections, error: connError } = await supabaseAdmin
      .from('stripe_connections')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (connError) {
      console.error('user/profile: connection error', connError)
    }
    const stripeAccountId = connections?.[0]?.stripe_account_id

    return NextResponse.json(
      {
        subscription_tier: subscriptionTier,
        full_name: fullName,
        stripe_account_id: stripeAccountId,
      },
      { status: 200 }
    )
  } catch (err) {
    const errorResponse = handleApiError(err, 'USER_PROFILE_GET')
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
