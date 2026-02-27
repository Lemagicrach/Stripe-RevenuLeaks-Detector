import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getServerEnv() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return { supabaseUrl, supabaseKey }
}

type CookieStoreLike = Awaited<ReturnType<typeof cookies>>

export const createClient = async (
  cookieStore: Promise<CookieStoreLike> | CookieStoreLike = cookies()
) => {
  const { supabaseUrl: url, supabaseKey: key } = getServerEnv()
  const store = await cookieStore

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if middleware refreshes user sessions.
        }
      },
    },
  })
}

// Backward-compatible API used across route handlers and utilities.
export const getSupabaseServerClient = async () => createClient(cookies())
