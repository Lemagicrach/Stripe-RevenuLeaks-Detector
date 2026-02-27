import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'

/**
 * GET /api/leaks/connections
 * Returns the user's Stripe connections with last leak scan timestamp.
 */
export const GET = withRateLimit(async () => {
  try {
    const supabase = await getSupabaseServerClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: conns, error: connErr } = await supabase
      .from('stripe_connections')
      .select('id,stripe_account_id,is_active,created_at,webhook_status,webhook_endpoint_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (connErr) throw connErr

    const connIds = (conns || []).map((c) => c.id)
    let lastScanByConn: Record<string, string | null> = {}

    if (connIds.length) {
      const { data: scans, error: scanErr } = await supabase
        .from('revenue_leaks')
        .select('stripe_connection_id, created_at')
        .in('stripe_connection_id', connIds)
        .order('created_at', { ascending: false })

      if (scanErr) throw scanErr

      // first row per connection is the latest because ordered desc
      for (const s of scans || []) {
        if (!lastScanByConn[s.stripe_connection_id]) {
          lastScanByConn[s.stripe_connection_id] = s.created_at
        }
      }
    }

    return NextResponse.json({
      connections: (conns || []).map((c) => ({
        ...c,
        last_scan_at: lastScanByConn[c.id] || null,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
})
