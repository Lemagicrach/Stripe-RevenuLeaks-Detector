import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const stripe_connection_id = body.stripe_connection_id as string | undefined
  const action_key = body.action_key as string | undefined
  const leak_type = body.leak_type as string | undefined
  const assigned_to = (body.assigned_to as string | undefined) || user.id
  const status = (body.status as string | undefined) || 'open'

  if (!stripe_connection_id || !action_key || !leak_type) {
    return NextResponse.json({ error: 'Missing stripe_connection_id, action_key, or leak_type' }, { status: 400 })
  }

  const { error } = await supabase
    .from('leak_action_assignments')
    .upsert(
      {
        stripe_connection_id,
        action_key,
        leak_type,
        assigned_to,
        assigned_by: user.id,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_connection_id,action_key' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
