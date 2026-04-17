// ダブル ヌメルゴン(通常) M-1 の詳細データを直接 Supabase に保存
import { createClient } from "@supabase/supabase-js";

const URL = "https://ilziiwrrfxhbvjhqiavh.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsemlpd3JyZnhoYnZqaHFpYXZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1NDU4NiwiZXhwIjoyMDkxODMwNTg2fQ.L-pf-IcXK5FVGW7k2G3s-igSKx6nPRNwqZrr6YzOMKA";

const sb = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const data = {
  season_id: "M-1",
  format: "double",
  rank: 155,
  pokemon_ja: "ヌメルゴン",
  pokemon_slug: "goodra",
  dex_no: 706,
  moves: [
    { name: "りゅうせいぐん", rate: 37.9 },
    { name: "まもる", rate: 37.5 },
    { name: "りゅうのはどう", rate: 32.2 },
    { name: "10まんボルト", rate: 31.6 },
    { name: "ヘドロばくだん", rate: 25.8 },
    { name: "ねっとう", rate: 22.5 },
    { name: "かえんほうしゃ", rate: 22.5 },
    { name: "れいとうビーム", rate: 20.5 },
    { name: "かみなり", rate: 18.5 },
    { name: "いのちのしずく", rate: 16.3 },
  ],
  items: [
    { name: "たべのこし", rate: 29.3 },
    { name: "オボンのみ", rate: 19.3 },
    { name: "ハバンのみ", rate: 12.5 },
    { name: "しろいハーブ", rate: 6.6 },
    { name: "ロゼルのみ", rate: 6.1 },
    { name: "ラムのみ", rate: 4.8 },
    { name: "せんせいのツメ", rate: 4.6 },
    { name: "ひかりのこな", rate: 3.5 },
    { name: "りゅうのキバ", rate: 3.0 },
    { name: "こだわりスカーフ", rate: 2.9 },
  ],
  abilities: [
    { name: "そうしょく", rate: 45.4 },
    { name: "ぬめぬめ", rate: 44.9 },
    { name: "うるおいボディ", rate: 9.8 },
  ],
  natures: [
    { name: "ひかえめ", rate: 46.2 },
    { name: "ずぶとい", rate: 16.7 },
    { name: "れいせい", rate: 10.8 },
    { name: "おだやか", rate: 8.8 },
    { name: "おくびょう", rate: 4.3 },
    { name: "なまいき", rate: 3.2 },
    { name: "わんぱく", rate: 2.7 },
    { name: "いじっぱり", rate: 1.6 },
    { name: "のんき", rate: 1.6 },
    { name: "ゆうかん", rate: 1.0 },
  ],
  evs: [
    { hp: 32, atk: 0, def: 2, spa: 32, spd: 0, spe: 0, rate: 16.7 },
    { hp: 32, atk: 0, def: 0, spa: 32, spd: 2, spe: 0, rate: 6.5 },
    { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0, rate: 4.5 },
    { hp: 2,  atk: 0, def: 22, spa: 32, spd: 0, spe: 10, rate: 3.5 },
    { hp: 24, atk: 0, def: 10, spa: 32, spd: 0, spe: 0, rate: 3.5 },
    { hp: 32, atk: 0, def: 0, spa: 2, spd: 32, spe: 0, rate: 3.2 },
    { hp: 2,  atk: 0, def: 32, spa: 32, spd: 0, spe: 0, rate: 3.0 },
    { hp: 32, atk: 0, def: 1, spa: 32, spd: 0, spe: 0, rate: 3.0 },
    { hp: 2,  atk: 0, def: 0, spa: 32, spd: 32, spe: 0, rate: 2.7 },
    { hp: 32, atk: 0, def: 0, spa: 1, spd: 32, spe: 1, rate: 2.5 },
  ],
  partners: [
    { name: "ガオガエン", slug: "incineroar" },
    { name: "ミロカロス", slug: "milotic" },
    { name: "オオニューラ", slug: "sneasler" },
    { name: "ヤバソチャ", slug: "poltchageist" },
    { name: "エルフーン", slug: "whimsicott" },
    { name: "ペリッパー", slug: "pelipper" },
    { name: "リザードン", slug: "charizard" },
    { name: "ガブリアス", slug: "garchomp" },
    { name: "ブリジュラス", slug: "duraludon" },
    { name: "メガニウム", slug: "meganium" },
  ],
  updated_at: new Date().toISOString(),
};

// 既存レコードの確認
const { data: existing } = await sb
  .from("pokemon_details")
  .select("id, pokemon_slug, rank")
  .eq("season_id", "M-1")
  .eq("format", "double")
  .eq("pokemon_slug", "goodra")
  .single();

console.log("既存レコード:", existing);

// UPSERT
const { error } = await sb
  .from("pokemon_details")
  .upsert(data, { onConflict: "season_id,format,pokemon_slug" });

if (error) {
  console.error("エラー:", error);
  process.exit(1);
}

console.log("✅ ヌメルゴン(通常) ダブル M-1 保存完了！");
