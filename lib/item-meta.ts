// 持ち物のスプライト URL を取得 (PokeAPI sprite)
import { ITEMS } from "./items";

// OCR 由来の誤字バリアントを正しい日本語名にマッピング
const TYPO_ALIAS: Record<string, string> = {
  "しろいハープ": "しろいハーブ",
  "しんぴのしず": "しんぴのしずく",
  "じし": "じしゃく",
  "じしゃ": "じしゃく",
  "ヤチエのみ": "ヤチェのみ",
  "ヨブのみ": "ヨプのみ",
  "ユキノオナイト": "ユキノオーナイト",
  "マフオクシナイト": "マフォクシーナイト",
};

let JA_TO_SLUG: Map<string, string> | null = null;
function jaToSlug(ja: string): string | null {
  if (!JA_TO_SLUG) {
    JA_TO_SLUG = new Map();
    for (const it of ITEMS) {
      JA_TO_SLUG.set(it.ja, it.slug);
    }
  }
  const normalized = TYPO_ALIAS[ja] ?? ja;
  return JA_TO_SLUG.get(normalized) ?? null;
}

/** 日本語名 → PokeAPI スプライト URL。マッチしない場合は null */
export function getItemSpriteUrl(ja: string): string | null {
  const slug = jaToSlug(ja);
  if (!slug) return null;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
}
