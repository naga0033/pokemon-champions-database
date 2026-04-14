// 円グラフパレット: 紫→ラベンダーの階調を軸に、隣接スライスが近い色になるよう配置
// (小さいスライスが大きな紫に挟まれて浮かないように)
export const CHART_PALETTE = [
  "#7c3aed", // violet-600 (1位: 濃紫)
  "#a78bfa", // violet-400
  "#c4b5fd", // violet-300 (ラベンダー)
  "#d8b4fe", // purple-300 (淡紫)
  "#e9d5ff", // purple-200 (淡ラベンダー)
  "#a5b4fc", // indigo-300 (淡インディゴで遷移)
  "#93c5fd", // blue-300 (青)
  "#f9a8d4", // pink-300 (ピンクで差し色)
  "#cbd5e1", // slate-300 (その他)
];

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
