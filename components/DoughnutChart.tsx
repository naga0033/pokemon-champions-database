"use client";
// SVG 円グラフ + ホバーツールチップ (採用率パネル用)
import { useState } from "react";
import type { UsageEntry } from "@/lib/types";

const PALETTE = [
  "#93c5fd", "#fca5a5", "#fcd34d", "#86efac", "#c4b5fd",
  "#f9a8d4", "#5eead4", "#fdba74", "#cbd5e1",
];

type Props = {
  entries: UsageEntry[];
  size?: number;
  limit?: number;
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  if (endAngle - startAngle >= 359.999) {
    const mid = polar(cx, cy, r, startAngle + 180);
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${mid.x} ${mid.y} A ${r} ${r} 0 0 1 ${start.x} ${start.y} Z`;
  }
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

export function DoughnutChart({ entries, size = 160, limit }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (entries.length === 0) return null;

  const visible = limit ? entries.slice(0, limit) : entries;
  const total = visible.reduce((s, e) => s + e.percentage, 0);
  const others = Math.max(0, 100 - total);

  const segments = [
    ...visible.map((e, i) => ({
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
    const isHovered = hoveredIdx === i;
    return (
      <path
        key={`${i}-${seg.label}`}
        d={pieSlicePath(cx, cy, r, start, end)}
        fill={seg.color}
        stroke={isHovered ? "#1e293b" : "transparent"}
        strokeWidth={isHovered ? 1.5 : 0}
        className="cursor-pointer transition-[filter] duration-150"
        style={{ filter: isHovered ? "brightness(1.08) saturate(1.15)" : "none" }}
        onMouseEnter={() => setHoveredIdx(i)}
        onMouseLeave={() => setHoveredIdx(null)}
      />
    );
  });

  const hovered = hoveredIdx != null ? segments[hoveredIdx] : null;

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="block">
        {paths}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 flex items-center gap-1.5 whitespace-nowrap rounded-md bg-slate-900/95 px-2.5 py-1 text-xs font-bold text-white shadow-lg"
          style={{
            left: Math.min(Math.max(mousePos.x + 12, 0), size - 8),
            top: Math.max(mousePos.y - 32, -32),
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: hovered.color }}
          />
          <span>{hovered.label}: {hovered.value.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

export function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
