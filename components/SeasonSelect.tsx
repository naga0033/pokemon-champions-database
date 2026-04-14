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

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentSeasonId}
        onChange={(e) => {
          const target = e.target.value;
          router.push(`/?format=${format}&season=${target}`);
        }}
        className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label} ({s.startDate} 〜 {s.endDate})
          </option>
        ))}
      </select>
    </div>
  );
}
