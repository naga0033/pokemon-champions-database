// 種族値を横棒グラフで表示 (低いほど黄色、高いほど紫)
import type { BaseStats } from "@/lib/pokeapi-stats";

type Props = { stats: BaseStats };

const LABELS: Array<{ key: keyof BaseStats; label: string }> = [
  { key: "hp",     label: "HP" },
  { key: "atk",    label: "こうげき" },
  { key: "def",    label: "ぼうぎょ" },
  { key: "spAtk",  label: "とくこう" },
  { key: "spDef",  label: "とくぼう" },
  { key: "speed",  label: "すばやさ" },
];

/** 低→黄、中→水色/青、高→紫のグラデ (円グラフのパレットと揃える) */
function barColor(v: number): string {
  if (v >= 130) return "bg-purple-600";
  if (v >= 110) return "bg-violet-500";
  if (v >= 90)  return "bg-sky-400";
  if (v >= 70)  return "bg-cyan-300";
  if (v >= 50)  return "bg-amber-400";
  return "bg-yellow-300";
}

export function BaseStatsBars({ stats }: Props) {
  const total = stats.hp + stats.atk + stats.def + stats.spAtk + stats.spDef + stats.speed;
  return (
    <div className="space-y-1">
      {LABELS.map(({ key, label }) => {
        const v = stats[key];
        const pct = Math.min(100, (v / 180) * 100);
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-14 shrink-0 font-bold text-slate-600">{label}</span>
            <span className="font-display w-8 shrink-0 text-right font-black text-slate-900 tabular-nums">
              {v}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`absolute inset-y-0 left-0 ${barColor(v)}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-1 text-xs">
        <span className="w-14 shrink-0 font-bold text-slate-500">合計</span>
        <span className="font-display w-8 shrink-0 text-right font-black text-slate-900 tabular-nums">
          {total}
        </span>
        <div className="flex-1" />
      </div>
    </div>
  );
}
