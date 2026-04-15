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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-5">
      {entries.map((entry) => (
        <Link
          key={`${entry.rank}-${entry.pokemonSlug}`}
          href={`/pokemon/${entry.pokemonSlug}?season=${seasonId}&format=${format}`}
          className="group flex items-center gap-1.5 rounded-xl border border-violet-100 bg-white/85 px-2 py-2 transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md sm:gap-3 sm:px-4 sm:py-3"
        >
          <span className="font-display w-5 shrink-0 text-right text-xs font-black text-slate-400 group-hover:text-indigo-500 sm:w-8 sm:text-base">
            {entry.rank}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getListSpriteUrl(entry.pokemonSlug)}
            alt={entry.pokemonJa}
            className="h-10 w-10 shrink-0 object-contain sm:h-14 sm:w-14"
            loading="lazy"
          />
          <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-900 group-hover:text-indigo-700 sm:text-sm">
            {entry.pokemonJa}
          </span>
        </Link>
      ))}
    </div>
  );
}
