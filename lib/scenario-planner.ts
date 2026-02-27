import { StripeMetricsEngine } from './stripe-metrics'
import { getSupabaseAdminClient } from './server-clients'

export interface ScenarioParameters {
  // Churn reduction
  churnRateReduction?: number // Percentage points to reduce churn

  // Price increase
  priceIncreasePercent?: number
  expectedChurnPercent?: number // Expected churn from price increase

  // Growth acceleration
  newCustomersPerMonth?: number
  avgCustomerValue?: number

  // Retention improvement
  retentionImprovementPercent?: number

  // Upsell
  customersToUpsellPercent?: number
  upsellValueIncreasePercent?: number

  // General
  timeframeMonths: number
}

export interface MonthlyProjection {
  month: number
  mrr: number
  arr: number
  customers: number
  newCustomers: number
  churnedCustomers: number
  arpu: number
}

export interface ScenarioResult {
  scenarioId?: string
  name: string
  description: string
  scenarioType: string
  baseMRR: number
  baseCustomerCount: number
  baseChurnRate: number
  baseARPU: number
  parameters: ScenarioParameters
  projections: MonthlyProjection[]
  mrrImpact12m: number
  arrImpact12m: number
  customerImpact12m: number
  revenueImpactTotal: number
  insights: string[]
}

export class ScenarioPlannerEngine {
  private connectionId: string

  constructor(connectionId: string) {
    this.connectionId = connectionId
  }

  /**
   * Get latest metrics from database
   */
  private async getLatestMetrics() {
    const supabase = getSupabaseAdminClient()
    const { data: snapshot, error } = await supabase
      .from('metrics_snapshots')
      .select('*')
      .eq('stripe_connection_id', this.connectionId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !snapshot) {
      throw new Error('No metrics data available. Please sync your Stripe data first.')
    }

    return snapshot
  }

  /**
   * Create and calculate a new scenario
   */
  async createScenario(
    name: string,
    scenarioType: string,
    parameters: ScenarioParameters,
    description?: string
  ): Promise<ScenarioResult> {
    // Get current baseline metrics from database
    const metrics = await this.getLatestMetrics()
    const baseMRR = metrics.mrr
    const baseARPU = metrics.arpu
    const customerChurnRate = metrics.customer_churn_rate
    const baseCustomerCount = metrics.total_customers

    // Calculate projections based on scenario type
    let projections: MonthlyProjection[]

    switch (scenarioType) {
      case 'churn_reduction':
        projections = this.projectChurnReduction(
          baseMRR,
          baseCustomerCount,
          customerChurnRate,
          baseARPU,
          parameters
        )
        break
      case 'price_increase':
        projections = this.projectPriceIncrease(
          baseMRR,
          baseCustomerCount,
          customerChurnRate,
          baseARPU,
          parameters
        )
        break
      case 'growth_acceleration':
        projections = this.projectGrowthAcceleration(
          baseMRR,
          baseCustomerCount,
          customerChurnRate,
          baseARPU,
          parameters
        )
        break
      case 'retention_improvement':
        projections = this.projectRetentionImprovement(
          baseMRR,
          baseCustomerCount,
          customerChurnRate,
          baseARPU,
          parameters
        )
        break
      case 'upsell':
        projections = this.projectUpsell(
          baseMRR,
          baseCustomerCount,
          customerChurnRate,
          baseARPU,
          parameters
        )
        break
      default:
        throw new Error(`Unknown scenario type: ${scenarioType}`)
    }

    // Calculate impacts
    const finalProjection = projections[projections.length - 1]
    const mrrImpact12m = finalProjection.mrr - baseMRR
    const arrImpact12m = mrrImpact12m * 12
    const customerImpact12m = finalProjection.customers - baseCustomerCount

    // Calculate total revenue impact (sum of all monthly MRR)
    const revenueImpactTotal = projections.reduce(
      (sum, p) => sum + (p.mrr - baseMRR),
      0
    )

    // Generate insights
    const insights = this.generateInsights(
      scenarioType,
      parameters,
      baseMRR,
      baseCustomerCount,
      mrrImpact12m,
      customerImpact12m,
      revenueImpactTotal
    )

    const result: ScenarioResult = {
      name,
      description: description || '',
      scenarioType,
      baseMRR,
      baseCustomerCount,
      baseChurnRate: customerChurnRate,
      baseARPU,
      parameters,
      projections,
      mrrImpact12m,
      arrImpact12m,
      customerImpact12m,
      revenueImpactTotal,
      insights,
    }

    // Save to database
    await this.saveScenario(result)

    return result
  }

