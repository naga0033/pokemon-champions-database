// スコヴィラン シングル M-1 の技リストを修正:
//   - 「みかわり」→「みがわり」(OCR誤字)
import { createClient } from "@supabase/supabase-js";

const URL = "https://ilziiwrrfxhbvjhqiavh.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsemlpd3JyZnhoYnZqaHFpYXZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1NDU4NiwiZXhwIjoyMDkxODMwNTg2fQ.L-pf-IcXK5FVGW7k2G3s-igSKx6nPRNwqZrr6YzOMKA";

const sb = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// シングルの行を取得
const { data: rows, error: fetchErr } = await sb
  .from("pokemon_details")
  .select("*")
  .eq("pokemon_slug", "scovillain")
  .eq("season_id", "M-1")
  .eq("format", "single");

if (fetchErr) {
  console.error("Fetch error:", fetchErr);
  process.exit(1);
}
if (!rows || rows.length === 0) {
  console.error("No rows found");
  process.exit(1);
}

const row = rows[0];
console.log("Before:", JSON.stringify(row.moves.find((m) => m.name === "みかわり" || m.name === "みがわり")));

// moves 内の「みかわり」を「みがわり」に置換
const fixedMoves = row.moves.map((m) =>
  m.name === "みかわり" ? { ...m, name: "みがわり" } : m,
);

const { error: updateErr } = await sb
  .from("pokemon_details")
  .update({ moves: fixedMoves, updated_at: new Date().toISOString() })
  .eq("pokemon_slug", "scovillain")
  .eq("season_id", "M-1")
  .eq("format", "single");

if (updateErr) {
  console.error("Update error:", updateErr);
  process.exit(1);
}

console.log("After:", JSON.stringify(fixedMoves.find((m) => m.name === "みがわり")));
console.log("✅ スコヴィラン シングルの技リスト修正完了");
