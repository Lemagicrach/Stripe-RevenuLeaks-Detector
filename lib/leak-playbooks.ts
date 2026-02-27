import type { RevenueLeakType } from '@/lib/revenue-leaks'

export type Playbook = {
  title: string
  goal: string
  steps: string[]
  templates?: { label: string; content: string }[]
  links?: { label: string; href: string }[]
}

export const LEAK_PLAYBOOKS: Record<RevenueLeakType, Playbook> = {
  failed_payments: {
    title: 'Failed Payments Playbook',
    goal: 'Recover revenue from failed invoices and reduce involuntary churn.',
    steps: [
      'Enable Smart Retries (Stripe Billing) and set retry schedule (e.g., day 1/3/5/7).',
      'Turn on Card Updater and ensure retry rules apply to all plans.',
      'Add an in-app banner: “Update payment method” for past_due customers.',
      'Send a 3-email dunning sequence (Day 0, Day 3, Day 7) with a direct update link.',
      'Measure recovery rate weekly (recovered / failed). Aim for 40–70% depending on ICP.',
    ],
    templates: [
      {
        label: 'Email #1 (Day 0)',
        content:
          'Subject: Action needed — payment failed\n\nHi {{name}},\n\nYour latest payment for {{product}} failed. Please update your card to avoid service interruption:\n{{update_link}}\n\nThanks,\n{{company}}',
      },
      {
        label: 'Email #2 (Day 3)',
        content:
          'Subject: Reminder — update your billing details\n\nHi {{name}},\n\nQuick reminder: your payment is still pending. Update your payment method here:\n{{update_link}}\n\n— {{company}}',
      },
    ],
  },

  recovery_gap: {
    title: 'Recovery Gap Playbook',
    goal: 'Shorten time-to-recovery and stop invoices getting “stuck”.',
    steps: [
      'Check retry rules + email deliverability (SPF/DKIM).',
      'Add grace period policy and communicate it clearly.',
      'Pause non-critical features for past_due users to prompt action.',
      'Offer annual switch discount if churn risk is high.',
      'Review 10 recent stuck invoices and identify pattern (cards, regions, plan).',
    ],
  },

  churn_spike: {
    title: 'Churn Spike Playbook',
    goal: 'Identify root cause quickly and stop the bleeding.',
    steps: [
      'Segment churn by plan / cohort / country / acquisition source.',
      'Check last 14 days: product releases, outages, pricing changes.',
      'Review cancel reasons (if captured) and support tickets.',
      'Run a save campaign: offer downgrade, pause, or annual discount.',
      'Add an “exit survey” at cancellation to capture reason.',
    ],
  },

  silent_churn: {
    title: 'Silent Churn Playbook',
    goal: 'Explain unexplained MRR drops (downgrades, proration, unpaid).',
    steps: [
      'Add subscription event tracking (upgrades/downgrades/proration).',
      'Inspect invoices with proration and negative line items.',
      'Check unpaid / incomplete subscriptions and whether they’re counted in MRR.',
      'Verify currency conversion rules (if multi-currency).',
      'Reconcile MRR movements to subscription item deltas.',
    ],
  },

  expansion_opportunity: {
    title: 'Expansion Opportunity Playbook',
    goal: 'Convert power users to higher tiers and capture underpricing.',
    steps: [
      'Identify long-tenure customers on lowest tier with consistent usage.',
      'Create a clear upgrade path (feature gating or usage-based tier).',
      'Add in-app upgrade prompts at the moment of need.',
      'Run a targeted upsell campaign (10–30% of accounts).',
      'Track upgrade conversion and time-to-upgrade by cohort.',
    ],
    templates: [
      {
        label: 'Upgrade email',
        content:
          'Subject: You’re hitting the limits of {{plan}}\n\nHi {{name}},\n\nIt looks like you’re getting strong value from {{product}}. Based on your usage, you may benefit from upgrading to {{next_plan}} for {{benefit}}.\n\nUpgrade here: {{upgrade_link}}\n\n— {{company}}',
      },
    ],
  },
}
