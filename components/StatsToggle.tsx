"use client";
// 種族値 <-> Lv50 実数値 を切り替えるトグル
import { useState } from "react";
import type { BaseStats } from "@/lib/pokeapi-stats";
import { BaseStatsBars } from "./BaseStatsBars";
import { ActualStatsTable } from "./ActualStatsTable";

export function StatsToggle({ stats }: { stats: BaseStats }) {
  const [showActual, setShowActual] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
          {showActual ? "Lv50 実数値" : "種族値"}
        </p>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-[11px] font-bold shadow-sm">
          <button
            type="button"
            onClick={() => setShowActual(false)}
            className={
              !showActual
                ? "rounded-full bg-indigo-500 px-3 py-1 text-white shadow"
                : "rounded-full px-3 py-1 text-slate-500 hover:text-slate-700"
            }
          >
            種族値
          </button>
          <button
            type="button"
            onClick={() => setShowActual(true)}
            className={
              showActual
                ? "rounded-full bg-indigo-500 px-3 py-1 text-white shadow"
                : "rounded-full px-3 py-1 text-slate-500 hover:text-slate-700"
            }
          >
            実数値
          </button>
        </div>
      </div>
      {showActual ? <ActualStatsTable stats={stats} /> : <BaseStatsBars stats={stats} />}
    </div>
  );
}
