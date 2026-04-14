import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `あなたはポケモンチャンピオンズのゲーム内「ポケモン詳細画面」のスクショを解析するアシスタントです。

画面構造:
- 画面上部中央に「順位 No.○○○ ポケモン日本語名」+ テラスアイコン
- 中央に現在表示中のパネル
- 左右の見切れパネルは無視

パネル種別:
- 技 -> panelType: "moves"
- 持ち物 -> panelType: "items"
- 特性 -> panelType: "abilities"
- 性格補正 -> panelType: "natures"
- 能力ポイント -> panelType: "evs"
- 同じチームのポケモン -> panelType: "partners"

出力 JSON:
{
  "rank": 1,
  "pokemonJa": "ガブリアス",
  "dexNo": 445,
  "panelType": "moves"|"items"|"abilities"|"natures"|"evs"|"partners",
  "entries": [ ... ]
}

厳守事項:
- 中央パネルだけ解析
- percentage は数値で
- evs は { rank, percentage, hp, atk, def, spAtk, spDef, speed }
- 純粋な JSON のみ`;

const API_BASE = process.env.API_BASE ?? "https://pokemon-champions-database-orcin.vercel.app";
const DOWNLOADS_DIR = path.join(process.env.HOME, "Downloads");
const OUTPUT_DIR = path.join(process.cwd(), "tmp", "loose-import");
const FILE_PATTERN = new RegExp(process.env.FILE_PATTERN ?? "^20260414.*_c\\.jpg$", "i");
const LIMIT = Number(process.env.LIMIT ?? "80");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const processedFiles = await collectProcessedFiles(OUTPUT_DIR);

const files = (await fs.readdir(DOWNLOADS_DIR))
  .filter((name) => FILE_PATTERN.test(name))
  .filter((name) => !processedFiles.has(name))
  .sort(compareImageName)
  .slice(0, LIMIT)
  .map((name) => path.join(DOWNLOADS_DIR, name));

const grouped = new Map();

for (const file of files) {
  const result = await parseImage(file);
  const key = `${result.rank}-${result.pokemonJa}`;
  let group = grouped.get(key);
  if (!group) {
    group = {
      rank: result.rank,
      pokemonJa: result.pokemonJa,
      dexNo: result.dexNo,
      files: [],
      panels: {
        moves: new Map(),
        items: new Map(),
        abilities: new Map(),
        natures: new Map(),
        partners: new Map(),
        evs: new Map(),
      },
    };
    grouped.set(key, group);
  }

  group.files.push({ file: path.basename(file), panelType: result.panelType });
  for (const entry of result.entries) {
    const normalized = normalizeEntry(result.panelType, entry);
    if (normalized) {
      group.panels[result.panelType].set(entry.rank, normalized);
    }
  }
}

const rankingEntries = [];

for (const group of [...grouped.values()].sort((a, b) => a.rank - b.rank)) {
  const payload = {
    seasonId: "M-1",
    format: "single",
    rank: group.rank,
    pokemonJa: group.pokemonJa,
    dexNo: group.dexNo,
    panels: {
      moves: sortEntries(group.panels.moves),
      items: sortEntries(group.panels.items),
      abilities: sortEntries(group.panels.abilities),
      natures: sortEntries(group.panels.natures),
      partners: sortEntries(group.panels.partners),
      evs: sortEntries(group.panels.evs),
    },
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, `${group.rank}-${group.pokemonJa}.json`),
    JSON.stringify({ payload, files: group.files }, null, 2),
    "utf8",
  );

  const saveRes = await fetch(`${API_BASE}/api/save-detail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const saveJson = await saveRes.json();
  if (!saveRes.ok) {
    throw new Error(`${group.pokemonJa}: save-detail failed: ${JSON.stringify(saveJson)}`);
  }

  rankingEntries.push({ rank: group.rank, pokemonJa: group.pokemonJa });
  console.log(JSON.stringify({
    pokemonJa: group.pokemonJa,
    rank: group.rank,
    panels: Object.fromEntries(Object.entries(payload.panels).map(([k, v]) => [k, v.length])),
    files: group.files.length,
  }));
}

if (rankingEntries.length > 0) {
  const saveRankingRes = await fetch(`${API_BASE}/api/save-ranking`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      seasonId: "M-1",
      seasonLabel: "シーズンM-1",
      startDate: "2026-04-08",
      endDate: "2026-05-13",
      format: "single",
      entries: rankingEntries,
    }),
  });
  const rankingJson = await saveRankingRes.json();
  if (!saveRankingRes.ok) {
    throw new Error(`save-ranking failed: ${JSON.stringify(rankingJson)}`);
  }
  console.log(JSON.stringify({ saveRanking: rankingJson }));
}

async function parseImage(file) {
  const image = await fs.readFile(file);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image.toString("base64") } },
            { type: "text", text: "この画像の中央パネルだけを解析して JSON を返してください。" },
          ],
        }],
      });

      const text = res.content.find((item) => item.type === "text")?.text ?? "";
      return JSON.parse(extractJson(text));
    } catch (error) {
      if (attempt === 5 || !isRateLimit(error)) throw error;
      await sleep(65_000);
    }
  }
}

function sortEntries(map) {
  return [...map.values()].sort((a, b) => a.rank - b.rank);
}

function normalizeEntry(panelType, entry) {
  if (!entry || typeof entry !== "object") return null;
  if (panelType === "evs") return entry;

  const name = [entry.name, entry.move, entry.item, entry.ability, entry.nature]
    .find((value) => typeof value === "string" && value.trim().length > 0);

  if (typeof name !== "string" || typeof entry.rank !== "number" || typeof entry.percentage !== "number") {
    return null;
  }

  return {
    rank: entry.rank,
    name,
    percentage: entry.percentage,
  };
}

async function collectProcessedFiles(dir) {
  const seen = new Set();
  try {
    const docs = (await fs.readdir(dir)).filter((name) => name.endsWith(".json"));
    for (const file of docs) {
      const json = JSON.parse(await fs.readFile(path.join(dir, file), "utf8"));
      for (const item of json.files ?? []) {
        if (item?.file) seen.add(item.file);
      }
    }
  } catch {
    return seen;
  }
  return seen;
}

function isRateLimit(error) {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 429);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compareImageName(a, b) {
  return a.localeCompare(b, "ja");
}

function extractJson(text) {
  let value = text.trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) value = fenced[1].trim();
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  return first >= 0 && last > first ? value.slice(first, last + 1) : value;
}
