// 採用率パネル: 円グラフ + 凡例
// オプションで行左にアイコン (タイプ / もちもの画像)、右にバッジ (物理/特殊/変化) を出せる
import type { UsageEntry } from "@/lib/types";
import type { MoveMeta } from "@/lib/move-meta";
import { DoughnutChart, paletteColor } from "./DoughnutChart";
import { getItemSpriteUrl } from "@/lib/item-meta";

type Props = {
  title: string;
  iconLabel: string;
  entries: UsageEntry[];
  limit?: number;
  /** moves パネル用: 技の type/category を表示 */
  moveMeta?: Record<string, MoveMeta>;
  /** items パネル用: もちものスプライトを左に表示 */
  showItemSprite?: boolean;
};

const TYPE_COLOR: Record<string, string> = {
  normal:"bg-slate-400", fire:"bg-orange-500", water:"bg-blue-500",
  electric:"bg-yellow-400", grass:"bg-green-500", ice:"bg-cyan-400",
  fighting:"bg-red-700", poison:"bg-purple-500", ground:"bg-amber-700",
  flying:"bg-sky-400", psychic:"bg-pink-500", bug:"bg-lime-600",
  rock:"bg-stone-600", ghost:"bg-purple-800", dragon:"bg-indigo-700",
  dark:"bg-slate-800", steel:"bg-slate-500", fairy:"bg-pink-300",
};
const TYPE_LABEL: Record<string, string> = {
  normal:"ノ", fire:"炎", water:"水", electric:"電", grass:"草",
  ice:"氷", fighting:"闘", poison:"毒", ground:"地", flying:"飛",
  psychic:"超", bug:"虫", rock:"岩", ghost:"霊", dragon:"竜",
  dark:"悪", steel:"鋼", fairy:"妖",
};

const CATEGORY_ICON: Record<MoveMeta["category"], { bg: string; label: string }> = {
  physical: { bg: "bg-rose-500", label: "物" },
  special:  { bg: "bg-sky-500",  label: "特" },
  status:   { bg: "bg-slate-400", label: "変" },
};

export function UsagePanel({
  title, iconLabel, entries, limit = 5,
  moveMeta, showItemSprite,
}: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 pt-3 pb-2">
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
          {iconLabel}
        </span>
        <span className="text-sm font-black text-slate-900">{title}</span>
      </div>
      {/* 円グラフ */}
      <div className="px-4 py-4">
        <DoughnutChart entries={entries} size={140} limit={limit} />
      </div>
      {/* 凡例 */}
      <ul className="space-y-1.5 border-t border-slate-100 px-4 pt-3 pb-4">
        {entries.slice(0, limit).map((e, i) => {
          const meta = moveMeta?.[e.name];
          const spriteUrl = showItemSprite ? getItemSpriteUrl(e.name) : null;
          return (
            <li key={`${e.rank}-${e.name}`} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: paletteColor(i) }}
              />
              {/* 左アイコン (技タイプ or もちもの画像) */}
              {meta && (
                <span
                  title={meta.type}
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${TYPE_COLOR[meta.type] ?? "bg-slate-400"} text-[9px] font-black text-white`}
                >
                  {TYPE_LABEL[meta.type] ?? "?"}
                </span>
              )}
              {spriteUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spriteUrl}
                  alt={e.name}
                  className="h-5 w-5 shrink-0 object-contain"
                  loading="lazy"
                />
              )}
              <span className="flex-1 truncate text-[13px] font-bold text-slate-700">
                {e.name}
              </span>
              {/* 右バッジ (物理/特殊/変化) */}
              {meta && (
                <span
                  title={meta.category}
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ${CATEGORY_ICON[meta.category].bg} text-[9px] font-black text-white`}
                >
                  {CATEGORY_ICON[meta.category].label}
                </span>
              )}
              <span className="font-display text-xs font-black text-slate-900 tabular-nums">
                {e.percentage.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
