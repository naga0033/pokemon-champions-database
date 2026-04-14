"use client";
// 種族値 <-> 実数値 切り替え (両方常にレンダリングして CSS で表示切替 = 高さ固定)
import { useState } from "react";
import type { BaseStats } from "@/lib/pokeapi-stats";
import { BaseStatsBars } from "./BaseStatsBars";
import { ActualStatsTable } from "./ActualStatsTable";

export function StatsToggle({ stats }: { stats: BaseStats }) {
  const [showActual, setShowActual] = useState(false);
  return (
    <div className="space-y-2">
      {/* トグル (ラベル無し、右寄せ) */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-[11px] font-bold shadow-sm">
          <button
            type="button"
            onClick={() => setShowActual(false)}
            className={
              !showActual
                ? "rounded-full bg-indigo-500 px-3 py-0.5 text-white shadow"
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
                ? "rounded-full bg-indigo-500 px-3 py-0.5 text-white shadow"
                : "rounded-full px-3 py-0.5 text-slate-500 hover:text-slate-700"
            }
          >
            実数値
          </button>
        </div>
      </div>
      {/* 両方レンダリングして一方は非表示にする (高さ固定) */}
      <div className="relative">
        <div className={showActual ? "invisible" : "visible"}>
          <BaseStatsBars stats={stats} />
        </div>
        <div className={showActual ? "absolute inset-0" : "absolute inset-0 invisible"}>
          <ActualStatsTable stats={stats} />
        </div>
      </div>
    </div>
  );
}
