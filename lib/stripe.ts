// lib/stripe.ts
import Stripe from 'stripe'
import { getStripeServerClient } from './server-clients'
/**
 * Get plan limits
 */
export function getPlanLimits(plan: string): { products: number; apiCalls: number } {
  const limits = {
    free: { products: 5, apiCalls: 100 },
    pro: { products: 999, apiCalls: 1000 },
    ultra: { products: 999, apiCalls: 10000 },
    mega: { products: 999, apiCalls: 50000 },
  }
  
  return limits[plan as keyof typeof limits] || limits.free
}
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripeServerClient() as any
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
}: {
  priceId: string
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
}) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      allow_promotion_codes: true,
    })

    return { session, error: null }
  } catch (error: any) {
    console.error('Error creating checkout session:', error)
    return { session: null, error: error.message }
  }
}

/**
 * Create a Stripe customer portal session
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return { session, error: null }
  } catch (error: any) {
    console.error('Error creating portal session:', error)
    return { session: null, error: error.message }
  }
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return { subscription, error: null }
  } catch (error: any) {
    console.error('Error fetching subscription:', error)
    return { subscription: null, error: error.message }
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId)
    return { subscription, error: null }
  } catch (error: any) {
    console.error('Error canceling subscription:', error)
    return { subscription: null, error: error.message }
  }
}

/**
 * Update subscription plan
 */
export async function updateSubscription({
  subscriptionId,
  newPriceId,
}: {
  subscriptionId: string
  newPriceId: string
}) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'always_invoice',
    })

    return { subscription: updatedSubscription, error: null }
  } catch (error: any) {
    console.error('Error updating subscription:', error)
    return { subscription: null, error: error.message }
  }
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string) {
  try {
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    })

    const customer = customers.data[0] || null
    return { customer, error: null }
  } catch (error: any) {
    console.error('Error fetching customer:', error)
    return { customer: null, error: error.message }
  }
}

/**
 * Create or get customer
 */
export async function createOrGetCustomer({
  email,
  name,
  metadata,
}: {
  email: string
  name?: string
  metadata?: Record<string, string>
}) {
  try {
    // Check if customer exists
    const { customer: existingCustomer } = await getCustomerByEmail(email)
    
    if (existingCustomer) {
      return { customer: existingCustomer, error: null }
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    })

    return { customer, error: null }
  } catch (error: any) {
    console.error('Error creating customer:', error)
    return { customer: null, error: error.message }
  }
}

/**
 * Create a usage record for metered billing
 */
export async function createUsageRecord({
  subscriptionItemId,
  quantity,
  timestamp,
}: {
  subscriptionItemId: string
  quantity: number
  timestamp?: number
}) {
  try {
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        action: 'increment',
      }
    )

    return { usageRecord, error: null }
  } catch (error: any) {
    console.error('Error creating usage record:', error)
    return { usageRecord: null, error: error.message }
  }
}

/**
 * Get invoice preview for subscription change
 */
export async function getUpcomingInvoice({
  customerId,
  subscriptionId,
  newPriceId,
}: {
  customerId: string
  subscriptionId: string
  newPriceId?: string
}) {
  try {
    const params: Stripe.InvoiceRetrieveUpcomingParams = {
      customer: customerId,
      subscription: subscriptionId,
    }

    if (newPriceId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      params.subscription_items = [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ]
    }

    const invoice = await stripe.invoices.retrieveUpcoming(params)
    return { invoice, error: null }
  } catch (error: any) {
    console.error('Error fetching upcoming invoice:', error)
    return { invoice: null, error: error.message }
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event | null {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret)
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message)
    return null
  }
}

/**
 * Price mapping helper
 */
export const STRIPE_PRICES = {
  free: null,
  pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
  ultra: process.env.STRIPE_PRICE_ULTRA_MONTHLY,
  mega: process.env.STRIPE_PRICE_MEGA_MONTHLY,
} as const

export type StripePlan = keyof typeof STRIPE_PRICES

/**
 * Get price ID by plan name
 */
export function getPriceIdByPlan(plan: string): string | null {
  return STRIPE_PRICES[plan as StripePlan] || null
}

/**
 * Get plan name by price ID
 */
export function getPlanByPriceId(priceId: string): string {
  const entry = Object.entries(STRIPE_PRICES).find(([_, id]) => id === priceId)
  return entry ? entry[0] : 'free'
}

/**
 * Format Stripe amount (cents to dollars)
 */
export function formatStripeAmount(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

/**
 * Get subscription status display text
 */
export function getSubscriptionStatusText(status: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'Active',
    past_due: 'Past Due',
    unpaid: 'Unpaid',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
    incomplete_expired: 'Expired',
    trialing: 'Trial',
    paused: 'Paused',
  }

  return statusMap[status] || status
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(status: Stripe.Subscription.Status): boolean {
  return ['active', 'trialing'].includes(status)
}

/**
 * Calculate proration cost
 */
export async function calculateProrationCost({
  customerId,
  subscriptionId,
  newPriceId,
}: {
  customerId: string
  subscriptionId: string
  newPriceId: string
}): Promise<{ amount: number; currency: string; error: string | null }> {
  const { invoice, error } = await getUpcomingInvoice({
    customerId,
    subscriptionId,
    newPriceId,
  })

  if (error || !invoice) {
    return { amount: 0, currency: 'USD', error: error || 'Failed to fetch invoice' }
  }

  return {
    amount: invoice.amount_due,
    currency: invoice.currency,
    error: null,
  }
}
