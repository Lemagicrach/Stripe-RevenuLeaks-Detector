// lib/data-mode.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type DataMode = "demo" | "real";

export async function getUserDataMode(): Promise<DataMode> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // App Router server components: no-op here
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return "demo"; // if not logged in, demo is safer for marketing previews

  // Ensure row exists
  const { data: settings } = await supabase
    .from("user_settings")
    .select("data_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!settings) {
    // create default row
    await supabase.from("user_settings").insert({ user_id: user.id, data_mode: "real" });
    return "real";
  }

  return (settings.data_mode as DataMode) ?? "real";
}
