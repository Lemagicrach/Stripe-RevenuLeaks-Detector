// app/admin/settings/toggle.tsx
"use client";

import { useState } from "react";

export default function DataModeToggle({ initialMode }: { initialMode: "demo" | "real" }) {
  const [mode, setMode] = useState<"demo" | "real">(initialMode);
  const [saving, setSaving] = useState(false);

  async function update(next: "demo" | "real") {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/data-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data_mode: next }),
      });

      if (!res.ok) throw new Error("Failed");
      setMode(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Data mode</div>
          <div className="text-xs text-slate-300">
            Demo mode is great for screenshots and onboarding with no real Stripe data.
          </div>
        </div>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs ring-1 ring-slate-800">
          {mode.toUpperCase()}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          disabled={saving}
          onClick={() => update("demo")}
          className={`rounded-md px-3 py-2 text-xs font-semibold ${
            mode === "demo" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-100"
          }`}
        >
          Use Demo Data
        </button>
        <button
          disabled={saving}
          onClick={() => update("real")}
          className={`rounded-md px-3 py-2 text-xs font-semibold ${
            mode === "real" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-100"
          }`}
        >
          Use Real Data
        </button>
      </div>

      {saving && <p className="mt-2 text-xs text-slate-400">Saving…</p>}
    </div>
  );
}

