import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { getStripeServerClient, getSupabaseAdminClient } from '@/lib/server-clients'

export async function GET(req: NextRequest) {
  try {
    const stripe = getStripeServerClient()
    const supabaseAdmin = getSupabaseAdminClient()
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      )
    }

    // Validate authenticated user
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const subscription = session.subscription as Stripe.Subscription | null
    const customer = session.customer as Stripe.Customer | string | null

    if (!subscription || !customer) {
      return NextResponse.json(
        { error: 'No subscription or customer on session' },
        { status: 400 }
      )
    }

    const customerId =
      typeof customer === 'string' ? customer : (customer.id as string)
    const priceId = subscription.items.data[0]?.price.id

    if (!priceId) {
      return NextResponse.json(
        { error: 'Unable to determine price from subscription' },
        { status: 400 }
      )
    }

    // Map price → tier using same logic as webhook
    const tier = getSubscriptionTier(priceId)
    const limits = getUsageLimits(tier)

    // Find user profile by Stripe customer or email/session user
    const { data: profileByCustomer } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    const targetUserId = profileByCustomer?.user_id || user.id

    // Upsert user_profiles with latest subscription info
    await supabaseAdmin.from('user_profiles').upsert(
      {
        user_id: targetUserId,
        subscription_tier: tier,
        subscription_status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_started_at: new Date(
          subscription.current_period_start * 1000
        ).toISOString(),
        subscription_ends_at: new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        monthly_scenario_limit: limits.scenarioLimit,
        monthly_ai_insights_limit: limits.aiInsightsLimit,
        monthly_transaction_volume_limit: limits.transactionVolumeLimit,
      },
      { onConflict: 'user_id' }
    )

    // Upsert into user_subscriptions for audit
    await supabaseAdmin.from('user_subscriptions').upsert(
      {
        user_id: targetUserId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        status: subscription.status,
        plan_id: subscription.items.data[0]?.price.id,
        plan_name: tier,
        subscription_started_at: new Date(
          subscription.start_date * 1000
        ).toISOString(),
        subscription_current_period_start: new Date(
          subscription.current_period_start * 1000
        ).toISOString(),
        subscription_current_period_end: new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        subscription_updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' }
    )

    return NextResponse.json({
      success: true,
      tier,
      status: subscription.status,
    })
  } catch (error) {
    console.error('❌ Manual sync error:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync subscription state',
      },
      { status: 500 }
    )
  }
}

// Reuse the same tier/limits logic as the webhook to stay consistent
function getSubscriptionTier(priceId: string): string {
  const tierMap: Record<string, string> = {
    [process.env.STRIPE_STARTER_PRICE_ID || '']: 'starter',
    [process.env.STRIPE_PROFESSIONAL_PRICE_ID || '']: 'professional',
    [process.env.STRIPE_BUSINESS_PRICE_ID || '']: 'business',
    [process.env.STRIPE_ENTERPRISE_PRICE_ID || '']: 'enterprise',
    [process.env.STRIPE_REV_PILOT_STARTER_PRICE_ID || '']: 'starter',
    [process.env.STRIPE_REV_PILOT_PRO_PRICE_ID || '']: 'professional',
    [process.env.STRIPE_REV_PILOT_BUSINESS_PRICE_ID || '']: 'business',
  }

  Object.keys(tierMap).forEach((key) => {
    if (!key || key === '') delete tierMap[key]
  })

  return tierMap[priceId] || 'starter'
}

function getUsageLimits(tier: string): {
  scenarioLimit: number | null
  aiInsightsLimit: number
  transactionVolumeLimit: number
} {
  const limits: Record<
    string,
    { scenarioLimit: number | null; aiInsightsLimit: number; transactionVolumeLimit: number }
  > = {
    starter: {
      scenarioLimit: 0,
      aiInsightsLimit: 5,
      transactionVolumeLimit: 10000,
    },
    professional: {
      scenarioLimit: 3,
      aiInsightsLimit: 50,
      transactionVolumeLimit: 100000,
    },
    business: {
      scenarioLimit: null,
      aiInsightsLimit: 200,
      transactionVolumeLimit: 500000,
    },
    enterprise: {
      scenarioLimit: null,
      aiInsightsLimit: -1,
      transactionVolumeLimit: -1,
    },
  }

  return limits[tier] || limits['starter']
}
