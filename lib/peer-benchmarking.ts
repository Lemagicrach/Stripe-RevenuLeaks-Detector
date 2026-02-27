import { createClient, PostgrestError } from '@supabase/supabase-js'

// --- TYPES DE BASES DE DONNÉES (Assumptions) ---
type Database = any 

// Fonction utilitaire pour obtenir le client Supabase Admin
function getSupabaseAdmin() {
    // IMPORTANT : Nécessite le SUPABASE_SERVICE_KEY pour les opérations d'écriture
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    )
}

// --- INTERFACES & TYPES ---
export type UserTier = 'starter' | 'pro' | 'business' // Ajout de ce type ici
export type ConnectionId = string

export interface OptInSettings {
    industryVertical: string
    businessModel: string
    shareMRR: boolean
    shareChurn: boolean
    shareARPU: boolean
    shareGrowthRate: boolean
    shareLTV: boolean
}

export interface BenchmarkMetricValues {
    mrr: number
    arr: number
    arpu: number
    ltv: number
    customerChurnRate: number
    revenueChurnRate: number
}

interface StripeSubscriptionRow {
    id: string
    amount: number | null // en cents
    status: string
    customer_id: string
    current_period_start: string | null
    current_period_end: string | null
}

export interface BenchmarkComparison {
    metric: string
    userValue: number
    peerMedian: number
    peerP25: number | null
    peerP75: number | null
    peerP90: number | null
    percentile: number | null
    status: 'excellent' | 'above_average' | 'average' | 'needs_improvement' | 'N/A'
    message: string
}

export interface BenchmarkInsights {
    comparisons: BenchmarkComparison[]
    peerGroupSize: number
    industryVertical: string
    revenueTier: string
    summary: string
    currency: string
    userTier: UserTier // Ajout du Tier pour le frontend
}


// ===============================================
// === CLASSE DE CALCUL : MetricsEngine ===
// ===============================================

class MetricsEngine {
    private supabase = getSupabaseAdmin()

    constructor(private connectionId: ConnectionId) { }

    public async getMonthlyMetrics(month: Date): Promise<BenchmarkMetricValues> {
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
        const nextMonthStart = new Date(month.getFullYear(), month.getMonth() + 1, 1)

        const { data: subscriptions, error } = await this.supabase
            .from('stripe_subscriptions_data') 
            .select('id, amount, status, customer_id, current_period_start, current_period_end')
            .eq('connection_id', this.connectionId)
            .or(`status.in.("active","trialing"),current_period_end.gte.${monthStart.toISOString().slice(0, 10)}`) as { data: StripeSubscriptionRow[] | null, error: PostgrestError | null }

        if (error || !subscriptions) {
            console.error('Error fetching subscriptions for metrics:', error)
            throw new Error(`Failed to fetch subscription data: ${error?.message || 'No subscriptions found'}`)
        }

        let mrr = 0
        const customers = new Set<string>()

        subscriptions.forEach((row) => {
            const isActiveForMonth = 
                (row.status === 'active' || row.status === 'trialing') && 
                new Date(row.current_period_start ?? 0) < nextMonthStart &&
                new Date(row.current_period_end ?? Infinity) >= monthStart

            if (isActiveForMonth && row.amount) {
                const amount = row.amount / 100 
                mrr += amount
                customers.add(row.customer_id)
            }
        })

        const totalCustomers = customers.size || 1

        const arr = mrr * 12
        const arpu = totalCustomers > 0 ? mrr / totalCustomers : 0
        const ltv = arpu * 24 // Placeholder 
        
        const customerChurnRate = 0 // Placeholder
        const revenueChurnRate = 0 // Placeholder

        return { mrr, arr, arpu, ltv, customerChurnRate, revenueChurnRate }
    }
}


// ===============================================
// === CLASSE PRINCIPALE : PeerBenchmarkingEngine ===
// ===============================================

export class PeerBenchmarkingEngine {
    private supabase = getSupabaseAdmin()
    private metricsEngine: MetricsEngine

    constructor(private connectionId: ConnectionId) {
        this.metricsEngine = new MetricsEngine(connectionId)
    }

    // --- optIn, optOut, contributeMetrics (Logique non modifiée) ---
    // (Incluses dans l'extrait précédent, la logique est de faire un UPSERT/UPDATE)
    public async optIn(settings: OptInSettings): Promise<void> { /* ... */ }
    public async optOut(): Promise<void> { /* ... */ }
    public async contributeMetrics(month: Date): Promise<void> { /* ... */ }


