"use client";
import { useRouter } from "next/navigation";
import type { Season } from "@/lib/types";

type Props = {
  seasons: Season[];
  currentSeasonId: string;
  format: "single" | "double";
};

export function SeasonSelect({ seasons, currentSeasonId, format }: Props) {
  const router = useRouter();

  /** 2026-04-08 〜 2026-05-13 → 2026-04-08 〜 05-13 (同じ年なら終わりの年を省略) */
  const formatRange = (start: string, end: string): string => {
    const startYear = start.slice(0, 4);
    const endYear = end.slice(0, 4);
    const endTail = endYear === startYear ? end.slice(5) : end;
    return `${start} 〜 ${endTail}`;
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <select
        value={currentSeasonId}
        onChange={(e) => {
          const target = e.target.value;
          router.push(`/?format=${format}&season=${target}`);
        }}
        className="w-full max-w-full cursor-pointer truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none sm:px-3 sm:text-sm"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label} ({formatRange(s.startDate, s.endDate)})
          </option>
        ))}
      </select>
    </div>
  );
}
