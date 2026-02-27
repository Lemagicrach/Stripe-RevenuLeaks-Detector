export interface PricingTier {
  name: string
  displayName: string
  description: string
  price: number
  includedVolume: number
  includedInsights: number
  overageRatePer10k: number
  overageRatePerInsight: number
  features: string[]
  popular?: boolean
  cta: string
  planId: string
  showOnHome?: boolean
}

export const pricingTiers: PricingTier[] = [
  {
    name: 'starter',
    displayName: 'Starter',
    description: 'Perfect for early-stage startups',
    price: 0,
    includedVolume: 10000,
    includedInsights: 5,
    overageRatePer10k: 0,
    overageRatePerInsight: 0,
    features: [
      'Up to $10K monthly transaction volume',
      '5 AI insights per month',
      'Basic dashboard access',
      '30-day data retention',
      'Community support',
    ],
    cta: 'Get Started Free',
    planId: 'starter',
    showOnHome: true,
  },
  {
    name: 'professional',
    displayName: 'Professional',
    description: 'For growing businesses',
    price: 29,
    includedVolume: 100000,
    includedInsights: 50,
    overageRatePer10k: 5,
    overageRatePerInsight: 0.5,
    features: [
      'Up to $100K monthly transaction volume',
      '50 AI insights per month',
      'Full dashboard + benchmarking',
      '1-year data retention',
      'Email support',
      '$5 per additional $10K volume',
      '$0.50 per additional AI insight',
    ],
    popular: true,
    cta: 'Upgrade to Pro — $29/mo',
    planId: 'professional',
    showOnHome: true,
  },
  {
    name: 'business',
    displayName: 'Business',
    description: 'For established companies',
    price: 99,
    includedVolume: 500000,
    includedInsights: 200,
    overageRatePer10k: 3,
    overageRatePerInsight: 0.4,
    features: [
      'Up to $500K monthly transaction volume',
      '200 AI insights per month',
      'Priority support',
      'Unlimited data retention',
      'Custom reports',
      'Advanced analytics',
      '$3 per additional $10K volume',
      '$0.40 per additional AI insight',
    ],
    cta: 'Upgrade to Business — $99/mo',
    planId: 'business',
    showOnHome: true,
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'For teams that need custom pricing and SLAs',
    price: 299,
    includedVolume: 999999999,
    includedInsights: 999999,
    overageRatePer10k: 0,
    overageRatePerInsight: 0,
    features: [
      'Unlimited transaction volume',
      'Unlimited AI insights',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantees',
      'White-label options',
    ],
    cta: 'Contact Sales',
    planId: 'enterprise',
    showOnHome: false,
  },
]
