import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'

/**
 * GET /api/recoveries/by-type?days=7&stripe_connection_id=...
 * Returns recovered totals grouped by leak_type.
 */
export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const days = Math.min(parseInt(searchParams.get('days') || '7', 10) || 7, 90)
    const stripe_connection_id = searchParams.get('stripe_connection_id')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let q = supabase
      .from('revenue_recovery_events')
      .select('recovered_amount_cents,leak_type,stripe_connection_id,recovered_at')
      .eq('user_id', user.id)
      .gte('recovered_at', since)

    if (stripe_connection_id) q = q.eq('stripe_connection_id', stripe_connection_id)

    const { data, error } = await q
    if (error) throw error

    const totals: Record<string, number> = {}
    for (const r of data || []) {
      const k = (r.leak_type || 'unknown') as string
      totals[k] = (totals[k] || 0) + Number(r.recovered_amount_cents || 0)
    }

    return NextResponse.json({ ok: true, days, totals })
  } catch (error) {
    return handleApiError(error)
  }
})
