// 技の type / damage class を PokeAPI から取得 (24h キャッシュ)
import { MOVE_NAMES_JA } from "./move-names";

export type MoveCategory = "physical" | "special" | "status";
export type MoveMeta = { type: string; category: MoveCategory };

// OCR 由来の誤字バリアントを正規名にマッピング (ェ→エ、ッ→ツ 等)
const TYPO_ALIAS: Record<string, string> = {
  "ウエザーボール": "ウェザーボール",
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

/** 複数の技メタを並列取得 */
export async function fetchMoveMetaMap(jaNames: string[]): Promise<Record<string, MoveMeta>> {
  const unique = Array.from(new Set(jaNames));
  const results = await Promise.all(unique.map(async (ja) => [ja, await fetchMoveMeta(ja)] as const));
  const out: Record<string, MoveMeta> = {};
  for (const [ja, meta] of results) {
    if (meta) out[ja] = meta;
  }
  return out;
}
