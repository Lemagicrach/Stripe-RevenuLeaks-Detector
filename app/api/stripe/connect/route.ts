import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import { withRateLimit } from '@/lib/rate-limit'
import {
  validateQueryParams,
  StripeConnectCallbackSchema,
  ValidationError,
} from '@/lib/validation-schemas'
import { getStripeServerClient, getSupabaseAdminClient } from '@/lib/server-clients'

const DEFAULT_POST_CONNECT_PATH = '/dashboard/leaks'

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

function getBaseUrl(req: NextRequest) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl)
  }
  return `${req.nextUrl.protocol}//${req.nextUrl.host}`
}

function getStripeConnectClientId() {
  const clientId = process.env.STRIPE_CLIENT_ID?.trim()
  if (!clientId) {
    throw new Error('Missing STRIPE_CLIENT_ID environment variable')
  }
  return clientId
}

function sanitizeRelativePath(path: string | null | undefined, fallback = DEFAULT_POST_CONNECT_PATH) {
  if (!path) return fallback
  const normalized = path.trim()
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return fallback
  return normalized
}

function encodeOAuthState(postConnectPath: string) {
  return Buffer.from(JSON.stringify({ next: postConnectPath }), 'utf8').toString('base64url')
}

function decodeOAuthState(state: string | undefined) {
  if (!state) return null
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { next?: string }
    return sanitizeRelativePath(parsed?.next || null)
  } catch {
    return null
  }
}

function getStripeConnectRedirectUri(req: NextRequest, appUrl: string) {
  const explicitRedirectUri = process.env.STRIPE_CONNECT_REDIRECT_URI?.trim()
  if (explicitRedirectUri) {
    return explicitRedirectUri
  }
  return `${normalizeBaseUrl(appUrl)}/api/stripe/connect`
}

export async function GET(req: NextRequest) {
  const rateLimitResponse = await withRateLimit(req, 'oauth')
  if (rateLimitResponse) return rateLimitResponse

  const requestedNextPath = req.nextUrl.searchParams.get('next')
  const postConnectPath = sanitizeRelativePath(requestedNextPath, DEFAULT_POST_CONNECT_PATH)

  // Require authenticated user for both start + callback
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const appUrl = getBaseUrl(req)
    const loginUrl = new URL('/login', appUrl)
    loginUrl.searchParams.set('error', 'auth_required')
    const connectPathWithNext = `/api/stripe/connect?next=${encodeURIComponent(postConnectPath)}`
    loginUrl.searchParams.set('redirect', connectPathWithNext)
    return NextResponse.redirect(loginUrl, { status: 302 })
  }

  try {
    const { code, state, error, error_description } = validateQueryParams(
      req.url,
      StripeConnectCallbackSchema
    )

    if (error) {
      const appUrl = getBaseUrl(req)
      const url = new URL(postConnectPath, appUrl)
      url.searchParams.set('error', 'stripe_connection_failed')
      url.searchParams.set('details', error_description || error)
      return NextResponse.redirect(url, { status: 302 })
    }

    if (!code) {
      const appUrl = getBaseUrl(req)
      const redirectUri = getStripeConnectRedirectUri(req, appUrl)
      return initiateOAuthFlow(appUrl, redirectUri, postConnectPath)
    }

    const appUrl = getBaseUrl(req)
    const callbackRedirectPath = decodeOAuthState(state) || postConnectPath
    return handleOAuthCallback(code, user.id, appUrl, callbackRedirectPath)
  } catch (error) {
    if (error instanceof ValidationError) {
      const appUrl = getBaseUrl(req)
      const url = new URL(postConnectPath, appUrl)
      url.searchParams.set('error', 'invalid_oauth_params')
      return NextResponse.redirect(url, { status: 302 })
    }

    const appUrl = getBaseUrl(req)
    const url = new URL(postConnectPath, appUrl)
    url.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(url, { status: 302 })
  }
}

