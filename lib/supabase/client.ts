import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let browserClient: ReturnType<typeof createBrowserClient> | null = null

function getClientEnv() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return { supabaseUrl, supabaseKey }
}

export const createClient = () => {
  const { supabaseUrl: url, supabaseKey: key } = getClientEnv()
  return createBrowserClient(url, key)
}

// Backward-compatible API used across the app.
export const getBrowserSupabaseClient = () => {
  if (!browserClient) {
    browserClient = createClient()
  }
  return browserClient
}
