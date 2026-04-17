import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync("./.env.local", "utf-8");
const env = Object.fromEntries(
  envText.split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=", 2))
);
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const payload = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64").toString());
const url = `https://${payload.ref}.supabase.co`;
const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

for (const format of ["single", "double"]) {
  console.log(`\n=== ${format} 76-100 ===`);
  const { data } = await sb
    .from("rankings")
    .select("rank, pokemon_ja, pokemon_slug")
    .eq("season_id", "M-1")
    .eq("format", format)
    .gte("rank", 76)
    .lte("rank", 100)
    .order("rank");
  for (const r of data ?? []) {
    console.log(`${r.rank}: ${r.pokemon_ja} (${r.pokemon_slug})`);
  }
}
