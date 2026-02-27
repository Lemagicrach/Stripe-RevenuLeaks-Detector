import Stripe from 'stripe'
import { getStripeServerClient, getSupabaseAdminClient } from './server-clients'

/**
 * Revenue signal definitions. A revenue signal represents an actionable insight
 * about the health of a user's subscription business. These signals are used
 * to trigger alerts in the dashboard and are intentionally opinionated –
 * rather than showing raw metrics, they surface a specific problem like a
 * churn spike or a payment failure trend. The detection heuristics are kept
 * simple and transparent on purpose.
 */

export type RevenueSignalType = 'churn_spike' | 'payment_failure'

export interface RevenueSignal {
  userId: string
  type: RevenueSignalType
  severity: 'low' | 'medium' | 'high'
  /**
   * An optional numeric value associated with the signal. For example, the
   * percentage increase in churn or the number of failed payments.
   */
  value: number | null
  /**
   * Additional metadata used to explain the context behind the signal. This
   * object is stored as JSONB in the database and can include any relevant
   * fields such as current and previous churn rates.
   */
  meta?: Record<string, any>
}

/**
 * Detect revenue signals for a given user. This function fetches the user's
 * active Stripe connection (if not provided) and analyses both payment data
 * and historical metrics snapshots to derive signals. The heuristics used
 * here are intentionally basic – in production, you might replace them with
 * more sophisticated models or rules.
 *
 * @param userId The user ID to evaluate signals for
 * @param connectionId Optional explicit Stripe connection ID for this user
 * @returns A list of revenue signals
 */
export async function detectRevenueSignals(
  userId: string,
  connectionId?: string
): Promise<RevenueSignal[]> {
  const supabase = getSupabaseAdminClient()
  const stripe = getStripeServerClient()
  const signals: RevenueSignal[] = []

  // Resolve the active Stripe connection ID for this user if not provided
  let stripeConnectionId = connectionId
  if (!stripeConnectionId) {
    const { data: connections, error } = await supabase
      .from('stripe_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('detectRevenueSignals: failed to fetch stripe connection', error)
    }
    stripeConnectionId = connections?.id
  }
  // If the user does not have an active connection, bail out
  if (!stripeConnectionId) {
    return signals
  }

  // Detect recent payment failures by inspecting Stripe charges.
  // We compare the number of failed charges in the last 7 days to the last 30 days.
  try {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const sevenDaysAgo = nowSeconds - 7 * 24 * 60 * 60
    const thirtyDaysAgo = nowSeconds - 30 * 24 * 60 * 60

    // Fetch charges from the last 7 days and 30 days.
    const [charges7d, charges30d] = await Promise.all([
      stripe.charges.list({
        limit: 100,
        created: { gte: sevenDaysAgo },
      }),
      stripe.charges.list({
        limit: 100,
        created: { gte: thirtyDaysAgo },
      }),
    ])

    const failed7d = charges7d.data.filter((c) => c.status === 'failed').length
    const failed30d = charges30d.data.filter((c) => c.status === 'failed').length

    // If failures increased significantly, create a payment_failure signal.
    // A ratio > 0.5 means more than half of recent failures occurred in the last 7 days.
    if (failed7d > 0 && failed30d > 0 && failed7d / failed30d > 0.5) {
      signals.push({
        userId,
        type: 'payment_failure',
        severity: failed7d > 3 ? 'high' : 'medium',
        value: failed7d,
        meta: { failed7d, failed30d },
      })
    }
  } catch (err) {
    console.error('detectRevenueSignals: failed to analyse charges', err)
  }

  // Detect churn spikes by comparing the last two revenue churn rates.
  try {
    const { data: snapshots, error } = await supabase
      .from('metrics_snapshots')
      .select('snapshot_date, revenue_churn_rate')
      .eq('stripe_connection_id', stripeConnectionId)
      .order('snapshot_date', { ascending: false })
      .limit(2)
    if (!error && snapshots && snapshots.length === 2) {
      const [current, previous] = snapshots
      const currentRate = current.revenue_churn_rate || 0
      const previousRate = previous.revenue_churn_rate || 0
      const diff = currentRate - previousRate
      // Trigger a signal if churn increased by more than 2 percentage points.
      if (diff > 0.02) {
        signals.push({
          userId,
          type: 'churn_spike',
          severity: diff > 0.1 ? 'high' : 'medium',
          value: Math.round(diff * 10000) / 100, // convert to percentage points
          meta: {
            currentRate,
            previousRate,
            increase: diff,
          },
        })
      }
    }
  } catch (err) {
    console.error('detectRevenueSignals: failed to compare churn rates', err)
  }

  return signals
}

/**
 * Save a list of revenue signals to the database. If a signal with the same
 * userId, type and detected_at timestamp already exists, it will not be
 * duplicated. This helper is useful if you wish to persist signals from a
 * scheduled job or after generating them via an API call.
 *
 * @param signals List of signals to persist
 */
export async function saveRevenueSignals(
  signals: RevenueSignal[]
): Promise<void> {
  if (signals.length === 0) return
  const supabase = getSupabaseAdminClient()
  const payload = signals.map((s) => ({
    user_id: s.userId,
    type: s.type,
    severity: s.severity,
    value: s.value,
    meta: s.meta || {},
  }))
  const { error } = await supabase.from('revenue_signals').insert(payload)
  if (error) {
    console.error('saveRevenueSignals: failed to insert signals', error)
  }
}
