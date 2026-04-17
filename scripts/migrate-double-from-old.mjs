// 旧プロジェクトからダブル(M-1)データを新プロジェクトへ移行
// - rankings
// - pokemon_details

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = Object.fromEntries(
  envText.split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=", 2))
);

// 旧プロジェクト (anon key で読み取り)
const OLD_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const OLD_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 新プロジェクト (service role で書き込み)
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const payload = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64").toString());
const NEW_URL = `https://${payload.ref}.supabase.co`;

console.log(`旧: ${OLD_URL}`);
console.log(`新: ${NEW_URL}`);
console.log();

const oldSb = createClient(OLD_URL, OLD_ANON);
const newSb = createClient(NEW_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEASON = "M-1";
const FORMAT = "double";

// 1. 旧プロジェクトから読み取り
const { data: oldRankings, error: rErr } = await oldSb
  .from("rankings")
  .select("*")
  .eq("season_id", SEASON)
  .eq("format", FORMAT)
  .order("rank", { ascending: true });
if (rErr) { console.error(rErr); process.exit(1); }

const { data: oldDetails, error: dErr } = await oldSb
  .from("pokemon_details")
  .select("*")
  .eq("season_id", SEASON)
  .eq("format", FORMAT);
if (dErr) { console.error(dErr); process.exit(1); }

console.log(`📖 旧プロジェクトから取得:`);
console.log(`   rankings: ${oldRankings.length}件`);
console.log(`   pokemon_details: ${oldDetails.length}件`);

// 2. 新プロジェクトの現状
const { count: newRCount } = await newSb
  .from("rankings").select("*", { count: "exact", head: true })
  .eq("season_id", SEASON).eq("format", FORMAT);
const { count: newDCount } = await newSb
  .from("pokemon_details").select("*", { count: "exact", head: true })
  .eq("season_id", SEASON).eq("format", FORMAT);
console.log();
console.log(`📊 新プロジェクトの現状:`);
console.log(`   rankings: ${newRCount}件 → ${oldRankings.length}件に置き換え予定`);
console.log(`   pokemon_details: ${newDCount}件 → ${oldDetails.length}件に置き換え予定`);

// バックアップ書き出し
writeFileSync(
  new URL(`./backup-double-migration-${Date.now()}.json`, import.meta.url),
  JSON.stringify({ oldRankings, oldDetails }, null, 2),
);
console.log();
console.log("✓ バックアップ保存");

if (!APPLY) {
  console.log();
  console.log("⏸  dry run 完了。実行するには --apply を付けてください。");
  process.exit(0);
}

// 3. 新プロジェクトのダブル(M-1)を全削除
console.log();
console.log("🚀 新プロジェクトに反映中...");

{
  const { error } = await newSb.from("rankings").delete()
    .eq("season_id", SEASON).eq("format", FORMAT);
  if (error) { console.error("rankings delete:", error); process.exit(1); }
  console.log("✓ 旧 rankings 削除");
}

{
  const { error } = await newSb.from("pokemon_details").delete()
    .eq("season_id", SEASON).eq("format", FORMAT);
  if (error) { console.error("pokemon_details delete:", error); process.exit(1); }
  console.log("✓ 旧 pokemon_details 削除");
}

// 4. seasons 行を確実に
await newSb.from("seasons").upsert({
  id: SEASON,
  label: "シーズンM-1",
  start_date: "2026-04-08",
  end_date: "2026-05-13",
  format: FORMAT,
});
console.log("✓ seasons 確保");

// 5. 旧データを新プロジェクトに insert
// id カラムは自動採番させる (新プロジェクトで衝突を避けるため)
const stripId = (rows) => rows.map(({ id, ...rest }) => rest);

for (let i = 0; i < oldRankings.length; i += 100) {
  const chunk = stripId(oldRankings.slice(i, i + 100));
  const { error } = await newSb.from("rankings").insert(chunk);
  if (error) { console.error(`rankings chunk ${i}:`, error); process.exit(1); }
  console.log(`✓ rankings insert ${i + 1}〜${i + chunk.length}`);
}

for (let i = 0; i < oldDetails.length; i += 50) {
  const chunk = stripId(oldDetails.slice(i, i + 50));
  const { error } = await newSb.from("pokemon_details").insert(chunk);
  if (error) { console.error(`pokemon_details chunk ${i}:`, error); process.exit(1); }
  console.log(`✓ pokemon_details insert ${i + 1}〜${i + chunk.length}`);
}

console.log();
console.log("🎉 完了！");
