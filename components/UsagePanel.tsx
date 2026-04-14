// 採用率パネル: 円グラフ + 凡例
// 技: 左にタイプバッジ、右に物理/特殊/変化アイコン
// もちもの: 左にもちものスプライト
import type { UsageEntry } from "@/lib/types";
import type { MoveMeta } from "@/lib/move-meta";
import { DoughnutChart } from "./DoughnutChart";
import { getItemSpriteUrl } from "@/lib/item-meta";

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

/** 物理: 四芒星バースト */
function PhysicalIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-rose-500 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-white">
        <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
      </svg>
    </span>
  );
}
/** 特殊: 同心円のぐるぐる */
function SpecialIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 stroke-white fill-none" strokeWidth="1.6">
        <circle cx="10" cy="10" r="2.5" />
        <circle cx="10" cy="10" r="5.5" />
        <circle cx="10" cy="10" r="8.5" />
      </svg>
    </span>
  );
}
/** 変化: 四角アイコン */
function StatusIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-500 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-3 w-3 stroke-white fill-none" strokeWidth="2">
        <rect x="3" y="3" width="14" height="14" rx="2" />
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
      {/* 凡例 */}
      <ul className="space-y-1.5 border-t border-slate-100 px-4 pt-3 pb-4">
        {entries.slice(0, limit).map((e) => {
          const meta = moveMeta?.[e.name];
          const spriteUrl = showItemSprite ? getItemSpriteUrl(e.name) : null;
          return (
            <li key={`${e.rank}-${e.name}`} className="flex items-center gap-2">
              {/* 左アイコン: 技タイプ or もちもの画像 */}
              {meta && (
                <span
                  title={meta.type}
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${TYPE_COLOR[meta.type] ?? "bg-slate-400"} text-[10px] font-black text-white`}
                >
                  {TYPE_LABEL[meta.type] ?? "?"}
                </span>
              )}
              {spriteUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={spriteUrl} alt={e.name}
                  className="h-5 w-5 shrink-0 object-contain"
                  loading="lazy"
                />
              )}
              {/* 名前 */}
              <span className="flex-1 truncate text-[13px] font-bold text-slate-700">
                {e.name}
              </span>
              {/* 右アイコン: 物理/特殊/変化 */}
              {meta && <CategoryIcon category={meta.category} />}
              {/* 採用率 */}
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
