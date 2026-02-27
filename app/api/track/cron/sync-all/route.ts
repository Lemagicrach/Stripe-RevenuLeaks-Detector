import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limit'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdminClient()
  // ✅ ADD THIS FIRST - before authentication
  const rateLimitResponse = await withRateLimit(req, 'sync')
  if (rateLimitResponse) return rateLimitResponse
  const authHeader = req.headers.get('authorization')
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { data: connections } = await supabase
    .from('stripe_connections')
    .select('stripe_account_id')
    .eq('is_active', true)
  
  if (!connections) {
    return NextResponse.json({ message: 'No connections' })
  }
  
  console.log(`Syncing ${connections.length} accounts`)
  
  const results = await Promise.allSettled(
    connections.map((conn: any) =>
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stripeAccountId: conn.stripe_account_id }),
      })
    )
  )
  
  const successful = results.filter(r => r.status === 'fulfilled').length
  
  return NextResponse.json({ total: connections.length, successful })
}
