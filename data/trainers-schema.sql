-- トレーナーランキング用テーブル
create table if not exists trainers (
  id          bigserial primary key,
  season_id   text not null references seasons(id) on delete cascade,
  format      text not null check (format in ('single','double')),
  rank        int  not null,
  name        text not null,
  rating      numeric not null,
  country     text,          -- JPN / KOR / CHT / USA 等
  updated_at  timestamptz default now(),
  unique (season_id, format, rank)
);

create index if not exists idx_trainers_season_format_rank
  on trainers (season_id, format, rank);

-- RLS 設定 (他テーブルと同じ)
alter table trainers enable row level security;

drop policy if exists "Public read trainers" on trainers;
create policy "Public read trainers"
  on trainers for select to anon, authenticated using (true);
