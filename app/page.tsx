// ランキングトップ: トレーナー/ポケモン切替 + シーズン × フォーマット選択 + ランキング
import { loadAllSeasons, loadLatestSeason, loadRanking } from "@/lib/rankings";
import { loadTrainers } from "@/lib/trainers";
import { SearchableRankingList } from "@/components/SearchableRankingList";
import { SearchableTrainerList } from "@/components/SearchableTrainerList";
import { SeasonSelect } from "@/components/SeasonSelect";
import { FormatSwitch } from "@/components/FormatSwitch";
import { ViewTabs } from "@/components/ViewTabs";
import type { Format } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ format?: string; season?: string; view?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view: "trainer" | "pokemon" = sp.view === "trainer" ? "trainer" : "pokemon";
  const format: Format = sp.format === "double" ? "double" : "single";

  const season = await loadLatestSeason(format, sp.season);
  const allSeasons = await loadAllSeasons();
  const ranking = view === "pokemon" && season ? await loadRanking(season.id, format) : [];
  const trainers = view === "trainer" && season ? await loadTrainers(season.id, format) : [];

  return (
    <div className="space-y-4">
      {/* ビュー切替タブ (トレーナー / ポケモン) */}
      <ViewTabs current={view} />

      {/* シーズン + フォーマット切替 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-white/85 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <span className="font-display shrink-0 text-[9px] font-bold uppercase tracking-[0.25em] text-indigo-600 sm:text-[10px] sm:tracking-[0.3em]">
            SEASON
          </span>
          {allSeasons.length > 0 && season ? (
            <SeasonSelect seasons={allSeasons} currentSeasonId={season.id} format={format} />
          ) : (
            <span className="text-xs text-slate-400">データ準備中…</span>
          )}
        </div>
        <FormatSwitch current={format} view={view} seasonId={season?.id} />
      </section>

      {/* コンテンツ */}
      {view === "pokemon" ? (
        ranking.length > 0 ? (
          <SearchableRankingList entries={ranking} format={format} seasonId={season!.id} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 py-16 text-center">
            <p className="text-sm font-bold tracking-wide text-slate-500">
              {format === "single" ? "シングル" : "ダブル"} のランキングデータは準備中です
            </p>
          </div>
        )
      ) : trainers.length > 0 ? (
        <SearchableTrainerList trainers={trainers} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 py-16 text-center">
          <p className="text-sm font-bold tracking-wide text-slate-500">
            トレーナーランキングは準備中です
          </p>
          <p className="mt-2 text-xs text-slate-400">
            動画から自動集計したプレイヤー順位をここに表示予定です。
          </p>
        </div>
      )}
    </div>
  );
}
