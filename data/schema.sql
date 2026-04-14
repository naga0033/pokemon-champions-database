-- ポケモンチャンピオンズ 使用率統計 DB スキーマ
-- Supabase で実行

-- シーズン
create table if not exists seasons (
  id         text primary key,      -- "M-1"
  label      text not null,         -- "シーズンM-1"
  start_date date not null,
  end_date   date not null,
  format     text not null check (format in ('single','double')),
  created_at timestamptz default now()
);

-- 全体ランキング (season × format × rank でユニーク)
create table if not exists rankings (
  id          bigserial primary key,
  season_id   text not null references seasons(id) on delete cascade,
  format      text not null check (format in ('single','double')),
  rank        int  not null,
  pokemon_ja  text not null,
  pokemon_slug text not null,
  tera_icons  jsonb,                -- ["fire","ground"] など
  updated_at  timestamptz default now(),
  unique (season_id, format, rank)
);

-- ポケモン別 詳細 (技・持ち物・特性・性格・テラス・組み合わせ ...)
-- 各パネルは UsageEntry[] を jsonb で持つ
create table if not exists pokemon_details (
  id          bigserial primary key,
  season_id   text not null references seasons(id) on delete cascade,
  format      text not null check (format in ('single','double')),
  rank        int  not null,
  pokemon_ja  text not null,
  pokemon_slug text not null,
  dex_no      int,

  moves       jsonb,  -- [{rank,name,percentage}]
  items       jsonb,  -- [{rank,name,percentage}]
  abilities   jsonb,  -- [{rank,name,percentage}]
  natures     jsonb,  -- [{rank,name,percentage}]
  evs         jsonb,  -- [{rank,percentage,hp,atk,def,spAtk,spDef,speed}]
  partners    jsonb,  -- [{rank,name,percentage}]

  updated_at  timestamptz default now(),
  unique (season_id, format, pokemon_slug)
);

-- 検索用インデックス
create index if not exists idx_rankings_season_format_rank
  on rankings (season_id, format, rank);
create index if not exists idx_pokemon_details_season_format_slug
  on pokemon_details (season_id, format, pokemon_slug);
