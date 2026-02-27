// app/api/cron/detect-revenue-leaks/route.ts
//
// Phase 1: runs as a cron job to detect revenue leaks across all active Stripe connections.
// Schedule daily (or hourly later). Requires CRON_SECRET in Authorization header.

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limit'
import { detectRevenueLeaks } from '@/lib/revenue-leaks'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdminClient()
  const rateLimitResponse = await withRateLimit(req, 'sync')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🧯 Revenue Leak Detector cron started')

    const { data: connections, error } = await supabase
      .from('stripe_connections')
      .select('id,user_id,stripe_account_id,business_name')
      .eq('is_active', true)
      .limit(25)

    if (error) {
      console.error('Failed to fetch connections:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active connections to scan',
        scanned: 0,
        leaks_created: 0,
      })
    }

    let scanned = 0
    let leaksCreated = 0
    const results: any[] = []

    for (const conn of connections) {
      scanned++
      try {
        const leaks = await detectRevenueLeaks(conn.user_id, conn.id)
        leaksCreated += leaks.length

        results.push({
          connectionId: conn.id,
          stripeAccountId: conn.stripe_account_id,
          businessName: conn.business_name,
          leaks: leaks.map((l) => l.leak_type),
          status: 'success',
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`❌ Leak detection failed for ${conn.stripe_account_id}:`, msg)
        results.push({
          connectionId: conn.id,
          stripeAccountId: conn.stripe_account_id,
          businessName: conn.business_name,
          status: 'error',
          error: msg,
        })
      }
    }

    return NextResponse.json({
      success: true,
      scanned,
      leaks_created: leaksCreated,
      results,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Revenue leak cron failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
