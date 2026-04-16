"use client";

// 採用率パネル: 円グラフ + 凡例
// 技: 左にタイプバッジ、右に物理/特殊/変化アイコン
// もちもの: 左にもちものスプライト
import type { UsageEntry } from "@/lib/types";
import type { MoveMeta } from "@/lib/move-meta";
import { DoughnutChart } from "./DoughnutChart";
import { paletteColor } from "@/lib/chart-palette";
import { getItemSpriteUrl } from "@/lib/item-meta";
import { TypeIcon } from "./TypeIcon";

type Props = {
  title: string;
  iconLabel: string;
  entries: UsageEntry[];
  limit?: number;
  moveMeta?: Record<string, MoveMeta>;
  showItemSprite?: boolean;
  /** 同じチーム用: % を非表示にしてチャートも出さない (ゲーム側に % が無いため) */
  hidePercentage?: boolean;
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

/** 物理 / 特殊 / 変化 アイコン: ユーザー提供の画像を使用 */
/* eslint-disable @next/next/no-img-element */
function PhysicalIcon() {
  return <img src="/move-category/physical.png" alt="物理" title="物理" className="h-5 w-5 shrink-0 rounded-md object-cover" />;
}
function SpecialIcon() {
  return <img src="/move-category/special.png" alt="特殊" title="特殊" className="h-5 w-5 shrink-0 rounded-md object-cover" />;
}
function StatusIcon() {
  return <img src="/move-category/status.png" alt="変化" title="変化" className="h-5 w-5 shrink-0 rounded-md object-cover" />;
}
/* eslint-enable @next/next/no-img-element */

function CategoryIcon({ category }: { category: MoveMeta["category"] }) {
  if (category === "physical") return <PhysicalIcon />;
  if (category === "special")  return <SpecialIcon />;
  return <StatusIcon />;
}

export function UsagePanel({
  title, iconLabel, entries, limit = 5,
  moveMeta, showItemSprite, hidePercentage,
}: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-violet-100 bg-white/85 shadow-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 pt-2.5 pb-1.5 sm:px-4 sm:pt-3 sm:pb-2">
        <span className="font-display text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400 sm:text-[10px] sm:tracking-[0.3em]">
          {iconLabel}
        </span>
        <span className="text-xs font-black text-slate-900 sm:text-sm">{title}</span>
      </div>
      {/* 円グラフ (% 無しパネルも高さ揃えるため枠だけ残す) */}
      <div className="px-2 py-3 sm:px-4 sm:py-4">
        {hidePercentage ? (
          <div className="mx-auto aspect-square max-w-[140px]" />
        ) : (
          <DoughnutChart entries={entries} size={140} limit={limit} />
        )}
      </div>
      {/* 凡例 (列をきっちり揃える) */}
      <ul className="space-y-1.5 border-t border-slate-100 px-2.5 pt-2.5 pb-3 sm:px-4 sm:pt-3 sm:pb-4">
        {entries.slice(0, limit).map((e, i) => {
          const meta = moveMeta?.[e.name];
          const spriteUrl = showItemSprite ? getItemSpriteUrl(e.name) : null;
          const hasTypeOrItem = !!meta || !!spriteUrl;
          const hasRightIcon = !!moveMeta;
          const color = paletteColor(i);
          return (
            <li key={`${e.rank}-${e.name}`} className="flex items-center gap-2">
              {/* 左アイコン列: 24px 枠で統一 (タイプは少し小さめ、もちもの画像は大きめ) */}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                {meta && (
                  <span className="scale-[0.85]">
                    <TypeIcon type={meta.type} size="sm" />
                  </span>
                )}
                {spriteUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={spriteUrl} alt={e.name}
                    className="h-6 w-6 object-contain"
                    loading="lazy"
                  />
                )}
                {/* アイコン無しパネルは箇条書きのドット */}
                {!hasTypeOrItem && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
              </span>
              {/* 名前: 残り幅を使って truncate */}
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700 sm:text-[13px]">
                {e.name}
              </span>
              {/* 右アイコン列: 20px 固定 (meta 無い場合も空枠) / モバイルは非表示 */}
              {hasRightIcon && (
                <span className="hidden h-5 w-5 shrink-0 items-center justify-center sm:flex">
                  {meta && <CategoryIcon category={meta.category} />}
                </span>
              )}
              {/* 採用率: 右寄せ (% が無いパネルでは順位だけ右に出す) */}
              {/* 1%以上は小数点以下切り捨て、0%台のみ小数1桁を維持 */}
              {hidePercentage ? (
                <span className="font-display w-9 shrink-0 text-right text-[10px] font-bold text-slate-400 tabular-nums sm:w-12 sm:text-xs">
                  {e.rank}位
                </span>
              ) : (
                <span className="font-display w-8 shrink-0 text-right text-[10px] font-black text-slate-900 tabular-nums sm:w-10 sm:text-xs">
                  {e.percentage >= 1 ? `${Math.floor(e.percentage)}%` : `${e.percentage.toFixed(1)}%`}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
