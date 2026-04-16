"use client";
// ポケモン詳細のプロフィールヘッダー（メガシンカ切り替えに対応したクライアントコンポーネント）
import { useState } from "react";
import { StatsToggle } from "./StatsToggle";
import { TypeBadge } from "./TypeBadge";
import type { BaseStats } from "@/lib/pokeapi-stats";
import type { MegaForm } from "@/lib/mega-data";
import type { TeraIcon } from "@/lib/types";

type Props = {
  pokemonJa: string;
  dexNo?: number | null;
  rank: number;
  artworkUrl: string;
  baseStats: BaseStats;
  types: string[];
  megaForms: MegaForm[];
  seasonLabel: string;
  format: "single" | "double";
  updatedAt: string;
};

export function PokemonProfileSection({
  pokemonJa,
  dexNo,
  rank,
  artworkUrl,
  baseStats,
  types,
  megaForms,
  seasonLabel,
  format,
  updatedAt,
}: Props) {
  const [selectedMega, setSelectedMega] = useState<MegaForm | null>(null);

  // メガシンカ中はメガのデータ、通常時はベースのデータを使う
  const displayStats = selectedMega?.baseStats ?? baseStats;
  const displayTypes = selectedMega?.types ?? types;
  const displayImage = selectedMega?.spriteUrl ?? artworkUrl;
  const displayName = selectedMega?.jaName ?? pokemonJa;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
      {/* 左側: ランクバッジ + 画像 + 名前 + タイプ + 更新情報 + メガボタン */}
      <div className="flex flex-col gap-1.5 sm:gap-0">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* ランクバッジ */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 font-display text-lg font-black text-white shadow sm:h-14 sm:w-14 sm:text-2xl">
            {rank}
          </div>

          {/* ポケモン画像 (メガ時はスプライトに切り替わる) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt={displayName}
            className="h-20 w-20 object-contain transition-all duration-300 sm:h-28 sm:w-28"
          />

          {/* 名前・タイプ・更新情報 */}
          <div className="min-w-0 flex-1">
            {dexNo && (
              <p className="text-[10px] font-bold tracking-widest text-slate-400 sm:text-[11px]">
                No.{dexNo}
              </p>
            )}
            <h1 className="font-display text-xl font-black text-slate-900 sm:text-2xl md:text-3xl">
              {displayName}
            </h1>
            {/* タイプバッジ (メガ時はメガのタイプに更新) */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {displayTypes.map((t) => (
                <TypeBadge key={t} type={t as TeraIcon} />
              ))}
            </div>
            {/* デスクトップ: 更新情報 */}
            <p className="mt-1.5 hidden text-[10px] leading-tight text-slate-500 sm:block sm:mt-2 sm:text-[11px]">
              {seasonLabel} · {format === "single" ? "シングル" : "ダブル"} · 更新 {updatedAt.slice(0, 10)}
            </p>
          </div>
        </div>

        {/* モバイル: 更新情報 */}
        <p className="text-[10px] leading-tight text-slate-500 sm:hidden">
          {seasonLabel} · {format === "single" ? "シングル" : "ダブル"} · 更新 {updatedAt.slice(0, 10)}
        </p>

        {/* メガシンカボタン (メガフォームが存在するポケモンのみ表示) */}
        {megaForms.length > 0 && (
          <div className="mt-3 flex flex-wrap items-start gap-2">
            {/* 通常フォームボタン */}
            <button
              type="button"
              onClick={() => setSelectedMega(null)}
              title={pokemonJa}
              className={`flex flex-col items-center gap-0.5 rounded-xl border p-1.5 text-[9px] font-bold transition-all ${
                selectedMega === null
                  ? "border-indigo-400 bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-md"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artworkUrl}
                alt={pokemonJa}
                className="h-10 w-10 object-contain"
              />
              <span className="leading-none">通常</span>
            </button>

            {/* メガシンカフォームボタン */}
            {megaForms.map((mega) => (
              <button
                key={mega.slug}
                type="button"
                onClick={() =>
                  setSelectedMega(selectedMega?.slug === mega.slug ? null : mega)
                }
                title={mega.jaName}
                className={`flex flex-col items-center gap-0.5 rounded-xl border p-1.5 text-[9px] font-bold transition-all ${
                  selectedMega?.slug === mega.slug
                    ? "border-indigo-400 bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-md"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mega.spriteUrl}
                  alt={mega.jaName}
                  className="h-10 w-10 object-contain"
                />
                <span className="max-w-[44px] text-center leading-tight">
                  {mega.jaName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 右側: 種族値 / 実数値 (メガ時はメガのステータスで更新) */}
      <div className="flex-1 md:border-l md:border-slate-100 md:pl-6">
        <StatsToggle stats={displayStats} />
      </div>
    </div>
  );
}
