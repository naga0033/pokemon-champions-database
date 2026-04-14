// ゲーム内「ポケモン詳細画面」の各パネルを Claude Vision で解析
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdminToken } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `あなたはポケモンチャンピオンズのゲーム内「ポケモン詳細画面」のスクショを解析するアシスタントです。

画面構造:
- 画面上部中央に「順位 No.○○○ ポケモン日本語名」+ テラスアイコン
  例: "1位 No.445 ガブリアス"
- 中央に現在表示中のパネル (下記いずれか)
- 左右に隣のパネルがチラ見えしてる (解析不要、無視)
- 下部に操作ボタン (メニュー/戻る)

パネル種別と JSON 形式:

(1) 技パネル (panelType: "moves")
  - タイトル: "技"
  - 各行: "順位 採用率% 技アイコン 技名 カテゴリアイコン"
  - 例: 1位 99.0% じしん、2位 70.0% げきりん
  → entries: [{ rank, name, percentage }]

(2) 持ち物パネル (panelType: "items")
  - タイトル: "持ち物"
  - 各行: "順位 採用率% アイテムアイコン 持ち物名"
  → entries: [{ rank, name, percentage }]

(3) 特性パネル (panelType: "abilities")
  - タイトル: "特性"
  - 各行: "順位 採用率% 特性名"
  → entries: [{ rank, name, percentage }]

(4) 性格補正パネル (panelType: "natures")
  - タイトル: "性格補正"
  - 各行: "順位 採用率% 性格名 [右側に 上がる能力↑ 下がる能力↓]"
  - 例: やんちゃ (こうげき↑ とくぼう↓)
  → entries: [{ rank, name, percentage }]
  (up/down は性格名から一意に決まるので保存しない)

(5) 能力ポイントパネル (panelType: "evs")
  - タイトル: "能力ポイント"
  - 各行: "順位 採用率% HP アイコン ATK アイコン DEF アイコン SPA アイコン SPD アイコン SPE アイコン"
  - 6 つの数字はステータス振り順 (HP, こうげき, ぼうぎょ, とくこう, とくぼう, すばやさ)
  - 例: 29位 0.1% → HP:31 ATK:0 DEF:2 SPA:0 SPD:0 SPE:2
  → entries: [{ rank, percentage, hp, atk, def, spAtk, spDef, speed }]

(6) 同じチームのポケモンパネル (panelType: "partners")
  - タイトル: "同じチームのポケモン"
  - 各行: "順位 採用率% ポケモンスプライト ポケモン日本語名 テラスアイコン"
  - 例: 1位 76.0% アシレーヌ
  → entries: [{ rank, name, percentage }]

出力 JSON:
{
  "rank": 1,
  "pokemonJa": "ガブリアス",
  "dexNo": 445,
  "panelType": "moves"|"items"|"abilities"|"natures"|"evs"|"partners",
  "entries": [ ... ]
}

厳守事項:
- パネルのタイトルから panelType を正確に判定
- 画面中央の表示中パネルのみ解析。左右見切れは無視
- 数値は半角で。percentage は 99.0 のように小数 1 桁
- 画面に「5位 24.0%」と出ていれば rank=5, percentage=24.0
- 能力ポイントパネルでは 6 つの数字順序を厳守 (HP→ATK→DEF→SPA→SPD→SPE)
- 能力ポイントでは name フィールドを入れず、hp/atk/def/spAtk/spDef/speed を直接入れる
- 純粋な JSON のみ。マークダウン・説明文不要`;

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
