'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RevenueLeak } from './LeakCard'
import { SeverityBadge } from './SeverityBadge'
import { LEAK_PLAYBOOKS } from '@/lib/leak-playbooks'
import { PlaybookModal } from './PlaybookModal'
import { CheckCircle2, Circle, BookOpen, UserPlus } from 'lucide-react'

type ActionItem = {
  key: string
  title: string
  action: string
  severity: RevenueLeak['severity']
  recoverable_amount_cents: number
  leak_ids: string[]
  leak_type: RevenueLeak['leak_type']
}

const SEVERITY_WEIGHT: Record<RevenueLeak['severity'], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

function money(cents: number) {
  const v = Math.round(cents || 0)
  return `$${(v / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function ActionCenter({
  leaks,
  stripeConnectionId,
}: {
  leaks: RevenueLeak[]
  stripeConnectionId: string | null
}) {
  const [playbookOpen, setPlaybookOpen] = useState(false)
  const [playbookType, setPlaybookType] = useState<string | null>(null)

  const [done, setDone] = useState<Record<string, boolean>>({})
  const [assignments, setAssignments] = useState<Record<string, { assigned_to?: string | null; status?: string }>>({})

  // Load persisted checklist state from DB (falls back to empty)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!stripeConnectionId) {
        setDone({})
        setAssignments({})
        return
      }
      try {
        const res = await fetch(`/api/leaks/actions?stripe_connection_id=${encodeURIComponent(stripeConnectionId)}`, {
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) setDone(json?.done || {})
      } catch {
        // ignore
      }

      // Load team assignments (Phase 6)
      try {
        const res2 = await fetch(`/api/team/actions?stripe_connection_id=${encodeURIComponent(stripeConnectionId)}`, {
          cache: 'no-store',
        })
        const json2 = await res2.json().catch(() => ({}))
        if (!cancelled && res2.ok) {
          const map: Record<string, any> = {}
          for (const a of json2.assignments || []) {
            map[a.action_key] = { assigned_to: a.assigned_to, status: a.status }
          }
          setAssignments(map)
        }
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [stripeConnectionId])

  const actions = useMemo(() => {
    const map = new Map<string, ActionItem>()

    for (const l of leaks) {
      const key = `${l.leak_type}`
      const existing = map.get(key)
      const recoverable = Number(l.recoverable_amount_cents || 0)

      const item: ActionItem = existing
        ? {
            ...existing,
            severity:
              SEVERITY_WEIGHT[l.severity] > SEVERITY_WEIGHT[existing.severity] ? l.severity : existing.severity,
            recoverable_amount_cents: existing.recoverable_amount_cents + recoverable,
            leak_ids: [...existing.leak_ids, l.id],
          }
        : {
            key,
            title: l.title,
            action: l.recommended_action,
            severity: l.severity,
            recoverable_amount_cents: recoverable,
            leak_ids: [l.id],
          leak_type: l.leak_type,
          }

      map.set(key, item)
    }

    return Array.from(map.values())
      .map((a) => ({
        ...a,
        _score: SEVERITY_WEIGHT[a.severity] * (a.recoverable_amount_cents / 100),
      }))
      .sort((a, b) => b._score - a._score)
  }, [leaks])

  async function toggle(key: string, leak_type: RevenueLeak['leak_type']) {
    const next = { ...done, [key]: !done[key] }
    setDone(next)

    if (!stripeConnectionId) return
    try {
      await fetch('/api/leaks/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stripe_connection_id: stripeConnectionId,
          action_key: key,
          leak_type,
          is_done: !!next[key],
        }),
      })
    } catch {
      // ignore
    }
  }

  async function assignToMe(key: string, leak_type: RevenueLeak['leak_type']) {
    if (!stripeConnectionId) return
    try {
      await fetch('/api/team/actions/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stripe_connection_id: stripeConnectionId, action_key: key, leak_type }),
      })
      setAssignments((prev) => ({ ...prev, [key]: { assigned_to: 'me', status: 'open' } }))
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Action Center</h2>
          <p className="mt-1 text-sm text-slate-600">Your highest-ROI fixes, ranked by money impact.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {actions.length === 0 ? (
          <div className="text-sm text-slate-600">No actions yet. Run a scan to generate prioritized fixes.</div>
        ) : (
          actions.slice(0, 8).map((a) => {
            const isDone = !!done[a.key]
            const assigned = assignments[a.key]?.assigned_to
            return (
              <button
                key={a.key}
                onClick={() => toggle(a.key, a.leak_type)}
                className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-400" />
                      )}
                      <span className={`truncate text-sm font-medium ${isDone ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {a.title}
                      </span>
                    </div>
                    <p className={`mt-1 text-sm ${isDone ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                      {a.action}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Linked leaks: {a.leak_ids.length} · Estimated recoverable:{' '}
                      <span className="font-medium">{money(a.recoverable_amount_cents)}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <SeverityBadge severity={a.severity} />
                    <div className="text-xs text-slate-500">
                      {assigned ? 'Assigned' : 'Unassigned'}
                    </div>
                    {!assigned && stripeConnectionId ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          assignToMe(a.key, a.leak_type)
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <UserPlus className="h-3 w-3" /> Assign to me
                      </button>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
