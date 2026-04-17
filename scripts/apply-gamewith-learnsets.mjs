// gamewith の index ページ（/pokemon-champions/546414）から
// 全ポケモンの「覚える技」一覧を抽出し、champions-learnsets.ts を置き換える。
// HTMLに埋め込まれたJSデータ（各ポケモンの mvs フィールド = 技IDカンマ区切り）を利用するため、
// 個別ページへのリクエストは不要。サーバー負荷はこの1リクエストのみ。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TS_PATH = path.join(ROOT, "lib/champions-learnsets.ts");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const INDEX_URL = "https://gamewith.jp/pokemon-champions/546414";

async function fetchIndex() {
  console.log("→ gamewith index をfetch (1リクエストのみ)");
  const res = await fetch(INDEX_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseMoveDict(html) {
  // {id:'NNN',n:'NAME',t:'TYPE',c:'物|特|変',...} 形式の技辞書を抽出
  const dict = {};
  const re = /\{id:'(\d+)',n:'([^']+)',t:'[^']*',c:'[物特変]'/g;
  let m;
  while ((m = re.exec(html)) !== null) dict[m[1]] = m[2];
  return dict;
}

function parsePokemon(html) {
  // 各ポケモンエントリ（aid=記事ID、n=日本語名、mvs=技IDリスト）を抽出
  const list = [];
  const re =
    /\{id:'\d+',idx:\d+,aid:'(\d+)',no:'(\d+)',n:'([^']+)',[^}]*?mvs:'([^']*)'/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    list.push({ aid: m[1], no: m[2], name: m[3], mvs: m[4].split(",").filter(Boolean) });
  }
  return list;
}

function readCurrentTs() {
  const ts = fs.readFileSync(TS_PATH, "utf8");
  const re = /"([^"]+)": \{\s*pokemonSlug: "([^"]+)",\s*pokemonJa: "([^"]+)",\s*moves: \[([^\]]*)\]/g;
  const entries = [];
  let m;
  while ((m = re.exec(ts)) !== null) {
    entries.push({ key: m[1], slug: m[2], ja: m[3], matchStart: m.index, matchEnd: m.index + m[0].length });
  }
  return { ts, entries };
}

// 「ルガルガン(まひる)」等の表記差異を吸収
function normalizeJa(s) {
  return s
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// 既存ファイル名 → gamewithの名前 への手動エイリアス（表記ゆれ・フォーム違い対応）
const NAME_ALIAS = {
  "ゾロアーク(ヒスイ)": "ヒスイゾロアーク",
  "ヌメルゴン(ヒスイ)": "ヒスイヌメルゴン",
  "パルデアケンタロス(炎)": "パルデアケンタロス(ほのお)",
  "パルデアケンタロス(格闘)": "パルデアケンタロス(かくとう)",
  "パルデアケンタロス(水)": "パルデアケンタロス(みず)",
  "フラエッテ(えいえん)": "フラエッテ(えいえんのはな)",
  // フォーム違いで技構成が同じもの: 代表フォームにマッピング
  "ギルガルド": "ギルガルド(シールドフォルム)",
  "パンプジン": "パンプジン(こだましゅ)",
  "イダイトウ": "イダイトウ(オス)",
  "イッカネズミ": "イッカネズミ(3びきかぞく)",
  // ヒーローフォーム = マイティ（強化フォーム）
  "イルカマン(ヒーロー)": "イルカマン(マイティ)",
};

async function main() {
  const html = await fetchIndex();
  const moveDict = parseMoveDict(html);
  const pokemon = parsePokemon(html);
  console.log(`→ 技辞書: ${Object.keys(moveDict).length} 件`);
  console.log(`→ ポケモン: ${pokemon.length} 件`);

  // gamewith側の名前 → moves配列 マップ（正規化キー）
  const gwByName = new Map();
  for (const p of pokemon) {
    const moves = p.mvs.map((id) => moveDict[id]).filter(Boolean);
    gwByName.set(normalizeJa(p.name), { original: p.name, moves });
  }

  const { ts, entries } = readCurrentTs();
  console.log(`→ 既存エントリ: ${entries.length} 件`);

  // 末尾から順に置換していく（先頭から置換すると index がズレるため）
  let out = ts;
  const reports = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const aliasTarget = NAME_ALIAS[e.ja];
    const key = normalizeJa(aliasTarget ?? e.ja);
    const gw = gwByName.get(key);
    if (!gw) {
      reports.push({ ja: e.ja, status: "NOT_FOUND" });
      continue;
    }
    const movesLiteral = gw.moves.map((m) => `"${m}"`).join(", ");
    const replacement = `"${e.key}": {\n    pokemonSlug: "${e.slug}",\n    pokemonJa: "${e.ja}",\n    moves: [${movesLiteral}]`;
    out = out.slice(0, e.matchStart) + replacement + out.slice(e.matchEnd);
    reports.push({ ja: e.ja, status: "OK", count: gw.moves.length, original: gw.original });
  }

  fs.writeFileSync(TS_PATH, out, "utf8");

  const notFound = reports.filter((r) => r.status === "NOT_FOUND");
  console.log(`\n✅ 更新完了: ${reports.length - notFound.length} 件`);
  if (notFound.length > 0) {
    console.log(`⚠️  未マッチ (${notFound.length} 件):`);
    for (const r of notFound) console.log(`   - ${r.ja}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
