// ポケモン詳細行を削除する管理 API (孤立行のクリーンアップ用)
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { requireAdminToken } from "@/lib/admin-auth";

export const runtime = "edge";

type Body = {
  seasonId?: string;
  format?: "single" | "double";
  pokemonSlug?: string;
};

export async function POST(req: Request) {
  const authError = requireAdminToken(req);
  if (authError) return authError;

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "JSON parse error" }, { status: 400 }); }

  if (!body.seasonId || !body.format || !body.pokemonSlug) {
    return NextResponse.json({ error: "seasonId / format / pokemonSlug required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pokemon_details")
    .delete()
    .eq("season_id", body.seasonId)
    .eq("format", body.format)
    .eq("pokemon_slug", body.pokemonSlug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: body.pokemonSlug });
}
