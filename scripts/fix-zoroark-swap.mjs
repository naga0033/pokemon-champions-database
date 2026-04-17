// 62位と144位の ゾロアーク(通常) と ゾロアーク(ヒスイ) の順位を入れ替え
// 実際のランキング: 62位=ヒスイゾロアーク, 144位=通常ゾロアーク
// 使い方:
//   node scripts/fix-zoroark-swap.mjs          # dry run
//   node scripts/fix-zoroark-swap.mjs --apply  # 実行
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = Object.fromEntries(
  envText.split("\n").filter(l => l && !l.startsWith("#") && l.includes("=")).map(l => l.split("=", 2))
);
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const payload = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64").toString());
const url = `https://${payload.ref}.supabase.co`;
const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const SEASON = "M-1";
const FORMAT = "single";

console.log(`対象: season=${SEASON}, format=${FORMAT}`);
console.log("変更内容:");
console.log("  rankings rank=62  : zoroark → zoroark-hisui");
console.log("  rankings rank=144 : zoroark-hisui → zoroark");
console.log("  pokemon_details zoroark        : rank 62 → 144");
console.log("  pokemon_details zoroark-hisui  : rank 144 → 62");
console.log();

if (!APPLY) {
  console.log("⏸  dry run。--apply で実行。");
  process.exit(0);
}

// 1. rankings を入れ替え (rank はそのまま、pokemon_slug/ja を swap)
const { error: r1 } = await sb
  .from("rankings")
  .update({ pokemon_slug: "zoroark-hisui", pokemon_ja: "ゾロアーク(ヒスイ)" })
  .eq("season_id", SEASON).eq("format", FORMAT).eq("rank", 62);
if (r1) { console.error("rankings r1:", r1); process.exit(1); }
console.log("✓ rankings rank=62 → zoroark-hisui");

const { error: r2 } = await sb
  .from("rankings")
  .update({ pokemon_slug: "zoroark", pokemon_ja: "ゾロアーク" })
  .eq("season_id", SEASON).eq("format", FORMAT).eq("rank", 144);
if (r2) { console.error("rankings r2:", r2); process.exit(1); }
console.log("✓ rankings rank=144 → zoroark");

// 2. pokemon_details の rank を swap
// UNIQUE(season,format,rank) 制約があるので一時値経由で2段階 swap
const { error: d1 } = await sb
  .from("pokemon_details")
  .update({ rank: -62 })
  .eq("season_id", SEASON).eq("format", FORMAT).eq("pokemon_slug", "zoroark");
if (d1) { console.error("pokemon_details d1:", d1); process.exit(1); }

const { error: d2 } = await sb
  .from("pokemon_details")
  .update({ rank: 62 })
  .eq("season_id", SEASON).eq("format", FORMAT).eq("pokemon_slug", "zoroark-hisui");
if (d2) { console.error("pokemon_details d2:", d2); process.exit(1); }
console.log("✓ pokemon_details zoroark-hisui: rank → 62");

const { error: d3 } = await sb
  .from("pokemon_details")
  .update({ rank: 144 })
  .eq("season_id", SEASON).eq("format", FORMAT).eq("pokemon_slug", "zoroark");
if (d3) { console.error("pokemon_details d3:", d3); process.exit(1); }
console.log("✓ pokemon_details zoroark: rank → 144");

console.log("\n🎉 完了");
