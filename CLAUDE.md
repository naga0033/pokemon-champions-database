# ルール
- コメントは日本語で書くこと
- 実装完了後は必ず以下を確認してから完了報告すること
  1. `npm run build` でビルドエラーがないことを確認
  2. 開発サーバーを起動して Preview MCP で動作確認
  3. 主要な機能（ポケモン検索・使用率ランキング表示）が正常に動くことを確認
  4. エラーが出た場合は自分で修正してから完了報告する
- 作業開始前の git コミットは不要。指示された作業だけを実行すること

# プロジェクト概要
ポケモンチャンピオンズの使用率ランキング・技・持ち物・特性・性格・努力値の採用率をまとめた非公式データベース。
- 公開URL: https://pokechamdb.com
- ホスティング: Cloudflare Pages
- ドメイン: pokechamdb.com（Cloudflare DNS）

# スタック
- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- データベース: Supabase（専用プロジェクト）
  - URL: https://ilziiwrrfxhbvjhqiavh.supabase.co
  - 環境変数: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ADMIN_API_TOKEN
- ポケモン名マスターと日本語ファジーマッチは `../pokemon-damage-calc/lib/` から流用

# DBスキーマ
- `seasons` - シーズン情報
- `rankings` - ポケモン使用率ランキング（season_id, format, rank, pokemon_name など）
- `pokemon_details` - 技・持ち物・特性・性格・努力値の詳細（JSONB）
- `trainers` - トレーナー情報

# 管理機能
- `/admin` - 管理画面（ADMIN_API_TOKEN による認証）
- `/api/parse-ranking`, `/api/parse-detail` - データ解析API
- `/api/save-ranking`, `/api/save-detail`, `/api/save-trainers` - データ保存API
- `/api/admin/delete-detail` - データ削除API

# 環境変数（Cloudflare Pages に設定済み）
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase プロジェクト URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `ADMIN_API_TOKEN` - 管理API認証トークン（Secret）
- `NEXT_PUBLIC_IS_NEW_SITE` - "true" のとき緑バナー表示（旧サイトは "false" or 未設定）
