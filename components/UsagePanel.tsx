// 採用率パネル: 円グラフ + 凡例 (技・持ち物・特性・性格・同じチーム 共通)
import type { UsageEntry } from "@/lib/types";
import { DoughnutChart, paletteColor } from "./DoughnutChart";

type Props = {
  title: string;
  iconLabel: string;
  entries: UsageEntry[];
};

export function UsagePanel({ title, iconLabel, entries }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 pt-3 pb-2">
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
          {iconLabel}
        </span>
        <span className="text-sm font-black text-slate-900">{title}</span>
      </div>
      {/* 円グラフ */}
      <div className="px-4 py-4">
        <DoughnutChart entries={entries} size={140} />
      </div>
      {/* 凡例 */}
      <ul className="space-y-1.5 border-t border-slate-100 px-4 pt-3 pb-4">
        {entries.slice(0, 5).map((e, i) => (
          <li key={`${e.rank}-${e.name}`} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: paletteColor(i) }}
            />
            <span className="flex-1 truncate text-[13px] font-bold text-slate-700">
              {e.name}
            </span>
            <span className="font-display text-xs font-black text-slate-900 tabular-nums">
              {e.percentage.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
