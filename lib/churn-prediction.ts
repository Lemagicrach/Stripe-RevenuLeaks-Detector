import Stripe from 'stripe'
import { getOpenAIClient, getSupabaseAdminClient } from './server-clients'

export interface ChurnRiskFactor {
  factor: string
  weight: number
  description: string
}

export interface ChurnPrediction {
  customerId: string
  subscriptionId: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  churnProbability: number
  predictedChurnDate: Date | null
  mrrAtRisk: number
  ltvAtRisk: number
  riskFactors: ChurnRiskFactor[]
  signals: Record<string, any>
  recommendedActions: Array<{
    action: string
    priority: number
    description: string
  }>
  generatedEmail: {
    subject: string
    body: string
    tone: string
  }
}

export class ChurnPredictionEngine {
  private stripe: Stripe
  private connectionId: string

  constructor(stripe: Stripe, connectionId: string) {
    this.stripe = stripe
    this.connectionId = connectionId
  }

  /**
   * Analyze all active subscriptions for churn risk
   */
  async analyzeAllSubscriptions(): Promise<ChurnPrediction[]> {
    const subscriptions = await this.fetchActiveSubscriptions()
    const predictions: ChurnPrediction[] = []

    for (const subscription of subscriptions) {
      try {
        const prediction = await this.predictChurnRisk(subscription)
        predictions.push(prediction)

        // Save to database
        await this.savePrediction(prediction)
      } catch (error) {
        console.error(`Error predicting churn for ${subscription.id}:`, error)
      }
    }

    return predictions
  }

  /**
   * Predict churn risk for a single subscription
   */
  async predictChurnRisk(subscription: Stripe.Subscription): Promise<ChurnPrediction> {
    const customerId = subscription.customer as string
    const customer = await this.stripe.customers.retrieve(customerId) as Stripe.Customer

    // Extract behavioral signals
    const signals = await this.extractSignals(subscription, customer)

    // Calculate risk factors
    const riskFactors = this.calculateRiskFactors(signals)

    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(riskFactors)
    const riskLevel = this.getRiskLevel(riskScore)
    const churnProbability = this.calculateChurnProbability(riskScore)

    // Predict churn date
    const predictedChurnDate = this.predictChurnDate(riskScore, signals)

    // Calculate financial impact
    const mrrAtRisk = this.calculateMRR(subscription)
    const ltvAtRisk = mrrAtRisk * 12 // Simplified LTV

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(riskFactors, signals)

    // Generate personalized email
    const generatedEmail = await this.generateEmail(
      customer,
      subscription,
      riskFactors,
      recommendedActions
    )

    return {
      customerId,
      subscriptionId: subscription.id,
      riskScore,
      riskLevel,
      churnProbability,
      predictedChurnDate,
      mrrAtRisk,
      ltvAtRisk,
      riskFactors,
      signals,
      recommendedActions,
      generatedEmail,
    }
  }

