"use client";
// 種族値 <-> 実数値 切り替え
import { useState } from "react";
import type { BaseStats } from "@/lib/pokeapi-stats";
import { BaseStatsBars } from "./BaseStatsBars";
import { ActualStatsTable } from "./ActualStatsTable";

export function StatsToggle({ stats }: { stats: BaseStats }) {
  const [showActual, setShowActual] = useState(false);
  return (
    <div className="md:w-[640px] md:max-w-full">
      {/* トグルボタン (右寄せ) */}
      <div className="mb-3 flex justify-end">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-[11px] font-bold shadow-sm">
          <button
            type="button"
            onClick={() => setShowActual(false)}
            className={
              !showActual
                ? "rounded-full bg-gradient-to-b from-lime-300 to-lime-400 px-3 py-0.5 font-black text-slate-900 shadow-[inset_0_-2px_0_rgba(132,204,22,0.6)] ring-1 ring-lime-500/40"
                : "rounded-full px-3 py-0.5 text-slate-500 hover:text-slate-700"
            }
          >
            種族値
          </button>
          <button
            type="button"
            onClick={() => setShowActual(true)}
            className={
              showActual
                ? "rounded-full bg-gradient-to-b from-lime-300 to-lime-400 px-3 py-0.5 font-black text-slate-900 shadow-[inset_0_-2px_0_rgba(132,204,22,0.6)] ring-1 ring-lime-500/40"
                : "rounded-full px-3 py-0.5 text-slate-500 hover:text-slate-700"
            }
          >
            実数値
          </button>
        </div>
      </div>

      {/* コンテンツ切り替え */}
      {showActual ? (
        <ActualStatsTable stats={stats} />
      ) : (
        <BaseStatsBars stats={stats} />
      )}
    </div>
  );
}
