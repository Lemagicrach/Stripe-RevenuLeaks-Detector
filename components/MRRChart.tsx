'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, CalendarDays } from 'lucide-react'
import { MetricTooltip } from '@/components/ui/MetricTooltip'

interface MRRChartProps {
  data: {
    date: string
    mrr: number
  }[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export default function MRRChart({ data }: MRRChartProps) {
  const orderedHistory = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const chartData = orderedHistory.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    mrr: item.mrr,
  }))

  const latestMrr = orderedHistory[orderedHistory.length - 1]?.mrr
  const previousMrr = orderedHistory[orderedHistory.length - 2]?.mrr
  const trendChange =
    latestMrr !== undefined &&
    previousMrr !== undefined &&
    previousMrr > 0
      ? Number((((latestMrr - previousMrr) / previousMrr) * 100).toFixed(1))
      : undefined

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-slate-50/70 p-4 sm:p-6 shadow-sm">
      <div className="absolute -top-14 -right-10 w-28 h-28 rounded-full bg-indigo-100/40 blur-2xl" />

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <MetricTooltip
                label="MRR (Monthly Recurring Revenue)"
                definition="Recurring subscription revenue normalized to one month. This trend indicates subscription momentum over time."
              >
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 cursor-help">
                  MRR Growth
                </h3>
              </MetricTooltip>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              Revenue trajectory based on recent Stripe subscription history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
              <CalendarDays className="w-3.5 h-3.5" />
              {chartData.length} points
            </span>

            {trendChange !== undefined ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  trendChange >= 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {trendChange >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {trendChange >= 0 ? '+' : ''}
                {trendChange}%
              </span>
            ) : null}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Latest MRR</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {latestMrr !== undefined ? formatCurrency(latestMrr) : 'No data yet'}
          </p>
        </div>

        {chartData.length === 0 ? (
          <div className="h-72 sm:h-80 flex items-center justify-center text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 bg-white/70">
            No historical data yet
          </div>
        ) : (
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="mrrStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#64748b"
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value: number) => formatCurrencyCompact(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '10px',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    boxShadow: '0 10px 28px rgba(2, 6, 23, 0.35)',
                  }}
                  labelStyle={{ color: '#cbd5e1', marginBottom: 6 }}
                  formatter={(value: number | string) => [formatCurrency(Number(value)), 'MRR']}
                />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  stroke="url(#mrrStroke)"
                  strokeWidth={3}
                  dot={{ fill: '#4f46e5', r: 3, stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#06b6d4', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
