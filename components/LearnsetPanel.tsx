"use client";

import { useRef, useState } from "react";
import {
  getLearnsetMoveNote,
  getLearnsetMoveTypeFallback,
  getPriorityMoves,
  type ChampionsLearnset,
} from "@/lib/champions-learnsets";
import { TypeIcon } from "@/components/TypeIcon";
import type { MoveMeta } from "@/lib/move-meta";

type Props = {
  learnset: ChampionsLearnset;
  moveMeta?: Record<string, MoveMeta>;
};

export function LearnsetPanel({ learnset, moveMeta }: Props) {
  const priorityMoves = getPriorityMoves(learnset);
  const [activeMove, setActiveMove] = useState<string | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<{ left: number; top: number } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const openNote = (move: string, el: HTMLElement) => {
    const note = getLearnsetMoveNote(move);
    const listEl = listRef.current;
    if (!note || !listEl) return;

    const chipRect = el.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const popoverWidth = 248;
    const horizontalPadding = 8;
    const desiredLeft = chipRect.left - listRect.left + chipRect.width / 2 - popoverWidth / 2;
    const clampedLeft = Math.min(
      Math.max(desiredLeft, horizontalPadding),
      Math.max(horizontalPadding, listRect.width - popoverWidth - horizontalPadding),
    );

    const belowTop = chipRect.bottom - listRect.top + 8;
    const estimatedHeight = 72;
    const aboveTop = chipRect.top - listRect.top - estimatedHeight - 8;
    const top = belowTop + estimatedHeight > listRect.height && aboveTop > 0 ? aboveTop : belowTop;

    setActiveMove(move);
    setPopoverStyle({ left: clampedLeft, top });
  };

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

      <div ref={listRef} className="relative mt-4 flex flex-wrap gap-2 pb-24 md:pb-0">
        {learnset.moves.map((move) => {
          const meta = moveMeta?.[move];
          const fallbackType = getLearnsetMoveTypeFallback(move);
          const type = meta?.type ?? fallbackType;
          const note = getLearnsetMoveNote(move);
          return (
            <button
              key={move}
              type="button"
              onClick={(event) => note && openNote(move, event.currentTarget)}
              onMouseEnter={(event) => note && openNote(move, event.currentTarget)}
              onMouseLeave={() => {
                setActiveMove(null);
                setPopoverStyle(null);
              }}
              className={`group inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 ${
                activeMove === move ? "border-violet-300 bg-violet-50" : "border-slate-200"
              }`}
            >
              {type && (
                <span className="scale-[0.85]">
                  <TypeIcon type={type} size="sm" />
                </span>
              )}
              <span>{move}</span>
            </button>
          );
        })}

        {activeMove && popoverStyle && getLearnsetMoveNote(activeMove) && (
          <div
            className="pointer-events-none absolute z-20 w-[248px] rounded-2xl border border-violet-100 bg-white px-3 py-2 text-[11px] font-medium leading-5 text-slate-600 shadow-xl"
            style={{ left: `${popoverStyle.left}px`, top: `${popoverStyle.top}px` }}
          >
            <p className="font-bold text-slate-900">{activeMove}</p>
            <p className="mt-1">{getLearnsetMoveNote(activeMove)}</p>
          </div>
        )}
      </div>
    </section>
  );
}
