// 指摘されたポケモンの修正
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

// 修正内容
const fixes = [
  // シングル
  { format: "single", rank: 172, ja: "ジュナイパー",           slug: "decidueye" },
  { format: "single", rank: 180, ja: "ライチュウ",             slug: "raichu" },
  // 110 は既存のまま (ガラルヤドラン, slowbro-galar) で OK、念のため確認
  // ダブル
  { format: "double", rank: 64,  ja: "イダイトウ(メス)",        slug: "basculegion-female" },
  { format: "double", rank: 124, ja: "ガラルヤドラン",          slug: "slowbro-galar" },
  { format: "double", rank: 129, ja: "ルガルガン(まひる)",      slug: "lycanroc" },
  { format: "double", rank: 147, ja: "アローラライチュウ",      slug: "raichu-alola" },
  { format: "double", rank: 154, ja: "ニャオニクス",           slug: "meowstic" },
  { format: "double", rank: 181, ja: "ジュナイパー",           slug: "decidueye" },
  { format: "double", rank: 194, ja: "ケンタロス",             slug: "tauros" },
  { format: "double", rank: 202, ja: "ルガルガン(まよなか)",    slug: "lycanroc-midnight" },
  { format: "double", rank: 207, ja: "マッギョ",               slug: "stunfisk" },
  { format: "double", rank: 208, ja: "パンプジン",             slug: "gourgeist" },
  { format: "double", rank: 210, ja: "パンプジン",             slug: "gourgeist" },
  { format: "double", rank: 213, ja: "パンプジン",             slug: "gourgeist" },
];

// 修正前の状態を確認
console.log("📋 修正前の状態:");
for (const f of fixes) {
  const { data } = await sb
    .from("rankings")
    .select("pokemon_ja, pokemon_slug")
    .eq("season_id", "M-1")
    .eq("format", f.format)
    .eq("rank", f.rank)
    .maybeSingle();
  console.log(`  [${f.format} ${f.rank}位] ${data?.pokemon_ja} (${data?.pokemon_slug}) → ${f.ja} (${f.slug})`);
}

console.log();
console.log("🚀 修正実行中...");

// 使わなくなる slug を追跡 (後で pokemon_details を削除)
const orphanedSlugs = new Set();

for (const f of fixes) {
  const { data: oldRow } = await sb
    .from("rankings")
    .select("pokemon_slug")
    .eq("season_id", "M-1")
    .eq("format", f.format)
    .eq("rank", f.rank)
    .maybeSingle();

  if (oldRow?.pokemon_slug && oldRow.pokemon_slug !== f.slug) {
    orphanedSlugs.add(`${f.format}:${oldRow.pokemon_slug}`);
  }

  const { error } = await sb
    .from("rankings")
    .update({ pokemon_ja: f.ja, pokemon_slug: f.slug })
    .eq("season_id", "M-1")
    .eq("format", f.format)
    .eq("rank", f.rank);
  if (error) { console.error(`${f.format} ${f.rank}位:`, error); continue; }
  console.log(`✓ [${f.format} ${f.rank}位] → ${f.ja}`);
}

// 新 slug で pokemon_details が存在しない場合は空レコードを作成
console.log();
console.log("📝 pokemon_details 確認・補完中...");
for (const f of fixes) {
  const { data } = await sb
    .from("pokemon_details")
    .select("pokemon_slug")
    .eq("season_id", "M-1")
    .eq("format", f.format)
    .eq("pokemon_slug", f.slug)
    .maybeSingle();
  if (!data) {
    const { error } = await sb.from("pokemon_details").insert({
      season_id: "M-1",
      format: f.format,
      rank: f.rank,
      pokemon_ja: f.ja,
      pokemon_slug: f.slug,
      dex_no: null,
      moves: null,
      items: null,
      abilities: null,
      natures: null,
      evs: null,
      partners: null,
      updated_at: new Date().toISOString(),
    });
    if (error) { console.error(`details insert ${f.format} ${f.slug}:`, error); continue; }
    console.log(`  ✓ 空レコード作成: ${f.format} ${f.slug}`);
  }
}

// 孤立した古い slug の pokemon_details を削除 (他のランキング行からも参照されてなければ)
console.log();
console.log("🗑  使わなくなった pokemon_details を削除中...");
for (const key of orphanedSlugs) {
  const [format, slug] = key.split(":");
  const { count } = await sb
    .from("rankings")
    .select("*", { count: "exact", head: true })
    .eq("season_id", "M-1")
    .eq("format", format)
    .eq("pokemon_slug", slug);
  if (count === 0) {
    const { error } = await sb.from("pokemon_details").delete()
      .eq("season_id", "M-1")
      .eq("format", format)
      .eq("pokemon_slug", slug);
    if (error) console.error(`delete ${format} ${slug}:`, error);
    else console.log(`  ✓ 削除: ${format} ${slug}`);
  } else {
    console.log(`  - 保持: ${format} ${slug} (まだ${count}件のランキングから参照)`);
  }
}

console.log();
console.log("🎉 完了！");
