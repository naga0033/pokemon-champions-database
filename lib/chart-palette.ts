// 円グラフ + 凡例の共通カラーパレット (紫をベース + ピンク/青/ターコイズの差し色、暖色の黄系は除外)
export const CHART_PALETTE = [
  "#a78bfa", // violet-400 (濃紫、1位)
  "#c4b5fd", // violet-300 (ラベンダー)
  "#f9a8d4", // pink-300 (ピンク)
  "#93c5fd", // blue-300 (青)
  "#d8b4fe", // purple-300 (淡紫)
  "#5eead4", // teal-300 (ターコイズ)
  "#fca5a5", // red-300 (ソフトローズ)
  "#a5b4fc", // indigo-300 (淡インディゴ)
  "#cbd5e1", // slate-300 (その他)
];

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
