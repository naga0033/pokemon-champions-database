"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Entry = { pokemonJa: string; pokemonSlug: string };

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

  // 未入力: ランキング順全件、入力あり: フィルタ上位15件
  const suggestions = query
    ? entries.filter((e) => normalize(e.pokemonJa).includes(normalize(query))).slice(0, 15)
    : entries;

  const go = (slug: string) => {
    setQuery("");
    setOpen(false);
    router.push(`/pokemon/${slug}?format=${format}&season=${seasonId}`);
  };

  const openDropdown = useCallback(() => {
    setOpen(true);
    inputRef.current?.focus();
  }, []);

  // 外クリック・外タップで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const formatLabel = format === "double" ? "ダブル" : "シングル";

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      {/* 入力欄 + トリガー */}
      <div
        className="relative cursor-pointer"
        onClick={openDropdown}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          placeholder={`${formatLabel} ランキングからポケモンを選択…`}
          readOnly={!open}
          className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none shadow-sm cursor-pointer"
        />
        <svg
          className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        {/* 開閉矢印 */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none select-none">
          {open ? "▲" : "▼"}
        </span>
      </div>

      {/* サジェストドロップダウン */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* 検索欄（ドロップダウン内） */}
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder="名前で絞り込み…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
              <svg className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              {query && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setQuery(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 候補リスト */}
          <ul className="max-h-64 overflow-y-auto">
            {!query && (
              <li className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50">
                {formatLabel} ランキング順
              </li>
            )}
            {suggestions.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-400">見つかりませんでした</li>
            ) : (
              suggestions.map((e, i) => (
                <li key={e.pokemonSlug}>
                  <button
                    type="button"
                    onMouseDown={(ev) => { ev.preventDefault(); go(e.pokemonSlug); }}
                    onTouchEnd={(ev) => { ev.preventDefault(); go(e.pokemonSlug); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-indigo-50 active:bg-indigo-100"
                  >
                    {!query && (
                      <span className="w-6 shrink-0 text-right text-[10px] font-bold tabular-nums text-slate-400">
                        {i + 1}
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-800">
                      {e.pokemonJa}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
