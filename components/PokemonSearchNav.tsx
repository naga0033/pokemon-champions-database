"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Entry = { pokemonJa: string; pokemonSlug: string; rank?: number };

type Props = {
  entries: Entry[];
  format: string;
  seasonId: string;
};

const normalize = (s: string) =>
  s.replace(/[ァ-ンー]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60))
    .toLowerCase()
    .trim();

export function PokemonSearchNav({ entries, format, seasonId }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 未入力時はランキング順上位20件、入力時はフィルタ結果
  const suggestions = query
    ? entries.filter((e) => normalize(e.pokemonJa).includes(normalize(query))).slice(0, 10)
    : entries.slice(0, 20);

  const go = (slug: string) => {
    setQuery("");
    setOpen(false);
    router.push(`/pokemon/${slug}?format=${format}&season=${seasonId}`);
  };

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="ポケモンを選択…"
          className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none shadow-sm"
        />
        <svg
          className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        )}
      </div>
      {/* サジェストドロップダウン */}
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {!query && (
            <li className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
              {format === "double" ? "ダブル" : "シングル"} ランキング順
            </li>
          )}
          {suggestions.map((e, i) => (
            <li key={e.pokemonSlug}>
              <button
                type="button"
                onMouseDown={() => go(e.pokemonSlug)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-indigo-50"
              >
                <span className="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-slate-400">
                  {query ? "" : `${i + 1}`}
                </span>
                <span className="text-sm font-medium text-slate-800 hover:text-indigo-700">
                  {e.pokemonJa}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
