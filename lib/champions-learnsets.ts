export type ChampionsLearnset = {
  pokemonSlug: string;
  pokemonJa: string;
  moves: string[];
};

const PRIORITY_MOVES: Record<string, number> = {
  "でんこうせっか": 1,
  "しんくうは": 1,
  "アクアジェット": 1,
  "ふいうち": 1,
  "こおりのつぶて": 1,
  "バレットパンチ": 1,
  "かげうち": 1,
  "しんそく": 2,
  "ねこだまし": 3,
  "であいがしら": 2,
  "フェイント": 2,
  "てだすけ": 5,
  "まもる": 4,
  "みきり": 4,
  "トーチカ": 4,
  "キングシールド": 4,
  "こらえる": 4,
};

const LEARNSETS: Record<string, ChampionsLearnset> = {
  garchomp: {
    pokemonSlug: "garchomp",
    pokemonJa: "ガブリアス",
    moves: [
      "ギガインパクト",
      "すてみタックル",
      "あばれる",
      "のしかかり",
      "からげんき",
      "はかいこうせん",
      "りんしょう",
      "いびき",
      "てだすけ",
      "ねごと",
      "こらえる",
      "こわいかお",
      "まもる",
      "みがわり",
      "つるぎのまい",
      "ほのおのキバ",
      "だいもんじ",
      "かえんほうしゃ",
      "にほんばれ",
      "アクアブレイク",
      "なみのり",
      "あまごい",
      "かみなりのキバ",
      "つばめがえし",
      "ストーンエッジ",
      "いわなだれ",
      "がんせきふうじ",
      "パワージェム",
      "ステルスロック",
      "すなあらし",
      "どくづき",
      "じしん",
      "あなをほる",
      "じだんだ",
      "じならし",
      "すなじごく",
      "だいちのちから",
      "ねっさのだいち",
      "マッドショット",
      "まきびし",
      "かわらわり",
      "ねむる",
      "シャドークロー",
      "げきりん",
      "ドラゴンダイブ",
      "ドラゴンクロー",
      "ワイドブレイカー",
      "ドラゴンテール",
      "スケイルショット",
      "りゅうせいぐん",
      "りゅうのはどう",
      "ドラゴンエール",
      "かみくだく",
      "ぶんまわす",
      "かみつく",
      "なげつける",
      "アイアンテール",
      "アイアンヘッド",
    ],
  },
};

export function getChampionsLearnset(pokemonSlug: string): ChampionsLearnset | null {
  return LEARNSETS[pokemonSlug] ?? null;
}

export function getPriorityMoves(learnset: ChampionsLearnset): Array<{ name: string; priority: number }> {
  return learnset.moves
    .filter((move) => move in PRIORITY_MOVES)
    .map((move) => ({ name: move, priority: PRIORITY_MOVES[move] }))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, "ja"));
}
