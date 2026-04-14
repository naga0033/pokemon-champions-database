// 実数値表示テーブル (Lv50 ・ 4列: 最大 / 準 / 無振 / 下降)
import type { BaseStats } from "@/lib/pokeapi-stats";

type Props = { stats: BaseStats };

const LABELS: Array<{ key: keyof BaseStats; label: string }> = [
  { key: "hp",    label: "HP" },
  { key: "atk",   label: "こうげき" },
  { key: "def",   label: "ぼうぎょ" },
  { key: "spAtk", label: "とくこう" },
  { key: "spDef", label: "とくぼう" },
  { key: "speed", label: "すばやさ" },
];

/**
 * Lv50 の実数値計算 (ポケモン標準式、IV=31 前提)
 * - HP 最大 (EV 252): B + 107
 * - HP 無振 (EV 0):   floor((2B+31)/2) + 60
 * - 他 最大 (+性格, EV 252):  floor((B + 52) * 1.1)
 * - 他 準 (無性格, EV 252):   B + 52
 * - 他 無振 (無性格, EV 0):   floor((2B+31)/2) + 5
 * - 他 下降 (-性格, EV 0):    floor((floor((2B+31)/2) + 5) * 0.9)
 */
function calc(base: number, kind: "max" | "neutralMax" | "noInvest" | "down", isHp: boolean): number {
  if (isHp) {
    if (kind === "max" || kind === "neutralMax") return base + 107;
    // 無振 / 下降 は HP は同じ (HP は性格補正なし)
    return Math.floor((2 * base + 31) / 2) + 60;
  }
  const base252 = base + 52; // floor((2B+94)/2) + 5
  const base0 = Math.floor((2 * base + 31) / 2) + 5;
  switch (kind) {
    case "max":        return Math.floor(base252 * 1.1);
    case "neutralMax": return base252;
    case "noInvest":   return base0;
    case "down":       return Math.floor(base0 * 0.9);
  }
}

export function ActualStatsTable({ stats }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="px-2 py-1.5 text-left">Lv50</th>
            <th className="px-2 py-1.5 text-right">種族</th>
            <th className="px-2 py-1.5 text-right">最大</th>
            <th className="px-2 py-1.5 text-right">準</th>
            <th className="px-2 py-1.5 text-right">無振</th>
            <th className="px-2 py-1.5 text-right">下降</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {LABELS.map(({ key, label }) => {
            const b = stats[key];
            const isHp = key === "hp";
            return (
              <tr key={key}>
                <td className="px-2 py-1.5 font-bold text-slate-600">{label}</td>
                <td className="px-2 py-1.5 text-right font-bold text-slate-900 tabular-nums">{b}</td>
                <td className="px-2 py-1.5 text-right font-black text-rose-600 tabular-nums">{calc(b, "max", isHp)}</td>
                <td className="px-2 py-1.5 text-right font-bold text-slate-900 tabular-nums">{calc(b, "neutralMax", isHp)}</td>
                <td className="px-2 py-1.5 text-right text-slate-700 tabular-nums">{calc(b, "noInvest", isHp)}</td>
                <td className="px-2 py-1.5 text-right text-slate-500 tabular-nums">{calc(b, "down", isHp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
