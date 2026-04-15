// 解析したランキングデータを DB に保存
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { resolvePokemonJaName, getEnSlug } from "@/lib/pokemon-names";
import { requireAdminToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

type Entry = { rank: number; pokemonJa: string; teraIcons?: string[] };
type Body = {
  seasonId: string;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  format: "single" | "double";
  entries: Entry[];
};

export async function POST(req: Request) {
  const authError = requireAdminToken(req);
  if (authError) return authError;

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "JSON parse error" }, { status: 400 }); }

  if (!body.seasonId || !body.entries?.length) {
    return NextResponse.json({ error: "seasonId と entries が必要" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existingSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("id", body.seasonId)
    .maybeSingle();

  if (existingSeason) {
    // 既存 season は format を書き換えず、メタ情報のみ更新
    const { error: sErr } = await supabase
      .from("seasons")
      .update({
        label: body.seasonLabel,
        start_date: body.startDate,
        end_date: body.endDate,
      })
      .eq("id", body.seasonId);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  } else {
    const { error: sErr } = await supabase.from("seasons").insert({
      id: body.seasonId,
      label: body.seasonLabel,
      start_date: body.startDate,
      end_date: body.endDate,
      format: body.format,
    });
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  // ランキング upsert (順位ごと)
  const rows = body.entries.map((e) => {
    const resolved = resolvePokemonJaName(e.pokemonJa);
    return {
      season_id: body.seasonId,
      format: body.format,
      rank: e.rank,
      pokemon_ja: resolved ?? e.pokemonJa,
      pokemon_slug: resolved ? (getEnSlug(resolved) ?? "unknown") : "unknown",
      tera_icons: e.teraIcons ?? null,
    };
  });

  const { error: rErr } = await supabase.from("rankings").upsert(rows, {
    onConflict: "season_id,format,rank",
  });
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, saved: rows.length });
}
