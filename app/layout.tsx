import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { Noto_Sans_JP, Orbitron } from "next/font/google";
import { HeaderLogo } from "@/components/HeaderLogo";
import "./globals.css";

const GA_ID = "G-DWWZPKQ6FY";

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
  icons: { icon: "/icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen font-sans antialiased`}>
        {/* ヘッダー */}
        <header className="sticky top-0 z-40 border-b border-indigo-400/30 bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 text-white shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
            <HeaderLogo />
            <nav className="flex items-center gap-3 text-[11px] font-bold text-white/95 sm:gap-5 sm:text-sm">
              <Link href="/" className="transition hover:text-white">ランキング</Link>
              <Link href="/about" className="whitespace-nowrap transition hover:text-white">
                <span className="sm:hidden">サイトについて</span>
                <span className="hidden sm:inline">このサイトについて</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* サイト別バナー */}
        {process.env.NEXT_PUBLIC_IS_NEW_SITE === "true" ? (
          <div className="bg-emerald-500 px-3 py-2.5 text-center text-xs font-bold text-white sm:text-sm">
            <p>✅ <span className="underline underline-offset-2">このページが新しいURLです！</span></p>
            <p className="mt-0.5 font-normal">
              お手数ですが、{" "}
              <a
                href="https://pokechamdb.com"
                className="font-black underline underline-offset-2 hover:opacity-75"
              >
                pokechamdb.com
              </a>
              {" "}をブックマークへの登録をお願いします！🙏
            </p>
          </div>
        ) : (
          <div className="bg-red-500 px-3 py-2.5 text-center text-xs font-bold text-white sm:text-sm">
            <p>⚠️ <span className="underline underline-offset-2">いま見ているこのページは近日中に閉鎖されます</span></p>
            <p className="mt-0.5 font-normal">
              アクセス数が上限に達するため、近日中に見られなくなります。お手数ですが、新しいURL{" "}
              <a
                href="https://pokechamdb.com"
                className="font-black underline underline-offset-2 hover:opacity-75"
              >
                pokechamdb.com
              </a>
              {" "}へブックマークの更新をお願いします！🙏
            </p>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-8">{children}</main>

        {/* フッター */}
        <footer className="mt-20 bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 px-5 py-10 text-center text-xs text-white">
          <div className="mx-auto max-w-4xl space-y-2">
            <p>このサイトはポケモンチャンピオンズの非公式ファンツールです。</p>
            <p>
              不具合報告・ご要望は{" "}
              <a
                href="https://x.com/poketool2"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white/80"
              >
                X @poketool2
              </a>{" "}
              まで。
            </p>
            <p className="leading-relaxed text-white/85">
              当サイトは任天堂、株式会社ポケモン及び関係各社とは一切関係ありません。<br />
              ポケットモンスター・ポケモン・Pokémonは任天堂・クリーチャーズ・ゲームフリークの登録商標です。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
