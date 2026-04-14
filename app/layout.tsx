import type { Metadata } from "next";
import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { Noto_Sans_JP, Orbitron } from "next/font/google";
import "./globals.css";

const bodyFont = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-body",
});

const displayFont = Orbitron({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "ポケチャンバトルデータベース",
  description:
    "ポケモンチャンピオンズの使用率ランキング・技・持ち物・特性・性格・努力値の採用率をまとめた非公式データベース。スマホでも見やすい。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen bg-slate-50 font-sans antialiased`}>
        {/* ヘッダー */}
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
            <a
              href="/"
              className="group flex items-center gap-3"
              onClick={(e) => {
                // フルリロードして検索欄・フォーマット選択・シーズン選択をすべて初期化
                e.preventDefault();
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
            <nav className="flex items-center gap-4 text-xs font-bold text-slate-600">
              <Link href="/" className="transition hover:text-indigo-600">ランキング</Link>
              <Link href="/about" className="transition hover:text-indigo-600">このサイトについて</Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>

        {/* フッター */}
        <footer className="mt-20 border-t border-slate-200 px-5 py-8 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-4xl space-y-2">
            <p>使用率データ: ゲーム内ランキング画面を画像解析で集計 (Claude Vision)</p>
            <p>このサイトはポケモンチャンピオンズの非公式ファンツールです。</p>
            <p>
              不具合報告・ご要望は{" "}
              <a
                href="https://x.com/poketool2"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 underline underline-offset-2 hover:text-sky-700"
              >
                X @poketool2
              </a>{" "}
              まで。
            </p>
            <p className="leading-relaxed">
              当サイトは任天堂、株式会社ポケモン及び関係各社とは一切関係ありません。<br />
              ポケットモンスター・ポケモン・Pokémonは任天堂・クリーチャーズ・ゲームフリークの登録商標です。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
