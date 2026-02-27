import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'

/**
 * GET /api/leaks/notifications?since=ISO
 * Returns unread notifications (and a small recent window).
 */
export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const since = searchParams.get('since')

    let q = supabase
      .from('leak_notifications')
      .select('id,leak_id,leak_type,severity,title,message,channel,created_at,read_at,stripe_connection_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25)

    if (since) q = q.gte('created_at', since)

    const { data, error } = await q
    if (error) throw error

    return NextResponse.json({ ok: true, notifications: data || [] })
  } catch (error) {
    return handleApiError(error)
  }
})

/**
 * POST /api/leaks/notifications/mark-read
 * Body: { ids: string[] }
 */
export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : []
    if (!ids.length) return NextResponse.json({ ok: true })

    const { error } = await supabase
      .from('leak_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', ids)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
})
