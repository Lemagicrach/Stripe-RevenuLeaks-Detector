import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { buildPostConnectLeaksUrl, sanitizePlanId } from '@/lib/plan-flow'

function sanitizeRelativePath(path: string | null, fallback: string) {
  if (!path) return fallback
  const normalized = path.trim()
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return fallback
  return normalized
}

function clearSupabaseCookies(cookieStore: Awaited<ReturnType<typeof cookies>>, response: NextResponse) {
  cookieStore.getAll().forEach(cookie => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set({
        name: cookie.name,
        value: '',
        maxAge: 0,
        path: '/',
      })
    }
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const plan = sanitizePlanId(url.searchParams.get('plan'))
  const postConnectPath = buildPostConnectLeaksUrl(plan, { run_scan: '1' })
  const connectPath = `/api/stripe/connect?next=${encodeURIComponent(postConnectPath)}`
  const target = sanitizeRelativePath(url.searchParams.get('redirect'), connectPath)

  const cookieStore = await cookies()
  const hasSupabaseCookie = cookieStore.getAll().some(cookie => cookie.name.startsWith('sb-'))

  try {
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (user) {
      const { data: existingConnection } = await supabase
        .from('stripe_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (existingConnection) {
        return NextResponse.redirect(new URL(postConnectPath, url.origin))
      }

      return NextResponse.redirect(new URL(target, url.origin))
    }

    if (error || hasSupabaseCookie) {
      const loginUrl = new URL('/login', url.origin)
      loginUrl.searchParams.set('redirect', target)
      if (error?.code === 'refresh_token_not_found') {
        loginUrl.searchParams.set('error', 'session_expired')
      }
      const response = NextResponse.redirect(loginUrl)
      clearSupabaseCookies(cookieStore, response)
      return response
    }
  } catch (err) {
    console.error('Connect redirect failed:', err)
  }

  const signupUrl = new URL('/signup', url.origin)
  signupUrl.searchParams.set('redirect', target)
  return NextResponse.redirect(signupUrl)
}
