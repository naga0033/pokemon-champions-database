"use client";
import Link from "next/link";
import type { Format } from "@/lib/types";

/** シングル/ダブル切替 (URL クエリベース) */
export function FormatSwitch({ current }: { current: Format }) {
  return (
    <div className="inline-flex rounded-full border-2 border-indigo-200 bg-white p-1 shadow-sm">
      {(["single", "double"] as const).map((f) => {
        const active = f === current;
        return (
          <Link
            key={f}
            href={`/?format=${f}`}
            prefetch
            className={
              active
                ? "rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2 text-sm font-black text-white shadow-md"
                : "rounded-full px-6 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }
          >
            {f === "single" ? "シングル" : "ダブル"}
          </Link>
        );
      })}
    </div>
  );
}
