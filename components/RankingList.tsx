// 使用率ランキング一覧 (game の画面デザインを再現)
import Link from "next/link";
import type { Format, RankingEntry } from "@/lib/types";
import { getSpriteUrl } from "@/lib/pokemon-sprite";
import { TeraIconBadge } from "./TeraIconBadge";

type Props = {
  entries: RankingEntry[];
  format: Format;
  seasonId: string;
};

export function RankingList({ entries, format, seasonId }: Props) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {entries.map((entry) => (
        <Link
          key={`${entry.rank}-${entry.pokemonSlug}`}
          href={`/pokemon/${entry.pokemonSlug}?season=${seasonId}&format=${format}`}
          className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg"
        >
          {/* 順位 */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 font-display text-base font-black text-white shadow">
            {entry.rank}
          </div>
          {/* スプライト */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getSpriteUrl(entry.pokemonSlug)}
            alt={entry.pokemonJa}
            className="h-12 w-12 shrink-0 object-contain"
            loading="lazy"
          />
          {/* 名前 */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 group-hover:text-indigo-700">
              {entry.pokemonJa}
            </p>
          </div>
          {/* テラスアイコン */}
          {entry.teraIcons && entry.teraIcons.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {entry.teraIcons.slice(0, 3).map((t, i) => (
                <TeraIconBadge key={`${t}-${i}`} type={t} />
              ))}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
