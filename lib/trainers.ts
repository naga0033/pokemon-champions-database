// トレーナーランキング DB アクセス
import { supabase } from "./supabase";
import type { Format, Trainer } from "./types";

type Row = {
  rank: number;
  name: string;
  rating: number;
  country: string | null;
};

/** トレーナーランキングの最終更新日時を取得 */
export async function loadTrainersUpdatedAt(
  seasonId: string,
  format: Format,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("trainers")
      .select("updated_at")
      .eq("season_id", seasonId)
      .eq("format", format)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { updated_at: string }).updated_at;
  } catch {
    return null;
  }
}

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
