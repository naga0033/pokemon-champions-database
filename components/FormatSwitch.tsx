"use client";
import Link from "next/link";
import type { Format } from "@/lib/types";

/** シングル/ダブル切替 (URL クエリベース) */
export function FormatSwitch({ current }: { current: Format }) {
  return (
    <div className="inline-flex rounded-2xl bg-white/60 p-1 shadow-sm ring-1 ring-violet-100">
      {(["single", "double"] as const).map((f) => {
        const active = f === current;
        return (
          <Link
            key={f}
            href={`/?format=${f}`}
            prefetch
            className={
              active
                ? "rounded-xl bg-gradient-to-b from-lime-300 to-lime-400 px-6 py-2 text-sm font-black text-slate-900 shadow-[inset_0_-3px_0_rgba(132,204,22,0.6),0_2px_6px_rgba(0,0,0,0.08)] ring-1 ring-lime-500/40"
                : "rounded-xl bg-gradient-to-b from-indigo-100 to-violet-100 px-6 py-2 text-sm font-black text-slate-500 transition hover:text-slate-800"
            }
          >
            {f === "single" ? "シングル" : "ダブル"}
          </Link>
        );
      })}
    </div>
  );
}
