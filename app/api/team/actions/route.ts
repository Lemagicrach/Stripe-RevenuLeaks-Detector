import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stripe_connection_id = searchParams.get('stripe_connection_id')
  if (!stripe_connection_id) return NextResponse.json({ error: 'Missing stripe_connection_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('leak_action_assignments')
    .select('id, action_key, leak_type, assigned_to, assigned_by, status, updated_at')
    .eq('stripe_connection_id', stripe_connection_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data || [] })
}
