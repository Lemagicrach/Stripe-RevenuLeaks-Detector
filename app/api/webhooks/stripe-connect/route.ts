import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { detectRevenueLeaksDetailed } from '@/lib/revenue-leaks'
import { sendViaResend } from '@/lib/resend'
import { getStripeServerClient, getSupabaseAdminClient } from '@/lib/server-clients'

function monthlyAmountFromSubscription(sub: Stripe.Subscription): number {
  // Compute approximate monthly recurring amount from subscription items.
  // This is a heuristic for MVP; upgrades with metered billing should use events.
  let total = 0
  for (const item of sub.items.data) {
    const price = item.price
    const unit = price.unit_amount || 0
    const qty = item.quantity || 1
    const amount = unit * qty // in cents
    const interval = price.recurring?.interval
    const count = price.recurring?.interval_count || 1

    if (interval === 'month') total += amount / count
    else if (interval === 'year') total += amount / (12 * count)
    else total += amount // fallback
  }
  return Math.round(total)
}

async function upsertInvoice(connId: string, invoice: Stripe.Invoice) {
  const supabaseAdmin = getSupabaseAdminClient()
  const payload = {
    stripe_connection_id: connId,
    invoice_id: invoice.id,
    customer_id: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
    subscription_id:
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null,
    status: invoice.status || 'draft',
    amount_due_cents: invoice.amount_due || 0,
    amount_paid_cents: invoice.amount_paid || 0,
    attempt_count: invoice.attempt_count || 0,
    next_payment_attempt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null,
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    created_at_stripe: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
    updated_at_stripe: invoice.status_transitions?.finalized_at
      ? new Date(invoice.status_transitions.finalized_at * 1000).toISOString()
      : new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }

  // Check previous status for recovery tracking
  const { data: prev } = await supabaseAdmin
    .from('invoices_cache')
    .select('status, amount_due_cents, amount_paid_cents')
    .eq('stripe_connection_id', connId)
    .eq('invoice_id', invoice.id)
    .maybeSingle()

  const { error } = await supabaseAdmin
    .from('invoices_cache')
    .upsert(payload, { onConflict: 'stripe_connection_id,invoice_id' })
  if (error) throw error

  return prev
}

