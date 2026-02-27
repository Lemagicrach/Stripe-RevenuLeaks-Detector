'use client'

import { AlertTriangle, CreditCard, TrendingDown, Zap } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'

export type RevenueLeak = {
  id: string
  stripe_connection_id: string
  leak_type: string
  period_start: string
  period_end: string
  lost_amount_cents: number
  recoverable_amount_cents: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  title: string
  summary: string
  recommended_action: string
  created_at: string
}

function iconForType(type: string) {
  switch (type) {
    case 'failed_payments':
      return CreditCard
    case 'recovery_gap':
      return AlertTriangle
    case 'churn_spike':
    case 'silent_churn':
      return TrendingDown
    case 'expansion_opportunity':
      return Zap
    default:
      return AlertTriangle
  }
}

function money(cents: number) {
  const dollars = cents / 100
  return dollars.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function LeakCard({ leak }: { leak: RevenueLeak }) {
  const Icon = iconForType(leak.leak_type)
  const lost = money(leak.lost_amount_cents)
  const rec = money(leak.recoverable_amount_cents)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <Icon className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{leak.title}</h3>
              <SeverityBadge severity={leak.severity} />
              <span className="text-xs text-slate-500">
                Confidence {(leak.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{leak.summary}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Estimated lost</div>
          <div className="text-lg font-semibold text-slate-900">{lost}/mo</div>
          {leak.recoverable_amount_cents > 0 && (
            <div className="mt-1 text-xs text-slate-600">Recoverable ≈ {rec}/mo</div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <div className="text-xs font-semibold text-slate-700">Recommended action</div>
        <p className="mt-1 text-sm text-slate-700">{leak.recommended_action}</p>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Period: {leak.period_start} → {leak.period_end}</span>
        <span>Detected: {new Date(leak.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
