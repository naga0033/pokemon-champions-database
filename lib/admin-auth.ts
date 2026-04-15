import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function readToken(req: Request): string | null {
  const headerToken = req.headers.get("x-admin-token");
  if (headerToken) return headerToken.trim();

  const auth = req.headers.get("authorization");
  if (!auth) return null;

  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function requireAdminToken(req: Request): NextResponse | null {
  const expected = process.env.ADMIN_API_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_API_TOKEN 未設定" },
      { status: 503 },
    );
  }

  const actual = readToken(req);
  if (!actual || !safeEqual(actual, expected)) {
    return NextResponse.json(
      { error: "管理者トークンが必要です" },
      { status: 401 },
    );
  }

  return null;
}
