import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'
import { sanitizePlanId } from '@/lib/plan-flow'

// Initialise Stripe with secret key. The API version should match your Stripe account settings.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Use the latest Stripe API version or specify a version explicitly
  apiVersion: '2023-10-16',
})

/**
 * POST /api/create-checkout
 *
 * Creates a Stripe Checkout session for upgrading or purchasing a subscription plan.
 * Expects a JSON body with a `plan` field identifying the desired plan tier (e.g. starter, professional, business, enterprise).
 * Returns the session URL on success.
 */
export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting to prevent abuse
    const rl = await withRateLimit(req, 'metrics')
    if (rl) return rl

    // Ensure the user is authenticated
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

    // Parse the request body for the plan identifier
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const rawPlan: string | undefined = body?.plan
    if (!rawPlan || typeof rawPlan !== 'string') {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 })
    }
    const normalizedPaidPlan = sanitizePlanId(rawPlan)
    const plan = normalizedPaidPlan || rawPlan.trim().toLowerCase()

    // Determine the Stripe price ID from environment variables
    const planKey = plan.toUpperCase()
    const priceEnvVar = `STRIPE_${planKey}_PRICE_ID`
    const priceId = process.env[priceEnvVar as keyof NodeJS.ProcessEnv]
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid plan or price ID not configured' },
        { status: 400 }
      )
    }

    // Build success and cancel URLs based on the request origin
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const appUrl = origin.replace(/\/+$/, '')
    const successUrl = new URL('/dashboard/leaks', appUrl)
    successUrl.searchParams.set('checkoutSuccess', '1')
    if (normalizedPaidPlan) {
      successUrl.searchParams.set('intent_plan', normalizedPaidPlan)
    }
    const cancelUrl = new URL('/dashboard/leaks', appUrl)
    cancelUrl.searchParams.set('checkoutCancelled', '1')
    if (normalizedPaidPlan) {
      cancelUrl.searchParams.set('intent_plan', normalizedPaidPlan)
    }

    // Create the Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId as string,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan,
      },
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err) {
    const errorResponse = handleApiError(err, 'CHECKOUT_POST')
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
