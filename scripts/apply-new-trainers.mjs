// トレーナーランキングを trainers テーブルに反映
// 既存の (season_id, format) を全削除してから新規 insert

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const FILE = process.argv.find((a) => a.endsWith(".json")) ?? "./new-trainers-single.json";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = Object.fromEntries(
  envText.split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=", 2))
);

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const payload = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64").toString());
const url = `https://${payload.ref}.supabase.co`;

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const data = JSON.parse(readFileSync(new URL(FILE, import.meta.url), "utf-8"));
const { seasonId, format, trainers } = data;

console.log(`📋 シーズン: ${seasonId} / フォーマット: ${format}`);
console.log(`📋 エントリ数: ${trainers.length}`);

// 現在の件数確認
const { count: currentCount } = await sb
  .from("trainers")
  .select("*", { count: "exact", head: true })
  .eq("season_id", seasonId)
  .eq("format", format);
console.log(`📊 現在の登録数: ${currentCount}`);

if (!APPLY) {
  console.log();
  console.log("⏸  dry run 完了。実行するには --apply を付けてください。");
  process.exit(0);
}

// バックアップ取得
const { data: backup } = await sb
  .from("trainers").select("*")
  .eq("season_id", seasonId).eq("format", format);
writeFileSync(
  new URL(`./backup-trainers-${seasonId}-${format}-${Date.now()}.json`, import.meta.url),
  JSON.stringify(backup, null, 2),
);
console.log("✓ バックアップ保存");

// 既存削除
const { error: dErr } = await sb.from("trainers").delete()
  .eq("season_id", seasonId).eq("format", format);
if (dErr) { console.error("delete:", dErr); process.exit(1); }
console.log("✓ 旧データ削除");

// 新規 insert
const rows = trainers.map((t) => ({
  season_id: seasonId,
  format,
  rank: t.rank,
  name: t.name,
  rating: t.rating,
  country: t.country ?? null,
}));

for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100);
  const { error } = await sb.from("trainers").insert(chunk);
  if (error) { console.error(`insert ${i}:`, error); process.exit(1); }
  console.log(`✓ insert ${i + 1}〜${i + chunk.length}`);
}

console.log();
console.log("🎉 完了！");
