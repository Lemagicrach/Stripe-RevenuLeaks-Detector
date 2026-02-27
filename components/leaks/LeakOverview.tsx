'use client'

import { ArrowUpRight, ShieldAlert, Zap } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'
import type { RevenueLeak } from './LeakCard'

function sum(leaks: RevenueLeak[], key: 'lost_amount_cents' | 'recoverable_amount_cents') {
  return leaks.reduce((s, l) => s + (l[key] || 0), 0)
}

function money(cents: number) {
  const dollars = (cents || 0) / 100
  return dollars.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function worstSeverity(leaks: RevenueLeak[]): 'low' | 'medium' | 'high' | 'critical' {
  const order = { low: 0, medium: 1, high: 2, critical: 3 } as const
  let best: any = 'low'
  for (const l of leaks) {
    if ((order as any)[l.severity] > (order as any)[best]) best = l.severity
  }
  return best
}

export function LeakOverview({
  leaks,
  recovered7 = 0,
  recovered30 = 0,
  recoveredByType7,
  webhookStatus = null,
}: {
  leaks: RevenueLeak[]
  recovered7?: number
  recovered30?: number
  recoveredByType7?: Record<string, number>
  webhookStatus?: string | null
}) {
  const totalLost = sum(leaks, 'lost_amount_cents')
  const totalRecoverable = sum(leaks, 'recoverable_amount_cents')
  const sev = worstSeverity(leaks)

  const realtimeLabel =
    webhookStatus === 'active'
      ? 'Real-time alerts: ON'
      : webhookStatus === 'pending_secret'
        ? 'Real-time alerts: pending secret'
        : 'Real-time alerts: OFF'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <ShieldAlert className="h-5 w-5 text-slate-800" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Revenue Leak Overview</h2>
            <SeverityBadge severity={sev} />
          </div>

          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
            <Zap className="h-4 w-4" />
            {realtimeLabel}
          </div>

          <p className="mt-2 text-sm text-slate-600">
            Estimated monthly revenue at risk, based on your latest detection run.
          </p>
        </div>

        <a
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Back to dashboard <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-600">Estimated lost</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{money(totalLost)}/mo</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-600">Estimated recoverable</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{money(totalRecoverable)}/mo</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-600">Recovered (30d)</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{money(recovered30)}</div>
          <div className="mt-1 text-xs text-slate-600">Recovered (7d): {money(recovered7)}</div>
          {recoveredByType7 && Object.keys(recoveredByType7).length ? (
            <div className="mt-3 space-y-1">
              <div className="text-[11px] font-semibold text-slate-600">Recovered by driver (7d)</div>
              {Object.entries(recoveredByType7)
                .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                .slice(0, 3)
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="truncate">{k}</span>
                    <span className="ml-2 font-medium text-slate-900">{money(v)}</span>
                  </div>
                ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-600">Active leaks</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{leaks.length}</div>
        </div>
      </div>
    </div>
  )
}
