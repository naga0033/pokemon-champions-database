"use client";
import Link from "next/link";

type View = "trainer" | "pokemon";

export function ViewTabs({ current }: { current: View }) {
  const tabs: Array<{ id: View; label: string }> = [
    { id: "trainer", label: "トレーナー" },
    { id: "pokemon", label: "ポケモン" },
  ];

  return (
    <nav
      className="grid grid-cols-2 gap-0 rounded-2xl bg-white/60 p-1 shadow-sm ring-1 ring-violet-100"
    >
      {tabs.map((t) => {
        const active = current === t.id;
        return (
          <Link
            key={t.id}
            href={`/?view=${t.id}`}
            prefetch
            className={
              active
                ? "flex items-center justify-center rounded-xl bg-gradient-to-b from-lime-300 to-lime-400 px-4 py-2.5 text-sm font-black text-slate-900 shadow-[inset_0_-3px_0_rgba(132,204,22,0.6),0_2px_6px_rgba(0,0,0,0.08)] ring-1 ring-lime-500/40 sm:px-6 sm:py-3 sm:text-base"
                : "flex items-center justify-center rounded-xl bg-gradient-to-b from-indigo-100 to-violet-100 px-4 py-2.5 text-sm font-black text-slate-500 transition hover:text-slate-800 sm:px-6 sm:py-3 sm:text-base"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
