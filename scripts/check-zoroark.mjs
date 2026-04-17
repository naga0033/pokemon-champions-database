// ゾロアークと ゾロアーク(ヒスイ) の現状を確認
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const env = Object.fromEntries(
  envText.split("\n").filter(l => l && !l.startsWith("#") && l.includes("=")).map(l => l.split("=", 2))
);
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const payload = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64").toString());
const url = `https://${payload.ref}.supabase.co`;
const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

console.log("=== rankings (season=M-1, format=single) ===");
const { data: rankings } = await sb
  .from("rankings")
  .select("*")
  .eq("season_id", "M-1")
  .eq("format", "single")
  .in("rank", [62, 144]);
console.log(JSON.stringify(rankings, null, 2));

console.log("\n=== pokemon_details (season=M-1, format=single, zoroark系) ===");
const { data: details } = await sb
  .from("pokemon_details")
  .select("pokemon_slug, pokemon_ja, rank")
  .eq("season_id", "M-1")
  .eq("format", "single")
  .in("pokemon_slug", ["zoroark", "zoroark-hisui"]);
console.log(JSON.stringify(details, null, 2));
