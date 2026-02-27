import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Number(searchParams.get('days') || '30')
  const stripe_connection_id = searchParams.get('stripe_connection_id')
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 200)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let q = supabase
    .from('revenue_recovery_events')
    .select('id, invoice_id, recovered_amount_cents, recovered_at, leak_type, leak_id, meta')
    .eq('user_id', user.id)
    .gte('recovered_at', since)
    .order('recovered_at', { ascending: false })
    .limit(limit)

  if (stripe_connection_id) q = q.eq('stripe_connection_id', stripe_connection_id)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Join leak titles best-effort
  const leakIds = Array.from(new Set((rows || []).map((r: any) => r.leak_id).filter(Boolean))) as string[]
  let leakMap: Record<string, any> = {}
  if (leakIds.length) {
    const { data: leaks } = await supabase
      .from('revenue_leaks')
      .select('id, leak_type, title, severity')
      .in('id', leakIds)
    for (const l of leaks || []) leakMap[String(l.id)] = l
  }

  const timeline = (rows || []).map((r: any) => ({
    ...r,
    leak: r.leak_id ? leakMap[String(r.leak_id)] || null : null,
  }))

  return NextResponse.json({ days, timeline })
}
