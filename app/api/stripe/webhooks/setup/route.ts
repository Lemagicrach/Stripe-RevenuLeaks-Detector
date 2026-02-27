import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'

/**
 * POST /api/stripe/webhooks/setup
 * Creates a Stripe webhook endpoint on the CONNECTED ACCOUNT (Stripe-Account header)
 * and stores the signing secret in stripe_connections.webhook_secret.
 *
 * Body: { stripe_connection_id: string }
 */
export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stripe_connection_id } = await req.json()
    if (!stripe_connection_id) {
      return NextResponse.json({ error: 'Missing stripe_connection_id' }, { status: 400 })
    }

    // Load connection (must belong to user)
    const { data: conn, error: connErr } = await supabase
      .from('stripe_connections')
      .select('id, user_id, stripe_account_id, webhook_endpoint_id, webhook_status')
      .eq('id', stripe_connection_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (connErr) throw connErr
    if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

    // Build webhook URL with connection_id so we can look up the secret on receive
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const url = `${baseUrl}/api/webhooks/stripe-connect?connection_id=${encodeURIComponent(conn.id)}`

    // Create (or recreate) endpoint on connected account
    // Note: Stripe returns the signing secret on creation (Stripe API behavior).
    const endpoint = await stripe.webhookEndpoints.create(
      {
        url,
        enabled_events: [
          'invoice.payment_failed',
          'invoice.payment_succeeded',
          'invoice.paid',
          'invoice.finalized',
          'invoice.updated',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
        ],
        description: 'RevPilot Revenue Leak Detector (real-time alerts)',
      },
      { stripeAccount: conn.stripe_account_id }
    )

    // Persist endpoint id + secret (secret is not always typed on Stripe response)
    const endpointWithSecret = endpoint as { secret?: unknown }
    const secret =
      typeof endpointWithSecret.secret === 'string'
        ? endpointWithSecret.secret
        : undefined

    const { error: upErr } = await supabase
      .from('stripe_connections')
      .update({
        webhook_endpoint_id: endpoint.id,
        webhook_secret: secret || null,
        webhook_status: secret ? 'active' : 'pending_secret',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id)
      .eq('user_id', user.id)

    if (upErr) throw upErr

    return NextResponse.json({
      ok: true,
      stripe_connection_id: conn.id,
      webhook_endpoint_id: endpoint.id,
      webhook_status: secret ? 'active' : 'pending_secret',
      webhook_url: url,
      note: secret
        ? undefined
        : 'Stripe did not return a signing secret via API. If status is pending_secret, create the endpoint in Stripe dashboard and paste the secret into stripe_connections.webhook_secret.',
    })
  } catch (err) {
    return handleApiError(err)
  }
})
