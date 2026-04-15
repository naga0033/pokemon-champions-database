"use client";
import { useMemo, useState } from "react";
import type { Format, RankingEntry } from "@/lib/types";
import { RankingList } from "./RankingList";

type Props = {
  entries: RankingEntry[];
  format: Format;
  seasonId: string;
};

export function SearchableRankingList({ entries, format, seasonId }: Props) {
  const [query, setQuery] = useState("");

  const normalize = (s: string) =>
    s.replace(/[ァ-ンー]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60))
      .toLowerCase()
      .trim();

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return entries;
    return entries.filter((e) => normalize(e.pokemonJa).includes(q));
  }, [entries, query]);

  return (
    <div className="space-y-3">
      {/* 検索欄 */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={(e) => {
            // モバイルで確実に全選択するため setTimeout で遅延させる
            const el = e.currentTarget;
            setTimeout(() => el.select(), 0);
          }}
          placeholder="ポケモン名で検索 (例: ガブリアス、ぶりじゅらす)"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
          >
            クリア
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          「{query}」に一致するポケモンが見つかりませんでした
        </p>
      ) : (
        <RankingList entries={filtered} format={format} seasonId={seasonId} />
      )}
    </div>
  );
}
