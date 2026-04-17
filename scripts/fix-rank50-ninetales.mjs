// rank 50 キュウコン → アローラキュウコン 修正
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

// 現在のrank 50を確認
const { data: current } = await sb.from("rankings").select("*").eq("season_id","M-1").eq("format","single").eq("rank",50).single();
console.log("現在:", current?.pokemon_name, current?.pokemon_slug);

// 更新
const { error } = await sb.from("rankings").update({
  pokemon_name: "アローラキュウコン",
  pokemon_slug: "ninetales-alola",
}).eq("season_id","M-1").eq("format","single").eq("rank",50);

if (error) console.error("❌", error.message);
else console.log("✓ rank 50: キュウコン → アローラキュウコン (ninetales-alola)");
