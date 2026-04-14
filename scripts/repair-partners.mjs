import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const TARGETS = [
  { folder: "アシレーヌ" },
  { folder: "リザードン" },
  { folder: "アーマーガア" },
  { folder: "ブリジュラス" },
  { folder: "カバルドン" },
  { folder: "ゲンガー" },
  { folder: "ドドゲザン" },
  { folder: "ハッサム" },
  { folder: "ギルガルド" },
  { folder: "マスカーニャ" },
];
const TARGET_FILTER = process.env.TARGET?.split(",").map((v) => v.trim()).filter(Boolean);

const SYSTEM_PROMPT = `あなたはポケモンチャンピオンズの「同じチームのポケモン」パネルだけを読む OCR アシスタントです。

重要:
- 画面中央の大きいパネルに順位とポケモン名がある
- 採用率パーセンテージは、右端に細く見えている列に表示されていることがある
- 右端の細い列の数値は、中央パネルの各行と上から順に対応している
- ただし、右端の列に表示されていない行の percentage は推測してはいけない

返す JSON:
{
  "entries": [
    { "rank": 1, "name": "ガブリアス", "percentage": 71.9 }
  ]
}

厳守事項:
- percentage が画像内で確認できる行だけ返す
- 確認できない行は返さない
- 順位、ポケモン名、percentage を正確に返す
- 純粋な JSON のみ`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const API_BASE = process.env.API_BASE ?? "https://pokemon-champions-database-orcin.vercel.app";
const DOWNLOADS_DIR = path.join(process.env.HOME, "Downloads");
const OUTPUT_DIR = path.join(process.cwd(), "tmp", "detail-import");

for (const target of TARGETS.filter((item) => !TARGET_FILTER || TARGET_FILTER.includes(item.folder))) {
  const jsonPath = path.join(OUTPUT_DIR, `${target.folder}.json`);
  const doc = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const partnerFiles = doc.perImage
    .filter((item) => item.result.panelType === "partners")
    .sort((a, b) => {
      const aMin = Math.min(...a.result.entries.map((entry) => entry.rank));
      const bMin = Math.min(...b.result.entries.map((entry) => entry.rank));
      return aMin - bMin || a.file.localeCompare(b.file, "ja");
    });

  const partnerMap = new Map();
  const source = partnerFiles.find((item) => item.result.entries.some((entry) => entry.rank === 1));
  if (!source) {
    throw new Error(`${target.folder}: partners top5 image not found`);
  }

  {
    const filePath = path.join(DOWNLOADS_DIR, target.folder, source.file);
    const parsed = await parsePartnerImage(filePath);
    for (const entry of parsed.entries ?? []) {
      if (entry.rank <= 5 && typeof entry.percentage === "number") {
        partnerMap.set(entry.rank, entry);
      }
    }
  }

  doc.payload.panels.partners = [...partnerMap.values()].sort((a, b) => a.rank - b.rank);
  await fs.writeFile(jsonPath, JSON.stringify(doc, null, 2), "utf8");

  const saveRes = await fetch(`${API_BASE}/api/save-detail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(doc.payload),
  });
  const saveJson = await saveRes.json();
  if (!saveRes.ok) {
    throw new Error(`${target.folder}: save-detail failed: ${JSON.stringify(saveJson)}`);
  }

  console.log(JSON.stringify({
    folder: target.folder,
    partners: doc.payload.panels.partners,
    save: saveJson,
  }));
}

async function parsePartnerImage(filePath) {
  const image = await fs.readFile(filePath);
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image.toString("base64") } },
        { type: "text", text: "同じチームのポケモンのうち、percentage が画像内で見えている行だけ JSON で返してください。" },
      ],
    }],
  });

  const text = res.content.find((item) => item.type === "text")?.text ?? "";
  const json = extractJson(text);
  return JSON.parse(json);
}

function extractJson(text) {
  let value = text.trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) value = fenced[1].trim();
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  return first >= 0 && last > first ? value.slice(first, last + 1) : value;
}
