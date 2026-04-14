// 円グラフ + 凡例の共通カラーパレット (server/client 両方から参照される)
export const CHART_PALETTE = [
  "#93c5fd", "#fca5a5", "#fcd34d", "#86efac", "#c4b5fd",
  "#f9a8d4", "#5eead4", "#fdba74", "#cbd5e1",
];

export function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
