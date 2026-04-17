// 現在のDB状態を取得する一時スクリプト
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

// .env.local から読み込む
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = Object.fromEntries(
  envText.split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=", 2))
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Supabase credentials not found in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const SEASON = "M-1";
const FORMAT = "single";

// rankings を取得
const { data: rankings, error: rErr } = await supabase
  .from("rankings")
  .select("rank, pokemon_ja, pokemon_slug, tera_icons")
  .eq("season_id", SEASON)
  .eq("format", FORMAT)
  .order("rank", { ascending: true });

if (rErr) { console.error(rErr); process.exit(1); }

// pokemon_details を取得（パネル情報のあるもの）
const { data: details, error: dErr } = await supabase
  .from("pokemon_details")
  .select("rank, pokemon_ja, pokemon_slug, moves, items, abilities, natures, evs, partners")
  .eq("season_id", SEASON)
  .eq("format", FORMAT)
  .order("rank", { ascending: true });

if (dErr) { console.error(dErr); process.exit(1); }

const output = {
  rankings: rankings,
  details: details.map((d) => ({
    rank: d.rank,
    pokemon_ja: d.pokemon_ja,
    pokemon_slug: d.pokemon_slug,
    hasMoves: !!d.moves && d.moves.length > 0,
    hasItems: !!d.items && d.items.length > 0,
    hasAbilities: !!d.abilities && d.abilities.length > 0,
    hasNatures: !!d.natures && d.natures.length > 0,
    hasEvs: !!d.evs && d.evs.length > 0,
    hasPartners: !!d.partners && d.partners.length > 0,
  })),
};

writeFileSync(
  new URL("./current-state.json", import.meta.url),
  JSON.stringify(output, null, 2)
);

console.log(`rankings: ${rankings.length}件`);
console.log(`details: ${details.length}件`);
console.log(`→ scripts/current-state.json に出力しました`);
