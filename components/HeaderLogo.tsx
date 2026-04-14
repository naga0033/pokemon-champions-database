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
        className="h-10 w-auto object-contain transition group-hover:scale-[1.02]"
        priority
      />
      <span className="text-sm font-extrabold tracking-[0.04em] text-slate-900 md:text-base">
        ポケチャン
        <span className="ml-1 text-indigo-600">バトルデータベース</span>
      </span>
    </a>
  );
}
