// ゲーム内「ポケモン詳細画面」(技・持ち物・特性・性格・テラス)のスクショを Claude Vision で解析
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `あなたはポケモンチャンピオンズのゲーム内「ポケモン詳細画面」のスクショを解析するアシスタントです。

画面構造:
- 画面上部中央に「順位・No.・ポケモン日本語名」+ テラスアイコン
  例: "1位 No.445 ガブリアス"
- 中央に現在表示中のパネル (技 / 持ち物 / 特性 / 性格 / テラスタイプ / 組み合わせ のいずれか)
- 左右に隣のパネルがチラ見えしてる (左右キーで切り替え)
- 各パネルは採用率 Top5 前後を表示
  形式: "順位 採用率% アイコン 項目名"
  例: "1 99.0% [技アイコン] じしん"
  例: "3 48.0% [技アイコン] ステルスロック"

抽出する JSON 形式:
{
  "rank": 1,
  "pokemonJa": "ガブリアス",
  "dexNo": 445,
  "panelType": "moves"|"items"|"abilities"|"natures"|"teras"|"partners",
  "entries": [
    { "rank": 1, "name": "じしん", "percentage": 99.0 },
    { "rank": 2, "name": "げきりん", "percentage": 70.0 },
    ...
  ]
}

- panelType はパネルのタイトル文字 (技/持ち物/特性/性格/テラスタイプ/組み合わせ) から判定してください
- 左右の見切れパネルは無視し、中央のアクティブパネルだけ解析してください
- percentage は画面表記 (例: 99.0%) をそのまま数値として返してください
- 画面の最上部に順位が出ていなくても、中央のパネルに集中してください

純粋な JSON のみ返してください。`;

type Body = { imageBase64?: string; imageMediaType?: string };

export async function POST(req: Request) {
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
          { type: "text", text: "このパネルを解析して JSON で返してください。" },
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
