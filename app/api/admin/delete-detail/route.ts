// ポケモン詳細行を削除する管理 API (孤立行のクリーンアップ用)
// 本番公開時は認証で保護するが、MVP 段階では素通し。
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type Body = {
  seasonId?: string;
  format?: "single" | "double";
  pokemonSlug?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "JSON parse error" }, { status: 400 }); }

  if (!body.seasonId || !body.format || !body.pokemonSlug) {
    return NextResponse.json({ error: "seasonId / format / pokemonSlug required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("pokemon_details")
    .delete()
    .eq("season_id", body.seasonId)
    .eq("format", body.format)
    .eq("pokemon_slug", body.pokemonSlug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: body.pokemonSlug });
}
