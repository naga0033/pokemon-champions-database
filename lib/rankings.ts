// ランキング DB アクセス
import { supabase } from "./supabase";
import type { Format, RankingEntry, Season, PokemonDetail } from "./types";

type SeasonRow = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  format: Format;
};

type RankingRow = {
  rank: number;
  pokemon_ja: string;
  pokemon_slug: string;
  tera_icons: unknown;
};

type DetailRow = {
  season_id: string;
  format: Format;
  rank: number;
  pokemon_ja: string;
  pokemon_slug: string;
  dex_no: number | null;
  moves: unknown;
  items: unknown;
  abilities: unknown;
  natures: unknown;
  evs: unknown;
  partners: unknown;
  updated_at: string;
};

/** 最新シーズンを取得 (seasonId 指定があればそれを優先) */
export async function loadLatestSeason(
  format: Format,
  seasonId?: string,
): Promise<Season | null> {
  const query = supabase
    .from("seasons")
    .select("*")
    .eq("format", format)
    .order("start_date", { ascending: false })
    .limit(1);

  const { data, error } = seasonId
    ? await supabase.from("seasons").select("*").eq("id", seasonId).single()
    : await query.single();

  if (error || !data) return null;
  const row = data as SeasonRow;
  return {
    id: row.id,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    format: row.format,
  };
}

/** ランキングを取得 */
export async function loadRanking(
  seasonId: string,
  format: Format,
): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from("rankings")
    .select("rank, pokemon_ja, pokemon_slug, tera_icons")
    .eq("season_id", seasonId)
    .eq("format", format)
    .order("rank", { ascending: true });

  if (error || !data) return [];
  return (data as RankingRow[]).map((r) => ({
    rank: r.rank,
    pokemonJa: r.pokemon_ja,
    pokemonSlug: r.pokemon_slug,
    teraIcons: Array.isArray(r.tera_icons) ? r.tera_icons as RankingEntry["teraIcons"] : undefined,
  }));
}

/** ポケモン詳細を取得 */
export async function loadPokemonDetail(
  seasonId: string,
  format: Format,
  pokemonSlug: string,
): Promise<PokemonDetail | null> {
  const { data, error } = await supabase
    .from("pokemon_details")
    .select("*")
    .eq("season_id", seasonId)
    .eq("format", format)
    .eq("pokemon_slug", pokemonSlug)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as DetailRow;
  return {
    seasonId: row.season_id,
    format: row.format,
    rank: row.rank,
    pokemonJa: row.pokemon_ja,
    pokemonSlug: row.pokemon_slug,
    dexNo: row.dex_no ?? undefined,
    moves: asUsage(row.moves),
    items: asUsage(row.items),
    abilities: asUsage(row.abilities),
    natures: asUsage(row.natures),
    evs: Array.isArray(row.evs) ? (row.evs as PokemonDetail["evs"]) : undefined,
    partners: asUsage(row.partners),
    updatedAt: row.updated_at,
  };
}

function asUsage(v: unknown): PokemonDetail["moves"] | undefined {
  return Array.isArray(v) ? (v as PokemonDetail["moves"]) : undefined;
}
