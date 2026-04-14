"use client";
import Link from "next/link";
import type { Format } from "@/lib/types";

/** シングル/ダブル切替 (URL クエリベース) */
export function FormatSwitch({ current }: { current: Format }) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      {(["single", "double"] as const).map((f) => {
        const active = f === current;
        return (
          <Link
            key={f}
            href={`/?format=${f}`}
            className={
              active
                ? "rounded-full bg-indigo-600 px-5 py-1.5 text-xs font-bold text-white shadow"
                : "rounded-full px-5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"
            }
          >
            {f === "single" ? "シングル" : "ダブル"}
          </Link>
        );
      })}
    </div>
  );
}