    /**
     * Génère la comparaison de benchmarking, en filtrant les données selon le userTier.
     */
    public async getBenchmarkComparison(
        month: Date = new Date(), 
        userTier: UserTier = 'starter'
    ): Promise<BenchmarkInsights> {
        
        // 1. Vérifications de base (connexion, opt-in, devises)
        const { data: connectionData } = await this.supabase
            .from('stripe_connections')
            .select('currency')
            .eq('id', this.connectionId)
            .maybeSingle()
        const currency = connectionData?.currency?.toUpperCase() ?? 'USD'
        
        const { data: participantData } = await this.supabase
            .from('benchmark_participants')
            .select('industry_vertical, business_model, is_opted_in')
            .eq('connection_id', this.connectionId)
            .maybeSingle()

        if (!participantData?.is_opted_in) {
             return {
                comparisons: [], peerGroupSize: 0, industryVertical: 'N/A', revenueTier: 'N/A',
                summary: 'Please join the benchmarking network to view insights.', currency, userTier,
            } as BenchmarkInsights
        }

        const userMetrics = await this.metricsEngine.getMonthlyMetrics(month)
        const industryVertical = participantData.industry_vertical
        const calculatedRevenueTier = userMetrics.mrr > 10000 ? 'TIER_3' : 'TIER_2'
        
        const isPremium = userTier === 'pro' || userTier === 'business'
        
        // --- SIMULATION des données agrégées de pairs ---
        // (En production, ceci serait une requête BDD filtrée par industryVertical/calculatedRevenueTier si isPremium est true)
        const rawComparisons: any[] = [
            { 
                metric: 'Monthly Recurring Revenue (MRR)', 
                userValue: userMetrics.mrr, 
                peerMedian: 7500, 
                peerP25: 4000, 
                peerP75: 12000, 
                peerP90: 15000, 
                percentile: Math.min(100, Math.floor((userMetrics.mrr / 15000) * 100)),
                status: userMetrics.mrr > 12000 ? 'excellent' : 'above_average', 
                message: "Your MRR is strong, ranking above most of your peers in this segment."
            },
            { 
                metric: 'Revenue Churn Rate', 
                userValue: userMetrics.revenueChurnRate * 100,
                peerMedian: 5.0, 
                peerP25: 2.0, 
                peerP75: 8.0, 
                peerP90: 10.0,
                percentile: 20, 
                status: 'excellent', 
                message: "Your low revenue churn is a significant competitive advantage."
            },
        ]
        
        // 2. LOGIQUE DE FILTRAGE DES DONNÉES PAR TIER
        const comparisons: BenchmarkComparison[] = rawComparisons.map(c => ({
            metric: c.metric,
            userValue: c.userValue,
            peerMedian: c.peerMedian,
            // Rendre null si l'utilisateur n'est pas Premium
            peerP25: isPremium ? c.peerP25 : null, 
            peerP75: isPremium ? c.peerP75 : null,
            peerP90: isPremium ? c.peerP90 : null,
            percentile: isPremium ? c.percentile : null, 
            status: isPremium ? c.status : 'N/A', 
            message: isPremium ? c.message : 'Upgrade to Pro to see segmented data and actionable advice.',
        }))
        
        const peerGroupSize = isPremium ? 85 : 250
        const summary = isPremium 
            ? this.generateSummary(comparisons, peerGroupSize) 
            : `You are compared against ${peerGroupSize} companies. Upgrade for segmented analysis by industry and revenue.`


        return {
            comparisons,
            peerGroupSize: peerGroupSize,
            industryVertical: isPremium ? industryVertical : 'All Industries (Upgrade to segment)',
            revenueTier: isPremium ? calculatedRevenueTier : 'All Tiers (Upgrade to segment)',
            summary,
            currency,
            userTier,
        } as BenchmarkInsights
    }
    
    private generateSummary(comparisons: BenchmarkComparison[], peerCount: number): string {
        // ... (Logique de résumé non modifiée) ...
        const excellent = comparisons.filter(c => c.status === 'excellent').length
        const needsImprovement = comparisons.filter(c => c.status === 'needs_improvement').length

        if (excellent >= 2) {
            return `Félicitations ! Vous excellez dans ${excellent} métriques clés, vous plaçant dans le niveau supérieur de vos ${peerCount} pairs.`
        }
        if (needsImprovement >= 1) {
            const worstMetric = comparisons.find(c => c.status === 'needs_improvement')
            return `Vos métriques sont solides dans l'ensemble, mais votre ${worstMetric?.metric} est actuellement inférieur au 25e percentile pour votre segment. C'est votre priorité absolue.`
        }

        return `Vous performez bien dans l'ensemble. Par rapport à vos ${peerCount} pairs, vos résultats sont systématiquement moyens ou supérieurs à la moyenne.`
    }
}