  /**
   * Project churn reduction scenario
   */
  private projectChurnReduction(
    baseMRR: number,
    baseCustomers: number,
    baseChurnRate: number,
    baseARPU: number,
    params: ScenarioParameters
  ): MonthlyProjection[] {
    const projections: MonthlyProjection[] = []
    const newChurnRate = Math.max(0, baseChurnRate - (params.churnRateReduction || 0))

    let currentMRR = baseMRR
    let currentCustomers = baseCustomers

    for (let month = 1; month <= params.timeframeMonths; month++) {
      // Calculate churned customers with new rate
      const churnedCustomers = Math.round(currentCustomers * (newChurnRate / 100))
      const retainedCustomers = currentCustomers - churnedCustomers

      // Assume some new customer acquisition to maintain baseline
      const newCustomers = Math.round(baseCustomers * 0.02) // 2% growth

      currentCustomers = retainedCustomers + newCustomers
      currentMRR = currentCustomers * baseARPU

      projections.push({
        month,
        mrr: Math.round(currentMRR * 100) / 100,
        arr: Math.round(currentMRR * 12 * 100) / 100,
        customers: currentCustomers,
        newCustomers,
        churnedCustomers,
        arpu: baseARPU,
      })
    }

    return projections
  }

  /**
   * Project price increase scenario
   */
  private projectPriceIncrease(
    baseMRR: number,
    baseCustomers: number,
    baseChurnRate: number,
    baseARPU: number,
    params: ScenarioParameters
  ): MonthlyProjection[] {
    const projections: MonthlyProjection[] = []
    const priceMultiplier = 1 + (params.priceIncreasePercent || 0) / 100
    const newARPU = baseARPU * priceMultiplier

    // One-time churn from price increase
    const priceChurnCustomers = Math.round(
      baseCustomers * (params.expectedChurnPercent || 0) / 100
    )

    let currentCustomers = baseCustomers - priceChurnCustomers
    let currentMRR = currentCustomers * newARPU

    for (let month = 1; month <= params.timeframeMonths; month++) {
      // Normal churn after initial price increase
      const churnedCustomers = Math.round(currentCustomers * (baseChurnRate / 100))
      const newCustomers = Math.round(baseCustomers * 0.02) // 2% growth

      currentCustomers = currentCustomers - churnedCustomers + newCustomers
      currentMRR = currentCustomers * newARPU

      projections.push({
        month,
        mrr: Math.round(currentMRR * 100) / 100,
        arr: Math.round(currentMRR * 12 * 100) / 100,
        customers: currentCustomers,
        newCustomers,
        churnedCustomers: month === 1 ? churnedCustomers + priceChurnCustomers : churnedCustomers,
        arpu: newARPU,
      })
    }

    return projections
  }

  /**
   * Project growth acceleration scenario
   */
  private projectGrowthAcceleration(
    baseMRR: number,
    baseCustomers: number,
    baseChurnRate: number,
    baseARPU: number,
    params: ScenarioParameters
  ): MonthlyProjection[] {
    const projections: MonthlyProjection[] = []
    const newCustomersPerMonth = params.newCustomersPerMonth || 0
    const avgCustomerValue = params.avgCustomerValue || baseARPU

    let currentMRR = baseMRR
    let currentCustomers = baseCustomers

    for (let month = 1; month <= params.timeframeMonths; month++) {
      // Churn
      const churnedCustomers = Math.round(currentCustomers * (baseChurnRate / 100))

      // Add new customers
      currentCustomers = currentCustomers - churnedCustomers + newCustomersPerMonth
      currentMRR = currentCustomers * baseARPU + (newCustomersPerMonth * month * avgCustomerValue)

      projections.push({
        month,
        mrr: Math.round(currentMRR * 100) / 100,
        arr: Math.round(currentMRR * 12 * 100) / 100,
        customers: currentCustomers,
        newCustomers: newCustomersPerMonth,
        churnedCustomers,
        arpu: currentMRR / currentCustomers,
      })
    }

    return projections
  }

  /**
   * Project retention improvement scenario
   */
  private projectRetentionImprovement(
    baseMRR: number,
    baseCustomers: number,
    baseChurnRate: number,
    baseARPU: number,
    params: ScenarioParameters
  ): MonthlyProjection[] {
    const retentionImprovement = params.retentionImprovementPercent || 0
    const effectiveChurnReduction = baseChurnRate * (retentionImprovement / 100)

    return this.projectChurnReduction(
      baseMRR,
      baseCustomers,
      baseChurnRate,
      baseARPU,
      { ...params, churnRateReduction: effectiveChurnReduction }
    )
  }

