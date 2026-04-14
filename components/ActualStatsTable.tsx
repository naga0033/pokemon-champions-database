// 実数値表示テーブル (4列: 最大 / 準 / 無振 / 下降)
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

function calc(base: number, kind: "max" | "neutralMax" | "noInvest" | "down", isHp: boolean): number {
  if (isHp) {
    if (kind === "max" || kind === "neutralMax") return base + 107;
    return Math.floor((2 * base + 31) / 2) + 60;
  }
  const base252 = base + 52;
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
    <table className="w-full text-[11px]">
      <thead className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        <tr className="border-b border-slate-200">
          <th className="px-1 py-1 text-left">　</th>
          <th className="px-1 py-1 text-right">種族</th>
          <th className="px-1 py-1 text-right">最大</th>
          <th className="px-1 py-1 text-right">準</th>
          <th className="px-1 py-1 text-right">無振</th>
          <th className="px-1 py-1 text-right">下降</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {LABELS.map(({ key, label }) => {
          const b = stats[key];
          const isHp = key === "hp";
          return (
            <tr key={key}>
              <td className="px-1 py-1 font-bold text-slate-600">{label}</td>
              <td className="px-1 py-1 text-right font-bold text-slate-900 tabular-nums">{b}</td>
              <td className="px-1 py-1 text-right font-black text-purple-700 tabular-nums">{calc(b, "max", isHp)}</td>
              <td className="px-1 py-1 text-right font-bold text-slate-900 tabular-nums">{calc(b, "neutralMax", isHp)}</td>
              <td className="px-1 py-1 text-right text-slate-700 tabular-nums">{calc(b, "noInvest", isHp)}</td>
              <td className="px-1 py-1 text-right text-slate-500 tabular-nums">{calc(b, "down", isHp)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
