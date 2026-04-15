// トレーナーランキング DB アクセス
import { supabase } from "./supabase";
import type { Format, Trainer } from "./types";

type Row = {
  rank: number;
  name: string;
  rating: number;
  country: string | null;
};

/** トレーナーランキングを取得 */
export async function loadTrainers(seasonId: string, format: Format): Promise<Trainer[]> {
  const { data, error } = await supabase
    .from("trainers")
    .select("rank, name, rating, country")
    .eq("season_id", seasonId)
    .eq("format", format)
    .order("rank", { ascending: true });
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({
    rank: r.rank,
    name: r.name,
    rating: Number(r.rating),
    country: r.country ?? undefined,
  }));
}
