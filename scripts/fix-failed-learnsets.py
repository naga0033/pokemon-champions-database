#!/usr/bin/env python3
"""
PokeAPI 404エラーになったポケモンの代替slugでリトライ
"""

import re
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
MOVE_NAMES_TS = ROOT / "lib" / "move-names.ts"
OUTPUT = ROOT / "scripts" / "generated-learnsets.ts"

# 代替APIスラッグマッピング (DBのslug → PokeAPIスラッグ)
ALT_SLUGS = {
    "aegislash": "aegislash-shield",
    "basculegion": "basculegion-male",
    "gourgeist": "gourgeist-average",
    "jellicent": "jellicent",   # 再試行
    "lycanroc": "lycanroc-midday",
    "maushold": "maushold-family-of-four",
    "meowstic": "meowstic-male",
    "mimikyu": "mimikyu-disguised",
    "morpeko": "morpeko-full-belly",
    "palafin": "palafin-zero",
    "tauros-paldea-aqua": "tauros-paldea-aqua-breed",
    "tauros-paldea-blaze": "tauros-paldea-blaze-breed",
    "tauros-paldea-combat": "tauros-paldea-combat-breed",
}

# 日本語名の手動マッピング (pokemon-names.ts に誤りがあるもの含む)
JA_NAMES = {
    "aegislash": "ギルガルド",
    "basculegion": "イダイトウ",
    "gourgeist": "パンプジン",
    "jellicent": "ブルンゲル",
    "lycanroc": "ルガルガン(まひる)",
    "maushold": "イッカネズミ",
    "meowstic": "ニャオニクス(オス)",
    "mimikyu": "ミミッキュ",
    "morpeko": "モルペコ",
    "palafin": "イルカマン(ヒーロー)",
    "tauros-paldea-aqua": "パルデアケンタロス(水)",
    "tauros-paldea-blaze": "パルデアケンタロス(炎)",
    "tauros-paldea-combat": "パルデアケンタロス(格闘)",
}

def parse_move_names(ts_path: Path) -> dict[str, str]:
    text = ts_path.read_text()
    pattern = re.compile(r'"([a-z0-9\-]+)":\s*"([^"]+)"')
    result = {}
    for m in pattern.finditer(text):
        result[m.group(1)] = m.group(2)
    return result

def fetch_moves_from_pokeapi(api_slug: str) -> list[str]:
    url = f"https://pokeapi.co/api/v2/pokemon/{api_slug}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "pokemon-champions-stats/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        return [m["move"]["name"] for m in data.get("moves", [])]
    except Exception as e:
        print(f"  [WARN] PokeAPI fetch failed for {api_slug}: {e}")
        return []

def make_ts_entry(slug: str, ja_name: str, moves: list[str]) -> str:
    moves_str = ",".join(f'"{m}"' for m in moves)
    return f'  "{slug}": {{\n    pokemonSlug: "{slug}",\n    pokemonJa: "{ja_name}",\n    moves: [{moves_str}],\n  }},'

move_names = parse_move_names(MOVE_NAMES_TS)
print(f"技マッピング: {len(move_names)} 件")

new_entries = []
for db_slug, api_slug in ALT_SLUGS.items():
    ja_name = JA_NAMES[db_slug]
    print(f"{db_slug} (→ API:{api_slug}) ... ", end="", flush=True)

    api_moves = fetch_moves_from_pokeapi(api_slug)
    if not api_moves:
        print("SKIP")
        continue

    champ_moves = []
    for move_slug in api_moves:
        if move_slug in move_names:
            ja_move = move_names[move_slug]
            if ja_move not in champ_moves:
                champ_moves.append(ja_move)

    print(f"{len(api_moves)}技 → {len(champ_moves)}技")

    if champ_moves:
        new_entries.append(make_ts_entry(db_slug, ja_name, champ_moves))

    time.sleep(0.5)

# 既存ファイルに追記
existing = OUTPUT.read_text()
OUTPUT.write_text(existing.rstrip() + "\n" + "\n".join(new_entries) + "\n")
print(f"\n{len(new_entries)} 件を {OUTPUT} に追記完了")
