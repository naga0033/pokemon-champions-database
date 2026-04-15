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

/** 1-3 位に王冠 (金/銀/銅) */
function crown(rank: number): string | null {
  if (rank === 1) return "👑";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
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
          {filtered.map((t) => {
            const mark = crown(t.rank);
            const rankColor =
              t.rank === 1 ? "text-amber-500"
              : t.rank === 2 ? "text-slate-500"
              : t.rank === 3 ? "text-orange-700"
              : "text-slate-400";
            return (
              <li
                key={`${t.rank}-${t.name}`}
                className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-5 sm:px-5 sm:py-3"
              >
                {/* 王冠 (1-3位のみ) */}
                <span className="flex w-5 shrink-0 items-center justify-center text-base leading-none sm:w-6 sm:text-xl">
                  {mark ?? ""}
                </span>
                {/* 順位番号 */}
                <span
                  className={`font-display w-7 shrink-0 text-right text-base font-black tabular-nums sm:w-8 sm:text-lg ${rankColor}`}
                >
                  {t.rank}
                </span>
                {/* 国旗 */}
                <span className="w-6 shrink-0 text-center text-lg sm:w-8 sm:text-xl">
                  {flag(t.country) || <span className="text-[10px] text-slate-300">---</span>}
                </span>
                {/* レート */}
                <span className="font-display w-[70px] shrink-0 text-right text-[13px] font-black text-slate-900 tabular-nums sm:w-24 sm:text-base">
                  {t.rating.toFixed(3)}
                </span>
                {/* レート と 名前 の区切り */}
                <span className="h-5 w-px shrink-0 bg-slate-200 sm:h-6" aria-hidden />
                {/* 名前 */}
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800 sm:text-sm">
                  {t.name}
                </span>
                {/* 国コード: モバイルでは国旗で代替するため非表示 */}
                {t.country && (
                  <span className="hidden shrink-0 text-[10px] font-bold tracking-wider text-slate-400 sm:inline">
                    {t.country}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