  /**
   * Extract behavioral signals from subscription and customer data
   */
  private async extractSignals(
    subscription: Stripe.Subscription,
    customer: Stripe.Customer
  ): Promise<Record<string, any>> {
    const now = new Date()
    const subscriptionStart = new Date(subscription.created * 1000)
    const subscriptionAgeDays = Math.floor(
      (now.getTime() - subscriptionStart.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Check for failed payments in last 30 days
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
    const charges = await this.stripe.charges.list({
      customer: customer.id,
      created: { gte: thirtyDaysAgo },
      limit: 100,
    })

    const failedPayments = charges.data.filter((c) => c.status === 'failed')
    const failedPaymentsCount = failedPayments.length

    // Get most recent failed payment
    const lastFailedPayment = failedPayments[0]
    const daysSinceLastFailure = lastFailedPayment
      ? Math.floor((Date.now() / 1000 - lastFailedPayment.created) / (24 * 60 * 60))
      : null

    // Check subscription status
    const isTrialing = subscription.status === 'trialing'
    const isPastDue = subscription.status === 'past_due'
    const hasDiscount = subscription.discount !== null

    // Check for recent plan changes
    const invoices = await this.stripe.invoices.list({
      customer: customer.id,
      limit: 10,
    })

    const planChanges = invoices.data.filter((inv) =>
      inv.lines.data.some((line) => line.description?.includes('Change'))
    ).length

    // Payment method age
    const defaultPaymentMethod = subscription.default_payment_method
    let paymentMethodAgeDays = null
    if (defaultPaymentMethod) {
      const pm = await this.stripe.paymentMethods.retrieve(
        defaultPaymentMethod as string
      )
      if (pm.created) {
        paymentMethodAgeDays = Math.floor(
          (Date.now() / 1000 - pm.created) / (24 * 60 * 60)
        )
      }
    }

    // Calculate MRR
    const mrr = this.calculateMRR(subscription)

    // Check for usage decline (if usage-based billing)
    // This would require additional API calls to usage records
    // For now, we'll use a placeholder
    const usageTrend = 1.0 // 1.0 = stable, <1.0 = declining, >1.0 = growing

    return {
      subscription_age_days: subscriptionAgeDays,
      failed_payments_30d: failedPaymentsCount,
      days_since_last_failure: daysSinceLastFailure,
      is_trialing: isTrialing,
      is_past_due: isPastDue,
      has_discount: hasDiscount,
      plan_changes_90d: planChanges,
      payment_method_age_days: paymentMethodAgeDays,
      mrr,
      usage_trend: usageTrend,
      subscription_status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
    }
  }

  /**
   * Calculate risk factors based on signals
   */
  private calculateRiskFactors(signals: Record<string, any>): ChurnRiskFactor[] {
    const factors: ChurnRiskFactor[] = []

    // Payment failures
    if (signals.failed_payments_30d > 0) {
      const weight = Math.min(signals.failed_payments_30d * 0.15, 0.40)
      factors.push({
        factor: 'payment_failure',
        weight,
        description: `${signals.failed_payments_30d} failed payment(s) in last 30 days`,
      })
    }

    // Recent payment failure
    if (signals.days_since_last_failure !== null && signals.days_since_last_failure < 7) {
      factors.push({
        factor: 'recent_payment_failure',
        weight: 0.25,
        description: `Payment failed ${signals.days_since_last_failure} days ago`,
      })
    }

    // Past due status
    if (signals.is_past_due) {
      factors.push({
        factor: 'past_due',
        weight: 0.35,
        description: 'Subscription is past due',
      })
    }

    // Cancel at period end
    if (signals.cancel_at_period_end) {
      factors.push({
        factor: 'cancel_scheduled',
        weight: 0.90,
        description: 'Subscription scheduled to cancel',
      })
    }

    // Usage decline
    if (signals.usage_trend < 0.7) {
      const declinePercent = Math.round((1 - signals.usage_trend) * 100)
      factors.push({
        factor: 'usage_decline',
        weight: 0.20,
        description: `Usage declined ${declinePercent}% this month`,
      })
    }

    // Frequent plan changes (instability)
    if (signals.plan_changes_90d >= 2) {
      factors.push({
        factor: 'plan_instability',
        weight: 0.15,
        description: `${signals.plan_changes_90d} plan changes in 90 days`,
      })
    }

    // Very new subscription (higher churn risk)
    if (signals.subscription_age_days < 30) {
      factors.push({
        factor: 'new_customer',
        weight: 0.10,
        description: 'New customer (less than 30 days)',
      })
    }

    // Old payment method (may be expired)
    if (signals.payment_method_age_days && signals.payment_method_age_days > 365) {
      factors.push({
        factor: 'old_payment_method',
        weight: 0.10,
        description: 'Payment method over 1 year old',
      })
    }

    return factors
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(riskFactors: ChurnRiskFactor[]): number {
    if (riskFactors.length === 0) return 10 // Base risk

    // Sum weights with diminishing returns
    let totalWeight = 0
    for (const factor of riskFactors) {
      totalWeight += factor.weight * (1 - totalWeight * 0.3)
    }

    // Convert to 0-100 scale with base risk
    const score = Math.min(10 + totalWeight * 90, 100)
    return Math.round(score * 100) / 100
  }

  /**
   * Determine risk level from score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 85) return 'critical'
    if (score >= 70) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }

  /**
   * Calculate churn probability (0-100%)
   */
  private calculateChurnProbability(riskScore: number): number {
    // Use sigmoid function for more realistic probability
    const probability = 100 / (1 + Math.exp(-0.1 * (riskScore - 50)))
    return Math.round(probability * 100) / 100
  }

  /**
   * Predict when customer might churn
   */
  private predictChurnDate(
    riskScore: number,
    signals: Record<string, any>
  ): Date | null {
    if (riskScore < 40) return null // Low risk, no prediction

    // Base days until churn on risk score
    let daysUntilChurn = Math.max(7, Math.round((100 - riskScore) * 0.5))

    // Adjust based on specific signals
    if (signals.is_past_due) {
      daysUntilChurn = Math.min(daysUntilChurn, 7)
    }
    if (signals.cancel_at_period_end) {
      daysUntilChurn = Math.min(daysUntilChurn, 3)
    }

    const predictedDate = new Date()
    predictedDate.setDate(predictedDate.getDate() + daysUntilChurn)
    return predictedDate
  }

  /**
   * Generate recommended actions based on risk factors
   */
  private generateRecommendedActions(
    riskFactors: ChurnRiskFactor[],
    signals: Record<string, any>
  ): Array<{ action: string; priority: number; description: string }> {
    const actions: Array<{ action: string; priority: number; description: string }> = []

    const hasPaymentIssue = riskFactors.some(
      (f) => f.factor === 'payment_failure' || f.factor === 'past_due'
    )
    const hasUsageIssue = riskFactors.some((f) => f.factor === 'usage_decline')
    const isScheduledCancel = riskFactors.some((f) => f.factor === 'cancel_scheduled')

    if (hasPaymentIssue) {
      actions.push({
        action: 'update_payment_method',
        priority: 1,
        description: 'Contact customer to update payment method',
      })
      actions.push({
        action: 'payment_retry',
        priority: 2,
        description: 'Retry failed payment with updated card',
      })
    }

    if (isScheduledCancel) {
      actions.push({
        action: 'retention_offer',
        priority: 1,
        description: 'Offer 25% discount for next 3 months',
      })
      actions.push({
        action: 'exit_interview',
        priority: 2,
        description: 'Schedule call to understand cancellation reason',
      })
    }

    if (hasUsageIssue) {
      actions.push({
        action: 'onboarding_review',
        priority: 2,
        description: 'Offer onboarding session to improve product adoption',
      })
      actions.push({
        action: 'feature_education',
        priority: 3,
        description: 'Send guide on underutilized features',
      })
    }

    if (signals.subscription_age_days < 30) {
      actions.push({
        action: 'welcome_call',
        priority: 2,
        description: 'Schedule welcome call to ensure successful onboarding',
      })
    }

    // Default action if no specific issues
    if (actions.length === 0) {
      actions.push({
        action: 'check_in',
        priority: 3,
        description: 'Send check-in email to gauge satisfaction',
      })
    }

    return actions.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Generate personalized retention email using AI
   */
  private async generateEmail(
    customer: Stripe.Customer,
    subscription: Stripe.Subscription,
    riskFactors: ChurnRiskFactor[],
    recommendedActions: Array<{ action: string; priority: number; description: string }>
  ): Promise<{ subject: string; body: string; tone: string }> {
    const customerName = customer.name || customer.email || 'there'
    const mrr = this.calculateMRR(subscription)

    // Determine tone based on risk level and factors
    const hasPaymentIssue = riskFactors.some(
      (f) => f.factor === 'payment_failure' || f.factor === 'past_due'
    )
    const isScheduledCancel = riskFactors.some((f) => f.factor === 'cancel_scheduled')

    let tone = 'professional'
    if (isScheduledCancel) tone = 'urgent'
    else if (hasPaymentIssue) tone = 'helpful'
    else tone = 'friendly'

    // Build context for AI
    const context = {
      customerName,
      riskFactors: riskFactors.map((f) => f.description),
      topAction: recommendedActions[0],
      hasPaymentIssue,
      isScheduledCancel,
      tone,
    }

    try {
      const openai = getOpenAIClient()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are a customer success specialist writing retention emails for a SaaS company. Write personalized, empathetic emails that address customer concerns and offer solutions. Keep emails concise (under 150 words) and actionable.`,
          },
          {
            role: 'user',
            content: `Generate a ${tone} retention email for ${customerName}.

Risk factors: ${context.riskFactors.join(', ')}
Recommended action: ${context.topAction.description}

${hasPaymentIssue ? 'Focus on helping them resolve the payment issue.' : ''}
${isScheduledCancel ? 'They scheduled cancellation - make a compelling retention offer.' : ''}

Return JSON with "subject" and "body" fields.`,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })

      const response = JSON.parse(completion.choices[0].message.content || '{}')
      return {
        subject: response.subject || 'We noticed you might need help',
        body: response.body || 'Hi there, we wanted to reach out...',
        tone,
      }
    } catch (error) {
      console.error('Error generating email:', error)
      // Fallback to template
      return this.generateFallbackEmail(customerName, context)
    }
  }

  /**
   * Fallback email template if AI fails
   */
  private generateFallbackEmail(
    customerName: string,
    context: any
  ): { subject: string; body: string; tone: string } {
    if (context.isScheduledCancel) {
      return {
        subject: "We'd love to keep you as a customer",
        body: `Hi ${customerName},\n\nWe noticed you've scheduled your subscription to cancel. We'd love to understand what led to this decision and see if there's anything we can do to improve your experience.\n\nAs a valued customer, we'd like to offer you 25% off your next 3 months if you decide to stay.\n\nCould we schedule a quick call to discuss?\n\nBest regards,\nThe Team`,
        tone: 'urgent',
      }
    }

    if (context.hasPaymentIssue) {
      return {
        subject: 'Quick help needed with your payment',
        body: `Hi ${customerName},\n\nWe noticed there was an issue processing your recent payment. This can happen for various reasons - expired card, insufficient funds, or bank security checks.\n\nCould you take a moment to update your payment method? This will ensure uninterrupted access to your account.\n\nIf you need any help, just reply to this email.\n\nBest regards,\nThe Team`,
        tone: 'helpful',
      }
    }

    return {
      subject: 'How are things going?',
      body: `Hi ${customerName},\n\nWe wanted to check in and see how things are going with your account. Are you getting the value you expected?\n\nIf there's anything we can do to improve your experience, please don't hesitate to reach out. We're here to help!\n\nBest regards,\nThe Team`,
      tone: 'friendly',
    }
  }

  /**
   * Calculate MRR from subscription
   */
  private calculateMRR(subscription: Stripe.Subscription): number {
    const item = subscription.items.data[0]
    if (!item?.price) return 0

    const price = item.price
    const quantity = item.quantity || 1
    const unitAmount = price.unit_amount || 0

    let monthlyAmount = (unitAmount / 100) * quantity

    if (price.recurring?.interval === 'year') {
      monthlyAmount = monthlyAmount / 12
    } else if (price.recurring?.interval === 'week') {
      monthlyAmount = monthlyAmount * 4.33
    }

    return Math.round(monthlyAmount * 100) / 100
  }

  /**
   * Fetch active subscriptions
   */
  private async fetchActiveSubscriptions(): Promise<Stripe.Subscription[]> {
    const subs: Stripe.Subscription[] = []
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const response = await this.stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        starting_after: startingAfter,
      })

      subs.push(...response.data)
      hasMore = response.has_more
      startingAfter = response.data[response.data.length - 1]?.id
    }

    return subs
  }

  /**
   * Save prediction to database
   */
  private async savePrediction(prediction: ChurnPrediction): Promise<void> {
    const supabase = getSupabaseAdminClient()
    await supabase.from('churn_predictions').insert({
      stripe_connection_id: this.connectionId,
      customer_id: prediction.customerId,
      subscription_id: prediction.subscriptionId,
      risk_score: prediction.riskScore,
      risk_level: prediction.riskLevel,
      churn_probability: prediction.churnProbability,
      predicted_churn_date: prediction.predictedChurnDate?.toISOString(),
      mrr_at_risk: prediction.mrrAtRisk,
      ltv_at_risk: prediction.ltvAtRisk,
      risk_factors: prediction.riskFactors,
      signals: prediction.signals,
      recommended_actions: prediction.recommendedActions,
      generated_email_subject: prediction.generatedEmail.subject,
      generated_email_body: prediction.generatedEmail.body,
      email_tone: prediction.generatedEmail.tone,
      status: 'pending',
      model_version: 'v1.0',
      confidence_score: prediction.riskScore > 70 ? 85 : 70,
    })
  }
}