async function initiateOAuthFlow(appUrl: string, redirectUri: string, postConnectPath: string) {
  try {
    const url = new URL('https://connect.stripe.com/oauth/authorize')
    const clientId = getStripeConnectClientId()

    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('scope', 'read_write')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', encodeOAuthState(postConnectPath))

    return NextResponse.redirect(url.toString())
  } catch (error) {
    console.error('Failed to initiate Stripe connection:', error)
    const url = new URL(postConnectPath, appUrl)
    url.searchParams.set('error', 'stripe_config_missing')
    url.searchParams.set('details', 'Check STRIPE_CLIENT_ID and STRIPE_CONNECT_REDIRECT_URI')
    return NextResponse.redirect(url, { status: 302 })
  }
}

async function handleOAuthCallback(
  code: string,
  userId: string,
  appUrl: string,
  postConnectPath: string
) {
  try {
    const stripe = getStripeServerClient()
    const supabaseAdmin = getSupabaseAdminClient()
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    })

    const { access_token, refresh_token, stripe_user_id, scope } = response
    if (!access_token || !stripe_user_id) {
      throw new Error('Invalid OAuth response from Stripe')
    }

    if (scope !== 'read_write') {
      throw new Error(`Invalid scope: ${scope}`)
    }

    const account = await stripe.accounts.retrieve(stripe_user_id)

    const encryptedAccessToken = encrypt(access_token)
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null

    // Check if connection already exists for this Stripe account
    const { data: existingConnection } = await supabaseAdmin
      .from('stripe_connections')
      .select('id, user_id')
      .eq('stripe_account_id', stripe_user_id)
      .maybeSingle()

    const connectionData = {
      user_id: userId,
      stripe_account_id: stripe_user_id,
      access_token_enc: encryptedAccessToken.encryptedData,
      iv: encryptedAccessToken.iv,
      auth_tag: encryptedAccessToken.authTag,
      refresh_token_enc: encryptedRefreshToken?.encryptedData || null,
      refresh_token_iv: encryptedRefreshToken?.iv || null,
      refresh_token_auth_tag: encryptedRefreshToken?.authTag || null,
      business_name:
        account.business_profile?.name || account.email || 'Unknown',
      currency: account.default_currency?.toUpperCase() || 'USD',
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    let dbError
    if (existingConnection) {
      // Update existing connection
      console.log(`🔄 Updating existing connection: ${existingConnection.id}`)
      const { error } = await supabaseAdmin
        .from('stripe_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
      dbError = error
    } else {
      // Insert new connection
      console.log('➕ Creating new connection')
      const { error } = await supabaseAdmin
        .from('stripe_connections')
        .insert({
          ...connectionData,
          last_synced_at: null,
          created_at: new Date().toISOString(),
        })
      dbError = error
    }

    if (dbError) {
      console.error('❌ Database error:', dbError)
      throw new Error(`Failed to save: ${dbError.message}`)
    }

    console.log(`✅ Stripe connection saved successfully for account: ${stripe_user_id}`)

    // ✅ FIXED: Trigger automatic sync after connection
    // Get the connection ID for sync
    const { data: newConnection } = await supabaseAdmin
      .from('stripe_connections')
      .select('id')
      .eq('stripe_account_id', stripe_user_id)
      .maybeSingle()
    
    if (newConnection?.id && appUrl && process.env.CRON_SECRET) {
      // Fire and forget - trigger background sync
      fetch(`${appUrl}/api/stripe/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        },
        body: JSON.stringify({
          stripeAccountId: stripe_user_id,
          connectionId: newConnection.id,
          force: true // Full sync on first connection
        })
      }).catch(err => {
        console.error('⚠️ Background sync trigger failed:', err)
        // Non-critical - user can manually sync
      })
      
      console.log(`🔄 Triggered background sync for connection: ${newConnection.id}`)
    }

    const successUrl = new URL(postConnectPath, appUrl)
    successUrl.searchParams.set('connected', 'true')
    successUrl.searchParams.set('account', stripe_user_id)
    successUrl.searchParams.set('run_scan', '1')
    return NextResponse.redirect(successUrl, { status: 302 })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const url = new URL(postConnectPath, appUrl)
    url.searchParams.set('error', 'connection_failed')
    url.searchParams.set('details', errorMessage)
    return NextResponse.redirect(url, { status: 302 })
  }
}
