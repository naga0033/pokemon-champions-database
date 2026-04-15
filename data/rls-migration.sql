-- ============================================================
-- RLS (Row Level Security) 設定: 読み取りは anon で許可、書き込みは service_role のみ
-- ============================================================
-- これを実行すると:
--  * anon key (ブラウザに露出する公開鍵) では SELECT だけ可能
--  * INSERT / UPDATE / DELETE は service_role (サーバ専用鍵) のみ
--  * うちの save-* API は service_role を使うのでそのまま動く
--  * 一般ユーザが直接 Supabase を叩いても書き込めなくなる
-- ============================================================

-- 1. RLS を有効化
alter table seasons         enable row level security;
alter table rankings        enable row level security;
alter table pokemon_details enable row level security;

-- 2. anon / authenticated 向けの SELECT ポリシー (サイト閲覧用)
--    既存ポリシーがあれば一旦落として作り直す
drop policy if exists "Public read seasons"         on seasons;
drop policy if exists "Public read rankings"        on rankings;
drop policy if exists "Public read pokemon_details" on pokemon_details;

create policy "Public read seasons"
  on seasons for select
  to anon, authenticated
  using (true);

create policy "Public read rankings"
  on rankings for select
  to anon, authenticated
  using (true);

create policy "Public read pokemon_details"
  on pokemon_details for select
  to anon, authenticated
  using (true);

-- 3. INSERT / UPDATE / DELETE ポリシーは作らない
--    = anon / authenticated は書き込み不可
--    service_role は RLS をバイパスするので引き続き書き込み可能
