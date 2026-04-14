// 使用率ランキング一覧 (5列コンパクトグリッド)
import Link from "next/link";
import type { Format, RankingEntry } from "@/lib/types";
import { getListSpriteUrl } from "@/lib/pokemon-sprite";

type Props = {
  entries: RankingEntry[];
  format: Format;
  seasonId: string;
};

export function RankingList({ entries, format, seasonId }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {entries.map((entry) => (
        <Link
          key={`${entry.rank}-${entry.pokemonSlug}`}
          href={`/pokemon/${entry.pokemonSlug}?season=${seasonId}&format=${format}`}
          className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-indigo-400 hover:shadow-md"
        >
          <span className="font-display shrink-0 w-7 text-right text-sm font-black text-slate-400 group-hover:text-indigo-500">
            {entry.rank}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getListSpriteUrl(entry.pokemonSlug)}
            alt={entry.pokemonJa}
            className="h-10 w-10 shrink-0 object-contain"
            loading="lazy"
          />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-900 group-hover:text-indigo-700">
            {entry.pokemonJa}
          </span>
        </Link>
      ))}
    </div>
  );
}
