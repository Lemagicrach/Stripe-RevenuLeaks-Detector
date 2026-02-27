import { NextRequest, NextResponse } from 'next/server'
// Utilisation de ton helper local pour l'authentification côté serveur
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'
import { DEMO_METRICS_RESPONSE } from '@/lib/demo-metrics'

const TEMPLATE_MODE = process.env.NEXT_PUBLIC_TEMPLATE_MODE === 'true'

// Create admin client only when needed (prevents crashes in template mode)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Server misconfigured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY'
    )
  }
  return createClient(url, serviceKey)
}


// -----------------------------
// ✅ Read/Init per-user data_mode
// Uses user-auth supabase client (RLS allows own row)
// -----------------------------
async function getUserDataMode(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  // Try read existing setting
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('data_mode')
    .eq('user_id', userId)
    .maybeSingle()

  // If table missing or error, default to "real"
  if (error) return 'real' as const

  if (!settings) {
    // Create default row (real)
    await supabase.from('user_settings').insert({ user_id: userId, data_mode: 'real' })
    return 'real' as const
  }

  const mode = (settings as any).data_mode
  return mode === 'demo' ? ('demo' as const) : ('real' as const)
}

export async function GET(req: NextRequest) {
  try {
    const rl = await withRateLimit(req, 'metrics')
    if (rl) return rl

    // 1. Authentification Utilisateur (inchangée)
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
    // ✅ Template Mode: always serve demo metrics (no DB/admin key required)
if (TEMPLATE_MODE) {
  return NextResponse.json(DEMO_METRICS_RESPONSE, { status: 200 })
}


    // ✅ 1.5 DEMO TOGGLE (NEW)
    const mode = await getUserDataMode(supabase, user.id)
    if (mode === 'demo') {
      return NextResponse.json(DEMO_METRICS_RESPONSE, { status: 200 })
    }
    const supabaseAdmin = getSupabaseAdmin()


    // 2. Récupérer la connexion Stripe active
    const { data: connections, error: connError } = await supabaseAdmin
      .from('stripe_connections')
      .select('id, stripe_account_id, business_name, currency, last_synced_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    const connection = connections?.[0]

    if (connError) {
      console.error('metrics: connection error', connError)
      return NextResponse.json({ state: 'error', message: 'Database error' }, { status: 500 })
    }

    // ✅ OPTIONAL: If you want "auto-demo when no connection", uncomment this:
    // if (!connection) return NextResponse.json(DEMO_METRICS_RESPONSE, { status: 200 })

    if (!connection) {
      return NextResponse.json(
        { state: 'no_connection', message: 'No active Stripe connection found.' },
        { status: 200 }
      )
    }

    // 3. Récupérer les métriques actuelles (MRR, Clients actifs)
    const { data: metricsData, error: metricsError } = await supabaseAdmin
      .from('view_connection_metrics')
      .select('mrr, total_customers, active_subscriptions')
      .eq('stripe_connection_id', connection.id)
      .limit(1)

    const metrics = metricsData?.[0]

    if (metricsError) {
      console.error('metrics: view error', metricsError)
      return NextResponse.json({ state: 'error', message: 'Failed to load metrics' }, { status: 500 })
    }

    // Données de base
    const currentStats = metrics || {
      mrr: 0,
      total_customers: 0,
      active_subscriptions: 0
    }

    const mrr = Number(currentStats.mrr)
    const totalCustomers = Number(currentStats.total_customers)
    const activeSubscriptions = Number(currentStats.active_subscriptions)

    // ✅ OPTIONAL: auto-demo if connected but truly no data yet (mrr==0 & no subs)
    // if (mrr === 0 && activeSubscriptions === 0) return NextResponse.json(DEMO_METRICS_RESPONSE, { status: 200 })

    // 4. Récupérer les métriques de CHURN sur 30 jours
    const { data: churnDataList, error: churnError } = await supabaseAdmin
      .from('view_churn_rate_30d')
      .select('churned_customers_30d, churned_mrr_30d')
      .eq('stripe_connection_id', connection.id)
      .limit(1)

    if (churnError) {
      console.error('metrics: churn error', churnError)
    }

    // Déterminer la cohorte de l'utilisateur pour le Benchmarking
    const userCohort = get_mrr_cohort(mrr)

    // 5. Récupérer le Benchmarking Global
    const { data: benchmarksList, error: benchError } = await supabaseAdmin
      .from('view_global_benchmarks')
      .select('average_mrr, cohort_size, total_churned_in_cohort, total_customers_at_start')
      .eq('cohort', userCohort)
      .limit(1)

    if (benchError) {
      console.error('metrics: benchmark error', benchError)
    }

    // 6. Récupérer l'HISTORIQUE (pour le graphique MRR Trend)
    const { data: historyData } = await supabaseAdmin
      .from('metrics_history')
      .select('date, mrr')
      .eq('stripe_connection_id', connection.id)
      .order('date', { ascending: true })
      .limit(90)

    // ---------------------------------------------------------
    // CALCULS FINAUX ET FORMATAGE
    // ---------------------------------------------------------
    const arr = mrr * 12
    const arpu = totalCustomers > 0 ? mrr / totalCustomers : 0
    const ltv = arpu * 24 // Placeholder

    // --- Calculs Churn ---
    const churnStats = (churnDataList?.[0]) ?? {
      churned_customers_30d: 0,
      churned_mrr_30d: 0
    }

    const churnedCustomers = Number(churnStats.churned_customers_30d)
    const customersAtStartOfPeriod = totalCustomers + churnedCustomers

    const customerChurnRate =
      customersAtStartOfPeriod > 0
        ? (churnedCustomers / customersAtStartOfPeriod) * 100
        : 0

    const churnedMrr = Number(churnStats.churned_mrr_30d)
    const mrrAtStartOfPeriod = mrr + churnedMrr

    const revenueChurnRate =
      mrrAtStartOfPeriod > 0
        ? (churnedMrr / mrrAtStartOfPeriod) * 100
        : 0

    // --- Calculs Benchmarking ---
    const benchmarkData = (benchmarksList?.[0]) ?? {}

    const avgMrr = Number((benchmarkData as any).average_mrr) || 0
    const cohortSize = Number((benchmarkData as any).cohort_size) || 0

    const totalChurned = Number((benchmarkData as any).total_churned_in_cohort) || 0
    const totalCustomersStart = Number((benchmarkData as any).total_customers_at_start) || 0

    const averageChurnRate =
      totalCustomersStart > 0
        ? (totalChurned / totalCustomersStart) * 100
        : 0

    // --- Formatage Historique ---
    const history = (historyData || []).map(row => ({
      date: row.date,
      mrr: Number(row.mrr)
    }))

    // ---------------------------------------------------------
    // RÉPONSE FINALE CONSOLIDÉE
    // ---------------------------------------------------------
    return NextResponse.json(
      {
        state: 'ok',
        connection: {
          stripeAccountId: connection.stripe_account_id,
          businessName: connection.business_name ?? 'Your business',
          currency: connection.currency.toUpperCase(),
          lastSyncedAt: connection.last_synced_at ?? new Date().toISOString(),
        },
        current: {
          mrr,
          arr,
          arpu,
          ltv,
          totalCustomers,
          activeSubscriptions,
          customerChurnRate,
          revenueChurnRate,
        },
        history,
        benchmarking: {
          userCohort,
          avgMrr,
          cohortSize,
          averageChurnRate,
        }
      },
      { status: 200 }
    )

} catch (error) {
  return handleApiError(error, 'METRICS_GET')
  }
}
function get_mrr_cohort(mrr: number) {
  throw new Error('Function not implemented.')
}
