// ダブルランキング(M-1)の誤登録を修正
// 使い方:
//   node scripts/fix-double-rankings.mjs          # dry run
//   node scripts/fix-double-rankings.mjs --apply  # 実行
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
const FORMAT = "double";

// 修正リスト: rank → { slug, ja }
const CORRECTIONS = [
  { rank: 39,  slug: "ninetales-alola",    ja: "アローラキュウコン" },
  { rank: 45,  slug: "arcanine-hisui",     ja: "ヒスイウインディ" },
  { rank: 51,  slug: "zoroark-hisui",      ja: "ゾロアーク(ヒスイ)" },
  { rank: 74,  slug: "goodra-hisui",       ja: "ヌメルゴン(ヒスイ)" },
  { rank: 78,  slug: "tauros-paldea-aqua", ja: "パルデアケンタロス(水)" },
  { rank: 95,  slug: "slowking-galar",     ja: "ガラルヤドキング" },
  { rank: 108, slug: "decidueye-hisui",    ja: "ヒスイジュナイパー" },
  { rank: 109, slug: "slowking",           ja: "ヤドキング" },
  { rank: 111, slug: "rotom-mow",          ja: "カットロトム" },
  { rank: 134, slug: "typhlosion",         ja: "バクフーン" },
  { rank: 140, slug: "ninetales",          ja: "キュウコン" },
  { rank: 156, slug: "meowstic-female",    ja: "ニャオニクス(メス)" },
  { rank: 173, slug: "avalugg-hisui",      ja: "ヒスイクレベース" },
  { rank: 175, slug: "zoroark",            ja: "ゾロアーク" },
  { rank: 182, slug: "avalugg",            ja: "クレベース" },
  { rank: 186, slug: "rotom-fan",          ja: "スピンロトム" },
  { rank: 197, slug: "tauros-paldea-combat", ja: "パルデアケンタロス(格闘)" },
  { rank: 209, slug: "stunfisk-galar",     ja: "ガラルマッギョ" },
];

// 現在の状態を取得
const { data: current } = await sb
  .from("rankings")
  .select("rank, pokemon_ja, pokemon_slug")
  .eq("season_id", SEASON)
  .eq("format", FORMAT)
  .in("rank", CORRECTIONS.map(c => c.rank));

console.log("=== 変更内容 ===");
for (const c of CORRECTIONS) {
  const cur = current.find(r => r.rank === c.rank);
  const already = cur?.pokemon_slug === c.slug && cur?.pokemon_ja === c.ja;
  const arrow = already ? "✓ 既に正しい" : `${cur?.pokemon_ja}(${cur?.pokemon_slug}) → ${c.ja}(${c.slug})`;
  console.log(`  ${c.rank}位: ${arrow}`);
}

if (!APPLY) {
  console.log("\n⏸  dry run。--apply で実行。");
  process.exit(0);
}

// 既存 pokemon_details slugを取得
const { data: existingDetails } = await sb
  .from("pokemon_details")
  .select("pokemon_slug")
  .eq("season_id", SEASON)
  .eq("format", FORMAT);
const existingSlugs = new Set(existingDetails.map(d => d.pokemon_slug));

console.log("\n🚀 DB反映中...");

for (const c of CORRECTIONS) {
  // 1. rankings 更新
  const { error: rErr } = await sb
    .from("rankings")
    .update({ pokemon_slug: c.slug, pokemon_ja: c.ja })
    .eq("season_id", SEASON)
    .eq("format", FORMAT)
    .eq("rank", c.rank);
  if (rErr) { console.error(`rankings rank=${c.rank}:`, rErr); process.exit(1); }
  console.log(`✓ rankings ${c.rank}位 → ${c.ja}(${c.slug})`);

  // 2. pokemon_details: 新slug が未登録なら空レコード作成
  if (!existingSlugs.has(c.slug)) {
    const { error: dErr } = await sb
      .from("pokemon_details")
      .insert({
        season_id: SEASON,
        format: FORMAT,
        rank: c.rank,
        pokemon_ja: c.ja,
        pokemon_slug: c.slug,
        dex_no: null,
        moves: null,
        items: null,
        abilities: null,
        natures: null,
        evs: null,
        partners: null,
        updated_at: new Date().toISOString(),
      });
    if (dErr) { console.error(`pokemon_details insert ${c.slug}:`, dErr); process.exit(1); }
    console.log(`  ↳ pokemon_details 新規追加: ${c.slug}`);
    existingSlugs.add(c.slug);
  }
}

console.log("\n🎉 完了！");
