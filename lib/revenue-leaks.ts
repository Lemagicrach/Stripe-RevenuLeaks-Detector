import { getSupabaseAdminClient } from './server-clients'

/**
 * Revenue Leak Detector (Phase 1)
 *
 * This module detects *money-impact* issues (leaks) using cached Stripe data:
 * - invoices_cache (failed payments, recovery gap)
 * - metrics_snapshots (churn spike, silent churn proxy)
 * - subscriptions_cache (expansion opportunity proxy)
 *
 * Detection is intentionally rules-based and transparent for MVP velocity.
 */

export type RevenueLeakType =
  | 'failed_payments'
  | 'recovery_gap'
  | 'churn_spike'
  | 'silent_churn'
  | 'expansion_opportunity'

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface RevenueLeak {
  id?: string
  stripe_connection_id: string
  user_id: string
  leak_type: RevenueLeakType
  period_start: string // YYYY-MM-DD
  period_end: string   // YYYY-MM-DD
  lost_amount_cents: number
  recoverable_amount_cents: number
  severity: Severity
  confidence: number // 0..1
  title: string
  summary: string
  recommended_action: string
  evidence: Record<string, unknown>
  created_at?: string
}

export interface LeakChange {
  leak: RevenueLeak
  changed: boolean
  previous?: {
    id: string
    severity: Severity
    lost_amount_cents: number
    recoverable_amount_cents: number
    created_at: string
  } | null
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function severityFromLoss(lossCents: number): Severity {
  if (lossCents >= 50_000_00) return 'critical' // $50k+/mo
  if (lossCents >= 10_000_00) return 'high'     // $10k+/mo
  if (lossCents >= 2_000_00) return 'medium'    // $2k+/mo
  return 'low'
}

async function saveLeak(leak: RevenueLeak): Promise<LeakChange> {
  const supabase = getSupabaseAdminClient()
  // Fetch previous record for diffing
  const { data: prev } = await supabase
    .from('revenue_leaks')
    .select('id,severity,lost_amount_cents,recoverable_amount_cents,created_at')
    .eq('stripe_connection_id', leak.stripe_connection_id)
    .eq('leak_type', leak.leak_type)
    .eq('period_end', leak.period_end)
    .maybeSingle()

  // Avoid spam: replace same leak type for same period_end
  await supabase
    .from('revenue_leaks')
    .delete()
    .eq('stripe_connection_id', leak.stripe_connection_id)
    .eq('leak_type', leak.leak_type)
    .eq('period_end', leak.period_end)

  const { data: inserted, error } = await supabase
    .from('revenue_leaks')
    .insert(leak)
    .select('id')
    .maybeSingle()
  if (error) throw error

  if (inserted?.id) leak.id = inserted.id

  // Decide if this is a meaningful change (new, severity up, or >15% delta)
  const prevLoss = Number(prev?.lost_amount_cents ?? 0)
  const nextLoss = Number(leak.lost_amount_cents ?? 0)
  const deltaPct = prevLoss > 0 ? Math.abs(nextLoss - prevLoss) / prevLoss : 1
  const severityChanged = prev?.severity && prev.severity !== leak.severity
  const severityUp = severityChanged && (prev.severity === 'low' || (prev.severity === 'medium' && (leak.severity === 'high' || leak.severity === 'critical')) || (prev.severity === 'high' && leak.severity === 'critical'))

  const changed = !prev || severityUp || deltaPct >= 0.15

  return {
    leak,
    changed,
    previous: prev ? { ...prev } : null,
  }
}

/**
 * Detect leaks for a user (and optionally a specific connection)
 */
async function computeRevenueLeaks(userId: string, connectionId?: string): Promise<RevenueLeak[]> {
  const supabase = getSupabaseAdminClient()
  const leaks: RevenueLeak[] = []

  // Resolve active connection if not provided
  let stripeConnectionId = connectionId
  if (!stripeConnectionId) {
    const { data, error } = await supabase
      .from('stripe_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error) console.error('detectRevenueLeaks: fetch connection failed', error)
    stripeConnectionId = data?.id
  }

  if (!stripeConnectionId) return leaks

  const periodEndDate = new Date()
  const periodStartDate = daysAgo(30)
  const periodStart = isoDate(periodStartDate)
  const periodEnd = isoDate(periodEndDate)

  // Fetch cached data (last 30d + buffer)
  const [{ data: invoices }, { data: snapshots }, { data: subs }] = await Promise.all([
    supabase
      .from('invoices_cache')
      .select('invoice_id,status,amount_due_cents,amount_paid_cents,attempt_count,next_payment_attempt,hosted_invoice_url,created_at_stripe')
      .eq('stripe_connection_id', stripeConnectionId)
      .gte('created_at_stripe', periodStartDate.toISOString())
      .order('created_at_stripe', { ascending: false }),

    supabase
      .from('metrics_snapshots')
      .select('snapshot_date,mrr,net_revenue_retention,churn_rate,grr')
      .eq('stripe_connection_id', stripeConnectionId)
      .gte('snapshot_date', periodStart)
      .order('snapshot_date', { ascending: true }),

    supabase
      .from('subscriptions_cache')
      .select('subscription_id,status,mrr_amount,created_at_stripe,price_id,plan_name,customer_id')
      .eq('stripe_connection_id', stripeConnectionId),
  ])

  const inv = invoices ?? []
  const ms = snapshots ?? []
  const sc = subs ?? []

  // ---------------------------
  // Leak 1: Failed Payments (open/uncollectible invoices)
  // ---------------------------
  const failed = inv.filter((i: any) => i.status === 'open' || i.status === 'uncollectible')
  const failedLoss = failed.reduce((sum: number, i: any) => sum + Number(i.amount_due_cents ?? 0), 0)

  if (failedLoss > 0) {
    leaks.push({
      stripe_connection_id: stripeConnectionId,
      user_id: userId,
      leak_type: 'failed_payments',
      period_start: periodStart,
      period_end: periodEnd,
      lost_amount_cents: failedLoss,
      recoverable_amount_cents: Math.round(failedLoss * 0.65),
      severity: severityFromLoss(failedLoss),
      confidence: 0.82,
      title: 'Failed payments are leaking revenue',
      summary: `You have ${failed.length} open/uncollectible invoices in the last 30 days, representing ~$${(failedLoss / 100).toFixed(0)} at risk.`,
      recommended_action:
        'Improve dunning: enable smart retries, card update reminders, and in-app prompts. Track recovery weekly.',
      evidence: {
        failed_invoice_count: failed.length,
        sample_invoices: failed.slice(0, 5),
      },
    })
  }

  // ---------------------------
  // Leak 2: Recovery Gap (failed invoices older than N days)
  // ---------------------------
  const N = 7
  const now = Date.now()
  const stuck = failed.filter((i: any) => {
    const created = i.created_at_stripe ? new Date(i.created_at_stripe).getTime() : 0
    const ageDays = created ? (now - created) / (1000 * 60 * 60 * 24) : 0
    return ageDays >= N
  })
  const stuckLoss = stuck.reduce((sum: number, i: any) => sum + Number(i.amount_due_cents ?? 0), 0)

  if (stuckLoss > 0) {
    leaks.push({
      stripe_connection_id: stripeConnectionId,
      user_id: userId,
      leak_type: 'recovery_gap',
      period_start: periodStart,
      period_end: periodEnd,
      lost_amount_cents: stuckLoss,
      recoverable_amount_cents: Math.round(stuckLoss * 0.45),
      severity: severityFromLoss(stuckLoss),
      confidence: 0.78,
      title: 'Recovery gap: failed invoices are not being recovered',
      summary: `You have ${stuck.length} failed invoices older than ${N} days. This usually indicates weak retry + reminder flow.`,
      recommended_action:
        'Add a 3-step dunning sequence (email + in-app), verify retry rules, enable card updater, and pause access until payment is updated.',
      evidence: {
        stuck_days_threshold: N,
        stuck_invoice_count: stuck.length,
        sample_invoices: stuck.slice(0, 5),
      },
    })
  }

  // ---------------------------
  // Leak 3: Churn Spike (proxy using churn_rate snapshots)
  // ---------------------------
  // If you store churn_rate as percentage (0-100), we compare recent vs baseline.
  if (ms.length >= 14) {
    const recent = ms.slice(-7)
    const baseline = ms.slice(-21, -7)

    if (baseline.length >= 7) {
      const recentChurn = recent.reduce((s: number, m: any) => s + Number(m.churn_rate ?? 0), 0) / recent.length
      const baseChurn = baseline.reduce((s: number, m: any) => s + Number(m.churn_rate ?? 0), 0) / baseline.length

      if (baseChurn > 0 && recentChurn >= baseChurn * 2 && recentChurn >= 2) {
        // Estimate loss using MRR * churn delta (very rough MVP)
        const latestMRR = Number(ms[ms.length - 1].mrr ?? 0)
        const churnDelta = (recentChurn - baseChurn) / 100
        const lossEstimate = Math.round(latestMRR * churnDelta * 100) // mrr is dollars? to cents
        const lossMonthly = Math.max(0, lossEstimate)

        leaks.push({
          stripe_connection_id: stripeConnectionId,
          user_id: userId,
          leak_type: 'churn_spike',
          period_start: periodStart,
          period_end: periodEnd,
          lost_amount_cents: lossMonthly,
          recoverable_amount_cents: Math.round(lossMonthly * 0.25),
          severity: severityFromLoss(lossMonthly),
          confidence: 0.70,
          title: 'Churn spike detected',
          summary: `Your churn rate (7d avg) is ~${recentChurn.toFixed(1)}% vs baseline ~${baseChurn.toFixed(
            1
          )}%. This indicates a sudden retention issue.`,
          recommended_action:
            'Investigate which plan/cohort churned. Review recent product changes, pricing updates, and payment failures. Trigger save-offers for at-risk cancels.',
          evidence: {
            recent_churn_avg_pct: recentChurn,
            baseline_churn_avg_pct: baseChurn,
            latest_mrr: latestMRR,
          },
        })
      }
    }
  }

  // ---------------------------
  // Leak 4: Silent Churn proxy (NRR drop with low tracked churn)
  // ---------------------------
  // If NRR drops hard, it often means downgrades/untracked churn (or pricing changes).
  if (ms.length >= 7) {
    const recent = ms.slice(-7)
    const startNRR = Number(recent[0].net_revenue_retention ?? 0)
    const endNRR = Number(recent[recent.length - 1].net_revenue_retention ?? 0)

    if (startNRR > 0 && endNRR > 0 && endNRR < startNRR - 10) {
      const latestMRR = Number(ms[ms.length - 1].mrr ?? 0)
      const drop = (startNRR - endNRR) / 100
      const lossMonthly = Math.round(latestMRR * drop * 100)

      leaks.push({
        stripe_connection_id: stripeConnectionId,
        user_id: userId,
        leak_type: 'silent_churn',
        period_start: periodStart,
        period_end: periodEnd,
        lost_amount_cents: lossMonthly,
        recoverable_amount_cents: Math.round(lossMonthly * 0.15),
        severity: severityFromLoss(lossMonthly),
        confidence: 0.55,
        title: 'Possible silent churn / untracked revenue loss',
        summary: `Your NRR dropped from ~${startNRR.toFixed(0)}% to ~${endNRR.toFixed(
          0
        )}% in the last 7 days. This often indicates downgrades, proration issues, or silent churn.`,
        recommended_action:
          'Enable subscription event tracking (upgrades/downgrades). Review plan changes, proration invoices, and unpaid subscriptions to explain the drop.',
        evidence: {
          nrr_start_pct: startNRR,
          nrr_end_pct: endNRR,
        },
      })
    }
  }

  // ---------------------------
  // Leak 5: Expansion opportunity (proxy)
  // ---------------------------
  // Heuristic: many long-tenure active subs with low MRR amount suggests upsell potential.
  const activeSubs = sc.filter((s: any) => s.status === 'active' || s.status === 'trialing')
  const mrrAmounts = activeSubs.map((s: any) => Number(s.mrr_amount ?? 0)).filter((x: number) => x > 0)

  if (mrrAmounts.length >= 10) {
    const min = Math.min(...mrrAmounts)
    const lowTier = activeSubs.filter((s: any) => Number(s.mrr_amount ?? 0) === min)

    const longTenure = lowTier.filter((s: any) => {
      const created = s.created_at_stripe ? new Date(s.created_at_stripe).getTime() : 0
      const ageDays = created ? (Date.now() - created) / (1000 * 60 * 60 * 24) : 0
      return ageDays >= 180
    })

    if (longTenure.length >= 5) {
      const currentMRR = longTenure.reduce((sum: number, s: any) => sum + Math.round(Number(s.mrr_amount ?? 0) * 100), 0) // dollars->cents
      const potential = Math.round(currentMRR * 0.5 * 0.2)

      if (potential >= 500_00) {
        leaks.push({
          stripe_connection_id: stripeConnectionId,
          user_id: userId,
          leak_type: 'expansion_opportunity',
          period_start: periodStart,
          period_end: periodEnd,
          lost_amount_cents: potential,
          recoverable_amount_cents: potential,
          severity: severityFromLoss(potential),
          confidence: 0.50,
          title: 'Expansion opportunity: long-tenure customers on lowest tier',
          summary: `${longTenure.length} long-tenure customers are still on your lowest tier. A small upsell campaign could unlock ~$${(
            potential / 100
          ).toFixed(0)}/month.`,
          recommended_action:
            'Identify power users on the lowest tier and offer a clear upgrade path (feature gating, usage-based tier, annual discount). Add in-app upgrade prompts.',
          evidence: {
            lowest_tier_mrr_amount: min,
            long_tenure_low_tier_count: longTenure.length,
            estimated_current_mrr_cents: currentMRR,
            estimated_potential_mrr_cents: potential,
          },
        })
      }
    }
  }

  return leaks
}

export async function detectRevenueLeaks(
  userId: string,
  connectionId?: string
): Promise<RevenueLeak[]> {
  const leaks = await computeRevenueLeaks(userId, connectionId)

  for (const leak of leaks) {
    leak.confidence = clamp(leak.confidence, 0.2, 0.95)
    await saveLeak(leak)
  }

  return leaks
}

/**
 * Detailed detection that returns which leaks meaningfully changed.
 * Use this for webhook-triggered instant alerts.
 */
export async function detectRevenueLeaksDetailed(
  userId: string,
  connectionId?: string
): Promise<LeakChange[]> {
  const leaks = await computeRevenueLeaks(userId, connectionId)
  const changes: LeakChange[] = []
  for (const leak of leaks) {
    leak.confidence = clamp(leak.confidence, 0.2, 0.95)
    const change = await saveLeak(leak)
    changes.push(change)
  }
  return changes
}
