// スコヴィランの現DB状態を確認
import { createClient } from "@supabase/supabase-js";

const URL = "https://ilziiwrrfxhbvjhqiavh.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsemlpd3JyZnhoYnZqaHFpYXZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1NDU4NiwiZXhwIjoyMDkxODMwNTg2fQ.L-pf-IcXK5FVGW7k2G3s-igSKx6nPRNwqZrr6YzOMKA";

const sb = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await sb
  .from("pokemon_details")
  .select("season_id, format, rank, pokemon_ja, pokemon_slug, moves")
  .eq("pokemon_slug", "scovillain");
if (error) {
  console.error(error);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
