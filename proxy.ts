// /proxy.ts

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(cookie => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set({
        name: cookie.name,
        value: '',
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
      })
    }
  })
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ============================================
  // 1. SECURITY HEADERS - Apply to all requests
  // ============================================
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Set security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const connectSources = [
    "'self'",
    'https://*.supabase.co',
    'https://api.stripe.com',
    'https://vercel.live',
    'wss://*.supabase.co',
    'https://va.vercel-scripts.com',
  ]

  if (appUrl) {
    connectSources.push(appUrl)
  }

  // Content Security Policy
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://vercel.live https://va.vercel-scripts.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' data:;
    connect-src ${connectSources.join(' ')};
    frame-src https://js.stripe.com https://hooks.stripe.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim()

  response.headers.set('Content-Security-Policy', cspHeader)

  // ============================================
  // 2. CRON JOB PROTECTION
  // ============================================
  if (pathname.startsWith('/api/cron/')) {
    const cronSecret = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      console.error('❌ CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      )
    }

    if (cronSecret !== `Bearer ${expectedSecret}`) {
      console.warn('⚠️ Unauthorized CRON access attempt:', pathname)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // CRON request authorized, continue
    return response
  }

  // ============================================
  // 3. PUBLIC ROUTES - No authentication needed
  // ============================================
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/connect',
    '/pricing',
    '/pricing-new',
    '/terms',
    '/privacy',
    '/auth/callback',
    '/auth/confirm',
    '/api/health',
    '/api/webhooks/stripe-billing',
  ]

  const protectedPaths = [
    '/dashboard',
    '/onboarding',
    '/insights',
    '/benchmarks',
    '/products',
    '/alerts',
    '/analytics',
    '/settings',
    '/admin',
    '/api/metrics',
    '/api/stripe',
    '/api/user',
    '/api/admin',
    '/api/insights',
    '/api/churn',
    '/api/scenarios',
    '/api/benchmarks',
    '/api/usage',
    '/api/create-checkout',
    '/api/create-portal',
    '/api/sync-stripe-session',
    '/api/track',
    '/api/products',
    '/api/alerts',
  ]

  const isPublicRoute = publicRoutes.some(route => {
    if (route === pathname) return true
    if (route.endsWith('/*') && pathname.startsWith(route.slice(0, -2))) return true
    return false
  })

  if (isPublicRoute) {
    return response
  }

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY

  // Avoid runtime crashes when env vars are missing.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      'Supabase auth not configured: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )

    if (isProtectedPath) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Server misconfigured: Supabase auth env vars are missing' },
          { status: 500 }
        )
      }

      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'server_config_missing')
      loginUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  // 4. AUTHENTICATION CHECK
// ============================================
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        // ✅ CORRECTION 1: Simplifier 'set' pour manipuler uniquement la 'response' de sortie
        set(name: string, value: string, options: CookieOptions) {
          // Ne pas manipuler 'request.cookies', seulement la réponse à renvoyer
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        // ✅ CORRECTION 2: Simplifier 'remove'
        remove(name: string, options: CookieOptions) {
          // Ne pas manipuler 'request.cookies', seulement la réponse à renvoyer
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Tenter de récupérer la session utilisateur. Cela mettra à jour les cookies si la session doit être renouvelée.
  let user = null
  let authErrorCode: string | undefined
  try {
    const { error: sessionError } = await supabase.auth.getSession()
    if (sessionError?.code) {
      authErrorCode = sessionError.code
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError?.code) {
      authErrorCode = userError.code
    }
    user = userData.user
  } catch (error) {
    console.error('Supabase auth check failed:', error)
    authErrorCode = authErrorCode ?? 'auth_check_failed'
  }


  // ============================================
  // 5. PROTECTED ROUTES - Require authentication
  // ... (le reste de cette section est inchangé et correct)
  // ============================================
  if (isProtectedPath && !user) {
    const redirectPath = `${pathname}${request.nextUrl.search}`

    if (pathname.startsWith('/api/')) {
      const apiResponse = NextResponse.json(
        { error: authErrorCode === 'refresh_token_not_found' ? 'Session expired' : 'Unauthorized' },
        { status: 401 }
      )
      if (authErrorCode === 'refresh_token_not_found') {
        clearSupabaseCookies(request, apiResponse)
      }
      return apiResponse
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', redirectPath)
    if (authErrorCode === 'refresh_token_not_found') {
      loginUrl.searchParams.set('error', 'session_expired')
    }
    const loginResponse = NextResponse.redirect(loginUrl)
    if (authErrorCode === 'refresh_token_not_found') {
      clearSupabaseCookies(request, loginResponse)
    }
    return loginResponse
  }

  // ============================================
  // 6. AUTH ROUTES - Redirect if already logged in
  // ... (le reste de cette section est inchangé et correct)
  // ============================================
  const authRoutes = ['/login', '/signup']
  const isAuthRoute = authRoutes.includes(pathname)

  if (isAuthRoute && user) {
    // User is already authenticated, redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

// ============================================
// PROXY CONFIGURATION
// ============================================
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - static files (.png, .jpg, .svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
