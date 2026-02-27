'use client'

import { X } from 'lucide-react'
import type { Playbook } from '@/lib/leak-playbooks'

export function PlaybookModal({
  open,
  onClose,
  playbook,
}: {
  open: boolean
  onClose: () => void
  playbook: Playbook | null
}) {
  if (!open || !playbook) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{playbook.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{playbook.goal}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-900">Steps</h4>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {playbook.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>

        {playbook.templates?.length ? (
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-slate-900">Templates</h4>
            <div className="mt-2 space-y-3">
              {playbook.templates.map((t) => (
                <div key={t.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700">{t.label}</div>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{t.content}</pre>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
