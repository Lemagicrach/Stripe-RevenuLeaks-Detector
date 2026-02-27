import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Lazily create the admin client so build doesn't explode if env is missing,
 * and we can throw a clear error instead of failing module evaluation.
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
  }

  return createClient(url, serviceKey)
}

/**
 * DELETE /api/admin/clear-connection?account=acct_xxx
 * 
 * Clears a Stripe connection to allow reconnection
 * Temporary endpoint to fix duplicate key constraint issues
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams
    const stripeAccountId = searchParams.get('account')
    
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'Missing account parameter. Usage: /api/admin/clear-connection?account=acct_xxx' },
        { status: 400 }
      )
    }
    
    console.log('🗑️ Clearing connection for:', stripeAccountId)
    
    // Delete the connection
    const { data, error } = await supabase
      .from('stripe_connections')
      .delete()
      .eq('stripe_account_id', stripeAccountId)
      .select()
    
    if (error) {
      console.error('❌ Error deleting connection:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          success: true,
          message: 'No connection found to delete',
          stripeAccountId 
        }
      )
    }
    
    console.log('✅ Connection deleted:', data[0].id)
    
    return NextResponse.json({
      success: true,
      message: 'Connection cleared successfully! You can now reconnect your Stripe account.',
      deleted: {
        id: data[0].id,
        stripeAccountId: data[0].stripe_account_id,
        businessName: data[0].business_name,
      }
    })
    
  } catch (error) {
    console.error('❌ Clear connection error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/clear-connection?account=acct_xxx
 * 
 * Check if a connection exists (without deleting)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams
    const stripeAccountId = searchParams.get('account')
    
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'Missing account parameter' },
        { status: 400 }
      )
    }
    
    const { data, error } = await supabase
      .from('stripe_connections')
      .select('*')
      .eq('stripe_account_id', stripeAccountId)
      .maybeSingle()
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      exists: !!data,
      connection: data ? {
        id: data.id,
        stripeAccountId: data.stripe_account_id,
        businessName: data.business_name,
        isActive: data.is_active,
        createdAt: data.created_at,
      } : null
    })
    
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
