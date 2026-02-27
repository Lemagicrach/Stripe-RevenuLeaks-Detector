'use client'

import clsx from 'clsx'

type Severity = 'low' | 'medium' | 'high' | 'critical'

export function SeverityBadge({ severity }: { severity: Severity }) {
  const classes = clsx(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
    severity === 'low' && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    severity === 'medium' && 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    severity === 'high' && 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    severity === 'critical' && 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  )

  return <span className={classes}>{severity}</span>
}
