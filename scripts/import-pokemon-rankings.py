#!/usr/bin/env python3
"""
固定レイアウトのポケモンランキング画像を macOS Vision OCR で読み取り、
rankings と pokemon_details を Supabase へ直接反映する。

usage:
  python3 scripts/import-pokemon-rankings.py \
    --images-dir "$HOME/Downloads/ダブル1から最後" \
    --season M-1 \
    --format double
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR_SWIFT = ROOT / "scripts" / "ocr_boxes.swift"
POKEMON_NAMES_TS = ROOT / "lib" / "pokemon-names.ts"
ENV_FILE = Path("/tmp/vercel-env-prod")

RANK_RE = re.compile(r"^\d{1,3}$")
SLUG_JA_RE = re.compile(r'(?:"([^"]+)"|([a-z0-9-]+)):\s*"([^"]+)"')

NOISE_EXACT = {
    "トレーナー", "フレンド", "ポケモン", "ボケモン",
    "R", "L", "Y", "ZR", "F",
    "絞り込みOFF", "メニュー", "◎ メニュー", "→ メニュー", "• メニュー",
    "B", "B 戻る", "戻る",
}

OCR_NAME_FIXES = {
    "ドドグザン": "ドドゲザン",
    "ハツサム": "ハッサム",
    "フラエッテ": "フラエッテ",
    "プリムオン": "ブリムオン",
    "アレユータン": "ヤレユータン",
    "バクータ": "バクーダ",
    "プリガロン": "ブリガロン",
    "ソウプレイズ": "ソウブレイズ",
    "ミカルグ": "ミカルゲ",
    "エンプオー": "エンブオー",
    "バオツキー": "バオッキー",
    "ヒヤツキー": "ヒヤッキー",
    "イツカネズミ": "イッカネズミ",
}

JA_TO_SLUG_OVERRIDES = {
    "デスバーン": "runerigus",
}

RANK_SLUG_OVERRIDES = {
    9: ("ウォッシュロトム", "rotom-wash"),
    48: ("ヒートロトム", "rotom-heat"),
    64: ("イダイトウ", "basculegion-female"),
    65: ("フロストロトム", "rotom-frost"),
    72: ("ライチュウ", "raichu"),
    73: ("ニャオニクス", "meowstic"),
    87: ("ケンタロス", "tauros"),
    96: ("ヤドラン", "slowbro"),
    103: ("ルガルガン", "lycanroc"),
    108: ("ジュナイパー", "decidueye"),
    111: ("スピンロトム", "rotom-fan"),
    124: ("ガラルヤドラン", "slowbro-galar"),
    129: ("ルガルガン", "lycanroc-midnight"),
    147: ("アローラライチュウ", "raichu-alola"),
    154: ("ニャオニクス", "meowstic-female"),
    181: ("ジュナイパー(ヒスイ)", "decidueye-hisui"),
    186: ("カットロトム", "rotom-mow"),
    190: ("パンプジン", "gourgeist"),
    195: ("マッギョ", "stunfisk"),
    197: ("ケンタロス", "tauros-paldea-combat"),
    199: ("ロトム", "rotom"),
    202: ("ルガルガン", "lycanroc-dusk"),
    207: ("ガラルマッギョ", "stunfisk-galar"),
    208: ("パンプジン", "gourgeist-small"),
    210: ("パンプジン", "gourgeist-large"),
    213: ("パンプジン", "gourgeist-super"),
}


def to_half_width(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        if 0xFF01 <= code <= 0xFF5E:
            out.append(chr(code - 0xFEE0))
        else:
            out.append(ch)
    return "".join(out)


def katakana_to_hiragana(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return "".join(out)


def normalize_ja(text: str) -> str:
    text = katakana_to_hiragana(
        to_half_width(text)
        .strip()
        .replace("Ⅰ", "I")
        .replace("Ⅱ", "II")
        .replace("♀", "メス")
        .replace("♂", "オス")
    )
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[‐‑‒–—―ｰ]", "ー", text)
    text = re.sub(r"[()（）［］\[\]【】「」『』]", "", text)
    text = re.sub(r"[@＠]", "", text)
    text = re.sub(r"[・･:：,，.。!！?？\s]", "", text)
    text = text.replace("\\", "")
    return text


def levenshtein(a: str, b: str) -> int:
    rows = len(a) + 1
    cols = len(b) + 1
    dp = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        dp[i][0] = i
    for j in range(cols):
        dp[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[-1][-1]


def find_best_match(raw: str, candidates: list[str]) -> str | None:
    normalized_input = normalize_ja(raw)
    if not normalized_input:
        return None

    exact = [c for c in candidates if normalize_ja(c) == normalized_input]
    if exact:
        return exact[0]

    contains = [
        c for c in candidates
        if normalize_ja(c).find(normalized_input) >= 0 or normalized_input.find(normalize_ja(c)) >= 0
    ]
    if len(contains) == 1:
        return contains[0]

    best = None
    best_distance = 10**9
    max_distance = 2 if len(normalized_input) >= 6 else 1
    for candidate in candidates:
        dist = levenshtein(normalized_input, normalize_ja(candidate))
        if dist <= max_distance and dist < best_distance:
            best = candidate
            best_distance = dist
    return best


def load_slug_map() -> tuple[dict[str, str], dict[str, str]]:
    text = POKEMON_NAMES_TS.read_text()
    slug_to_ja: dict[str, str] = {}
    ja_to_slug: dict[str, str] = {}
    for quoted_slug, bare_slug, ja in SLUG_JA_RE.findall(text):
        slug = quoted_slug or bare_slug
        slug_to_ja[slug] = ja
        ja_to_slug.setdefault(ja, slug)
    return slug_to_ja, ja_to_slug


def build_ja_to_slugs(slug_to_ja: dict[str, str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for slug, ja in slug_to_ja.items():
        out.setdefault(ja, []).append(slug)
    return out


def get_variant_slugs(base_name: str, slug_to_ja: dict[str, str], ja_to_slug: dict[str, str], ja_to_slugs: dict[str, list[str]]) -> list[str]:
    exact = list(ja_to_slugs.get(base_name, []))
    base_norm = normalize_ja(base_name)
    related = [
        slug for slug, ja in slug_to_ja.items()
        if slug not in exact
        and base_norm
        and (
            normalize_ja(ja).find(base_norm) >= 0
            or base_norm.find(normalize_ja(ja)) >= 0
        )
    ]
    generic_slug = ja_to_slug.get(base_name)
    ordered: list[str] = []
    if generic_slug:
        ordered.append(generic_slug)
    for slug in exact + related:
        if slug not in ordered:
            ordered.append(slug)
    return ordered


def read_env() -> tuple[str, str]:
    text = ENV_FILE.read_text()
    url = text.split('NEXT_PUBLIC_SUPABASE_URL="', 1)[1].split('"', 1)[0].replace("\\n", "")
    key = text.split('SUPABASE_SERVICE_ROLE_KEY="', 1)[1].split('"', 1)[0].replace("\\n", "")
    return url, key


def supabase_request(base_url: str, key: str, method: str, path: str, body=None, headers=None):
    req_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    if headers:
        req_headers.update(headers)
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(base_url + path, data=data, method=method, headers=req_headers)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: {err.code} {raw}") from err


def is_noise(text: str) -> bool:
    text = text.strip()
    if not text:
        return True
    if text in NOISE_EXACT:
        return True
    if text.startswith("シーズン"):
        return True
    if "2026/" in text or "09:00" in text or "10:59" in text:
        return True
    return False


def clean_name(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^[>\-•◎\.,，、。・･．?？]+", "", text).strip()
    text = re.sub(r"^\d+\s*", "", text).strip()
    text = OCR_NAME_FIXES.get(text, text)
    return text


def infer_frame_start(observed_ranks: list[int], row_count: int, max_rank: int = 500) -> int | None:
    if not observed_ranks:
        return None
    best_start = None
    best_score = -1
    for start in range(1, max_rank - row_count + 2):
        score = 0
        for idx, observed in enumerate(observed_ranks[:row_count]):
            expected = start + idx
            if observed == expected:
                score += 3
            elif str(expected).endswith(str(observed)):
                score += 1
        if score > best_score:
            best_score = score
            best_start = start
    return best_start


def extract_rows_from_frame(rows: list[dict]) -> list[dict]:
    rows = [r for r in rows if r["x"] > 0.50 and not is_noise(r["text"])]
    rank_boxes = sorted(
        [r for r in rows if RANK_RE.match(r["text"]) and r["x"] < 0.63],
        key=lambda r: -(r["y"] + r["h"] / 2),
    )
    name_candidates = []
    for candidate in rows:
        if candidate["x"] < 0.63:
            continue
        if RANK_RE.match(candidate["text"]):
            continue
        cleaned = clean_name(candidate["text"])
        if len(normalize_ja(cleaned)) < 2:
            continue
        name_candidates.append({**candidate, "cleaned": cleaned})

    observed_ranks = [int(r["text"]) for r in rank_boxes[:5]]
    frame_start_rank = infer_frame_start(observed_ranks, min(len(rank_boxes), 5))
    if frame_start_rank is None:
        return []

    out: list[dict] = []
    used = set()
    for slot, rank_box in enumerate(rank_boxes[:5]):
        y = rank_box["y"] + rank_box["h"] / 2
        near_names = []
        for idx, candidate in enumerate(name_candidates):
            if idx in used:
                continue
            cy = candidate["y"] + candidate["h"] / 2
            if abs(cy - y) > 0.09:
                continue
            near_names.append((idx, candidate))
        near_names.sort(key=lambda item: (abs((item[1]["y"] + item[1]["h"] / 2) - y), item[1]["x"]))
        if not near_names:
            continue
        idx, chosen = near_names[0]
        used.add(idx)
        out.append(
            {
                "rank": frame_start_rank + slot,
                "raw_name": chosen["cleaned"],
            }
        )
    return out


def ocr_image(path: Path) -> list[dict]:
    output = subprocess.check_output(["swift", str(OCR_SWIFT), str(path)], cwd=str(ROOT))
    return json.loads(output)


def resolve_name(
    rank: int,
    raw_name: str,
    all_ja_names: list[str],
    existing_detail_by_rank: dict[int, dict],
) -> str:
    raw_norm = normalize_ja(raw_name)
    if raw_name in JA_TO_SLUG_OVERRIDES:
        return raw_name
    current = existing_detail_by_rank.get(rank)
    if current:
        current_name = clean_name(current["pokemon_ja"])
        current_norm = normalize_ja(current_name)
        if raw_norm and current_norm and (
            current_norm == raw_norm
            or current_norm.find(raw_norm) >= 0
            or raw_norm.find(current_norm) >= 0
        ):
            return current_name

    exact_or_fuzzy_all = find_best_match(raw_name, all_ja_names)
    if exact_or_fuzzy_all:
        return exact_or_fuzzy_all
    return raw_name


def assign_variant_slugs(
    parsed_rows: list[dict],
    slug_to_ja: dict[str, str],
    ja_to_slug: dict[str, str],
    ja_to_slugs: dict[str, list[str]],
    existing_detail_by_rank: dict[int, dict],
) -> None:
    by_slug: dict[str, list[dict]] = {}
    for row in parsed_rows:
        by_slug.setdefault(row["pokemon_slug"], []).append(row)

    for slug, rows in by_slug.items():
        if slug == "unknown" or len(rows) <= 1:
            continue

        used: set[str] = set()
        for row in rows:
            current = existing_detail_by_rank.get(row["rank"])
            if current and current.get("pokemon_slug"):
                row["pokemon_slug"] = current["pokemon_slug"]
                row["pokemon_ja"] = current["pokemon_ja"]
                used.add(row["pokemon_slug"])

        for row in rows:
            current = existing_detail_by_rank.get(row["rank"])
            if current and current.get("pokemon_slug"):
                continue
            variants = get_variant_slugs(row["raw_name"], slug_to_ja, ja_to_slug, ja_to_slugs)
            if row["pokemon_ja"] != row["raw_name"]:
                for candidate in get_variant_slugs(row["pokemon_ja"], slug_to_ja, ja_to_slug, ja_to_slugs):
                    if candidate not in variants:
                        variants.append(candidate)
            chosen = None
            for candidate in variants:
                if candidate not in used:
                    chosen = candidate
                    break
            if chosen is None:
                chosen = row["pokemon_slug"]
            row["pokemon_slug"] = chosen
            row["pokemon_ja"] = slug_to_ja.get(chosen, row["pokemon_ja"])
            used.add(chosen)


def apply_rank_slug_overrides(parsed_rows: list[dict]) -> None:
    for row in parsed_rows:
        override = RANK_SLUG_OVERRIDES.get(row["rank"])
        if not override:
            continue
        row["pokemon_ja"], row["pokemon_slug"] = override


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--images-dir", required=True)
    parser.add_argument("--season", required=True)
    parser.add_argument("--format", choices=["single", "double"], required=True)
    args = parser.parse_args()

    slug_to_ja, ja_to_slug = load_slug_map()
    ja_to_slugs = build_ja_to_slugs(slug_to_ja)
    base_url, key = read_env()

    images_dir = Path(os.path.expanduser(args.images_dir))
    files = sorted([p for p in images_dir.iterdir() if p.is_file()])
    if not files:
        raise SystemExit(f"no files: {images_dir}")

    existing_rankings = supabase_request(
        base_url,
        key,
        "GET",
        f"/rest/v1/rankings?season_id=eq.{urllib.parse.quote(args.season)}&format=eq.{args.format}&select=rank,pokemon_ja,pokemon_slug,tera_icons&order=rank.asc",
    ) or []
    existing_details = supabase_request(
        base_url,
        key,
        "GET",
        f"/rest/v1/pokemon_details?season_id=eq.{urllib.parse.quote(args.season)}&format=eq.{args.format}&select=*&order=rank.asc",
    ) or []

    existing_detail_by_rank = {row["rank"]: row for row in existing_details}
    all_ja_names = list(ja_to_slug.keys())

    parsed_by_rank: dict[int, dict] = {}
    for path in files:
        rows = ocr_image(path)
        for row in extract_rows_from_frame(rows):
            rank = row["rank"]
            resolved_name = resolve_name(rank, row["raw_name"], all_ja_names, existing_detail_by_rank)
            slug = JA_TO_SLUG_OVERRIDES.get(resolved_name) or ja_to_slug.get(resolved_name)
            if slug is None:
                # raw_name のまま残す
                slug = JA_TO_SLUG_OVERRIDES.get(row["raw_name"]) or ja_to_slug.get(row["raw_name"], "unknown")
            parsed_by_rank[rank] = {
                "rank": rank,
                "raw_name": row["raw_name"],
                "pokemon_ja": resolved_name,
                "pokemon_slug": slug,
            }

    parsed_rows = [parsed_by_rank[r] for r in sorted(parsed_by_rank)]
    if not parsed_rows:
        raise SystemExit("no ranking rows parsed")

    assign_variant_slugs(parsed_rows, slug_to_ja, ja_to_slug, ja_to_slugs, existing_detail_by_rank)
    apply_rank_slug_overrides(parsed_rows)

    existing_details_by_slug = {row["pokemon_slug"]: row for row in existing_details}

    ranking_rows = []
    detail_by_slug = {}
    unresolved = []
    for row in parsed_rows:
        slug = row["pokemon_slug"]
        ja_name = row["pokemon_ja"]
        if slug == "unknown":
            unresolved.append(row)
        ranking_rows.append(
            {
                "season_id": args.season,
                "format": args.format,
                "rank": row["rank"],
                "pokemon_ja": ja_name,
                "pokemon_slug": slug,
                "tera_icons": None,
            }
        )

        existing = existing_details_by_slug.get(slug)
        if existing:
            merged = {
                "season_id": existing["season_id"],
                "format": existing["format"],
                "rank": row["rank"],
                "pokemon_ja": ja_name,
                "pokemon_slug": existing["pokemon_slug"],
                "dex_no": existing.get("dex_no"),
                "moves": existing.get("moves"),
                "items": existing.get("items"),
                "abilities": existing.get("abilities"),
                "natures": existing.get("natures"),
                "evs": existing.get("evs"),
                "partners": existing.get("partners"),
            }
        else:
            merged = {
                "season_id": args.season,
                "format": args.format,
                "rank": row["rank"],
                "pokemon_ja": ja_name,
                "pokemon_slug": slug,
                "dex_no": None,
                "moves": None,
                "items": None,
                "abilities": None,
                "natures": None,
                "evs": None,
                "partners": None,
            }
        existing_detail = detail_by_slug.get(merged["pokemon_slug"])
        if existing_detail is None or merged["rank"] < existing_detail["rank"]:
            detail_by_slug[merged["pokemon_slug"]] = merged

    detail_rows = list(detail_by_slug.values())

    if unresolved:
        print("unresolved rows:", file=sys.stderr)
        for row in unresolved:
            print(f"  rank {row['rank']}: raw={row['raw_name']} -> slug=unknown", file=sys.stderr)

    # rankings は今回の画像を正として全置換
    supabase_request(
        base_url,
        key,
        "DELETE",
        f"/rest/v1/rankings?season_id=eq.{urllib.parse.quote(args.season)}&format=eq.{args.format}",
        headers={"Prefer": "return=minimal"},
    )
    supabase_request(
        base_url,
        key,
        "POST",
        "/rest/v1/rankings",
        ranking_rows,
        headers={"Prefer": "return=representation,resolution=merge-duplicates"},
    )
    supabase_request(
        base_url,
        key,
        "POST",
        "/rest/v1/pokemon_details?on_conflict=season_id,format,pokemon_slug",
        detail_rows,
        headers={"Prefer": "return=representation,resolution=merge-duplicates"},
    )

    print(f"parsed {len(parsed_rows)} rows from {len(files)} images")
    print(f"updated rankings: {len(ranking_rows)}")
    print(f"upserted pokemon_details: {len(detail_rows)}")
    if parsed_rows:
        print(f"rank range: {parsed_rows[0]['rank']}..{parsed_rows[-1]['rank']}")
        print("sample:")
        for row in parsed_rows[:10]:
            print(f"  {row['rank']:>3} {row['pokemon_ja']} ({row['pokemon_slug']})")


if __name__ == "__main__":
    main()
