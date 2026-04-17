#!/usr/bin/env python3
"""ダブルランキング30個の重複を修正するスクリプト。

OCR結果・ユーザー確認・ヒスイルールに基づいて誤ったランクを修正する。
usage:
  python3 scripts/fix-double-duplicates.py [--dry-run]
"""
from __future__ import annotations

import json
import sys
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRY_RUN = "--dry-run" in sys.argv


def load_env() -> dict:
    env = {}
    with open(ROOT / ".env.local") as f:
        for line in f:
            line = line.strip()
            if line and "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k] = v.strip('"').strip("'")
    return env


def fetch_rankings(env: dict, season_id: str = "M-1", fmt: str = "double") -> list[dict]:
    url = (
        f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/rankings"
        f"?select=id,rank,pokemon_ja,pokemon_slug"
        f"&season_id=eq.{season_id}&format=eq.{fmt}&order=rank&limit=1000"
    )
    req = urllib.request.Request(url, headers={
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def patch_ranking(env: dict, row_id: int, new_ja: str, new_slug: str) -> bool:
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/rankings?id=eq.{row_id}"
    data = json.dumps({"pokemon_ja": new_ja, "pokemon_slug": new_slug}).encode()
    req = urllib.request.Request(url, data=data, method="PATCH", headers={
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    })
    try:
        with urllib.request.urlopen(req) as r:
            return r.status < 300
    except Exception as e:
        print(f"  [ERROR] PATCH失敗: {e}")
        return False


# rank → (japanese_name, slug, 根拠)
# OCR: 動画OCR結果  ユーザー: ユーザー確認  ヒスイルール: 良い順位=ヒスイ/地域フォーム
FIXES: dict[int, tuple[str, str]] = {
    11:  ("デカヌチャン",         "tinkaton"),           # OCR誤読 → 欠損ポケモンに割当
    38:  ("ガルーラ",             "kangaskhan"),         # OCR=ガルーラ（欠損確認）
    40:  ("アローラキュウコン",   "ninetales-alola"),    # OCR=キュウコン → アローラ形（ヒスイルール）
    42:  ("ヒスイバクフーン",     "typhlosion-hisui"),   # ユーザー確認
    46:  ("ヒスイウインディ",     "arcanine-hisui"),     # OCR=ウインディ → ヒスイ形（ヒスイルール、良い順位）
    47:  ("ヒートロトム",         "rotom-heat"),         # ユーザー確認
    50:  ("ゾロアーク(ヒスイ)",   "zoroark-hisui"),      # OCR=ゾロアーク → ヒスイ形（良い順位）
    62:  ("ウォッシュロトム",     "rotom-wash"),         # OCR=ロトム → 最人気ウォッシュ形
    71:  ("パルデアケンタロス(格闘)", "tauros-paldea-combat"),  # OCR=ケンタロス → 格闘形
    75:  ("ウインディ",           "arcanine"),           # OCR誤読 → 通常ウインディ（悪い順位）
    91:  ("ガラルヤドキング",     "slowking-galar"),     # OCR=ヤドキング → ガラル形（欠損ポケモン）
    101: ("カイリキー",           "machamp"),            # OCR=カイリキー（欠損確認）
    106: ("ホルード",             "diggersby"),          # OCR誤読 → 欠損ポケモンに割当
    110: ("ライチュウ",           "raichu"),             # 欠損ポケモン
    112: ("スピンロトム",         "rotom-fan"),          # OCR=ロトム → スピン形
    120: ("ガラルヤドラン",       "slowbro-galar"),      # OCR=ヤドラン → ガラル形（ヒスイルール）
    135: ("チャーレム",           "medicham"),           # OCR=チャーレム（欠損確認）
    137: ("ヘラクロス",           "heracross"),          # OCR=ヘラクロス（欠損確認）
    142: ("パルデアケンタロス(水)", "tauros-paldea-aqua"),  # OCR=ケンタロス → 水形
    152: ("ナゲツケサル",         "passimian"),          # OCR=ナゲツケサル（欠損確認）
    153: ("ヌメルゴン",           "goodra"),             # OCR=ヌメルゴン（欠損確認）
    176: ("ゾロア",               "zorua"),              # OCR=ゾロアーク → 進化前ゾロア（backup由来）
    183: ("ヒスイジュナイパー",   "decidueye-hisui"),    # OCR誤読 → 欠損ポケモン
    184: ("クレベース",           "avalugg"),            # OCR=クレベース → 通常形（悪い順位）
    185: ("カットロトム",         "rotom-mow"),          # OCR=ロトム → カット形
    196: ("パルデアケンタロス(炎)", "tauros-paldea-blaze"),  # OCR=ケンタロス → 炎形
    203: ("ルガルガン",           "lycanroc-dusk"),      # OCR=ルガルガン → たそがれ形（欠損）
    204: ("ペロリーム",           "slurpuff"),           # OCR=ペロリーム（欠損確認）
    211: ("ルガルガン(まよなか)", "lycanroc-midnight"),  # OCR=ルガルガン → まよなか形
    213: ("パンプジン(ちいさいサイズ)", "gourgeist-small"),  # 重複解消（210=通常パンプジン）
}


def main() -> int:
    env = load_env()
    rankings = fetch_rankings(env)
    rank_map = {row["rank"]: row for row in rankings}

    # 現在の重複状況を表示
    name_counts = Counter(row["pokemon_ja"] for row in rankings)
    duplicates = {n: cnt for n, cnt in name_counts.items() if cnt > 1}
    print(f"現在のダブルランキング: {len(rankings)}件")
    print(f"重複: {len(duplicates)}件\n")
    for name in sorted(duplicates):
        ranks = sorted(r["rank"] for r in rankings if r["pokemon_ja"] == name)
        print(f"  {name}: {ranks}")

    print(f"\n{'=' * 60}")
    print(f"適用する修正: {len(FIXES)}件\n")

    # 修正後の重複チェック用
    new_state: dict[int, str] = {row["rank"]: row["pokemon_ja"] for row in rankings}
    for rank, (new_ja, _) in FIXES.items():
        new_state[rank] = new_ja

    new_name_counts = Counter(new_state.values())
    post_duplicates = {n: cnt for n, cnt in new_name_counts.items() if cnt > 1}

    ok = 0
    skip = 0
    for rank, (new_ja, new_slug) in sorted(FIXES.items()):
        if rank not in rank_map:
            print(f"  [SKIP] rank {rank}: DBに存在しない")
            skip += 1
            continue
        row = rank_map[rank]
        old_ja = row["pokemon_ja"]
        marker = " ⚠" if new_ja in post_duplicates else ""
        print(f"  {rank:3d}位: {old_ja} → {new_ja}{marker}")
        if not DRY_RUN:
            if patch_ranking(env, row["id"], new_ja, new_slug):
                ok += 1
            else:
                skip += 1

    if post_duplicates:
        print(f"\n⚠ 修正後も重複が残る: {list(post_duplicates.keys())}")
    else:
        print(f"\n✓ 修正後の重複なし")

    if DRY_RUN:
        print(f"\n[DRY RUN] DB更新はスキップ（{len(FIXES) - skip}件を適用予定）")
    else:
        print(f"\n更新完了: {ok}/{len(FIXES)}件")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
