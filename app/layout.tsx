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

const SITE_URL = "https://pokechamdb.com";
const OG_IMAGE = `${SITE_URL}/og-image.png?v=2`;

export const metadata: Metadata = {
  title: "ポケモンバトルサポート",
  description:
    "ポケモンチャンピオンズの使用率ランキング・覚えるわざ・持ち物・特性・性格・努力値をまとめた非公式バトルサポートサイト。スマホでも見やすい。",
  icons: { icon: "/icon.png" },
  openGraph: {
    title: "ポケモンバトルサポート",
    description:
      "ポケモンチャンピオンズの使用率ランキング・覚えるわざ・持ち物・特性・性格・努力値をまとめた非公式バトルサポートサイト。スマホでも見やすい。",
    url: SITE_URL,
    siteName: "ポケモンバトルサポート",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "ポケモンバトルサポート" }],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ポケモンバトルサポート",
    description:
      "ポケモンチャンピオンズの使用率ランキング・覚えるわざ・持ち物・特性・性格・努力値をまとめた非公式バトルサポートサイト。",
    images: [OG_IMAGE],
  },
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

        <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-8">{children}</main>

        {/* フッター */}
        <footer className="mt-20 bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 px-5 py-10 text-center text-xs text-white">
          <div className="mx-auto max-w-4xl space-y-2">
            <p>ポケモンバトルサポートはポケモンチャンピオンズの非公式ファンツールです。</p>
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
