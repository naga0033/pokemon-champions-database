import { getPriorityMoves, type ChampionsLearnset } from "@/lib/champions-learnsets";
import { TypeIcon } from "@/components/TypeIcon";
import type { MoveMeta } from "@/lib/move-meta";

type Props = {
  learnset: ChampionsLearnset;
  moveMeta?: Record<string, MoveMeta>;
};

export function LearnsetPanel({ learnset, moveMeta }: Props) {
  const priorityMoves = getPriorityMoves(learnset);

  return (
    <section className="rounded-2xl border border-violet-100 bg-white/85 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500">
            MOVE LIST
          </p>
          <h2 className="mt-1 text-base font-black text-slate-900 sm:text-lg">
            {learnset.pokemonJa}が覚えるわざ
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            ポケモンチャンピオンズ用に整理した覚えるわざ一覧です。
          </p>
        </div>
        <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
          {learnset.moves.length}わざ
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
        <p className="text-xs font-black text-slate-900">先制技</p>
        {priorityMoves.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {priorityMoves.map((move) => (
              <span
                key={move.name}
                className="inline-flex items-center gap-2 rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-lime-900"
              >
                <span>{move.name}</span>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-lime-700">
                  +{move.priority}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            いま登録されている技の中に先制技はありません。
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {learnset.moves.map((move) => {
          const priority = priorityMoves.find((item) => item.name === move);
          const meta = moveMeta?.[move];
          return (
            <span
              key={move}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm"
            >
              {meta && (
                <span className="scale-[0.85]">
                  <TypeIcon type={meta.type} size="sm" />
                </span>
              )}
              <span>{move}</span>
              {priority && (
                <span className="rounded-full bg-lime-100 px-1.5 py-0.5 text-[10px] text-lime-700">
                  +{priority.priority}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </section>
  );
}
