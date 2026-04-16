"use client";
import Image from "next/image";

/** ヘッダー左のロゴ + サイト名。クリックで完全リセット (フルリロード) */
export function HeaderLogo() {
  return (
    <a
      href="/"
      className="group flex items-center gap-3"
      onClick={(e) => {
        e.preventDefault();
        // 検索文字・フォーマット・シーズン選択を全部初期化するためフルリロード
        window.location.href = "/";
      }}
    >
      <Image
        src="/pokemon-champions-logo.webp"
        alt="Pokemon Champions"
        width={308}
        height={160}
        className="h-8 w-auto object-contain transition group-hover:scale-[1.02] sm:h-10"
        priority
      />
      <span className="text-[11px] font-extrabold tracking-tight leading-tight text-white sm:text-sm sm:tracking-[0.04em] md:text-base">
        ポケチャン
        <span className="ml-1 hidden sm:inline">バトルデータラボ</span>
        <span className="ml-1 inline sm:hidden">データラボ</span>
      </span>
    </a>
  );
}
