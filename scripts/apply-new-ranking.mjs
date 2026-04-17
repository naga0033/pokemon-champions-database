// 新しいランキング(M-1/single)をDBに反映するスクリプト
// - rankings: 全213件を upsert (rank でコンフリクト解決)
// - pokemon_details: 新規ポケモンのみ空レコードとして insert
// - 既存ポケモンの pokemon_details はそのまま残る (slugキー)
//
// 使い方:
//   node scripts/apply-new-ranking.mjs         # dry run (プレビューのみ)
//   node scripts/apply-new-ranking.mjs --apply # 実行

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

// .env.local 読み込み
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = Object.fromEntries(
  envText.split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=", 2))
);

// 新Supabaseプロジェクト(ilziiwrrfxhbvjhqiavh)に書き込む
// .env.local の NEXT_PUBLIC_SUPABASE_URL は旧プロジェクトのままなので service role keyの ref から決定
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
let url = env.NEXT_PUBLIC_SUPABASE_URL;
if (serviceKey) {
  const payload = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64").toString());
  url = `https://${payload.ref}.supabase.co`;
  console.log(`🔑 service role key の ref: ${payload.ref}`);
  console.log(`→ URL: ${url}`);
}
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const key = serviceKey ?? anonKey;

if (!url || !key) {
  console.error("Supabase credentials not found in .env.local");
  process.exit(1);
}

