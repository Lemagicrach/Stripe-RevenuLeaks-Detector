// lib/demo-metrics.ts
// Demo payload for /api/metrics (same shape as the real API response).
// Used for template mode and demo mode.

export const DEMO_METRICS_RESPONSE = {
  state: 'ok',
  demo: true,
  connection: {
    stripeAccountId: 'acct_demo_123',
    businessName: 'Demo SaaS',
    currency: 'USD',
    lastSyncedAt: new Date().toISOString(),
  },
  current: {
    mrr: 1240,
    arr: 14880,
    arpu: 33.51,
    ltv: 804.24,
    totalCustomers: 37,
    activeSubscriptions: 41,
    customerChurnRate: 3.2,
    revenueChurnRate: 2.8,
  },
  history: [
    { date: '2024-08-01', mrr: 820 },
    { date: '2024-09-01', mrr: 890 },
    { date: '2024-10-01', mrr: 960 },
    { date: '2024-11-01', mrr: 1030 },
    { date: '2024-12-01', mrr: 1150 },
    { date: '2025-01-01', mrr: 1240 },
  ],
  benchmarking: {
    userCohort: 'Petit',
    avgMrr: 980,
    cohortSize: 412,
    averageChurnRate: 4.1,
  },
} as const;