  /**
   * Project upsell scenario
   */
  private projectUpsell(
    baseMRR: number,
    baseCustomers: number,
    baseChurnRate: number,
    baseARPU: number,
    params: ScenarioParameters
  ): MonthlyProjection[] {
    const projections: MonthlyProjection[] = []
    const customersToUpsell = Math.round(
      baseCustomers * (params.customersToUpsellPercent || 0) / 100
    )
    const upsellValueIncrease = (params.upsellValueIncreasePercent || 0) / 100
    const upsellMRRIncrease = customersToUpsell * baseARPU * upsellValueIncrease

    let currentMRR = baseMRR
    let currentCustomers = baseCustomers

    for (let month = 1; month <= params.timeframeMonths; month++) {
      // Churn
      const churnedCustomers = Math.round(currentCustomers * (baseChurnRate / 100))
      const newCustomers = Math.round(baseCustomers * 0.02) // 2% growth

      currentCustomers = currentCustomers - churnedCustomers + newCustomers

      // Add upsell revenue (one-time boost in month 1, then maintained)
      if (month === 1) {
        currentMRR += upsellMRRIncrease
      }

      // Account for churn on total MRR
      currentMRR = currentMRR * (1 - baseChurnRate / 100) + (newCustomers * baseARPU)

      projections.push({
        month,
        mrr: Math.round(currentMRR * 100) / 100,
        arr: Math.round(currentMRR * 12 * 100) / 100,
        customers: currentCustomers,
        newCustomers,
        churnedCustomers,
        arpu: currentMRR / currentCustomers,
      })
    }

    return projections
  }

  /**
   * Generate insights for scenario
   */
  private generateInsights(
    scenarioType: string,
    params: ScenarioParameters,
    baseMRR: number,
    baseCustomers: number,
    mrrImpact: number,
    customerImpact: number,
    totalRevenue: number
  ): string[] {
    const insights: string[] = []

    if (scenarioType === 'churn_reduction') {
      const reduction = params.churnRateReduction || 0
      insights.push(
        `Reducing churn by ${reduction}% would add $${Math.round(mrrImpact).toLocaleString()} MRR in 12 months`
      )

      const equivalentCustomers = Math.round(mrrImpact / (baseMRR / baseCustomers))
      insights.push(
        `This is equivalent to acquiring ${equivalentCustomers} new customers`
      )

      const roi = Math.round(mrrImpact / reduction)
      insights.push(
        `ROI: Every 1% churn reduction = $${roi.toLocaleString()} MRR`
      )
    } else if (scenarioType === 'price_increase') {
      const increase = params.priceIncreasePercent || 0
      const churn = params.expectedChurnPercent || 0

      insights.push(
        `A ${increase}% price increase would add $${Math.round(mrrImpact).toLocaleString()} MRR despite ${churn}% customer loss`
      )

      insights.push(
        `Total additional revenue over 12 months: $${Math.round(totalRevenue).toLocaleString()}`
      )

      if (mrrImpact > 0) {
        insights.push(
          `Net positive: Price increase more than compensates for churn`
        )
      } else {
        insights.push(
          `Net negative: Customer loss outweighs price increase benefit`
        )
      }
    } else if (scenarioType === 'growth_acceleration') {
      const newCustomers = params.newCustomersPerMonth || 0

      insights.push(
        `Adding ${newCustomers} customers/month would grow MRR by $${Math.round(mrrImpact).toLocaleString()} in 12 months`
      )

      insights.push(
        `Total customer growth: ${customerImpact} customers (+${Math.round((customerImpact / baseCustomers) * 100)}%)`
      )

      const avgRevPerCustomer = mrrImpact / customerImpact
      insights.push(
        `Average revenue per new customer: $${Math.round(avgRevPerCustomer).toLocaleString()}/month`
      )
    } else if (scenarioType === 'upsell') {
      const upsellPercent = params.customersToUpsellPercent || 0
      const valueIncrease = params.upsellValueIncreasePercent || 0

      insights.push(
        `Upselling ${upsellPercent}% of customers by ${valueIncrease}% would add $${Math.round(mrrImpact).toLocaleString()} MRR`
      )

      const customersUpsold = Math.round(baseCustomers * upsellPercent / 100)
      insights.push(
        `Target: ${customersUpsold} customers to upsell`
      )

      insights.push(
        `Total additional revenue over 12 months: $${Math.round(totalRevenue).toLocaleString()}`
      )
    }

    return insights
  }

