// lib/template-features.ts
// Feature flags used to ship a "Starter Kit" and upsell additional modules.

export const FEATURES = {
  stripeOAuth: true,
  demoMode: true,
  benchmarking: true,
  aiInsights: false, // Suggested upsell module
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isEnabled(feature: FeatureKey): boolean {
  return FEATURES[feature] === true;
}
