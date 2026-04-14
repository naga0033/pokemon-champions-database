// 採用率パネル: 円グラフ + 凡例
// 技: 左にタイプバッジ、右に物理/特殊/変化アイコン
// もちもの: 左にもちものスプライト
import type { UsageEntry } from "@/lib/types";
import type { MoveMeta } from "@/lib/move-meta";
import { DoughnutChart, paletteColor } from "./DoughnutChart";
import { getItemSpriteUrl } from "@/lib/item-meta";
import { TypeIcon } from "./TypeIcon";

type Props = {
  title: string;
  iconLabel: string;
  entries: UsageEntry[];
  limit?: number;
  moveMeta?: Record<string, MoveMeta>;
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

/** 物理: 8 ジャギーのバースト (インパクト型) */
function PhysicalIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-500 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4 fill-white">
        <path d="M10 1 L12 5 L15 3 L14 7 L18 6 L15.5 9.5 L19 11 L15 13 L17 16 L13 16 L13 19 L10 17 L7 19 L7 16 L3 16 L5 13 L1 11 L4.5 9.5 L2 6 L6 7 L5 3 L8 5 Z" />
      </svg>
    </span>
  );
}
/** 特殊: 横長の同心楕円スパイラル */
function SpecialIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4 stroke-white fill-none" strokeWidth="1.5">
        <ellipse cx="10" cy="10" rx="2" ry="1.3" />
        <ellipse cx="10" cy="10" rx="4.5" ry="2.8" />
        <ellipse cx="10" cy="10" rx="7.5" ry="4.5" />
      </svg>
    </span>
  );
}
/** 変化: 月型 (楕円 + くり抜き) */
function StatusIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-500 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4">
        <ellipse cx="10" cy="10" rx="7" ry="5.5" fill="white" />
        <ellipse cx="12" cy="9" rx="4" ry="3.5" fill="rgb(100,116,139)" />
      </svg>
    </span>
  );
}

function CategoryIcon({ category }: { category: MoveMeta["category"] }) {
  if (category === "physical") return <PhysicalIcon />;
  if (category === "special")  return <SpecialIcon />;
  return <StatusIcon />;
}

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
      {/* 凡例 (列をきっちり揃える: [左アイコン枠 20px][名前 flex][右アイコン枠 20px][採用率 48px]) */}
      <ul className="space-y-1.5 border-t border-slate-100 px-4 pt-3 pb-4">
        {entries.slice(0, limit).map((e, i) => {
          const meta = moveMeta?.[e.name];
          const spriteUrl = showItemSprite ? getItemSpriteUrl(e.name) : null;
          const hasTypeOrItem = !!meta || !!spriteUrl;
          const hasRightIcon = !!moveMeta;
          const color = paletteColor(i);
          return (
            <li key={`${e.rank}-${e.name}`} className="flex items-center gap-2">
              {/* 左アイコン列: 20px 固定 */}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {meta && <TypeIcon type={meta.type} size="sm" />}
                {spriteUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={spriteUrl} alt={e.name}
                    className="h-5 w-5 object-contain"
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
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-700">
                {e.name}
              </span>
              {/* 右アイコン列: 20px 固定 (meta 無い場合も空枠) */}
              {hasRightIcon && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {meta && <CategoryIcon category={meta.category} />}
                </span>
              )}
              {/* 採用率: 48px 固定・右寄せ */}
              <span className="font-display w-12 shrink-0 text-right text-xs font-black text-slate-900 tabular-nums">
                {e.percentage.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
