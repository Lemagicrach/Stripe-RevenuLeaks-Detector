'use client'

import { useEffect, useMemo, useState } from 'react'

type LeakSeverity = 'low' | 'medium' | 'high' | 'critical'

type LeakItem = {
  type: string
  severity: LeakSeverity
  impact: string
  action: string
}

type DemoScenario = {
  id: string
  label: string
  headline: string
  subtitle: string
  mrr: string
  atRisk: string
  recoverable: string
  scanCoverage: number
  leaks: LeakItem[]
}

const scenarios: DemoScenario[] = [
  {
    id: 'failed-payments',
    label: 'Failed Payments Spike',
    headline: '12 payment failures detected in the last 7 days',
    subtitle: 'Recovery gap widened after retries stopped on day 3.',
    mrr: '$48,120',
    atRisk: '$6,240',
    recoverable: '$4,056',
    scanCoverage: 92,
    leaks: [
      {
        type: 'Failed payments',
        severity: 'high',
        impact: '$4,920 at immediate risk',
        action: 'Enable smart retries and card update reminders',
      },
      {
        type: 'Recovery gap',
        severity: 'medium',
        impact: '$1,320 likely recoverable',
        action: 'Send a 3-step dunning flow with in-app prompts',
      },
    ],
  },
  {
    id: 'churn-risk',
    label: 'Churn Warning',
    headline: 'Churn probability rose in your mid-market segment',
    subtitle: 'NRR trend dropped while support touches increased.',
    mrr: '$48,120',
    atRisk: '$8,900',
    recoverable: '$2,250',
    scanCoverage: 88,
    leaks: [
      {
        type: 'Churn spike',
        severity: 'critical',
        impact: '$7,800 projected monthly loss',
        action: 'Launch retention offer for at-risk subscriptions today',
      },
      {
        type: 'Silent churn signal',
        severity: 'medium',
        impact: '$1,100 hidden expansion loss',
        action: 'Audit downgrades and usage drop-off cohorts',
      },
    ],
  },
  {
    id: 'recovery-win',
    label: 'Recovery Win',
    headline: 'RevPilot recovered failed invoices after retry optimization',
    subtitle: 'Automated alert + targeted action reduced leakage this week.',
    mrr: '$49,030',
    atRisk: '$2,180',
    recoverable: '$1,320',
    scanCoverage: 96,
    leaks: [
      {
        type: 'Failed payments',
        severity: 'low',
        impact: '$980 still open',
        action: 'Keep monitoring and escalate only on repeated failures',
      },
      {
        type: 'Expansion opportunity',
        severity: 'medium',
        impact: '$1,200 upsell potential',
        action: 'Target long-tenure low-tier customers with upgrade prompts',
      },
    ],
  },
]

const severityStyles: Record<LeakSeverity, string> = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
}

export function LeakDemoPreview() {
  const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0].id)
  const [scanProgress, setScanProgress] = useState(0)

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) || scenarios[0],
    [activeScenarioId]
  )

  useEffect(() => {
    setScanProgress(12)
    const timer = setTimeout(() => {
      setScanProgress(activeScenario.scanCoverage)
    }, 120)
    return () => clearTimeout(timer)
  }, [activeScenario])

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => {
          const active = scenario.id === activeScenario.id
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setActiveScenarioId(scenario.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                active
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {scenario.label}
            </button>
          )
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MRR</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{activeScenario.mrr}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">At risk</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{activeScenario.atRisk}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recoverable</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{activeScenario.recoverable}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live scan preview</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${scanProgress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">Coverage: {scanProgress}% of recent Stripe events analyzed</p>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-slate-900">{activeScenario.headline}</h3>
        <p className="mt-1 text-sm text-slate-600">{activeScenario.subtitle}</p>

        <div className="mt-4 grid gap-3">
          {activeScenario.leaks.map((leak) => (
            <article
              key={`${activeScenario.id}-${leak.type}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{leak.type}</p>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severityStyles[leak.severity]}`}>
                  {leak.severity.toUpperCase()}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">{leak.impact}</p>
              <p className="mt-1 text-sm text-slate-600">{leak.action}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
