import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'
import { detectRevenueLeaks } from '@/lib/revenue-leaks'

/**
 * POST /api/leaks/run-scan
 * Runs the revenue leak detector for the authenticated user.
 * Body: { stripe_connection_id?: string }
 */
export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const stripe_connection_id: string | undefined = body?.stripe_connection_id

    const leaks = await detectRevenueLeaks(user.id, stripe_connection_id)
    return NextResponse.json({ ok: true, leaks_created: leaks.length })
  } catch (error) {
    return handleApiError(error)
  }
})
