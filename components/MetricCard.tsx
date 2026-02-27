'use client'

import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { MetricTooltip } from '@/components/ui/MetricTooltip'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: ReactNode
  currency?: boolean
  tooltipDefinition?: string
}

function formatCurrencyValue(value: string | number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return value
  return `$${numericValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  currency = false,
  tooltipDefinition,
}: MetricCardProps) {
  const formattedValue = currency ? formatCurrencyValue(value) : value

  const trend =
    change === undefined ? 'none' : change > 0 ? 'positive' : change < 0 ? 'negative' : 'flat'

  const trendColor =
    trend === 'positive'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : trend === 'negative'
        ? 'text-rose-700 bg-rose-50 border-rose-200'
        : trend === 'flat'
          ? 'text-slate-700 bg-slate-100 border-slate-200'
          : ''

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-slate-50/80 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-indigo-100/40 blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          {tooltipDefinition ? (
            <MetricTooltip label={title} definition={tooltipDefinition}>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-600 cursor-help uppercase tracking-wide">
                {title}
              </h3>
            </MetricTooltip>
          ) : (
            <h3 className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">
              {title}
            </h3>
          )}

          {icon ? (
            <div className="rounded-lg border border-gray-200 bg-white p-2 text-slate-500 group-hover:text-indigo-700 group-hover:border-indigo-200 transition-colors">
              {icon}
            </div>
          ) : null}
        </div>

        <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {formattedValue}
        </p>

        {change !== undefined ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${trendColor}`}
            >
              {trend === 'positive' ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : trend === 'negative' ? (
                <ArrowDownRight className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              {change > 0 ? '+' : ''}
              {change}%
            </span>

            {changeLabel ? (
              <span className="text-xs sm:text-sm text-slate-500">{changeLabel}</span>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs sm:text-sm text-slate-500">
            No comparison available yet.
          </p>
        )}
      </div>
    </div>
  )
}
