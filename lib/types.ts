// ポケモンチャンピオンズ 使用率統計サイトの型定義

export type Format = "single" | "double";

export type TeraIcon =
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic"
  | "bug" | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy"
  | "stellar";

/** シーズン (例: M-1 = 2026/04/08〜05/13) */
export type Season = {
  id: string;             // "M-1"
  label: string;          // "シーズンM-1"
  startDate: string;      // ISO "2026-04-08"
  endDate: string;        // ISO "2026-05-13"
  format: Format;
};

/** 全体ランキングの 1 行 */
export type RankingEntry = {
  rank: number;
  pokemonJa: string;      // "ガブリアス"
  pokemonSlug: string;    // "garchomp" (PokeAPI slug)
  teraIcons?: TeraIcon[]; // 画面に出てる採用テラスアイコン (右の小アイコン群)
};

/** 採用率付きのエントリ (技、持ち物、特性、性格、組み合わせポケモン等) */
export type UsageEntry = {
  rank: number;           // 順位
  name: string;           // "じしん" / "きあいのタスキ" / etc.
  slug?: string;          // 英語slug (あれば)
  percentage: number;     // 99.0 (%)
};

/** 努力値 (能力ポイント) の 1 配分 + その採用率 */
export type EvEntry = {
  rank: number;
  percentage: number;
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
};

/** 詳細パネルの種別 */
export type DetailPanel =
  | "moves"      // 技
  | "items"      // 持ち物
  | "abilities"  // 特性
  | "natures"    // 性格補正
  | "evs"        // 能力ポイント (努力値振り)
  | "partners";  // 同じチームのポケモン

/** ポケモンの詳細データ (1 体分) */
export type PokemonDetail = {
  seasonId: string;
  format: Format;
  rank: number;
  pokemonJa: string;
  pokemonSlug: string;
  dexNo?: number;         // 画面に "No.445" と出る

  moves?: UsageEntry[];
  items?: UsageEntry[];
  abilities?: UsageEntry[];
  natures?: UsageEntry[];
  evs?: EvEntry[];        // 能力ポイント (努力値振り)
  partners?: UsageEntry[];

  updatedAt: string;      // ISO
};