if (!serviceKey) {
  console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY 未設定 - 書き込み時に RLS エラーが発生する可能性");
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 新ランキングデータ
const newRanking = JSON.parse(
  readFileSync(new URL("./new-ranking-single.json", import.meta.url), "utf-8")
);

// pokemon-names.ts の EN_TO_JA を直接読み込む (簡易パース)
const namesText = readFileSync(
  new URL("../lib/pokemon-names.ts", import.meta.url),
  "utf-8",
);

// EN_TO_JA のエントリをパース
const EN_TO_JA = {};
const regex = /["']?([a-z][a-z0-9-]*)["']?\s*:\s*"([^"]+)"/g;
let match;
// EN_TO_JA の範囲内だけ抽出
const startIdx = namesText.indexOf("EN_TO_JA");
const endIdx = namesText.indexOf("};", startIdx);
const section = namesText.slice(startIdx, endIdx);
while ((match = regex.exec(section)) !== null) {
  EN_TO_JA[match[1]] = match[2];
}

// フォームエイリアス (pokemon-names.ts の POKEMON_ALIAS に相当)
const POKEMON_ALIAS = {
  "フラエッテ": "フラエッテ(えいえん)",
  "黒バドレックス": "バドレックス(こくばじょう)",
  "白バドレックス": "バドレックス(はくばじょう)",
  "連撃ウーラオス": "ウーラオス(れんげき)",
  "一撃ウーラオス": "ウーラオス(いちげき)",
  // 既存 names テーブルの形式に揃える
  "ヒスイヌメルゴン": "ヌメルゴン(ヒスイ)",
  "ヒスイゾロアーク": "ゾロアーク(ヒスイ)",
};

// pokemon-names.ts にまだ無いフォーム違い slug を追加 (将来 names ファイルへも反映推奨)
const EXTRA_FORM_SLUGS = {
  "ガラルヤドラン": "slowbro-galar",
  "ヒスイジュナイパー": "decidueye-hisui",
  "アローラライチュウ": "raichu-alola",
  "ガラルマッギョ": "stunfisk-galar",
  // チャンピオンズ固有名称
  "デスバーン": "runerigus",
};

// 日本語名 → slug 逆引き
const JA_TO_EN = {};
for (const [en, ja] of Object.entries(EN_TO_JA)) {
  JA_TO_EN[ja] = en;
}

function resolveSlug(jaName) {
  // 特殊フォーム (names ファイルに無いもの)
  if (EXTRA_FORM_SLUGS[jaName]) return EXTRA_FORM_SLUGS[jaName];

  const normalized = POKEMON_ALIAS[jaName] ?? jaName;
  if (JA_TO_EN[normalized]) return JA_TO_EN[normalized];

  // 前方一致/部分一致
  for (const [ja, en] of Object.entries(JA_TO_EN)) {
    if (ja === normalized) return en;
  }
  return null;
}

function resolveJaName(jaName) {
  if (EXTRA_FORM_SLUGS[jaName]) return jaName; // そのまま
  const normalized = POKEMON_ALIAS[jaName] ?? jaName;
  if (JA_TO_EN[normalized]) return normalized;
  return jaName;
}

// --- メイン処理 ---

const SEASON = newRanking.seasonId;
const FORMAT = newRanking.format;

console.log(`📋 シーズン: ${SEASON} (${FORMAT})`);
console.log(`📋 エントリ数: ${newRanking.entries.length}`);
console.log();

// 現在の pokemon_details を取得 (重複チェック用)
const { data: existingDetails, error: eErr } = await supabase
  .from("pokemon_details")
  .select("pokemon_slug, pokemon_ja, rank")
  .eq("season_id", SEASON)
  .eq("format", FORMAT);

if (eErr) { console.error(eErr); process.exit(1); }

const existingSlugs = new Set(existingDetails.map((d) => d.pokemon_slug));
console.log(`現在の pokemon_details 登録数: ${existingSlugs.size}`);

// 新ランキングから rankings テーブル行を生成
const rankingRows = [];
const detailRowsToCreate = [];
const unresolvable = [];

// slug の重複を追跡 (ランキング内で同じ slug が複数回出る場合)
const seenSlugs = new Set();

for (const e of newRanking.entries) {
  const slug = resolveSlug(e.pokemonJa);
  const jaName = resolveJaName(e.pokemonJa);

  if (!slug) {
    unresolvable.push({ rank: e.rank, name: e.pokemonJa });
  }

  const finalSlug = slug ?? "unknown";
  rankingRows.push({
    season_id: SEASON,
    format: FORMAT,
    rank: e.rank,
    pokemon_ja: jaName,
    pokemon_slug: finalSlug,
    tera_icons: e.teraIcons ?? null,
  });

  // pokemon_details に新規追加すべきか判定
  // - 既に登録済みの slug はスキップ (データ保持)
  // - slug が "unknown" はスキップ (ユーザー手動対応)
  // - 同一スクリプト内で同じ slug を2度作らない
  if (finalSlug !== "unknown" && !existingSlugs.has(finalSlug) && !seenSlugs.has(finalSlug)) {
    detailRowsToCreate.push({
      season_id: SEASON,
      format: FORMAT,
      rank: e.rank,
      pokemon_ja: jaName,
      pokemon_slug: finalSlug,
      dex_no: null,
      moves: null,
      items: null,
      abilities: null,
      natures: null,
      evs: null,
      partners: null,
      updated_at: new Date().toISOString(),
    });
    seenSlugs.add(finalSlug);
  }
}

// レポート出力
console.log();
console.log(`✏️  rankings 更新対象: ${rankingRows.length}件`);
console.log(`✨ pokemon_details 新規作成: ${detailRowsToCreate.length}件`);
console.log(`⚠️  slug解決できなかった名前: ${unresolvable.length}件`);

if (unresolvable.length > 0) {
  console.log();
  console.log("--- 要手動確認 (slug=unknown) ---");
  unresolvable.forEach((u) => console.log(`  ${u.rank}位 ${u.name}`));
}

// 新規追加リストも表示
console.log();
console.log("--- 新規登録されるポケモン ---");
detailRowsToCreate.forEach((d) => console.log(`  ${d.rank}位 ${d.pokemon_ja} (${d.pokemon_slug})`));

// プレビューファイルに書き出し
writeFileSync(
  new URL("./preview-ranking-rows.json", import.meta.url),
  JSON.stringify({
    rankingRows,
    detailRowsToCreate,
    unresolvable,
  }, null, 2),
);
console.log();
console.log("→ scripts/preview-ranking-rows.json にプレビュー出力");

if (!APPLY) {
  console.log();
  console.log("⏸  dry run 完了。実行するには --apply を付けてください。");
  process.exit(0);
}

// --- 実行 ---
console.log();
console.log("🚀 DB に反映中...");

// バックアップ: 現在のランキングと詳細を保存 (復旧用)
const { data: backupRankings } = await supabase
  .from("rankings")
  .select("*")
  .eq("season_id", SEASON)
  .eq("format", FORMAT);
const { data: backupDetails } = await supabase
  .from("pokemon_details")
  .select("*")
  .eq("season_id", SEASON)
  .eq("format", FORMAT);

writeFileSync(
  new URL(`./backup-${SEASON}-${FORMAT}-${Date.now()}.json`, import.meta.url),
  JSON.stringify({ rankings: backupRankings, details: backupDetails }, null, 2),
);
console.log("✓ バックアップ保存");


// 1. seasons テーブル (メタ情報更新)
const { error: sErr } = await supabase.from("seasons").upsert({
  id: SEASON,
  label: newRanking.seasonLabel,
  start_date: newRanking.startDate,
  end_date: newRanking.endDate,
  format: FORMAT,
});
if (sErr) { console.error("seasons:", sErr); process.exit(1); }
console.log("✓ seasons 更新");

// 2. rankings upsert - 古い順位のデータも削除する必要がある
// 新ランキングの範囲外の rank (214以上) が残らないよう、まず全削除
const { error: dErr } = await supabase
  .from("rankings")
  .delete()
  .eq("season_id", SEASON)
  .eq("format", FORMAT);
if (dErr) { console.error("rankings delete:", dErr); process.exit(1); }
console.log("✓ 旧 rankings 削除");

// 新規 insert (100件ずつに分割)
for (let i = 0; i < rankingRows.length; i += 100) {
  const chunk = rankingRows.slice(i, i + 100);
  const { error } = await supabase.from("rankings").insert(chunk);
  if (error) { console.error(`rankings chunk ${i}:`, error); process.exit(1); }
  console.log(`✓ rankings insert ${i + 1}〜${i + chunk.length}`);
}

// 3. pokemon_details 新規作成
if (detailRowsToCreate.length > 0) {
  for (let i = 0; i < detailRowsToCreate.length; i += 50) {
    const chunk = detailRowsToCreate.slice(i, i + 50);
    const { error } = await supabase.from("pokemon_details").insert(chunk);
    if (error) { console.error(`pokemon_details chunk ${i}:`, error); process.exit(1); }
    console.log(`✓ pokemon_details insert ${i + 1}〜${i + chunk.length}`);
  }
}

console.log();
console.log("🎉 完了！");