async function upsertSubscription(connId: string, sub: Stripe.Subscription) {
  const supabaseAdmin = getSupabaseAdminClient()
  const mrr = monthlyAmountFromSubscription(sub)

  const payload = {
    stripe_connection_id: connId,
    subscription_id: sub.id,
    customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || '',
    status: sub.status,
    mrr_amount: (mrr / 100).toFixed(2), // table uses DECIMAL(10,2)
    interval: sub.items.data?.[0]?.price?.recurring?.interval || null,
    currency: sub.currency?.toUpperCase() || 'USD',
    current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    created_at_stripe: sub.created ? new Date(sub.created * 1000).toISOString() : null,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
    plan_name: sub.items.data?.[0]?.price?.nickname || null,
    price_id: sub.items.data?.[0]?.price?.id || null,
    quantity: sub.items.data?.[0]?.quantity || 1,
    synced_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin
    .from('subscriptions_cache')
    .upsert(payload, { onConflict: 'stripe_connection_id,subscription_id' })

  if (error) throw error
}

async function logRecovery(connId: string, userId: string, invoice: Stripe.Invoice, prevStatus?: string | null) {
  const supabaseAdmin = getSupabaseAdminClient()
  const nowPaid = invoice.status === 'paid' || invoice.paid === true
  if (!nowPaid) return
  if (prevStatus === 'paid') return

  const amount = invoice.amount_paid || invoice.amount_due || 0
  if (amount <= 0) return

  // Attribute recovery to failed-payments leak when transitioning from failed/open.
  const leakType = prevStatus === 'open' || prevStatus === 'uncollectible' ? 'failed_payments' : null

  // Phase 6: best-effort link to the latest matching leak
  let leakId: string | null = null
  if (leakType) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabaseAdmin
      .from('revenue_leaks')
      .select('id, created_at')
      .eq('stripe_connection_id', connId)
      .eq('leak_type', leakType)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)

    leakId = (data && data[0]?.id) ? String(data[0].id) : null
  }

  const { error } = await supabaseAdmin.from('revenue_recovery_events').insert({
    stripe_connection_id: connId,
    user_id: userId,
    invoice_id: invoice.id,
    recovered_amount_cents: amount,
    recovered_at: new Date().toISOString(),
    leak_type: leakType,
    leak_id: leakId,
    source_event_type: 'invoice.payment_succeeded',
    meta: {
      prev_status: prevStatus,
      status: invoice.status,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
    },
  })

  // Ignore unique conflicts
  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) {
    // best-effort
    console.warn('recovery log error', error)
  }
}

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdminClient()
  const stripe = getStripeServerClient()
  // Identify connection
  const { searchParams } = new URL(req.url)
  const connectionId = searchParams.get('connection_id')
  if (!connectionId) {
    return new NextResponse('Missing connection_id', { status: 400 })
  }

  // Load webhook secret + user_id
  const { data: conn, error: connErr } = await supabaseAdmin
    .from('stripe_connections')
    .select('id, user_id, stripe_account_id, webhook_secret, webhook_status')
    .eq('id', connectionId)
    .maybeSingle()

  if (connErr) return new NextResponse('DB error', { status: 500 })
  if (!conn) return new NextResponse('Unknown connection', { status: 404 })
  if (!conn.webhook_secret) return new NextResponse('Webhook secret not configured', { status: 412 })

  const sig = req.headers.get('stripe-signature') as string
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, conn.webhook_secret)
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed', err?.message)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'invoice.payment_failed':
      case 'invoice.finalized':
      case 'invoice.updated': {
        const invoice = event.data.object as Stripe.Invoice
        await upsertInvoice(conn.id, invoice)
        break
      }
      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const prev = await upsertInvoice(conn.id, invoice)
        await logRecovery(conn.id, conn.user_id, invoice, prev?.status || null)
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await upsertSubscription(conn.id, sub)
        break
      }
      default:
        // ignore other events
        break
    }

    // Trigger leak detection for this connection (fast decision updates)
    const changes = await detectRevenueLeaksDetailed(conn.user_id, conn.id)

    // Create in-app notifications for meaningful changes
    const interesting = changes.filter((c) => c.changed)

    if (interesting.length) {
      await supabaseAdmin.from('leak_notifications').upsert(
        interesting.map((c) => ({
          user_id: conn.user_id,
          stripe_connection_id: conn.id,
          leak_id: c.leak.id,
          leak_type: c.leak.leak_type,
          severity: c.leak.severity,
          title: c.leak.title,
          message: c.leak.summary,
          channel: 'in_app',
        })),
        { onConflict: 'leak_id,channel' }
      )

      // Email alerts for high/critical (respects user_profiles.email_reports_enabled)
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('email_reports_enabled')
        .eq('user_id', conn.user_id)
        .maybeSingle()

      const emailEnabled = profile?.email_reports_enabled !== false

      if (emailEnabled) {
        const severe = interesting.filter((c) => c.leak.severity === 'high' || c.leak.severity === 'critical')
        if (severe.length) {
          try {
            const adminUser = await supabaseAdmin.auth.admin.getUserById(conn.user_id)
            const email = adminUser?.data?.user?.email

            if (email) {
              const top = severe[0].leak
              const html = `
                <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto; line-height:1.5; color:#0f172a">
                  <h2 style="margin:0 0 8px 0;">RevPilot — Instant Revenue Leak Alert</h2>
                  <p style="margin:0 0 14px 0; color:#475569;">A high-impact leak was detected from live Stripe activity.</p>
                  <div style="padding:12px 14px; border:1px solid #e2e8f0; border-radius:12px;">
                    <div style="font-weight:700;">${top.title}</div>
                    <div style="margin-top:6px; color:#334155;">${top.summary}</div>
                    <div style="margin-top:10px;"><b>Fix:</b> ${top.recommended_action}</div>
                    <div style="margin-top:10px; font-size:12px; color:#64748b;">Severity: ${String(top.severity).toUpperCase()} · Confidence ${(top.confidence * 100).toFixed(0)}%</div>
                  </div>
                  <p style="margin:14px 0 0 0; font-size:12px; color:#64748b;">Open your dashboard → Revenue Leak Detector for details.</p>
                </div>
              `

              const subject = `RevPilot Alert: ${top.title} (${String(top.severity).toUpperCase()})`
              const sent = await sendViaResend({ to: email, subject, html })

              // Log per-leak email notification (deduped)
              await supabaseAdmin.from('leak_notifications').upsert(
                severe.map((c) => ({
                  user_id: conn.user_id,
                  stripe_connection_id: conn.id,
                  leak_id: c.leak.id,
                  leak_type: c.leak.leak_type,
                  severity: c.leak.severity,
                  title: c.leak.title,
                  message: c.leak.summary,
                  channel: 'email',
                  provider_message_id: sent?.id || null,
                })),
                { onConflict: 'leak_id,channel' }
              )
            }
          } catch (e) {
            console.warn('email alert failed', e)
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Webhook processing error', err)
    return new NextResponse('Webhook processing error', { status: 500 })
  }
}
