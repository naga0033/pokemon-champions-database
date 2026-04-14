// SVG 円グラフ (採用率パネル用)
// ライブラリなしで pure SVG path でなめらかな扇形を描く
import type { UsageEntry } from "@/lib/types";

const PALETTE = [
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#ec4899", // pink
  "#facc15", // yellow
  "#10b981", // emerald
  "#0ea5e9", // sky
  "#a855f7", // purple
  "#64748b", // slate
];

type Props = {
  entries: UsageEntry[];
  /** 円の直径 px */
  size?: number;
};

/**
 * 円の中心 (cx,cy) から、半径 r で角度 angleDeg (12時起点) の座標
 * 上から時計回り
 */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** 扇形の SVG path を作る */
function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  // 全体が 1 枚のとき (100%) は 2 つの半円で描く
  if (endAngle - startAngle >= 359.999) {
    const mid = polar(cx, cy, r, startAngle + 180);
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${mid.x} ${mid.y} A ${r} ${r} 0 0 1 ${start.x} ${start.y} Z`;
  }
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

export function DoughnutChart({ entries, size = 160 }: Props) {
  if (entries.length === 0) return null;

  const total = entries.reduce((s, e) => s + e.percentage, 0);
  const others = Math.max(0, 100 - total);

  const segments = [
    ...entries.map((e, i) => ({
      value: e.percentage,
      color: PALETTE[i % PALETTE.length],
      label: e.name,
    })),
    ...(others > 0.1 ? [{ value: others, color: "#e2e8f0", label: "その他" }] : []),
  ];

  const normalizedTotal = segments.reduce((s, x) => s + x.value, 0) || 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  let current = 0;
  const paths = segments.map((seg, i) => {
    const ratio = seg.value / normalizedTotal;
    const start = current * 360;
    current += ratio;
    const end = current * 360;
    return (
      <path
        key={`${i}-${seg.label}`}
        d={pieSlicePath(cx, cy, r, start, end)}
        fill={seg.color}
      />
    );
  });

  return (
    <div className="mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="block">
        {paths}
      </svg>
    </div>
  );
}

/** パレット色の取得 (凡例用) */
export function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
