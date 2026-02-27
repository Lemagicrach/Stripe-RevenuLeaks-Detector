import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'
import { getSupabaseAdminClient } from '@/lib/server-clients'

/**
 * GET /api/insights
 *
 * Generates simple AI-style insights based on the user's current metrics.
 * Requires the user to be authenticated and have an active Stripe connection.
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    // Apply rate limiting using the 'metrics' limiter as a baseline
    const rl = await withRateLimit(req, 'metrics')
    if (rl) return rl

    // Authenticate the user via Supabase session cookies
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

    // Find the user's active Stripe connection
    const { data: connections, error: connError } = await supabaseAdmin
      .from('stripe_connections')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (connError) {
      console.error('insights: connection error', connError)
      return NextResponse.json(
        { state: 'error', message: 'Database error' },
        { status: 500 }
      )
    }
    const connection = connections?.[0]
    if (!connection) {
      return NextResponse.json(
        { state: 'no_connection', message: 'No active Stripe connection found.' },
        { status: 200 }
      )
    }

    // Pull basic metrics for the connection
    const { data: metricsData, error: metricsError } = await supabaseAdmin
      .from('view_connection_metrics')
      .select('mrr, total_customers, active_subscriptions')
      .eq('stripe_connection_id', connection.id)
      .limit(1)
    if (metricsError) {
      console.error('insights: view metrics error', metricsError)
      return NextResponse.json(
        { state: 'error', message: 'Failed to load metrics' },
        { status: 500 }
      )
    }
    const currentStats = metricsData?.[0] ?? {
      mrr: 0,
      total_customers: 0,
      active_subscriptions: 0,
    }
    const mrr = Number(currentStats.mrr) || 0
    const totalCustomers = Number(currentStats.total_customers) || 0
    const activeSubscriptions = Number(currentStats.active_subscriptions) || 0

    // Fetch churn data for the past 30 days
    const { data: churnDataList, error: churnError } = await supabaseAdmin
      .from('view_churn_rate_30d')
      .select('churned_customers_30d, churned_mrr_30d')
      .eq('stripe_connection_id', connection.id)
      .limit(1)
    if (churnError) {
      console.error('insights: churn error', churnError)
    }
    const churnStats = churnDataList?.[0] ?? {
      churned_customers_30d: 0,
      churned_mrr_30d: 0,
    }
    const churnedCustomers = Number(churnStats.churned_customers_30d) || 0
    const churnedMrr = Number(churnStats.churned_mrr_30d) || 0
    const customersAtStartOfPeriod = totalCustomers + churnedCustomers
    const mrrAtStartOfPeriod = mrr + churnedMrr
    const customerChurnRate =
      customersAtStartOfPeriod > 0 ? (churnedCustomers / customersAtStartOfPeriod) * 100 : 0
    const revenueChurnRate =
      mrrAtStartOfPeriod > 0 ? (churnedMrr / mrrAtStartOfPeriod) * 100 : 0

    // Fetch MRR history for the past 60 days to assess growth trends
    const { data: historyData } = await supabaseAdmin
      .from('metrics_history')
      .select('date, mrr')
      .eq('stripe_connection_id', connection.id)
      .order('date', { ascending: true })
      .limit(60)

    // Compute a simple growth rate using the earliest and latest points
    let growthRate = 0
    if (Array.isArray(historyData) && historyData.length >= 2) {
      const firstMrr = Number(historyData[0].mrr) || 0
      const lastMrr = Number(historyData[historyData.length - 1].mrr) || 0
      if (firstMrr > 0) {
        growthRate = ((lastMrr - firstMrr) / firstMrr) * 100
      }
    }

    // Generate human-readable messages based on heuristic rules
    let predictionMessage = ''
    if (growthRate > 10) {
      predictionMessage = `Your revenue is trending up! MRR increased by ${growthRate.toFixed(1)}% over the last period.`
    } else if (growthRate < -5) {
      predictionMessage = `Revenue is declining by ${Math.abs(growthRate).toFixed(1)}% – consider reviewing customer retention and pricing.`
    } else {
      predictionMessage = `Revenue is relatively stable with a ${growthRate.toFixed(1)}% change recently. Focus on steady growth.`
    }

    let churnMessage = ''
    if (customerChurnRate > 5) {
      churnMessage = `Churn rate is high at ${customerChurnRate.toFixed(1)}%. Implement retention strategies to reduce churn.`
    } else {
      churnMessage = `Churn rate is moderate at ${customerChurnRate.toFixed(1)}%. Continue monitoring customer satisfaction.`
    }

    let growthMessage = ''
    if (activeSubscriptions > totalCustomers * 0.8) {
      growthMessage = `Focus on expansion and upsell high‑value customers to boost revenue.`
    } else {
      growthMessage = `Consider acquiring new customers to increase your base.`
    }

    const arpu = totalCustomers > 0 ? mrr / totalCustomers : 0
    let pricingMessage = ''
    if (arpu > 100) {
      pricingMessage =
        'Average revenue per user is high. You may consider introducing higher‑tier plans or value‑added features.'
    } else if (arpu < 20) {
      pricingMessage =
        'Average revenue per user is low. Evaluate your pricing strategy or increase perceived value.'
    } else {
      pricingMessage =
        'ARPU is within a healthy range. Focus on optimizing customer lifetime value through engagement.'
    }

    // Health score: simple proxy based on churn rate
    let healthScore = 100 - customerChurnRate
    if (healthScore < 0) healthScore = 0
    if (healthScore > 100) healthScore = 100

    return NextResponse.json(
      {
        prediction: predictionMessage,
        churn_risk: churnMessage,
        growth: growthMessage,
        pricing: pricingMessage,
        health_score: `${healthScore.toFixed(0)}/100`,
      },
      { status: 200 }
    )
  } catch (err) {
    const errorResponse = handleApiError(err, 'INSIGHTS_GET')
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
