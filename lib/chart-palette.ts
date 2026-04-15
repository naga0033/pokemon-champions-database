// 円グラフ + 凡例の共通カラーパレット (紫ラベンダー + 黄緑のアクセント、種族値バーと揃える)
export const CHART_PALETTE = [
  "#a78bfa", // violet-400 (1位が一番濃い紫)
  "#c4b5fd", // violet-300 (ラベンダー)
  "#fde047", // yellow-300 (黄)
  "#d8b4fe", // purple-300 (淡紫)
  "#bef264", // lime-300 (黄緑)
  "#fcd34d", // amber-300 (琥珀)
  "#e9d5ff", // purple-200 (淡ラベンダー)
  "#a5b4fc", // indigo-300 (淡インディゴ)
  "#cbd5e1", // slate-300 (その他用)
];

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
