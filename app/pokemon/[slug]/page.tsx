// ポケモン個別詳細: 技・持ち物・特性・性格・テラス の採用率パネル
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLatestSeason, loadPokemonDetail } from "@/lib/rankings";
import { UsagePanel } from "@/components/UsagePanel";
import { getOfficialArtworkUrl } from "@/lib/pokemon-sprite";
import type { Format } from "@/lib/types";

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

      {/* ヘッダー */}
      <section className="flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 font-display text-2xl font-black text-white shadow">
          {detail.rank}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getOfficialArtworkUrl(detail.pokemonSlug)}
          alt={detail.pokemonJa}
          className="h-28 w-28 object-contain"
        />
        <div className="flex-1 min-w-[200px]">
          {detail.dexNo && (
            <p className="text-[11px] font-bold tracking-widest text-slate-400">
              No.{detail.dexNo}
            </p>
          )}
          <h1 className="font-display text-2xl font-black text-slate-900 md:text-3xl">
            {detail.pokemonJa}
          </h1>
          <p className="mt-1 text-[11px] text-slate-500">
            {season.label} · {format === "single" ? "シングル" : "ダブル"} · 最終更新 {detail.updatedAt.slice(0, 10)}
          </p>
        </div>
      </section>

      {/* 採用率パネル群 */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {detail.moves && <UsagePanel title="技" iconLabel="わざ" entries={detail.moves} accent="from-rose-500 to-orange-500" />}
        {detail.items && <UsagePanel title="持ち物" iconLabel="もちもの" entries={detail.items} accent="from-emerald-500 to-teal-500" />}
        {detail.abilities && <UsagePanel title="特性" iconLabel="とくせい" entries={detail.abilities} accent="from-sky-500 to-blue-500" />}
        {detail.natures && <UsagePanel title="性格" iconLabel="せいかく" entries={detail.natures} accent="from-violet-500 to-purple-500" />}
        {detail.teras && <UsagePanel title="テラスタイプ" iconLabel="テラス" entries={detail.teras} accent="from-pink-500 to-fuchsia-500" />}
        {detail.partners && <UsagePanel title="組み合わせ" iconLabel="ペア" entries={detail.partners} accent="from-amber-500 to-yellow-500" />}
      </section>
    </div>
  );
}
