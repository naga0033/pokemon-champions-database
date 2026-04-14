// ランキングトップ: シーズン × フォーマット選択 + 使用率ランキング
import { loadLatestSeason, loadRanking } from "@/lib/rankings";
import { RankingList } from "@/components/RankingList";
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
  const ranking = season ? await loadRanking(season.id, format) : [];

  return (
    <div className="space-y-6">
      {/* ヒーロー */}
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 md:p-8">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">
          POKECHAN STATS
        </p>
        <h1 className="mt-2 font-display text-2xl font-black text-slate-900 md:text-3xl">
          使用率ランキング
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          ポケモンチャンピオンズのゲーム内ランキングデータを集計。
          ポケモン名をクリックで技・持ち物・特性・性格・テラスタイプの採用率が見れる。
        </p>
      </section>

      {/* シーズン情報 + フォーマット切替 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-600">
            SEASON
          </p>
          {season ? (
            <>
              <p className="mt-0.5 text-lg font-black text-slate-900">{season.label}</p>
              <p className="text-[11px] text-slate-500">
                {season.startDate} 〜 {season.endDate}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-slate-400">データ準備中…</p>
          )}
        </div>
        <FormatSwitch current={format} />
      </section>

      {/* ランキング */}
      {ranking.length > 0 ? (
        <RankingList entries={ranking} format={format} seasonId={season!.id} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 py-16 text-center">
          <p className="text-sm font-bold tracking-wide text-slate-500">
            まだランキングデータがありません
          </p>
          <p className="mt-2 text-xs text-slate-400">
            ゲーム内ランキング画面のスクショから順次データを追加していきます。しばらくお待ちください。
          </p>
        </div>
      )}
    </div>
  );
}
