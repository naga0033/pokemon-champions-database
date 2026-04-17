// 技の type / damage class を PokeAPI から取得 (24h キャッシュ)
import { MOVE_NAMES_JA } from "./move-names";

export type MoveCategory = "physical" | "special" | "status";
export type MoveMeta = { type: string; category: MoveCategory };

// OCR 由来の誤字バリアントや別表記を正規名にマッピング (ェ→エ、ッ→ツ 等)
const TYPO_ALIAS: Record<string, string> = {
  "ウエザーボール": "ウェザーボール",
  // ポケモンチャンピオンズでの表記が move-names の登録名と異なるケース
  "さいはい": "きょうしゅ", // Instruct
  // OCR 誤字: 「みがわり」を「みかわり」と読み取るケース
  "みかわり": "みがわり",
  // OCR 誤字: 「めいそう」を「めいそ」と読み取るケース（う抜け）
  "めいそ": "めいそう",
};

// PokeAPI に存在しない/取得失敗する技の type・category を手動で補完
// (ポケモンチャンピオンズ専用技や新技など)
const MOVE_META_OVERRIDE: Record<string, MoveMeta> = {
  "しっとのほのお": { type: "fire", category: "special" },
  "ハバネロエキス": { type: "grass", category: "status" },
  "めいそう": { type: "psychic", category: "status" },
};

// 日本語名 → 英語 slug 逆引き (モジュールスコープでキャッシュ)
let JA_TO_SLUG: Map<string, string> | null = null;
function jaToSlug(ja: string): string | null {
  if (!JA_TO_SLUG) {
    JA_TO_SLUG = new Map();
    for (const [slug, jaName] of Object.entries(MOVE_NAMES_JA)) {
      JA_TO_SLUG.set(jaName, slug);
    }
  }
  const normalized = TYPO_ALIAS[ja] ?? ja;
  return JA_TO_SLUG.get(normalized) ?? null;
}

/** 1 つの技のメタ情報を取得 */
export async function fetchMoveMeta(ja: string): Promise<MoveMeta | null> {
  // 先にオーバーライド表を参照 (PokeAPI に存在しない新技など)
  const normalized = TYPO_ALIAS[ja] ?? ja;
  if (MOVE_META_OVERRIDE[normalized]) return MOVE_META_OVERRIDE[normalized];

  const slug = jaToSlug(ja);
  if (!slug) return null;
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/move/${slug}`, {
      next: { revalidate: 86400 }, // 24h
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      type: data.type?.name ?? "normal",
      category: (data.damage_class?.name as MoveCategory) ?? "status",
    };
  } catch {
    return null;
  }
}

/** 複数の技メタを並列取得（レートリミット回避のため 10 件ずつバッチ処理） */
export async function fetchMoveMetaMap(jaNames: string[]): Promise<Record<string, MoveMeta>> {
  const unique = Array.from(new Set(jaNames));
  const out: Record<string, MoveMeta> = {};
  const BATCH = 10;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (ja) => [ja, await fetchMoveMeta(ja)] as const),
    );
    for (const [ja, meta] of results) {
      if (meta) out[ja] = meta;
    }
  }
  // フォールバック: PokeAPI 取得失敗時に MOVE_META_OVERRIDE を直接適用
  for (const name of unique) {
    if (!out[name] && MOVE_META_OVERRIDE[name]) {
      out[name] = MOVE_META_OVERRIDE[name];
    }
  }
  return out;
}
