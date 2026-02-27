import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Stripe from 'stripe'
import { encrypt } from '@/lib/encryption'
import { withRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { apiKey } = await req.json()
    
    if (!apiKey || !apiKey.startsWith('sk_')) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      )
    }
    
    let stripe: Stripe
    try {
      stripe = new Stripe(apiKey, {
        apiVersion: '2023-10-16',
      })
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid Stripe API key' },
        { status: 400 }
      )
    }
    
    let account: Stripe.Account
    try {
      account = await stripe.accounts.retrieve()
    } catch (error: any) {
      console.error('Stripe API error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to connect to Stripe',
          details: error.message 
        },
        { status: 400 }
      )
    }
    
    console.log('Successfully connected to Stripe account:', account.id)
    
    const encryptedKey = encrypt(apiKey)
    
    const { error: dbError } = await supabase
      .from('stripe_connections')
      .upsert({
        user_id: user.id,
        stripe_account_id: account.id,
        access_token: encryptedKey,
        business_name: account.business_profile?.name || 
                       account.settings?.dashboard?.display_name || 
                       'My Business',
        currency: account.default_currency?.toUpperCase() || 'USD',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'user_id',
      })
    
    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      )
    }
    
    console.log('Connection saved to database')
    
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        stripeAccountId: account.id,
        fullSync: true 
      }),
    }).catch(err => {
      console.error('Sync trigger failed (non-critical):', err)
    })
    
    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        name: account.business_profile?.name || 'Your Business',
        currency: account.default_currency
      }
    })
    
  } catch (error: any) {
    console.error('Connect error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}