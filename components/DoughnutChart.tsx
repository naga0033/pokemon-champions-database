// SVG ドーナツチャート (採用率パネル用)
// ライブラリなしで軽量に実装
import type { UsageEntry } from "@/lib/types";

/** 7 色の回転パレット (前任 DB を参考にした彩度高めの原色系) */
const PALETTE = [
  "#f97316", // orange-500
  "#14b8a6", // teal-500
  "#6366f1", // indigo-500
  "#ec4899", // pink-500
  "#facc15", // yellow-400
  "#10b981", // emerald-500
  "#0ea5e9", // sky-500
  "#a855f7", // purple-500
  "#64748b", // slate-500
];

type Props = {
  entries: UsageEntry[];
  /** 円の直径 px */
  size?: number;
  /** ドーナツ穴の厚み比率 (0-1), 小さいほど穴が大きい */
  thickness?: number;
};

export function DoughnutChart({ entries, size = 160, thickness = 0.3 }: Props) {
  if (entries.length === 0) return null;

  const top = entries[0];
  const total = entries.reduce((s, e) => s + e.percentage, 0);
  // 残り = 100% - 合計 (Top5 しか出てないので)
  const others = Math.max(0, 100 - total);

  const segments = [
    ...entries.map((e, i) => ({
      value: e.percentage,
      color: PALETTE[i % PALETTE.length],
      label: e.name,
    })),
    ...(others > 0.1 ? [{ value: others, color: "#e2e8f0", label: "その他" }] : []),
  ];

  // 円周の長さ
  const radius = size / 2 - 4;
  const innerR = radius * (1 - thickness);
  const circumference = 2 * Math.PI * radius;

  // 各セグメントを SVG stroke-dasharray で描画
  const normalizedTotal = segments.reduce((s, x) => s + x.value, 0) || 100;
  let cumulative = 0;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
        {/* ベース円 (薄グレー) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={radius - innerR}
        />
        {segments.map((seg, i) => {
          const ratio = seg.value / normalizedTotal;
          const length = ratio * circumference;
          const offset = (cumulative / normalizedTotal) * circumference;
          cumulative += seg.value;
          return (
            <circle
              key={`${i}-${seg.label}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={radius - innerR}
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      {/* 中央ラベル (1 位名前 + 採用率) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          TOP
        </span>
        <span className="mt-0.5 max-w-[80%] truncate text-xs font-black text-slate-900">
          {top.name}
        </span>
        <span className="font-display text-lg font-black text-slate-900">
          {top.percentage.toFixed(1)}
          <span className="ml-0.5 text-[10px] font-bold text-slate-400">%</span>
        </span>
      </div>
    </div>
  );
}

/** パレット色の取得 (UsagePanel 側で凡例に使う) */
export function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
