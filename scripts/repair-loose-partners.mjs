import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const API_BASE = process.env.API_BASE ?? "https://pokemon-champions-database-orcin.vercel.app";
const DOWNLOADS_DIR = path.join(process.env.HOME, "Downloads");
const INPUT_DIR = path.join(process.cwd(), "tmp", "loose-import");
const FILE_FILTER = process.env.FILE_FILTER ? new RegExp(process.env.FILE_FILTER) : null;

const SYSTEM_PROMPT = `あなたはポケモンチャンピオンズの「同じチームのポケモン」パネルだけを読む OCR アシスタントです。

重要:
- 画面中央の大きいパネルの各行に 順位 と ポケモン名 がある
- 採用率パーセンテージは右端に見えている列の 1〜5 行ぶんだけ読めることが多い
- percentage が画像内で確認できる行だけ返す
- 確認できない行は返さない

返す JSON:
{
  "entries": [
    { "rank": 1, "name": "ガブリアス", "percentage": 71.9 }
  ]
}

純粋な JSON のみ`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

for (const name of (await fs.readdir(INPUT_DIR)).filter((file) => file.endsWith(".json")).sort()) {
  if (FILE_FILTER && !FILE_FILTER.test(name)) continue;

  const jsonPath = path.join(INPUT_DIR, name);
  const doc = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const source = doc.files.find((file) => file.panelType === "partners");
  if (!source) continue;

  const parsed = await parsePartnerImage(path.join(DOWNLOADS_DIR, source.file));
  doc.payload.panels.partners = (parsed.entries ?? [])
    .filter((entry) => entry.rank <= 5 && typeof entry.percentage === "number")
    .sort((a, b) => a.rank - b.rank);

  await fs.writeFile(jsonPath, JSON.stringify(doc, null, 2), "utf8");

  const saveRes = await fetch(`${API_BASE}/api/save-detail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(doc.payload),
  });
  const saveJson = await saveRes.json();
  if (!saveRes.ok) {
    throw new Error(`${name}: save-detail failed: ${JSON.stringify(saveJson)}`);
  }

  console.log(JSON.stringify({
    file: name,
    pokemonJa: doc.payload.pokemonJa,
    partners: doc.payload.panels.partners,
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
        { type: "text", text: "percentage が画像内で見えている行だけ JSON で返してください。" },
      ],
    }],
  });

  const text = res.content.find((item) => item.type === "text")?.text ?? "";
  return JSON.parse(extractJson(text));
}

function extractJson(text) {
  let value = text.trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) value = fenced[1].trim();
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  return first >= 0 && last > first ? value.slice(first, last + 1) : value;
}
