// lib/demo-data.ts
export const DEMO_BUNDLE = {
  meta: { mode: "demo", currency: "USD", generated_at: "2025-01-15T10:00:00Z" },
  summary: {
    mrr: 1240,
    arr: 14880,
    active_customers: 37,
    active_subscriptions: 41,
    arpu: 33.51,
    ltv: 420,
    customer_churn_rate: 0.032,
    revenue_churn_rate: 0.028
  },
  trends: {
    mrr_change_percent: 0.074,
    customer_change_percent: 0.051,
    churn_change_percent: -0.004
  },
  mrr_history: [
    { date: "2024-08-01", mrr: 820 },
    { date: "2024-09-01", mrr: 890 },
    { date: "2024-10-01", mrr: 960 },
    { date: "2024-11-01", mrr: 1030 },
    { date: "2024-12-01", mrr: 1150 },
    { date: "2025-01-01", mrr: 1240 }
  ],
  ai_insights: [
    { type: "positive", title: "MRR is trending up", message: "Your MRR increased by 7.4% this month, mainly driven by Pro plan upgrades." },
    { type: "warning", title: "Churn to watch", message: "Customer churn is slightly higher among Starter users. Consider nudging them toward Pro." },
    { type: "tip", title: "Growth opportunity", message: "Business plan customers have 2.1x higher LTV. Focus acquisition on this segment." }
  ],
  state: {
    has_stripe_connection: false,
    has_real_data: false,
    show_demo_badge: true,
    show_connect_cta: true
  }
} as const;
