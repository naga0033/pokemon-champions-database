// ダブルバトル全ポケモンの技データを調査し、問題のある名前を洗い出す
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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

// 正しい技名マスター（move-names.ts から主要なもの）
const CORRECT_NAMES = {
  "ぼうふう": true, "おいかぜ": true, "こごえるかぜ": true, "まもる": true,
  "ワイドガード": true, "ウェザーボール": true, "だくりゅう": true, "れいとうビーム": true,
  "ハイドロポンプ": true,
};

// 不正文字チェック (記号、括弧、丸など)
function hasBadChars(name) {
  // 末尾の (、◎、○、①-⑨、【】、※ 等
  return /[（）()①-⑨◎○【】※＊\*★☆▲△▼▽◆◇■□●○]/.test(name);
}

// 全ダブルの pokemon_details を取得
const { data: details, error } = await sb
  .from("pokemon_details")
  .select("id, pokemon_slug, moves, items, abilities, natures, partners")
  .eq("format", "double");

if (error) { console.error("Error:", error); process.exit(1); }

console.log(`取得件数: ${details.length}`);

const problems = [];

for (const d of details) {
  const moves = d.moves ?? [];
  const badMoves = moves.filter(m => hasBadChars(m.name));
  if (badMoves.length > 0) {
    problems.push({
      slug: d.pokemon_slug,
      id: d.id,
      badMoves: badMoves.map(m => m.name),
    });
  }
}

if (problems.length === 0) {
  console.log("問題なし！");
} else {
  console.log(`\n問題あり: ${problems.length}件\n`);
  for (const p of problems) {
    console.log(`${p.slug}: ${p.badMoves.join(", ")}`);
  }
}

// 全技名一覧も出力（ユニーク）
const allMoveNames = new Set();
for (const d of details) {
  (d.moves ?? []).forEach(m => allMoveNames.add(m.name));
}
console.log(`\n全ユニーク技名 (${allMoveNames.size}件):`);
console.log([...allMoveNames].sort().join("\n"));