  /**
   * Save scenario to database
   */
  private async saveScenario(result: ScenarioResult): Promise<void> {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('revenue_scenarios')
      .insert({
        stripe_connection_id: this.connectionId,
        name: result.name,
        description: result.description,
        scenario_type: result.scenarioType,
        base_mrr: result.baseMRR,
        base_customer_count: result.baseCustomerCount,
        base_churn_rate: result.baseChurnRate,
        base_arpu: result.baseARPU,
        parameters: result.parameters,
        projected_metrics: this.formatProjectionsForDB(result.projections),
        mrr_impact_12m: result.mrrImpact12m,
        arr_impact_12m: result.arrImpact12m,
        customer_impact_12m: result.customerImpact12m,
        revenue_impact_total: result.revenueImpactTotal,
        insights: result.insights,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving scenario:', error)
      throw error
    }

    result.scenarioId = data.id
  }

  /**
   * Format projections for database storage
   */
  private formatProjectionsForDB(projections: MonthlyProjection[]): any {
    const formatted: any = {}

    for (const proj of projections) {
      if ([1, 3, 6, 12].includes(proj.month)) {
        formatted[`month_${proj.month}`] = {
          mrr: proj.mrr,
          arr: proj.arr,
          customers: proj.customers,
        }
      }
    }

    return formatted
  }

  /**
   * Get saved scenarios
   */
  async getSavedScenarios(): Promise<ScenarioResult[]> {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('revenue_scenarios')
      .select('*')
      .eq('stripe_connection_id', this.connectionId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching scenarios:', error)
      return []
    }

    return data.map((s: any) => this.formatScenarioFromDB(s))
  }

  /**
   * Format scenario from database
   */
  private formatScenarioFromDB(dbScenario: any): ScenarioResult {
    return {
      scenarioId: dbScenario.id,
      name: dbScenario.name,
      description: dbScenario.description,
      scenarioType: dbScenario.scenario_type,
      baseMRR: dbScenario.base_mrr,
      baseCustomerCount: dbScenario.base_customer_count,
      baseChurnRate: dbScenario.base_churn_rate,
      baseARPU: dbScenario.base_arpu,
      parameters: dbScenario.parameters,
      projections: this.reconstructProjections(dbScenario.projected_metrics),
      mrrImpact12m: dbScenario.mrr_impact_12m,
      arrImpact12m: dbScenario.arr_impact_12m,
      customerImpact12m: dbScenario.customer_impact_12m,
      revenueImpactTotal: dbScenario.revenue_impact_total,
      insights: dbScenario.insights,
    }
  }

  /**
   * Reconstruct projections from database format
   */
  private reconstructProjections(projectedMetrics: any): MonthlyProjection[] {
    const projections: MonthlyProjection[] = []

    for (const [key, value] of Object.entries(projectedMetrics)) {
      const month = parseInt(key.replace('month_', ''))
      const metrics = value as any

      projections.push({
        month,
        mrr: metrics.mrr,
        arr: metrics.arr,
        customers: metrics.customers,
        newCustomers: 0, // Not stored in summary
        churnedCustomers: 0, // Not stored in summary
        arpu: metrics.mrr / metrics.customers,
      })
    }

    return projections.sort((a, b) => a.month - b.month)
  }

  /**
   * Compare multiple scenarios
   */
  async compareScenarios(scenarioIds: string[]): Promise<any> {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('revenue_scenarios')
      .select('*')
      .in('id', scenarioIds)

    if (error || !data) {
      throw new Error('Failed to fetch scenarios for comparison')
    }

    const scenarios = data.map((s: any) => this.formatScenarioFromDB(s))

    // Find best performing scenario
    const bestScenario = scenarios.reduce((best: ScenarioResult, current: ScenarioResult) =>
      current.mrrImpact12m > best.mrrImpact12m ? current : best
    )

    // Generate comparison insights
    const insights = []
    for (const scenario of scenarios) {
      if (scenario.scenarioId !== bestScenario.scenarioId) {
        const diff = bestScenario.mrrImpact12m - scenario.mrrImpact12m
        insights.push({
          message: `${bestScenario.name} outperforms ${scenario.name} by $${Math.round(diff).toLocaleString()} MRR`,
        })
      }
    }

    return {
      scenarios,
      bestScenarioId: bestScenario.scenarioId,
      insights,
    }
  }
}
