import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** 読み取り専用クライアント (anon key, ブラウザ露出 OK) */
export const supabase = createClient(url, anonKey);

/**
 * 書き込み用クライアント (service_role key, サーバ専用)
 * RLS をバイパスできるので save-* エンドポイントから使う
 * 絶対にクライアントサイドで import しないこと
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // 未設定時は anon にフォールバック (開発中の緊急逃げ道)
    // 本番では必ず SUPABASE_SERVICE_ROLE_KEY を設定すること
    return supabase;
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
