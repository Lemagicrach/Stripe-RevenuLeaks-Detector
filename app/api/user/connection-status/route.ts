import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/server-error'
import { getSupabaseAdminClient } from '@/lib/server-clients'

/**
 * GET /api/user/connection-status
 *
 * Returns active Stripe connection state + sync status for onboarding.
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    // Apply rate limiting
    const rl = await withRateLimit(req, 'metrics')
    if (rl) return rl

    // Authenticate user
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { state: 'unauthorized', message: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if the user has any active Stripe connection
    const { data: connections, error: connError } = await supabaseAdmin
      .from('stripe_connections')
      .select('id, sync_status, sync_progress, sync_message, last_synced_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (connError) {
      console.error('connection-status: connection error', connError)
      return NextResponse.json(
        { state: 'error', message: 'Database error' },
        { status: 500 }
      )
    }
    const connection = Array.isArray(connections) ? connections[0] : null
    const hasConnection = !!connection

    return NextResponse.json(
      {
        hasConnection,
        connectionId: connection?.id || null,
        syncStatus: connection?.sync_status || null,
        syncProgress: connection?.sync_progress ?? null,
        syncMessage: connection?.sync_message || null,
        lastSyncedAt: connection?.last_synced_at || null,
      },
      { status: 200 }
    )
  } catch (err) {
    const errorResponse = handleApiError(err, 'USER_CONNECTION_STATUS_GET')
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
