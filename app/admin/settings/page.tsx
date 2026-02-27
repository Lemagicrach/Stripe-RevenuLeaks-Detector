// app/admin/settings/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import DataModeToggle from "./toggle";

export default async function AdminSettingsPage() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  // ✅ Simple admin check:
  // Option 1: allowlist by email (fast)
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const isAdmin = adminEmails.includes(user.email ?? "");
  if (!isAdmin) redirect("/dashboard");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("data_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  const mode = (settings?.data_mode ?? "real") as "demo" | "real";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Admin Settings</h1>
        <p className="mt-2 text-sm text-slate-300">
          Toggle between demo data and real Stripe data for your account.
        </p>

        <div className="mt-6 rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
          <DataModeToggle initialMode={mode} />
        </div>
      </div>
    </main>
  );
}
