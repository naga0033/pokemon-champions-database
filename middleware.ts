import { NextRequest, NextResponse } from "next/server";

// 明らかなスクレイパー・自動化ツールのUser-Agent
const BOT_UA_PATTERN =
  /python-requests|python\/|scrapy|wget|curl\/|httpx|aiohttp|go-http-client|java\/|libwww|lwp-|okhttp|axios\/[0-9]|node-fetch|undici|ruby|perl|php\/|bot|crawler|spider|scraper|archiver|fetch\/[0-9]/i;

// SEO系クローラーは通す（Googlebot等）
const ALLOW_UA_PATTERN =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator/i;

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";

  // SEO・SNS系は明示的に許可
  if (ALLOW_UA_PATTERN.test(ua)) return NextResponse.next();

  // 明らかなスクレイパーは 403 を返す
  if (BOT_UA_PATTERN.test(ua)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // User-Agentが空のリクエストも拒否（ブラウザは必ず送る）
  if (!ua) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  // 静的ファイル・APIルートは除外
  matcher: ["/((?!_next/static|_next/image|favicon|icon|og-image|move-category|public).*)"],
};
