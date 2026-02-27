import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const CONNECT_PATH = '/api/stripe/connect'

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
  const target = url.searchParams.get('redirect') || CONNECT_PATH

  const cookieStore = await cookies()
  const hasSupabaseCookie = cookieStore.getAll().some(cookie => cookie.name.startsWith('sb-'))

  try {
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (user) {
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
