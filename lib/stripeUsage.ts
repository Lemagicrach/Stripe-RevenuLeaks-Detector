// lib/stripeUsage.ts
import { getStripeServerClient, getSupabaseAdminClient } from './server-clients'

// quantity = how many units of usage to add (default 1)
export async function reportScenarioUsageForUser(userId: string, quantity = 1) {
  const supabaseAdmin = getSupabaseAdminClient()
  const stripe = getStripeServerClient()

  // 1) Get the user's subscription id from user_profiles
  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select('stripe_subscription_id')
    .eq('user_id', userId)
    .single()

  if (error || !profile?.stripe_subscription_id) {
    console.warn('No subscription for user', userId)
    return
  }

  const subscriptionId = profile.stripe_subscription_id

  // 2) Retrieve subscription to find the usage-based item
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const usagePriceIds = [
    process.env.STRIPE_REV_PILOT_PRO_PRICE_ID!,
    process.env.STRIPE_REV_PILOT_BUSINESS_PRICE_ID!,
  ]

  const usageItem = subscription.items.data.find((item) =>
    usagePriceIds.includes(item.price.id)
  )

  if (!usageItem) {
    console.warn('No usage-based item on subscription', subscriptionId)
    return
  }

  // 3) Create usage record
  await stripe.subscriptionItems.createUsageRecord(usageItem.id, {
    quantity,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment', // add to current total
  })
}
