#!/usr/bin/env python3
"""
Vision OCR の bbox JSON から、固定レイアウトのトレーナーランキングを抽出。
usage: python3 parse-trainers-boxes.py <boxes_dir> <out.json>
"""
from __future__ import annotations

import json
import os
import re
import sys

RATING_RE = re.compile(r"^\d{4}[.,]\d{3}$")
RANK_RE = re.compile(r"^\d{1,4}$")
NOISE_EXACT = {
    "フレンド", "ポケモン", "ボケモン", "メニュー", "◎ メニュー", "• メニュー",
    "B 戻る", "戻る", "Y", "L", "なし", "詳しいルール", "ダブルバトル", "シングルバトル",
}
COUNTRY_LIKE = {
    "JPN", "KOR", "CHS", "CHT", "CHN", "ENG", "ES-ES", "ITA", "FRA", "DEU", "USA",
}


def is_noise(text: str) -> bool:
    if text in NOISE_EXACT:
        return True
    if text.startswith("シーズン"):
        return True
    if text.startswith("※ランキング"):
        return True
    if "2026/" in text or "09:00" in text or "10:59" in text:
        return True
    return False


def parse_frame(path: str) -> list[dict]:
    rows = json.load(open(path))
    rows = [r for r in rows if r["x"] > 0.50 and not is_noise(r["text"])]

    rating_boxes = sorted(
        [r for r in rows if RATING_RE.match(r["text"])],
        key=lambda r: -(r["y"] + r["h"] / 2),
    )
    if len(rating_boxes) < 4:
        return []

    parsed_rows = []
    for idx, rating_box in enumerate(rating_boxes[:5]):
        y = rating_box["y"] + rating_box["h"] / 2

        def near(candidates, x_min=None, x_max=None):
            found = []
            for r in candidates:
                cy = r["y"] + r["h"] / 2
                if abs(cy - y) > 0.07:
                    continue
                if x_min is not None and r["x"] < x_min:
                    continue
                if x_max is not None and r["x"] > x_max:
                    continue
                found.append(r)
            found.sort(key=lambda r: (abs((r["y"] + r["h"] / 2) - y), r["x"]))
            return found[0] if found else None

        rank_box = near([r for r in rows if RANK_RE.match(r["text"])], x_max=0.63)
        name_box = near(
            [
                r for r in rows
                if not RATING_RE.match(r["text"])
                and r["text"] not in COUNTRY_LIKE
            ],
            x_min=0.67,
        )
        country_box = near([r for r in rows if r["text"] in COUNTRY_LIKE], x_min=0.67)

        parsed_rows.append(
            {
                "slot": idx,
                "rank": int(rank_box["text"]) if rank_box else None,
                "rating": float(rating_box["text"].replace(",", ".")),
                "name": name_box["text"] if name_box else None,
                "country": country_box["text"] if country_box else None,
            }
        )

    observed = [r["rank"] for r in parsed_rows]
    best_start = None
    best_score = -1
    for start in range(1, 301):
        expected = [start + i for i in range(len(parsed_rows))]
        if expected[-1] > 300:
            break
        score = sum(1 for got, exp in zip(observed, expected) if got == exp)
        if score > best_score:
            best_score = score
            best_start = start

    if best_start is None:
        return []

    out = []
    for idx, row in enumerate(parsed_rows):
        out.append(
            {
                "rank": best_start + idx,
                "rating": row["rating"],
                "name": row["name"] or "",
                "country": row["country"],
            }
        )
    return out


def main():
    if len(sys.argv) != 3:
        print("usage: parse-trainers-boxes.py <boxes_dir> <out.json>", file=sys.stderr)
        sys.exit(1)

    boxes_dir, out_path = sys.argv[1], sys.argv[2]
    trainers_by_rank = {}

    for fname in sorted(os.listdir(boxes_dir)):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(boxes_dir, fname)
        for row in parse_frame(path):
            existing = trainers_by_rank.get(row["rank"])
            if not existing:
                trainers_by_rank[row["rank"]] = row
                continue
            # 名前がある方、country がある方を優先
            if (not existing.get("name") and row.get("name")) or (row.get("country") and not existing.get("country")):
                trainers_by_rank[row["rank"]] = row

    result = [trainers_by_rank[r] for r in sorted(trainers_by_rank) if 1 <= r <= 300]
    json.dump(result, open(out_path, "w"), ensure_ascii=False, indent=2)
    print(f"extracted {len(result)} trainers -> {out_path}")


if __name__ == "__main__":
    main()
