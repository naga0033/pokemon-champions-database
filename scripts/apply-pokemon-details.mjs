// ポケモン詳細データを pokemon_details テーブルに反映
// - slugベースで upsert (ポケモンベース、順位変動に影響されない)
// - 既存データは上書き (最新の詳細を反映)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const FILE = process.argv.find((a) => a.endsWith(".json")) ?? "./pokemon-details-progress.json";

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
const { seasonId, format, pokemon } = data;

console.log(`📋 シーズン: ${seasonId} / フォーマット: ${format}`);
console.log(`📋 ポケモン数: ${pokemon.length}`);

// 対象ポケモンの現在のランキングrank取得 (slug ベース)
const slugs = pokemon.map((p) => p.pokemonSlug);
const { data: rankingRows } = await sb
  .from("rankings")
  .select("rank, pokemon_slug")
  .eq("season_id", seasonId)
  .eq("format", format)
  .in("pokemon_slug", slugs);

const slugToRank = new Map();
for (const r of rankingRows ?? []) {
  slugToRank.set(r.pokemon_slug, r.rank);
}

// プレビュー表示
console.log();
for (const p of pokemon) {
  const currentRank = slugToRank.get(p.pokemonSlug) ?? "?";
  console.log(`  [${currentRank}位] ${p.pokemonJa} (${p.pokemonSlug})`);
}

if (!APPLY) {
  console.log();
  console.log("⏸  dry run 完了。実行するには --apply を付けてください。");
  process.exit(0);
}

// 既存バックアップ
const { data: backupData } = await sb
  .from("pokemon_details")
  .select("*")
  .eq("season_id", seasonId)
  .eq("format", format)
  .in("pokemon_slug", slugs);

writeFileSync(
  new URL(`./backup-pokemon-details-${Date.now()}.json`, import.meta.url),
  JSON.stringify(backupData, null, 2),
);
console.log();
console.log("✓ バックアップ保存");

// upsert 実行
let successCount = 0;
for (const p of pokemon) {
  const rankFromDb = slugToRank.get(p.pokemonSlug);
  const row = {
    season_id: seasonId,
    format,
    rank: rankFromDb ?? 999,
    pokemon_ja: p.pokemonJa,
    pokemon_slug: p.pokemonSlug,
    dex_no: p.dexNo ?? null,
    moves:     p.moves     ?? null,
    items:     p.items     ?? null,
    abilities: p.abilities ?? null,
    natures:   p.natures   ?? null,
    evs:       p.evs       ?? null,
    partners:  p.partners  ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from("pokemon_details").upsert(row, {
    onConflict: "season_id,format,pokemon_slug",
  });
  if (error) {
    console.error(`❌ ${p.pokemonJa}:`, error.message);
  } else {
    successCount++;
    console.log(`✓ ${p.pokemonJa} (${p.pokemonSlug})`);
  }
}

console.log();
console.log(`🎉 完了: ${successCount}/${pokemon.length} 件`);
