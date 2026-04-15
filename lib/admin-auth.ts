import { NextResponse } from "next/server";

function readToken(req: Request): string | null {
  const headerToken = req.headers.get("x-admin-token");
  if (headerToken) return headerToken.trim();

  const auth = req.headers.get("authorization");
  if (!auth) return null;

  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

// Edge Runtime 対応の定数時間比較 (タイミング攻撃対策)
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
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
