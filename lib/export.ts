// lib/export.ts
export function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? "")).join(","));
  return [headers.join(","), ...lines].join("\n");
}
