"use client";
import { useMemo, useState } from "react";
import type { Trainer } from "@/lib/types";

/** ひらがな/カタカナ/大文字小文字のゆらぎを吸収 */
function normalize(s: string): string {
  return s
    .replace(/[ァ-ン]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .toLowerCase()
    .trim();
}

/** 国旗アイコン (emoji) — 無い場合は国コード表記 */
function flag(country?: string): string {
  if (!country) return "";
  const m: Record<string, string> = {
    JPN: "🇯🇵", KOR: "🇰🇷", CHT: "🇹🇼", CHN: "🇨🇳",
    USA: "🇺🇸", GBR: "🇬🇧", FRA: "🇫🇷", DEU: "🇩🇪",
    ITA: "🇮🇹", ESP: "🇪🇸", CAN: "🇨🇦", AUS: "🇦🇺",
    MEX: "🇲🇽", BRA: "🇧🇷", HKG: "🇭🇰", SGP: "🇸🇬",
  };
  return m[country.toUpperCase()] ?? "";
}

export function SearchableTrainerList({ trainers }: { trainers: Trainer[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return trainers;
    return trainers.filter((t) => normalize(t.name).includes(q));
  }, [trainers, query]);

  if (trainers.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* 検索 */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={(e) => { if (e.currentTarget.value) e.currentTarget.select(); }}
          placeholder="トレーナー名で検索 (日本語・English・한국어 等)"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        {query && (
          <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700">
            クリア
          </button>
        )}
      </div>

      {/* リスト */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          「{query}」に一致するトレーナーが見つかりません
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-violet-100 bg-white/85 shadow-sm">
          {filtered.map((t) => (
            <li key={`${t.rank}-${t.name}`} className="flex items-center gap-3 px-4 py-2.5">
              <span className="font-display w-10 shrink-0 text-right text-base font-black text-slate-400 tabular-nums">
                {t.rank}
              </span>
              <span className="font-display w-24 shrink-0 text-right font-black text-slate-900 tabular-nums">
                {t.rating.toFixed(3)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                {t.name}
              </span>
              {t.country && (
                <span className="shrink-0 text-xs font-bold text-slate-400">
                  <span className="mr-1">{flag(t.country)}</span>
                  {t.country}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
