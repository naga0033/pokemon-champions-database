// ポケモン個別詳細: プロフィール + 種族値 + 各パネル (円グラフ) + 努力値ランキング
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLatestSeason, loadPokemonDetail, loadRanking } from "@/lib/rankings";
import { PokemonSearchNav } from "@/components/PokemonSearchNav";
import { fetchPokeProfile } from "@/lib/pokeapi-stats";
import { UsagePanel } from "@/components/UsagePanel";
import { getOfficialArtworkUrl } from "@/lib/pokemon-sprite";
import { fetchMoveMetaMap } from "@/lib/move-meta";
import { LearnsetPanel } from "@/components/LearnsetPanel";
import { getChampionsLearnset } from "@/lib/champions-learnsets";
import { PokemonProfileSection } from "@/components/PokemonProfileSection";
import { getMegaForms } from "@/lib/mega-data";
import type { Format } from "@/lib/types";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ format?: string; season?: string }>;
};

export default async function PokemonDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const format: Format = sp.format === "double" ? "double" : "single";

  const season = await loadLatestSeason(format, sp.season);
  if (!season) notFound();

  const detail = await loadPokemonDetail(season.id, format, slug);
  if (!detail) notFound();

  const rankingEntries = await loadRanking(season.id, format);

  const profile = await fetchPokeProfile(slug);
  const learnset = getChampionsLearnset(slug);
  // 採用率パネル用 + 覚えるわざパネル用の技メタを一括取得
  const allMoveNames = [
    ...(detail.moves?.map((m) => m.name) ?? []),
    ...(learnset?.moves ?? []),
  ];
  const moveMeta = allMoveNames.length > 0
    ? await fetchMoveMetaMap(allMoveNames)
    : {};

  return (
    <div className="space-y-6">
      {/* ランキングへ戻るリンク + ポケモン検索 */}
      <div className="flex items-center gap-3">
        <Link
          href={`/?format=${format}&season=${season.id}`}
          className="shrink-0 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          ← ランキング
        </Link>
        <PokemonSearchNav
          entries={rankingEntries}
          format={format}
          seasonId={season.id}
        />
      </div>

      {/* プロフィールヘッダー (メガシンカ切り替え対応) */}
      <section className="rounded-3xl border border-violet-100 bg-white/85 p-4 shadow-sm sm:p-5 md:p-7">
        <PokemonProfileSection
          pokemonJa={detail.pokemonJa}
          dexNo={detail.dexNo}
          rank={detail.rank}
          artworkUrl={getOfficialArtworkUrl(detail.pokemonSlug)}
          baseStats={profile?.baseStats ?? { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 }}
          types={profile?.types ?? []}
          megaForms={getMegaForms(detail.pokemonSlug)}
          seasonLabel={season.label}
          format={format}
          updatedAt={detail.updatedAt}
        />
      </section>

      {/* 採用率パネル (円グラフ) */}
      <section className="grid gap-2.5 grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {detail.moves && <UsagePanel title="わざ" iconLabel="MOVES" entries={detail.moves} limit={10} moveMeta={moveMeta} />}
        {detail.items && <UsagePanel title="もちもの" iconLabel="ITEMS" entries={detail.items} limit={10} showItemSprite />}
        {detail.abilities && <UsagePanel title="とくせい" iconLabel="ABILITY" entries={detail.abilities} />}
        {detail.natures && <UsagePanel title="せいかく" iconLabel="NATURE" entries={detail.natures} />}
        {detail.partners && <UsagePanel title="同じチーム" iconLabel="PARTNER" entries={detail.partners} limit={10} hidePercentage />}
      </section>

      {/* 能力ポイント (独自機能: 努力値振りランキング) */}
      {detail.evs && detail.evs.length > 0 && (
        <section className="rounded-2xl border border-violet-100 bg-white/85 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 px-3 py-2 text-white sm:px-4 sm:py-2.5">
            <span className="text-xs font-black sm:text-sm">能力ポイント 人気配分ランキング</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-xs sm:min-w-0 sm:text-sm">
              <thead className="text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:text-[10px]">
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2 text-left sm:px-3">順位</th>
                  <th className="px-1.5 py-2 sm:px-3">HP</th>
                  <th className="px-1.5 py-2 sm:px-3">攻</th>
                  <th className="px-1.5 py-2 sm:px-3">防</th>
                  <th className="px-1.5 py-2 sm:px-3">特攻</th>
                  <th className="px-1.5 py-2 sm:px-3">特防</th>
                  <th className="px-1.5 py-2 sm:px-3">素早</th>
                  <th className="px-2 py-2 text-right sm:px-3">採用率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.evs.slice(0, 10).map((e) => (
                  <tr key={e.rank}>
                    <td className="px-2 py-1.5 font-bold text-slate-400 sm:px-3 sm:py-2">{e.rank}</td>
                    <td className="px-1.5 py-1.5 text-center tabular-nums sm:px-3 sm:py-2">{e.hp}</td>
                    <td className="px-1.5 py-1.5 text-center tabular-nums sm:px-3 sm:py-2">{e.atk}</td>
                    <td className="px-1.5 py-1.5 text-center tabular-nums sm:px-3 sm:py-2">{e.def}</td>
                    <td className="px-1.5 py-1.5 text-center tabular-nums sm:px-3 sm:py-2">{e.spAtk}</td>
                    <td className="px-1.5 py-1.5 text-center tabular-nums sm:px-3 sm:py-2">{e.spDef}</td>
                    <td className="px-1.5 py-1.5 text-center tabular-nums sm:px-3 sm:py-2">{e.speed}</td>
                    <td className="px-2 py-1.5 text-right font-bold text-slate-900 tabular-nums sm:px-3 sm:py-2">{e.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {learnset && <LearnsetPanel learnset={learnset} moveMeta={moveMeta} />}

      {/* 三種の神器 クロスリンク */}
      <section className="rounded-2xl border border-violet-100 bg-white/85 p-5 shadow-sm">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-600">
          RELATED TOOLS
        </p>
        <p className="mt-1 text-sm font-bold text-slate-900">
          {detail.pokemonJa} の構築 / ダメ計をチェック
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`https://pokemon-teams-kappa.vercel.app/search?format=all&pokemon=${encodeURIComponent(detail.pokemonJa)}`}
            target="_blank"
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-indigo-700 shadow hover:bg-indigo-600 hover:text-white"
          >
            📋 {detail.pokemonJa} を含む構築を探す
          </Link>
          <Link
            href="https://pokemon-damage-calc.vercel.app/"
            target="_blank"
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-indigo-700 shadow hover:bg-indigo-600 hover:text-white"
          >
            ⚡ ダメージ計算
          </Link>
        </div>
      </section>
    </div>
  );
}
