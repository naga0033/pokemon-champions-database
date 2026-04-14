// PokeAPI からポケモンの種族値 + タイプを取得する軽量ヘルパ
// (詳細ページの表示用)

export type BaseStats = {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
};

export type PokeProfile = {
  slug: string;
  baseStats: BaseStats;
  types: string[];      // e.g. ["dragon", "ground"]
};

const FETCH_SLUG_OVERRIDES: Record<string, string> = {
  // 特殊フォーム用 (ダメ計と同じ運用)
  aegislash: "aegislash-shield",
  basculegion: "basculegion-male",
  mimikyu: "mimikyu-disguised",
  palafin: "palafin-hero",
  floette: "floette-eternal",
};

export async function fetchPokeProfile(slug: string): Promise<PokeProfile | null> {
  const resolved = FETCH_SLUG_OVERRIDES[slug] ?? slug;
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${resolved}`, {
      // ビルド時に取れれば十分なので短めキャッシュ
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const getStat = (name: string) =>
      (data.stats as Array<{ base_stat: number; stat: { name: string } }>)
        .find((s) => s.stat.name === name)?.base_stat ?? 0;

    return {
      slug,
      baseStats: {
        hp: getStat("hp"),
        atk: getStat("attack"),
        def: getStat("defense"),
        spAtk: getStat("special-attack"),
        spDef: getStat("special-defense"),
        speed: getStat("speed"),
      },
      types: (data.types as Array<{ type: { name: string } }>).map((t) => t.type.name),
    };
  } catch {
    return null;
  }
}
