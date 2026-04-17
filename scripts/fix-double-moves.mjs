// ダブルバトル全ポケモンの技データを一括修正
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = Object.fromEntries(
  envText.split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=", 2))
);

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const payload = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64").toString());
const sb = createClient(`https://${payload.ref}.supabase.co`, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// === 修正マッピング ===
// 優先度順: まず完全一致チェック → 末尾ゴミ除去 → 再チェック
const EXACT_FIXES = {
  "ぽうふぅ": "ぼうふう",   // dragoniteのhurricane OCR誤読
  "ぉいかせ⑦": "おいかぜ",  // dragoniteのtailwind OCR誤読
  "ぼうふ": "ぼうふう",      // hurricaneの表記ミス
  "だくりゅ": "だくりゅう",  // muddy-waterの表記ミス
  "アクアプレイク": "アクアブレイク",
  "フレアドライプ": "フレアドライブ",
  "プレイブバード": "ブレイブバード",
  "ボデイプレス": "ボディプレス",
  "つるぎのまぃ": "つるぎのまい",
  "さいみんじゅっ": "さいみんじゅつ",
  "しんそ": "しんそく",
  "とぐろを": "とぐろをまく",
  "りゅうのはど": "りゅうのはどう",
  "ねっぷ": "ねっぷう",
  "ふぶ": "ふぶき",
  "かえんほうし": "かえんほうしゃ",
  "もろはのずつ": "もろはのずつき",
  "ねっ": "ねっとう",
  "てっぺ": "てっぺき",
  "あくのはど": "あくのはどう",
  "うそな": "うそなき",
  "かふんだんごO": "かふんだんご",
  "じこさいせいO": "じこさいせい",
  "めいそうC": "めいそう",
  "トリックルームC": "トリックルーム",
  "ちからをすいとるし": "ちからをすいとる",
  "サイコファング氷": "サイコファング",
  "10まんばり": "10まんばりき",
};

// 末尾から除去する文字 (◎ * （ 〇 ○ ☆ ★ ① ー⑨ など)
const TRAILING_JUNK = /[◎\*（〇○☆★①②③④⑤⑥⑦⑧⑨]$/;

function fixName(name) {
  // 1. 完全一致チェック
  if (EXACT_FIXES[name]) return EXACT_FIXES[name];

  // 2. 末尾ゴミ除去
  const stripped = name.replace(TRAILING_JUNK, "").trim();
  if (stripped === name) return name; // 変化なし

  // 3. stripped が空 → null (削除対象)
  if (!stripped) return null;

  // 4. stripped に再度完全一致チェック
  if (EXACT_FIXES[stripped]) return EXACT_FIXES[stripped];

  return stripped;
}

function fixEntries(entries) {
  if (!entries) return { fixed: null, changed: false };
  const result = [];
  let changed = false;
  for (const e of entries) {
    const newName = fixName(e.name);
    if (newName === null) {
      // 空になった → 削除
      changed = true;
      continue;
    }
    if (newName !== e.name) {
      changed = true;
      result.push({ ...e, name: newName });
    } else {
      result.push(e);
    }
  }
  return { fixed: result, changed };
}

// === 全ダブル詳細を取得 ===
const { data: details, error } = await sb
  .from("pokemon_details")
  .select("id, pokemon_slug, moves, items")
  .eq("format", "double");

if (error) { console.error("Error:", error); process.exit(1); }

console.log(`取得件数: ${details.length}`);

const DRY_RUN = process.argv.includes("--dry");
const updates = [];

for (const d of details) {
  const { fixed: fixedMoves, changed: movesChanged } = fixEntries(d.moves);
  const { fixed: fixedItems, changed: itemsChanged } = fixEntries(d.items);

  if (!movesChanged && !itemsChanged) continue;

  const update = { id: d.id, slug: d.pokemon_slug };
  if (movesChanged) update.moves = fixedMoves;
  if (itemsChanged) update.items = fixedItems;
  updates.push(update);

  // 差分を表示
  if (movesChanged) {
    const before = d.moves.map(m => m.name);
    const after = fixedMoves.map(m => m.name);
    const changed = before.filter((n, i) => n !== after[i]);
    console.log(`\n${d.pokemon_slug}:`);
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      if (before[i] !== after[i]) {
        console.log(`  技: "${before[i] ?? "(削除)"}" → "${after[i] ?? "(削除)"}"`);
      }
    }
  }
}

console.log(`\n修正対象: ${updates.length}件`);

if (DRY_RUN) {
  console.log("--dry モード: DBは更新しません");
  process.exit(0);
}

// === バックアップ ===
const ts = Date.now();
writeFileSync(
  `scripts/backup-double-moves-fix-${ts}.json`,
  JSON.stringify(details, null, 2),
);
console.log(`バックアップ: scripts/backup-double-moves-fix-${ts}.json`);

// === DB 更新 ===
let successCount = 0;
for (const u of updates) {
  const patch = {};
  if (u.moves) patch.moves = u.moves;
  if (u.items) patch.items = u.items;

  const { error: upErr } = await sb
    .from("pokemon_details")
    .update(patch)
    .eq("id", u.id);

  if (upErr) {
    console.error(`ERR ${u.slug}:`, upErr.message);
  } else {
    successCount++;
  }
}

console.log(`\n✓ 更新完了: ${successCount}/${updates.length}件`);
