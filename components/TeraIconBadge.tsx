// テラスタイプのアイコンバッジ
import type { TeraIcon } from "@/lib/types";

const TYPE_COLORS: Record<TeraIcon, { bg: string; label: string }> = {
  normal:   { bg: "bg-slate-400",   label: "ノーマル" },
  fire:     { bg: "bg-orange-500",  label: "ほのお" },
  water:    { bg: "bg-blue-500",    label: "みず" },
  electric: { bg: "bg-yellow-400",  label: "でんき" },
  grass:    { bg: "bg-green-500",   label: "くさ" },
  ice:      { bg: "bg-cyan-400",    label: "こおり" },
  fighting: { bg: "bg-red-700",     label: "かくとう" },
  poison:   { bg: "bg-purple-500",  label: "どく" },
  ground:   { bg: "bg-amber-700",   label: "じめん" },
  flying:   { bg: "bg-sky-400",     label: "ひこう" },
  psychic:  { bg: "bg-pink-500",    label: "エスパー" },
  bug:      { bg: "bg-lime-600",    label: "むし" },
  rock:     { bg: "bg-stone-600",   label: "いわ" },
  ghost:    { bg: "bg-purple-800",  label: "ゴースト" },
  dragon:   { bg: "bg-indigo-700",  label: "ドラゴン" },
  dark:     { bg: "bg-slate-800",   label: "あく" },
  steel:    { bg: "bg-slate-500",   label: "はがね" },
  fairy:    { bg: "bg-pink-300",    label: "フェアリー" },
  stellar:  { bg: "bg-gradient-to-br from-indigo-400 via-pink-400 to-yellow-400", label: "ステラ" },
};

export function TeraIconBadge({ type, size = "sm" }: { type: TeraIcon; size?: "sm" | "md" }) {
  const entry = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
  const sizeClass = size === "md" ? "h-6 w-6 text-[9px]" : "h-5 w-5 text-[8px]";
  return (
    <span
      title={entry.label}
      className={`inline-flex ${sizeClass} items-center justify-center rounded-full ${entry.bg} font-bold text-white shadow-sm`}
    >
      {entry.label.slice(0, 2)}
    </span>
  );
}
