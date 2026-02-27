import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  
  try {
    const tests = await Promise.all([
      supabase.from('stripe_connections').select('id').limit(1),
      supabase.from('metrics_snapshots').select('id').limit(1),
      supabase.from('subscriptions_cache').select('id').limit(1),
      supabase.from('customers_cache').select('id').limit(1),
      supabase.from('cohorts').select('id').limit(1),
    ])
    
    return NextResponse.json({
      success: true,
      message: 'All tables accessible',
      tables: {
        stripe_connections: tests[0].error ? 'FAILED' : 'OK',
        metrics_snapshots: tests[1].error ? 'FAILED' : 'OK',
        subscriptions_cache: tests[2].error ? 'FAILED' : 'OK',
        customers_cache: tests[3].error ? 'FAILED' : 'OK',
        cohorts: tests[4].error ? 'FAILED' : 'OK',
      },
      errors: tests.map(t => t.error).filter(e => e)
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
