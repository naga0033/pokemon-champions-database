// ゲーム内「全体ランキング画面」のスクショを Claude Vision で解析
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdminToken } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `あなたはポケモンチャンピオンズのゲーム内「使用率ランキング画面」のスクリーンショットを解析するアシスタントです。

この画面の構造:
- 左上に「シーズンM-1」「シーズンM-2」のようなシーズン名
- 集計期間 (例: 2026/04/08 09:00〜2026/05/13 10:59)
- 左下に「自分の成績」(マスターボール級・ランク等)
- 右側が使用率ランキング: 順位 / ポケモンスプライト / ポケモン日本語名 / テラスアイコン(採用の多いテラスタイプ)
- 上部タブ: トレーナー / フレンド / ポケモン (「ポケモン」タブがアクティブなはず)
- X ボタン表示: シングルバトル or ダブルバトル

抽出する JSON 形式:
{
  "seasonId": "M-1" (etc., シーズン名から抽出),
  "seasonLabel": "シーズンM-1",
  "startDate": "2026-04-08",
  "endDate": "2026-05-13",
  "format": "single" or "double",
  "entries": [
    {
      "rank": 1,
      "pokemonJa": "ガブリアス",
      "teraIcons": ["fire","ground"]  // 写っているテラスアイコンを英語で
    },
    ...
  ]
}

テラスタイプは以下の英語名で: normal, fire, water, electric, grass, ice, fighting, poison, ground, flying, psychic, bug, rock, ghost, dragon, dark, steel, fairy, stellar

純粋な JSON のみ返してください。説明文・マークダウン不要。`;

type Body = { imageBase64?: string; imageMediaType?: string };

export async function POST(req: Request) {
  const authError = requireAdminToken(req);
  if (authError) return authError;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 未設定" }, { status: 500 });
  }

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "JSON パース失敗" }, { status: 400 }); }

  if (!body.imageBase64) {
    return NextResponse.json({ error: "imageBase64 が必要" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const media = normalizeMedia(body.imageMediaType);

  let rawText = "";
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: media, data: body.imageBase64 } },
          { type: "text", text: "画面を解析して JSON で返してください。" },
        ],
      }],
    });
    const b = res.content.find((x) => x.type === "text");
    rawText = b && b.type === "text" ? b.text : "";
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Claude API エラー",
    }, { status: 502 });
  }

  const json = extractJson(rawText);
  try {
    return NextResponse.json({ result: JSON.parse(json), rawText });
  } catch {
    return NextResponse.json({ error: "JSON パース失敗", rawText }, { status: 502 });
  }
}

function normalizeMedia(raw?: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (!raw) return "image/jpeg";
  const l = raw.toLowerCase();
  if (l.includes("png")) return "image/png";
  if (l.includes("gif")) return "image/gif";
  if (l.includes("webp")) return "image/webp";
  return "image/jpeg";
}

function extractJson(text: string): string {
  let w = text.trim();
  const fenced = w.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) w = fenced[1].trim();
  const first = w.indexOf("{");
  const last = w.lastIndexOf("}");
  if (first >= 0 && last > first) return w.slice(first, last + 1);
  return w;
}
