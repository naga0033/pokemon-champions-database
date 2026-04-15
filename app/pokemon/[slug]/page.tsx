// ポケモン個別詳細: プロフィール + 種族値 + 各パネル (円グラフ) + 努力値ランキング
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLatestSeason, loadPokemonDetail } from "@/lib/rankings";
import { fetchPokeProfile } from "@/lib/pokeapi-stats";
import { UsagePanel } from "@/components/UsagePanel";
import { StatsToggle } from "@/components/StatsToggle";
import { getOfficialArtworkUrl } from "@/lib/pokemon-sprite";
import { TypeBadge } from "@/components/TypeBadge";
import { fetchMoveMetaMap } from "@/lib/move-meta";
import type { Format, TeraIcon } from "@/lib/types";

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

  const profile = await fetchPokeProfile(slug);
  const moveMeta = detail.moves
    ? await fetchMoveMetaMap(detail.moves.map((m) => m.name))
    : {};

  return (
    <div className="space-y-6">
      {/* パンくず */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/?format=${format}&season=${season.id}`} className="hover:text-indigo-600">
          ランキング
        </Link>
        <span>›</span>
        <span className="font-bold text-slate-700">{detail.pokemonJa}</span>
      </nav>

      {/* プロフィールヘッダー */}
      <section className="rounded-3xl border border-violet-100 bg-white/85 p-4 shadow-sm sm:p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          {/* モバイルでは rank+image+info を縦並び、更新テキストを下段に出す */}
          <div className="flex flex-col gap-1.5 sm:gap-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 font-display text-lg font-black text-white shadow sm:h-14 sm:w-14 sm:text-2xl">
                {detail.rank}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getOfficialArtworkUrl(detail.pokemonSlug)}
                alt={detail.pokemonJa}
                className="h-20 w-20 object-contain sm:h-28 sm:w-28"
              />
              <div className="min-w-0 flex-1">
                {detail.dexNo && (
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 sm:text-[11px]">
                    No.{detail.dexNo}
                  </p>
                )}
                <h1 className="font-display text-xl font-black text-slate-900 sm:text-2xl md:text-3xl">
                  {detail.pokemonJa}
                </h1>
                {profile?.types && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.types.map((t) => (
                      <TypeBadge key={t} type={t as TeraIcon} />
                    ))}
                  </div>
                )}
                {/* デスクトップ: 名前の下に表示 */}
                <p className="mt-1.5 hidden text-[10px] leading-tight text-slate-500 sm:block sm:mt-2 sm:text-[11px]">
                  {season.label} · {format === "single" ? "シングル" : "ダブル"} · 更新 {detail.updatedAt.slice(0, 10)}
                </p>
              </div>
            </div>
            {/* モバイル: タイプバッジの下に独立した行で表示 */}
            <p className="text-[10px] leading-tight text-slate-500 sm:hidden">
              {season.label} · {format === "single" ? "シングル" : "ダブル"} · 更新 {detail.updatedAt.slice(0, 10)}
            </p>
          </div>
          {/* 種族値 / 実数値 */}
          {profile?.baseStats && (
            <div className="flex-1 md:border-l md:border-slate-100 md:pl-6">
              <StatsToggle stats={profile.baseStats} />
            </div>
          )}
        </div>
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
