import { NextRequest, NextResponse } from 'next/server'
import { createMetricsEngine } from '@/lib/stripe-metrics'
import { withRateLimit } from '@/lib/rate-limit'
import { ValidationError } from '@/lib/validation-schemas'
import { getSupabaseAdminClient } from '@/lib/server-clients'

/**
 * GET /api/cron/sync-all
 * 
 * Syncs all active Stripe connections
 * Called by Vercel Cron daily at 2 AM UTC
 * 
 * Auth: Requires CRON_SECRET in Authorization header
 */
export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdminClient()
  // ✅ Rate limiting
  const rateLimitResponse = await withRateLimit(req, 'sync')
  if (rateLimitResponse) return rateLimitResponse
  
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('🔄 Cron job started: Syncing all connections')
    
    // Get all active connections
    const { data: connections, error } = await supabase
      .from('stripe_connections')
      .select('id, stripe_account_id, user_id, business_name')
      .eq('is_active', true)
      .limit(10)
    
    if (error) {
      console.error('Failed to fetch connections:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    
    if (!connections || connections.length === 0) {
      console.log('⚠️ No active connections to sync')
      return NextResponse.json({
        success: true,
        message: 'No active connections to sync',
        synced: 0,
        failed: 0,
      })
    }
    
    console.log(`📊 Found ${connections.length} connection(s) to sync`)
    
    let successCount = 0
    let failCount = 0
    const results = []
    
    // Sync each connection
    for (const connection of connections) {
      try {
        console.log(`\n🔄 Syncing: ${connection.stripe_account_id}`)
        
        const engine = await createMetricsEngine(connection.id, supabase)
        await engine.syncMetrics(false) // Incremental sync
        
        successCount++
        results.push({
          connectionId: connection.id,
          stripeAccountId: connection.stripe_account_id,
          businessName: connection.business_name,
          status: 'success',
          syncedAt: new Date().toISOString(),
        })
        
        console.log(`✅ Successfully synced: ${connection.stripe_account_id}`)
        
      } catch (error) {
        failCount++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        console.error(`❌ Failed to sync ${connection.stripe_account_id}:`, errorMessage)
        
        results.push({
          connectionId: connection.id,
          stripeAccountId: connection.stripe_account_id,
          businessName: connection.business_name,
          status: 'error',
          error: errorMessage,
        })
      }
    }
    
    console.log(`\n✅ Cron job complete: ${successCount} synced, ${failCount} failed`)
    
    return NextResponse.json({
      success: true,
      message: `Synced ${successCount} connection(s), ${failCount} failed`,
      synced: successCount,
      failed: failCount,
      results,
    })
    
  } catch (error) {
    console.error('❌ Cron job error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
