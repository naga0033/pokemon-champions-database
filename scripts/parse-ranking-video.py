#!/usr/bin/env python3
"""ランキング一覧動画からランク→ポケモン名マッピングを抽出してDBを更新する。

usage:
  python3 scripts/parse-ranking-video.py ~/Movies/シングルポケモンランキング.mp4 \
    --season M-1 --format single [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ランク番号のx範囲
RANK_X_MIN, RANK_X_MAX = 0.47, 0.57
# ポケモン名のx範囲
NAME_X_MIN, NAME_X_MAX = 0.62, 0.74
# y方向のマッチング許容誤差
Y_TOLERANCE = 0.03


def ocr_frame(img_path: Path) -> list[dict]:
    result = subprocess.run(
        ["swift", str(ROOT / "scripts" / "ocr_boxes.swift"), str(img_path)],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        return []
    try:
        return json.loads(result.stdout)
    except Exception:
        return []


def levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (ca != cb)))
        prev = curr
    return prev[-1]


def fuzzy_match(name: str, valid_names: list[str], threshold: int = 2) -> str | None:
    """DBの正式名称リストと照合して最近傍を返す。閾値を超えたらNone。"""
    # 非カタカナ文字（記号・スペース）を除去して再マッチ
    cleaned = re.sub(r"[^\u30A0-\u30FF\u3041-\u309F\u4E00-\u9FFF（）()ー]", "", name)
    best, best_dist = None, threshold + 1
    for vn in valid_names:
        d = levenshtein(cleaned, vn)
        if d < best_dist:
            best_dist = d
            best = vn
    return best if best_dist <= threshold else None


def extract_pairs(boxes: list[dict], valid_names: list[str]) -> list[tuple[int, str]]:
    """1フレームからランク番号とポケモン名のペアを抽出する。"""
    ranks = []
    names = []

    for b in boxes:
        x, y = b["x"], b["y"]
        text = b["text"].strip()

        if RANK_X_MIN < x < RANK_X_MAX and re.fullmatch(r"\d{1,3}", text):
            ranks.append((int(text), y))

        if NAME_X_MIN < x < NAME_X_MAX and len(text) >= 2:
            matched = fuzzy_match(text, valid_names)
            if matched:
                names.append((matched, y))

    pairs = []
    for rank, ry in ranks:
        candidates = [(name, abs(ny - ry)) for name, ny in names if abs(ny - ry) < Y_TOLERANCE]
        if candidates:
            best_name = min(candidates, key=lambda c: c[1])[0]
            pairs.append((rank, best_name))

    return pairs


def load_env() -> dict:
    env = {}
    env_path = ROOT / ".env.local"
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k] = v.strip('"').strip("'")
    return env


def fetch_current_rankings(env: dict, season_id: str, fmt: str) -> list[dict]:
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/rankings?select=id,rank,pokemon_ja,pokemon_slug&season_id=eq.{season_id}&format=eq.{fmt}&order=rank&limit=1000"
    req = urllib.request.Request(url, headers={
        "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


# ポケモン名の正規化マップ（OCRミス補正）
NAME_FIXES = {
    "ヒスイバクフーン": "ヒスイバクフーン",
    "ゾロアーク": "ゾロアーク",
}

# ヒスイ・地域フォームのslugマップ
JA_TO_SLUG: dict[str, str] = {
    "ヒスイジュナイパー": "decidueye-hisui",
    "ジュナイパー": "decidueye",
    "ヒスイダイケンキ": "samurott-hisui",
    "ダイケンキ": "samurott",
    "ヒスイバクフーン": "typhlosion-hisui",
    "バクフーン": "typhlosion",
    "ヒスイウインディ": "arcanine-hisui",
    "ウインディ": "arcanine",
    "ヒスイゾロアーク": "zoroark-hisui",
    "ゾロアーク(ヒスイ)": "zoroark-hisui",
    "ゾロアーク": "zoroark",
    "ヒスイクレベース": "avalugg-hisui",
    "クレベース": "avalugg",
    "ヒスイヌメルゴン": "goodra-hisui",
    "ヌメルゴン(ヒスイ)": "goodra-hisui",
    "ヌメルゴン": "goodra",
    "アローラライチュウ": "raichu-alola",
    "ライチュウ": "raichu",
    "アローラキュウコン": "ninetales-alola",
    "キュウコン": "ninetales",
    "ガラルヤドラン": "slowbro-galar",
    "ヤドラン": "slowbro",
    "ガラルマッギョ": "stunfisk-galar",
    "マッギョ": "stunfisk",
    "パルデアケンタロス(格闘)": "tauros-paldea-combat",
    "パルデアケンタロス(炎)": "tauros-paldea-blaze",
    "パルデアケンタロス(水)": "tauros-paldea-aqua",
    "ルガルガン(まよなか)": "lycanroc-midnight",
    "ルガルガン(まひる)": "lycanroc",
    "ルガルガン": "lycanroc",
    "イダイトウ(メス)": "basculegion-female",
    "ニャオニクス(メス)": "meowstic-female",
    "フラエッテ(えいえん)": "floette-eternal",
}


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("video", help="ランキング動画ファイルのパス")
    parser.add_argument("--season", default="M-1")
    parser.add_argument("--format", default="single", choices=["single", "double"])
    parser.add_argument("--fps", default="1")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    video_path = Path(args.video).expanduser().resolve()
    if not video_path.exists():
        print(f"エラー: ファイルが見つかりません: {video_path}", file=sys.stderr)
        return 1

    frames_dir = ROOT / "tmp" / "ranking-frames"
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True)

    print(f"[1/3] ffmpegでフレーム抽出中... ({args.fps}fps)")
    ffmpeg_cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(video_path),
        "-vf", f"fps={args.fps}",
        "-q:v", "2",
        str(frames_dir / "frame_%06d.jpg"),
    ]
    try:
        subprocess.run(ffmpeg_cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"エラー: ffmpeg失敗 ({e})", file=sys.stderr)
        return 1

    frames = sorted(frames_dir.glob("frame_*.jpg"))
    print(f"  抽出完了: {len(frames)}フレーム\n")

    print("[2/3] OCRでランキング解析中...")
    env = load_env()
    current = fetch_current_rankings(env, args.season, args.format)
    valid_names = [row["pokemon_ja"] for row in current]

    rank_map: dict[int, str] = {}  # rank -> pokemon_ja
    for i, frame in enumerate(frames):
        boxes = ocr_frame(frame)
        pairs = extract_pairs(boxes, valid_names)
        for rank, name in pairs:
            if rank not in rank_map:
                rank_map[rank] = name
        if (i + 1) % 10 == 0:
            print(f"  {i+1}/{len(frames)}フレーム処理済み... ({len(rank_map)}ランク取得)")

    # 同じポケモン名が複数ランクに現れた場合はOCRノイズとして除外
    from collections import Counter
    name_counts = Counter(rank_map.values())
    duplicates = {name for name, cnt in name_counts.items() if cnt > 1}
    if duplicates:
        print(f"\n  [警告] 重複検出（OCRノイズとして除外）: {', '.join(sorted(duplicates))}")
        rank_map = {r: n for r, n in rank_map.items() if n not in duplicates}

    print(f"\n  取得できたランク: {len(rank_map)}件")
    if rank_map:
        sorted_ranks = sorted(rank_map.items())
        for r, n in sorted_ranks[:10]:
            print(f"    {r}位: {n}")
        if len(sorted_ranks) > 10:
            print(f"    ... (計{len(sorted_ranks)}件)")

    print("\n[3/3] DBと照合して更新...")
    db_map = {row["rank"]: row for row in current}
    # 正式名→slugのマッピング
    name_to_slug = {row["pokemon_ja"]: row["pokemon_slug"] for row in current}

    updates = []
    for rank, ocr_name in rank_map.items():
        if rank not in db_map:
            print(f"  [SKIP] {rank}位: DBに存在しない")
            continue
        db_row = db_map[rank]
        db_name = db_row["pokemon_ja"]

        if ocr_name == db_name:
            continue  # 一致してる

        # 新しい名前のslugをDBから取得
        new_slug = name_to_slug.get(ocr_name) or JA_TO_SLUG.get(ocr_name) or db_row["pokemon_slug"]
        updates.append((db_row["id"], rank, db_name, ocr_name, new_slug))

    print(f"\n  変更が必要なランク: {len(updates)}件")
    for row_id, rank, old_name, new_name, new_slug in updates:
        print(f"  {rank}位: {old_name} → {new_name} (slug: {new_slug})")

    if args.dry_run:
        print("\n[DRY RUN] DB更新はスキップ")
    else:
        ok = 0
        for row_id, rank, old_name, new_name, new_slug in updates:
            if patch_ranking(env, row_id, new_name, new_slug):
                ok += 1
        print(f"\n  更新完了: {ok}/{len(updates)}件")

    shutil.rmtree(frames_dir, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
