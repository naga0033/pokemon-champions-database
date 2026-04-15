/**
 * バリデーションモジュール
 * ポケモン名・技名・持ち物名・特性名・性格名の既知リストを提供し、
 * Vision API の解析結果に対してファジーマッチングでバリデーションを行う。
 *
 * 名前リストは ../pokemon-damage-calc/lib/ と ./lib/ の TS ファイルから
 * 正規表現で抽出し、コンパイル不要で利用する。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// 参照先: 同リポジトリの lib/ と 隣の pokemon-damage-calc/lib/
const SEARCH_DIRS = [
  path.join(PROJECT_ROOT, "lib"),
  path.join(PROJECT_ROOT, "../pokemon-damage-calc/lib"),
];

// ── TS ファイルからの名前抽出 ─────────────────────────────────────────────────

/**
 * "slug": "日本語名" 形式のマッピングから日本語名を抽出
 * (EN_TO_JA, MOVE_NAMES_JA, ABILITY_NAMES_JA など)
 */
async function extractJaFromKvTs(filePath) {
  const names = new Set();
  try {
    const src = await fs.readFile(filePath, "utf-8");
    // "any-slug": "日本語" パターン（英数字・記号のキー → カタカナ・漢字の値）
    const re = /["'][\w\s\-\.♀♂]+["']\s*:\s*["']([^\n"']{1,50})["']/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const ja = m[1].trim();
      // カタカナ・ひらがな・漢字が含まれる文字列のみ採用
      if (/[ぁ-んァ-ン一-龯]/.test(ja)) {
        names.add(ja);
      }
    }
  } catch {
    // ファイルが存在しない場合はスキップ
  }
  return names;
}

/**
 * ITEMS 配列の ja フィールドから持ち物名を抽出
 */
async function extractJaFromItemsTs(filePath) {
  const names = new Set();
  try {
    const src = await fs.readFile(filePath, "utf-8");
    const re = /\bja\s*:\s*["']([^"']{1,50})["']/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const ja = m[1].trim();
      if (/[ぁ-んァ-ン一-龯]/.test(ja)) {
        names.add(ja);
      }
    }
  } catch {}
  return names;
}

/**
 * 全検索ディレクトリからファイルを探して名前を統合
 */
async function mergeFromDirs(filename, extractor) {
  const results = await Promise.all(
    SEARCH_DIRS.map((dir) => extractor(path.join(dir, filename)))
  );
  return new Set(results.flatMap((s) => [...s]));
}

// ── ポケモン 25 性格（固定リスト）────────────────────────────────────────────
const KNOWN_NATURES = new Set([
  "がんばりや", "さみしがり", "ゆうかん", "いじっぱり", "やんちゃ",
  "ずぶとい",   "すなおに",   "のんき",   "わんぱく",   "のうてんき",
  "おくびょう", "せっかち",   "まじめ",   "ようき",     "むじゃき",
  "ひかえめ",   "おっとり",   "れいせい", "てれやり",   "うっかりや",
  "おだやか",   "おとなしい", "なまいき", "しんちょう", "きまぐれ",
]);

// ── キャッシュ ────────────────────────────────────────────────────────────────
let _knownNames = null;

/**
 * 既知名前リストを読み込む（初回のみ I/O、以降はキャッシュを返す）
 * @returns {{ pokemon: Set, moves: Set, abilities: Set, items: Set, natures: Set }}
 */
export async function loadKnownNames() {
  if (_knownNames) return _knownNames;

  const [pokemon, moves, abilities, items] = await Promise.all([
    mergeFromDirs("pokemon-names.ts", extractJaFromKvTs),
    mergeFromDirs("move-names.ts",    extractJaFromKvTs),
    mergeFromDirs("ability-names.ts", extractJaFromKvTs),
    mergeFromDirs("items.ts",         extractJaFromItemsTs),
  ]);

  _knownNames = { pokemon, moves, abilities, items, natures: KNOWN_NATURES };

  console.error(
    `[validate] 既知名前ロード完了: ポケモン=${pokemon.size} 技=${moves.size}` +
    ` 特性=${abilities.size} 持物=${items.size} 性格=${KNOWN_NATURES.size}`
  );
  return _knownNames;
}

// ── レーベンシュタイン距離 ────────────────────────────────────────────────────

/**
 * 2つの文字列間のレーベンシュタイン距離を計算
 * カタカナOCRミス（例: ガ→カ+゛）に対応するため文字単位で比較
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  // 長さ差が閾値を超える場合は早期リターン（高速化）
  if (Math.abs(m - n) > 4) return Math.abs(m - n);

  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * 名前セットから最も近い候補を探す
 * @param {string} name 検索対象
 * @param {Set<string>} nameSet 既知名前セット
 * @param {number} maxDist 許容する最大距離 (デフォルト: 2)
 * @returns {{ name: string, dist: number } | null}
 */
