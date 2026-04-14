// 採用率パネル: 技・持ち物・特性・性格・テラス などで共通利用
import type { UsageEntry } from "@/lib/types";

type Props = {
  title: string;
  iconLabel: string;
  entries: UsageEntry[];
  /** Tailwind gradient classes e.g. "from-rose-500 to-orange-500" */
  accent: string;
};

export function UsagePanel({ title, iconLabel, entries, accent }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`bg-gradient-to-r ${accent} px-4 py-2.5 text-white`}>
        <div className="flex items-center justify-between">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">
            {iconLabel}
          </span>
          <span className="text-sm font-black">{title}</span>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {entries.slice(0, 5).map((e) => (
          <li
            key={`${e.rank}-${e.name}`}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <span className="font-display w-6 text-right text-xs font-bold text-slate-400">
              {e.rank}
            </span>
            <span className="flex-1 truncate text-sm font-bold text-slate-800">
              {e.name}
            </span>
            <span className="font-display text-sm font-black text-slate-900">
              {e.percentage.toFixed(1)}
              <span className="ml-0.5 text-[10px] font-bold text-slate-400">%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
