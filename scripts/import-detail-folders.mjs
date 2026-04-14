import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

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
  → entries: [{ rank, name, percentage }]

(5) 能力ポイントパネル (panelType: "evs")
  - タイトル: "能力ポイント"
  - 各行: "順位 採用率% HP ATK DEF SPA SPD SPE の順で 6 数値"
  → entries: [{ rank, percentage, hp, atk, def, spAtk, spDef, speed }]

(6) 同じチームのポケモンパネル (panelType: "partners")
  - タイトル: "同じチームのポケモン"
  - 各行: "順位 採用率% ポケモン日本語名"
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
- 能力ポイントでは 6 つの数字順序を厳守 (HP→ATK→DEF→SPA→SPD→SPE)
- 純粋な JSON のみ。説明不要`;

const TARGETS = [
  { folder: "アシレーヌ", expectedRank: 2 },
  { folder: "リザードン", expectedRank: 3 },
  { folder: "アーマーガア", expectedRank: 4 },
  { folder: "ブリジュラス", expectedRank: 5 },
  { folder: "カバルドン", expectedRank: 6 },
  { folder: "ゲンガー", expectedRank: 7 },
  { folder: "ドドゲザン", expectedRank: 8 },
  { folder: "ハッサム", expectedRank: 9 },
  { folder: "ギルガルド", expectedRank: 10 },
  { folder: "マスカーニャ", expectedRank: 11 },
];
const TARGET_FILTER = process.env.TARGET?.split(",").map((v) => v.trim()).filter(Boolean);

const API_BASE = process.env.API_BASE ?? "https://pokemon-champions-database-orcin.vercel.app";
const DOWNLOADS_DIR = path.join(process.env.HOME, "Downloads");
const OUTPUT_DIR = path.join(process.cwd(), "tmp", "detail-import");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

await fs.mkdir(OUTPUT_DIR, { recursive: true });

for (const target of TARGETS.filter((item) => !TARGET_FILTER || TARGET_FILTER.includes(item.folder) || TARGET_FILTER.includes(String(item.expectedRank)))) {
  const folderPath = path.join(DOWNLOADS_DIR, target.folder);
  const files = (await fs.readdir(folderPath))
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .sort(compareImageName)
    .map((name) => path.join(folderPath, name));

  const merged = {
    moves: new Map(),
    items: new Map(),
    abilities: new Map(),
    natures: new Map(),
    partners: new Map(),
    evs: new Map(),
  };

  let meta = null;
  const perImage = [];

  for (const file of files) {
    const result = await parseImage(file);
    perImage.push({ file: path.basename(file), result });

    if (!meta) {
      meta = {
        rank: result.rank,
        pokemonJa: result.pokemonJa,
        dexNo: result.dexNo,
      };
    }

    if (result.rank !== target.expectedRank) {
      throw new Error(`${target.folder}: expected rank ${target.expectedRank}, got ${result.rank} from ${path.basename(file)}`);
    }

    for (const entry of result.entries) {
      merged[result.panelType].set(entry.rank, entry);
    }
  }

  const payload = {
    seasonId: "M-1",
    format: "single",
    rank: meta.rank,
    pokemonJa: meta.pokemonJa,
    dexNo: meta.dexNo,
    panels: {
      moves: sortEntries(merged.moves),
      items: sortEntries(merged.items),
      abilities: sortEntries(merged.abilities),
      natures: sortEntries(merged.natures),
      partners: sortEntries(merged.partners),
      evs: sortEntries(merged.evs),
    },
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, `${target.folder}.json`),
    JSON.stringify({ payload, perImage }, null, 2),
    "utf8",
  );

  const saveRes = await fetch(`${API_BASE}/api/save-detail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const saveJson = await saveRes.json();
  if (!saveRes.ok) {
    throw new Error(`${target.folder}: save-detail failed: ${JSON.stringify(saveJson)}`);
  }

  console.log(JSON.stringify({
    folder: target.folder,
    pokemonJa: payload.pokemonJa,
    rank: payload.rank,
    panels: Object.fromEntries(
      Object.entries(payload.panels).map(([key, entries]) => [key, entries.length]),
    ),
    save: saveJson,
  }));
}

async function parseImage(file) {
  const image = await fs.readFile(file);
  const media = getMediaType(file);

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: media, data: image.toString("base64") } },
        { type: "text", text: "この画像の中央パネルだけを解析して JSON を返してください。" },
      ],
    }],
  });

  const text = res.content.find((item) => item.type === "text")?.text ?? "";
  const json = extractJson(text);
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`parse failed for ${path.basename(file)}: ${error}\nRaw:\n${text}`);
  }
}

function sortEntries(map) {
  return [...map.values()].sort((a, b) => a.rank - b.rank);
}

function compareImageName(a, b) {
  const aNum = Number((a.match(/(\d+)/) ?? [])[1] ?? 0);
  const bNum = Number((b.match(/(\d+)/) ?? [])[1] ?? 0);
  return aNum - bNum || a.localeCompare(b, "ja");
}

function getMediaType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function extractJson(text) {
  let value = text.trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) value = fenced[1].trim();
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  return first >= 0 && last > first ? value.slice(first, last + 1) : value;
}
