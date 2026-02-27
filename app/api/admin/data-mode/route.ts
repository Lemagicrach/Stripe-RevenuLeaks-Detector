import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'

type DataMode = 'demo' | 'real'

export async function POST(req: NextRequest) {
  try {
    // ✅ Rate limiting
    const rl = await withRateLimit(req, 'admin:data-mode')
    if (rl) return rl

    // ✅ Parse body
    const body = await req.json()
    const dataMode = body?.data_mode as DataMode | undefined

    if (dataMode !== 'demo' && dataMode !== 'real') {
      return NextResponse.json(
        { error: 'Invalid data_mode. Must be demo or real.' },
        { status: 400 }
      )
    }

    // ✅ Auth (your helper)
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // ✅ Admin allowlist (simple & effective)
    const adminEmails =
      process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) ?? []

    if (!adminEmails.includes(user.email ?? '')) {
      return NextResponse.json(
        { error: 'Forbidden (admin only)' },
        { status: 403 }
      )
    }

    // ✅ Persist data mode (RLS allows user to manage own row)
    const { error: upsertError } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          data_mode: dataMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('admin:data-mode upsert error', upsertError)
      return NextResponse.json(
        { error: 'Failed to update data mode' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data_mode: dataMode },
      { status: 200 }
    )

  } catch (error) {
    const errRes = handleApiError(error, 'ADMIN_DATA_MODE_POST')
    return NextResponse.json(errRes, { status: 500 })
  }
}
