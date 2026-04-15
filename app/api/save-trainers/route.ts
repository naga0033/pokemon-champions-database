// トレーナーランキング一括投入 API
// スクリプトから動画 OCR の結果を POST する用
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { requireAdminToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

type Trainer = { rank: number; name: string; rating: number; country?: string | null };
type Body = {
  seasonId: string;
  format: "single" | "double";
  trainers: Trainer[];
};

export async function POST(req: Request) {
  const authError = requireAdminToken(req);
  if (authError) return authError;

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "JSON parse error" }, { status: 400 }); }

  if (!body.seasonId || !body.format || !Array.isArray(body.trainers)) {
    return NextResponse.json({ error: "seasonId / format / trainers 必須" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 同 season+format の既存データを全削除 → 新規投入 (日次更新で常に最新にするため)
  const { error: delErr } = await supabase
    .from("trainers")
    .delete()
    .eq("season_id", body.seasonId)
    .eq("format", body.format);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (body.trainers.length === 0) {
    return NextResponse.json({ ok: true, saved: 0, cleared: true });
  }

  const rows = body.trainers.map((t) => ({
    season_id: body.seasonId,
    format: body.format,
    rank: t.rank,
    name: t.name,
    rating: t.rating,
    country: t.country ?? null,
  }));

  const { error: insErr } = await supabase.from("trainers").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, saved: rows.length });
}