function findBestMatch(name, nameSet, maxDist = 2) {
  if (!name) return null;
  if (nameSet.has(name)) return { name, dist: 0 };

  let best = null;
  let bestDist = maxDist + 1;

  for (const candidate of nameSet) {
    // 長さが大きく違う候補はスキップ（高速化）
    if (Math.abs(candidate.length - name.length) > maxDist) continue;
    const dist = levenshtein(name, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best ? { name: best, dist: bestDist } : null;
}

// ── バリデーション関数 ────────────────────────────────────────────────────────

/**
 * panelType に対応する名前セットを返す
 */
function getNameSet(panelType, known) {
  return {
    moves:     known.moves,
    items:     known.items,
    abilities: known.abilities,
    natures:   known.natures,
    partners:  known.pokemon,
    evs:       null, // 数値チェックのみ
  }[panelType] ?? null;
}

/**
 * EVs エントリのバリデーション
 */
function validateEvsEntry(entry) {
  const FIELDS = ["hp", "atk", "def", "spAtk", "spDef", "speed"];
  const warnings = [];
  const corrected = { ...entry };

  for (const f of FIELDS) {
    const v = entry[f];
    if (typeof v !== "number") {
      warnings.push(`${f} が数値ではない: ${JSON.stringify(v)}`);
      corrected[f] = 0;
    } else if (v < 0 || v > 252) {
      warnings.push(`${f}=${v} が範囲外 (0〜252)`);
      corrected[f] = Math.max(0, Math.min(252, v));
    }
  }

  const total = FIELDS.reduce((s, f) => s + (corrected[f] ?? 0), 0);
  if (total > 510) {
    warnings.push(`努力値合計 ${total} が上限 510 を超えている`);
  }

  return { ok: warnings.length === 0, warnings, corrected };
}

/**
 * 単一エントリ（技・持物・特性・性格・パートナー）のバリデーション
 * @param {string} panelType
 * @param {object} entry
 * @param {object} known - loadKnownNames() の返値
 * @returns {{ ok: boolean, warnings: string[], corrected: object }}
 */
export function validateEntry(panelType, entry, known) {
  if (panelType === "evs") return validateEvsEntry(entry);

  const nameSet = getNameSet(panelType, known);

  // nameSet が null の場合（未知パネル）はスルー
  if (!nameSet) return { ok: true, warnings: [], corrected: entry };

  const name = entry.name;
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, warnings: ["name フィールドがない"], corrected: entry };
  }

  // 完全一致
  if (nameSet.has(name)) {
    return { ok: true, warnings: [], corrected: entry };
  }

  // ファジーマッチ（OCR ミスの自動補正）
  const match = findBestMatch(name, nameSet);
  if (match) {
    return {
      ok: false,
      warnings: [`"${name}" → "${match.name}" (距離: ${match.dist})`],
      corrected: { ...entry, name: match.name },
    };
  }

  return {
    ok: false,
    warnings: [`"${name}" は既知リストにない (補正不能)`],
    corrected: entry,
  };
}

/**
 * Vision API の解析結果全体をバリデーション・補正する
 * @param {object} result - parseImage() の戻り値
 * @param {object} known - loadKnownNames() の返値
 * @returns {{ result: object, warnings: string[], hasUnknown: boolean }}
 */
export function validateParsedResult(result, known) {
  const warnings = [];
  let corrected = { ...result };

  // ── ポケモン名チェック ──
  if (result.pokemonJa) {
    if (!known.pokemon.has(result.pokemonJa)) {
      const match = findBestMatch(result.pokemonJa, known.pokemon, 3);
      if (match) {
        warnings.push(`ポケモン名 "${result.pokemonJa}" → "${match.name}" (距離: ${match.dist})`);
        corrected = { ...corrected, pokemonJa: match.name };
      } else {
        warnings.push(`ポケモン名 "${result.pokemonJa}" は既知リストにない`);
      }
    }
  }

  // ── エントリーチェック ──
  const correctedEntries = [];
  for (const entry of result.entries ?? []) {
    const { warnings: ew, corrected: ce } = validateEntry(result.panelType, entry, known);
    warnings.push(...ew.map((w) => `  [rank${entry.rank}] ${w}`));
    correctedEntries.push(ce);
  }
  corrected = { ...corrected, entries: correctedEntries };

  // 補正不能な警告が含まれるか
  const hasUnknown = warnings.some((w) => w.includes("補正不能") || w.includes("既知リストにない"));

  return { result: corrected, warnings, hasUnknown };
}
