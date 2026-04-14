// ランキングトップ: シーズン × フォーマット選択 + 使用率ランキング (検索付き)
import { loadAllSeasons, loadLatestSeason, loadRanking } from "@/lib/rankings";
import { SearchableRankingList } from "@/components/SearchableRankingList";
import { SeasonSelect } from "@/components/SeasonSelect";
import { FormatSwitch } from "@/components/FormatSwitch";
import type { Format } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ format?: string; season?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const format: Format = sp.format === "double" ? "double" : "single";

  const season = await loadLatestSeason(format, sp.season);
  const allSeasons = await loadAllSeasons();
  const ranking = season ? await loadRanking(season.id, format) : [];

  return (
    <div className="space-y-4">
      {/* シーズン + フォーマット切替 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-600">
            SEASON
          </span>
          {allSeasons.length > 0 && season ? (
            <SeasonSelect seasons={allSeasons} currentSeasonId={season.id} format={format} />
          ) : (
            <span className="text-xs text-slate-400">データ準備中…</span>
          )}
        </div>
        <FormatSwitch current={format} />
      </section>

      {/* ランキング (検索付き) */}
      {ranking.length > 0 ? (
        <SearchableRankingList entries={ranking} format={format} seasonId={season!.id} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 py-16 text-center">
          <p className="text-sm font-bold tracking-wide text-slate-500">
            {format === "single" ? "シングル" : "ダブル"} のランキングデータは準備中です
          </p>
        </div>
      )}
    </div>
  );
}
