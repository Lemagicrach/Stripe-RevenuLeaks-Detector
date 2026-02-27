'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LeakOverview } from '@/components/leaks/LeakOverview'
import { LeakCard, type RevenueLeak } from '@/components/leaks/LeakCard'
import { ActionCenter } from '@/components/leaks/ActionCenter'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPaidPlanLabel, sanitizePlanId, type PaidPlanId } from '@/lib/plan-flow'

type Connection = {
  id: string
  stripe_account_id: string | null
  is_active: boolean
  created_at: string
  last_scan_at: string | null
  webhook_status?: string | null
  webhook_endpoint_id?: string | null
}

export default function RevenueLeaksPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leaks, setLeaks] = useState<RevenueLeak[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConn, setSelectedConn] = useState<string | 'all'>('all')
  const [runningScan, setRunningScan] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [recovered7, setRecovered7] = useState<number>(0)
  const [recovered30, setRecovered30] = useState<number>(0)
  const [recoveredByType7, setRecoveredByType7] = useState<Record<string, number>>({})
  const [settingUpWebhook, setSettingUpWebhook] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [checkoutStatusNotice, setCheckoutStatusNotice] = useState<string | null>(null)
  const [autoScanHandled, setAutoScanHandled] = useState(false)
  const [shouldAutoScan, setShouldAutoScan] = useState(false)
  const [intentPlan, setIntentPlan] = useState<PaidPlanId | null>(null)
  const [dismissedPlanPrompt, setDismissedPlanPrompt] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = new URLSearchParams(window.location.search)
    const nextIntentPlan = sanitizePlanId(query.get('intent_plan'))

    setIntentPlan(nextIntentPlan)
    setShouldAutoScan(query.get('run_scan') === '1')
    setDismissedPlanPrompt(false)

    if (query.get('checkoutSuccess') === '1') {
      setCheckoutStatusNotice('Trial started successfully. You can continue scanning and reviewing leaks below.')
      setDismissedPlanPrompt(true)
    } else if (query.get('checkoutCancelled') === '1') {
      setCheckoutStatusNotice('Checkout was cancelled. Your leak scanner stays fully available.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        setError(null)
        setNotice(null)

        // load connections meta
        const connRes = await fetch('/api/leaks/connections', { cache: 'no-store' })
        if (connRes.status === 401) {
          router.push('/login')
          return
        }
        const connJson = await connRes.json()
        if (connRes.ok && !cancelled) {
          setConnections(connJson.connections || [])
        }

        const res = await fetch('/api/leaks?limit=50', { cache: 'no-store' })
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load leaks')
        if (!cancelled) setLeaks(json.leaks || [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load leaks')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function setupRealtimeAlerts() {
    if (selectedConn === 'all') {
      setNotice('Select a Stripe connection to enable real-time alerts.')
      return
    }
    try {
      setSettingUpWebhook(true)
      setNotice(null)
      const res = await fetch('/api/stripe/webhooks/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stripe_connection_id: selectedConn }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to setup webhooks')
      // refresh connections list
      const connRes = await fetch('/api/leaks/connections', { cache: 'no-store' })
      const connJson = await connRes.json()
      setConnections(connJson.connections || [])
      setNotice(
        json.webhook_status === 'active'
          ? 'Real-time alerts enabled.'
          : 'Webhook created but signing secret was not returned. Add webhook_secret in stripe_connections to activate.'
      )
    } catch (e: any) {
      setNotice(e?.message || 'Failed to setup real-time alerts')
    } finally {
      setSettingUpWebhook(false)
    }
  }

  // reload leaks when connection filter changes
  useEffect(() => {
    let cancelled = false
    async function loadLeaks() {
      try {
        setLoading(true)
        setError(null)
        setNotice(null)
        const qs = selectedConn !== 'all' ? `&stripe_connection_id=${encodeURIComponent(selectedConn)}` : ''
        const res = await fetch(`/api/leaks?limit=50${qs}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load leaks')
        if (!cancelled) setLeaks(json.leaks || [])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load leaks')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadLeaks()
    return () => { cancelled = true }
  }, [selectedConn])

  // Load recovery tracking (totals + attribution)
  useEffect(() => {
    let cancelled = false
    async function loadRecovery() {
      try {
        const qs = selectedConn !== 'all' ? `&stripe_connection_id=${encodeURIComponent(selectedConn)}` : ''
        const r7 = await fetch(`/api/recoveries?days=7${qs}`, { cache: 'no-store' })
        const j7 = await r7.json().catch(() => ({}))
        const r30 = await fetch(`/api/recoveries?days=30${qs}`, { cache: 'no-store' })
        const j30 = await r30.json().catch(() => ({}))

        const by7 = await fetch(`/api/recoveries/by-type?days=7${qs}`, { cache: 'no-store' })
        const by7j = await by7.json().catch(() => ({}))

        if (!cancelled) {
          setRecovered7(Number(j7?.recovered_amount_cents || 0))
          setRecovered30(Number(j30?.recovered_amount_cents || 0))
          setRecoveredByType7(by7j?.totals || {})
        }
      } catch {
        // best-effort
      }
    }
    loadRecovery()
    return () => { cancelled = true }
  }, [selectedConn])

  // Phase 6: SSE stream for instant leak alerts (no polling)
  useEffect(() => {
    let es: EventSource | null = null
    try {
      const qs = selectedConn !== 'all' ? `?stripe_connection_id=${encodeURIComponent(selectedConn)}` : ''
      es = new EventSource(`/api/leaks/stream${qs}`)

      es.addEventListener('notification', (evt: MessageEvent) => {
        try {
          const n = JSON.parse(String(evt.data || '{}'))
          const msg = `${n.title}: ${n.message}`
          if (n.severity === 'critical' || n.severity === 'high') toast.error(msg)
          else toast(msg)
        } catch {
          // ignore
        }
      })

      es.onerror = () => {
        // Keep quiet; browser will auto-retry. If it keeps failing, user still sees leaks UI.
      }
    } catch {
      // ignore
    }

    return () => {
      try {
        es?.close()
      } catch {
        // ignore
      }
    }
  }, [selectedConn])

  async function runScan() {
    try {
      setRunningScan(true)
      setNotice(null)
      const body: any = {}
      if (selectedConn !== 'all') body.stripe_connection_id = selectedConn
      const res = await fetch('/api/leaks/run-scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Scan failed')
      setNotice(`Scan complete. Leaks created: ${json.leaks_created ?? 0}.`)
      // refresh
      const connRes = await fetch('/api/leaks/connections', { cache: 'no-store' })
      const connJson = await connRes.json()
      if (connRes.ok) setConnections(connJson.connections || [])

      const qs = selectedConn !== 'all' ? `&stripe_connection_id=${encodeURIComponent(selectedConn)}` : ''
      const leaksRes = await fetch(`/api/leaks?limit=50${qs}`, { cache: 'no-store' })
      const leaksJson = await leaksRes.json()
      if (leaksRes.ok) setLeaks(leaksJson.leaks || [])
    } catch (e: any) {
      setError(e?.message || 'Scan failed')
    } finally {
      setRunningScan(false)
    }
  }

  async function startTrialCheckout() {
    if (!intentPlan) return

    try {
      setStartingTrial(true)
      setError(null)
      setNotice(null)

      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: intentPlan }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          const redirectPath = `/dashboard/leaks?intent_plan=${encodeURIComponent(intentPlan)}`
          router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`)
          return
        }
        throw new Error(json?.error || 'Could not start checkout')
      }

      if (!json?.url) {
        throw new Error('No checkout URL received')
      }

      window.location.href = json.url
    } catch (e: any) {
      setError(e?.message || 'Could not start checkout')
    } finally {
      setStartingTrial(false)
    }
  }

  useEffect(() => {
    if (!shouldAutoScan || autoScanHandled || loading || runningScan) return

    setAutoScanHandled(true)
    setNotice('Stripe connected. Running initial revenue leak scan...')
    void runScan()
    const params = new URLSearchParams()
    if (intentPlan) params.set('intent_plan', intentPlan)
    const nextPath = params.toString() ? `/dashboard/leaks?${params.toString()}` : '/dashboard/leaks'
    router.replace(nextPath)
  }, [autoScanHandled, intentPlan, loading, router, runningScan, shouldAutoScan, runScan])

  async function emailReport() {
    try {
      setEmailing(true)
      setNotice(null)
      const body: any = { limit: 50 }
      if (selectedConn !== 'all') body.stripe_connection_id = selectedConn
      const res = await fetch('/api/leaks/email-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Email failed')
      setNotice('Report sent to your email.')
    } catch (e: any) {
      setError(e?.message || 'Email failed')
    } finally {
      setEmailing(false)
    }
  }

  const sorted = useMemo(() => leaks, [leaks])
  const lastScan = useMemo(() => {
    if (selectedConn === 'all') {
      const scans = connections.map((c) => c.last_scan_at).filter(Boolean) as string[]
      return scans.length ? scans.sort().slice(-1)[0] : null
    }
    const c = connections.find((x) => x.id === selectedConn)
    return c?.last_scan_at || null
  }, [connections, selectedConn])

  const webhookStatus = useMemo(() => {
    if (selectedConn === 'all') return null
    return connections.find((x) => x.id === selectedConn)?.webhook_status || null
  }, [connections, selectedConn])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Revenue Leak Detector</h1>
        <p className="mt-1 text-sm text-slate-600">
          See where you are losing money in Stripe — and what to fix first.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Connection</span>
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={selectedConn}
              onChange={(e) => setSelectedConn(e.target.value as any)}
            >
              <option value="all">All connections</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.stripe_account_id || c.id.slice(0, 8)}{c.is_active ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
              onClick={setupRealtimeAlerts}
              disabled={settingUpWebhook || selectedConn === 'all'}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {settingUpWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enable real-time alerts
            </button>

            <button
            onClick={runScan}
            disabled={runningScan}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-60"
            type="button"
          >
            {runningScan ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Running scan…</span>
            ) : (
              'Run scan now'
            )}
          </button>

          <button
            onClick={emailReport}
            disabled={emailing}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            type="button"
          >
            {emailing ? 'Sending…' : 'Email me this report'}
          </button>

          <div className="text-xs text-slate-500">
            Last scan: {lastScan ? new Date(lastScan).toLocaleString() : '—'}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading leaks…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {notice && !error && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {checkoutStatusNotice && !error && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          {checkoutStatusNotice}
        </div>
      )}

      {intentPlan && !dismissedPlanPrompt && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            You selected the <span className="font-semibold">{getPaidPlanLabel(intentPlan)}</span> plan.
            Start your 14-day trial anytime while keeping leak detection fully active.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={startTrialCheckout}
              disabled={startingTrial}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              type="button"
            >
              {startingTrial ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {startingTrial ? 'Starting checkout…' : `Start ${getPaidPlanLabel(intentPlan)} 14-day trial`}
            </button>
            <button
              onClick={() => setDismissedPlanPrompt(true)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <LeakOverview
            leaks={sorted}
            recovered7={recovered7}
            recovered30={recovered30}
            recoveredByType7={recoveredByType7}
            webhookStatus={webhookStatus}
          />

          <ActionCenter
            leaks={sorted}
            stripeConnectionId={selectedConn === 'all' ? null : selectedConn}
          />

          <div className="grid gap-4">
            {sorted.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                No leaks detected yet. Click <b>Run scan now</b> to generate your first leak report.
              </div>
            ) : (
              sorted.map((leak) => <LeakCard key={leak.id} leak={leak} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
