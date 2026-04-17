#!/usr/bin/env python3
"""
ポケモンチャンピオンズで覚えるわざ を全ポケモン分生成するスクリプト。

- move-names.ts から MOVE_NAMES_JA (英語slug→日本語名) を読み込む
- pokemon-names.ts から EN_TO_JA (slug→日本語名) を読み込む
- Supabase から全ポケモンslugを取得
- PokeAPI で各ポケモンの覚えられる技一覧を取得
- MOVE_NAMES_JA に存在する技 = ポケモンチャンピオンズで使える技のみ残す
- champions-learnsets.ts の LEARNSETS ブロックに追記するコードを生成
"""

import re
import json
import time
import urllib.request
from pathlib import Path

# === ファイルパス ===
ROOT = Path(__file__).parent.parent
MOVE_NAMES_TS = ROOT / "lib" / "move-names.ts"
POKEMON_NAMES_TS = ROOT / "lib" / "pokemon-names.ts"
LEARNSETS_TS = ROOT / "lib" / "champions-learnsets.ts"
ENV_FILE = ROOT / ".env.local"

# === .env.local 読み込み ===
env = {}
for line in ENV_FILE.read_text().splitlines():
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_ANON_KEY = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

# === move-names.ts から MOVE_NAMES_JA をパース ===
def parse_move_names(ts_path: Path) -> dict[str, str]:
    """英語slug → 日本語名 マッピングをパース"""
    text = ts_path.read_text()
    # "slug": "日本語名" パターンを全て抽出
    pattern = re.compile(r'"([a-z0-9\-]+)":\s*"([^"]+)"')
    result = {}
    for m in pattern.finditer(text):
        slug, ja = m.group(1), m.group(2)
        result[slug] = ja
    return result

# === pokemon-names.ts から EN_TO_JA をパース ===
def parse_pokemon_names(ts_path: Path) -> dict[str, str]:
    """英語slug → 日本語名 マッピングをパース"""
    text = ts_path.read_text()
    pattern = re.compile(r'"?([a-z0-9\-]+)"?\s*:\s*"([^"]+)"')
    result = {}
    for m in pattern.finditer(text):
        slug, ja = m.group(1), m.group(2)
        result[slug] = ja
    return result

# === Supabase から全ポケモンslugを取得 ===
def fetch_all_slugs() -> list[str]:
    url = f"{SUPABASE_URL}/rest/v1/rankings?select=pokemon_slug&order=pokemon_slug"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    slugs = sorted(set(row["pokemon_slug"] for row in data))
    return slugs

# === PokeAPI から覚えられる技一覧を取得 ===
def fetch_moves_from_pokeapi(slug: str) -> list[str]:
    """PokeAPI のslugを使って技スラッグ一覧を返す"""
    url = f"https://pokeapi.co/api/v2/pokemon/{slug}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pokemon-champions-stats/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        return [m["move"]["name"] for m in data.get("moves", [])]
    except Exception as e:
        print(f"  [WARN] PokeAPI fetch failed for {slug}: {e}")
        return []

# === 既存のlearnset slugを取得 ===
def get_existing_slugs(ts_path: Path) -> set[str]:
    text = ts_path.read_text()
    pattern = re.compile(r'pokemonSlug:\s*"([^"]+)"')
    return set(m.group(1) for m in pattern.finditer(text))

# === TypeScript エントリを生成 ===
def make_ts_entry(slug: str, ja_name: str, moves: list[str]) -> str:
    if not moves:
        return ""
    moves_str = ",".join(f'"{m}"' for m in moves)
    return f'  "{slug}": {{\n    pokemonSlug: "{slug}",\n    pokemonJa: "{ja_name}",\n    moves: [{moves_str}],\n  }},'

# ============================================================
# メイン処理
# ============================================================
print("=== move-names.ts をパース ===")
move_names = parse_move_names(MOVE_NAMES_TS)
print(f"  {len(move_names)} 件の技マッピングを読み込み")

print("=== pokemon-names.ts をパース ===")
pokemon_names = parse_pokemon_names(POKEMON_NAMES_TS)
print(f"  {len(pokemon_names)} 件のポケモン名マッピングを読み込み")

print("=== Supabase から全ポケモンslug取得 ===")
all_slugs = fetch_all_slugs()
print(f"  {len(all_slugs)} 件のポケモンslug")

print("=== 既存のlearnset確認 ===")
existing = get_existing_slugs(LEARNSETS_TS)
print(f"  既存: {len(existing)} 件")

missing = [s for s in all_slugs if s not in existing]
print(f"  未生成: {len(missing)} 件")
print(f"  対象: {missing}\n")

# === 各ポケモンの技を取得して生成 ===
generated_entries = []
failed = []

for i, slug in enumerate(missing):
    ja_name = pokemon_names.get(slug, "")
    if not ja_name:
        # slug から推測（フォームなど）
        base_slug = slug.split("-")[0]
        ja_name = pokemon_names.get(base_slug, slug)

    print(f"[{i+1}/{len(missing)}] {slug} ({ja_name}) ... ", end="", flush=True)

    api_moves = fetch_moves_from_pokeapi(slug)
    if not api_moves:
        print("SKIP (API失敗)")
        failed.append(slug)
        continue

    # ポケモンチャンピオンズで使える技のみ残す (MOVE_NAMES_JA に存在するもの)
    champ_moves = []
    for move_slug in api_moves:
        if move_slug in move_names:
            ja_move = move_names[move_slug]
            if ja_move not in champ_moves:
                champ_moves.append(ja_move)

    print(f"{len(api_moves)}技 → {len(champ_moves)}技 (チャンピオンズ対応)")

    if champ_moves:
        entry = make_ts_entry(slug, ja_name, champ_moves)
        generated_entries.append(entry)
    else:
        print(f"  [WARN] {slug}: 技が0件のためスキップ")
        failed.append(slug)

    # PokeAPI レートリミット回避 (0.5秒待機)
    time.sleep(0.5)

# === 結果出力 ===
print(f"\n=== 生成完了 ===")
print(f"  成功: {len(generated_entries)} 件")
print(f"  失敗: {len(failed)} 件 {failed}")

output_path = ROOT / "scripts" / "generated-learnsets.ts"
output_path.write_text("\n".join(generated_entries) + "\n")
print(f"\n生成コードを保存: {output_path}")
print("\n次のステップ: generated-learnsets.ts の内容を champions-learnsets.ts の LEARNSETS に追記してください")
