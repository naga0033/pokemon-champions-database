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

/** 全シーズンのリストを取得 (セレクタ用、新しい順) */
export async function loadAllSeasons(): Promise<Season[]> {
  try {
    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("start_date", { ascending: false });
    if (error || !data) return [];
    return (data as SeasonRow[]).map((r) => ({
      id: r.id,
      label: r.label,
      startDate: r.start_date,
      endDate: r.end_date,
      format: r.format,
    }));
  } catch {
    return [];
  }
}

/** 最新シーズンを取得 (seasonId 指定があればそれを優先) */
export async function loadLatestSeason(
  format: Format,
  seasonId?: string,
): Promise<Season | null> {
  try {
  if (seasonId) {
    const { data, error } = await supabase.from("seasons").select("*").eq("id", seasonId).single();
    if (!error && data) {
      const row = data as SeasonRow;
      return {
        id: row.id,
        label: row.label,
        startDate: row.start_date,
        endDate: row.end_date,
        format,
      };
    }
  }

  const query = supabase
    .from("seasons")
    .select("*")
    .eq("format", format)
    .order("start_date", { ascending: false })
    .limit(1);

  const { data, error } = await query.single();

  if (!error && data) {
    const row = data as SeasonRow;
    return {
      id: row.id,
      label: row.label,
      startDate: row.start_date,
      endDate: row.end_date,
      format,
    };
  }

  // seasons テーブルが片方の format で上書きされていても、
  // rankings が存在する season_id を拾って表示を継続する。
  const { data: rankingRow, error: rankingError } = await supabase
    .from("rankings")
    .select("season_id")
    .eq("format", format)
    .order("season_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rankingError || !rankingRow?.season_id) return null;

  const { data: fallbackSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", rankingRow.season_id)
    .maybeSingle();

  const row = fallbackSeason as SeasonRow | null;
  if (!row) {
    return {
      id: rankingRow.season_id,
      label: `シーズン${rankingRow.season_id}`,
      startDate: "",
      endDate: "",
      format,
    };
  }

  return {
    id: row.id,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    format,
  };
  } catch {
    return null;
  }
}

/** ランキングを取得 */
export async function loadRanking(
  seasonId: string,
  format: Format,
): Promise<RankingEntry[]> {
  try {
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
  } catch {
    return [];
  }
}

/** ポケモン詳細を取得 */
export async function loadPokemonDetail(
  seasonId: string,
  format: Format,
  pokemonSlug: string,
): Promise<PokemonDetail | null> {
  try {
  const { data, error } = await supabase
    .from("pokemon_details")
    .select("*")
    .eq("season_id", seasonId)
    .eq("format", format)
    .eq("pokemon_slug", pokemonSlug)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as DetailRow;

  // pokemon_details.rank は投入時の値でズレることがあるため、正は rankings テーブル側
  const { data: rankingRow } = await supabase
    .from("rankings")
    .select("rank")
    .eq("season_id", seasonId)
    .eq("format", format)
    .eq("pokemon_slug", pokemonSlug)
    .maybeSingle();
  const liveRank = rankingRow?.rank ?? row.rank;

  return {
    seasonId: row.season_id,
    format: row.format,
    rank: liveRank,
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
  } catch {
    return null;
  }
}

function asUsage(v: unknown): PokemonDetail["moves"] | undefined {
  if (!Array.isArray(v)) return undefined;

  return v
    .map((entry) => normalizeUsageEntry(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

type UsageEntryRow = { rank: number; percentage: number; name: string };

function normalizeUsageEntry(entry: unknown): UsageEntryRow | null {
  if (!entry || typeof entry !== "object") return null;

  const row = entry as Record<string, unknown>;
  const rank = typeof row.rank === "number" ? row.rank : null;
  const percentage = typeof row.percentage === "number" ? row.percentage : null;
  // Codex 由来の様々な field name バリエーションを許容
  const rawName = [
    row.name,
    row.move, row.moveName,
    row.item, row.itemName,
    row.ability, row.abilityName,
    row.nature, row.natureName,
    row.partner, row.partnerName, row.pokemon, row.pokemonJa, row.pokemonName,
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  if (rank == null || percentage == null || typeof rawName !== "string") return null;

  return {
    rank,
    percentage,
    name: rawName,
  };
}
