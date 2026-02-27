import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'

/**
 * GET /api/leaks/actions?stripe_connection_id=...
 * Returns persisted Action Center checklist state.
 */
export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const stripe_connection_id = searchParams.get('stripe_connection_id')
    if (!stripe_connection_id) return NextResponse.json({ error: 'Missing stripe_connection_id' }, { status: 400 })

    const { data, error } = await supabase
      .from('leak_action_state')
      .select('action_key,is_done,leak_type,updated_at')
      .eq('user_id', user.id)
      .eq('stripe_connection_id', stripe_connection_id)

    if (error) throw error
    const map: Record<string, boolean> = {}
    for (const r of data || []) map[String(r.action_key)] = !!r.is_done

    return NextResponse.json({ ok: true, done: map })
  } catch (error) {
    return handleApiError(error)
  }
})

/**
 * POST /api/leaks/actions
 * Body: { stripe_connection_id, action_key, leak_type, is_done }
 */
export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const stripe_connection_id = body?.stripe_connection_id as string | undefined
    const action_key = body?.action_key as string | undefined
    const leak_type = body?.leak_type as string | undefined
    const is_done = !!body?.is_done

    if (!stripe_connection_id || !action_key || !leak_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error } = await supabase
      .from('leak_action_state')
      .upsert(
        {
          user_id: user.id,
          stripe_connection_id,
          action_key,
          leak_type,
          is_done,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,stripe_connection_id,action_key' }
      )

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
})
