// server-only
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable'
    )
  }

  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        get: (key) => cookieStore.get(key)?.value,
      },
    }
  );
}
