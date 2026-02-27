export const Plans = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    scenarioLimit: 5,
    insightsLimit: 10,
    volumeLimit: 10_000,
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    scenarioLimit: 50,
    insightsLimit: 100,
    volumeLimit: 100_000,
  },
  // …
} as const;

export type PlanId = keyof typeof Plans;
