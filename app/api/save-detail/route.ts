// 解析したポケモン詳細パネルを DB に保存 (1 ポケモンは複数パネル分マージして保存)
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { resolvePokemonJaName, getEnSlug } from "@/lib/pokemon-names";
import { requireAdminToken } from "@/lib/admin-auth";

export const runtime = "edge";

type PanelType = "moves" | "items" | "abilities" | "natures" | "evs" | "partners";
type UsageEntry = { rank: number; name: string; percentage: number };
type EvEntry = {
  rank: number; percentage: number;
  hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number;
};

type Body = {
  seasonId: string;
  format: "single" | "double";
  rank: number;
  pokemonJa: string;
  dexNo?: number;
  panels: Partial<Record<PanelType, UsageEntry[] | EvEntry[]>>;
};

export async function POST(req: Request) {
  const authError = requireAdminToken(req);
  if (authError) return authError;

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "JSON parse error" }, { status: 400 }); }

  if (!body.seasonId || !body.pokemonJa) {
    return NextResponse.json({ error: "必須フィールド不足" }, { status: 400 });
  }

  const resolved = resolvePokemonJaName(body.pokemonJa);
  const slug = resolved ? (getEnSlug(resolved) ?? "unknown") : "unknown";
  const jaName = resolved ?? body.pokemonJa;

  const supabase = createAdminClient();

  // 既存レコード取得してマージ (単発パネルずつ送られる想定)
  const { data: existing } = await supabase
    .from("pokemon_details")
    .select("*")
    .eq("season_id", body.seasonId)
    .eq("format", body.format)
    .eq("pokemon_slug", slug)
    .maybeSingle();

  // Codex 由来データの field name バリエーションを "name" に正規化
  const normalizeUsage = (entries: unknown): UsageEntry[] | null => {
    if (!Array.isArray(entries)) return null;
    const out: UsageEntry[] = [];
    for (const e of entries) {
      if (!e || typeof e !== "object") continue;
      const row = e as Record<string, unknown>;
      const rank = typeof row.rank === "number" ? row.rank : null;
      const percentage = typeof row.percentage === "number" ? row.percentage : null;
      const name = [
        row.name,
        row.move, row.moveName,
        row.item, row.itemName,
        row.ability, row.abilityName,
        row.nature, row.natureName,
        row.partner, row.partnerName, row.pokemon, row.pokemonJa, row.pokemonName,
      ].find((v) => typeof v === "string" && v.trim().length > 0);
      if (rank == null || percentage == null || typeof name !== "string") continue;
      out.push({ rank, name, percentage });
    }
    return out;
  };

  const merged = {
    season_id: body.seasonId,
    format: body.format,
    rank: body.rank,
    pokemon_ja: jaName,
    pokemon_slug: slug,
    dex_no: body.dexNo ?? existing?.dex_no ?? null,
    moves:     body.panels.moves     ? normalizeUsage(body.panels.moves)     : existing?.moves     ?? null,
    items:     body.panels.items     ? normalizeUsage(body.panels.items)     : existing?.items     ?? null,
    abilities: body.panels.abilities ? normalizeUsage(body.panels.abilities) : existing?.abilities ?? null,
    natures:   body.panels.natures   ? normalizeUsage(body.panels.natures)   : existing?.natures   ?? null,
    evs:       body.panels.evs       ?? existing?.evs       ?? null,
    partners:  body.panels.partners  ? normalizeUsage(body.panels.partners)  : existing?.partners  ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pokemon_details").upsert(merged, {
    onConflict: "season_id,format,pokemon_slug",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, pokemon: jaName, slug });
}
