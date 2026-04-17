#!/usr/bin/env python3
"""
macOS Vision OCR でダブルのポケモン詳細画像を読み取り、pokemon_details を更新する。

- 画像上部の「順位 / No.xxx / ポケモン名」から対象ポケモンを特定
- 中央パネルだけを読む
- 左右の見切れパネルに出ている数値は無視
- 既存データは pokemon_slug ベースでマージ

usage:
  python3 scripts/import-double-detail-ocr.py \
    --images-dir "$HOME/Downloads/ダブルポケモンランキング  ギルガルドから" \
    --season M-1 \
    --format double \
    --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR_SWIFT = ROOT / "scripts" / "ocr_boxes.swift"
ENV_FILE = ROOT / ".env.local"
POKEMON_NAMES_TS = ROOT / "lib" / "pokemon-names.ts"
MOVE_NAMES_TS = ROOT / "lib" / "move-names.ts"
ABILITY_NAMES_TS = ROOT / "lib" / "ability-names.ts"
ITEMS_TS = ROOT / "lib" / "items.ts"
CACHE_DIR = ROOT / "tmp" / "detail-ocr-cache"
DEBUG_DIR = ROOT / "tmp" / "detail-ocr-debug"

SLUG_JA_RE = re.compile(r'(?:"([^"]+)"|([a-z0-9-]+)):\s*"([^"]+)"')
KV_JA_RE = re.compile(r'["\'][\w\s\-\.♀♂]+["\']\s*:\s*["\']([^\n"\']{1,60})["\']')
ITEM_JA_RE = re.compile(r'\bja\s*:\s*["\']([^"\']{1,60})["\']')

RANK_BOX_RE = re.compile(r"^\d{1,2}$")
RANK_HEADER_RE = re.compile(r"^(\d{1,3})位$")
DEX_HEADER_RE = re.compile(r"^No[.,](\d+)$")
PERCENT_RE = re.compile(r"(\d{1,3})\s*[\.,。]?\s*(\d?)\s*%")
INT_RE = re.compile(r"^\d{1,3}$")

PANEL_TITLES = {
    "技": "moves",
    "持ち物": "items",
    "特性": "abilities",
    "性格補正": "natures",
    "能力補正": "natures",
    "能力ポイント": "evs",
    "同じチームのポケモン": "partners",
}

NATURES = {
    "がんばりや", "さみしがり", "ゆうかん", "いじっぱり", "やんちゃ",
    "ずぶとい", "すなお", "のんき", "わんぱく", "のうてんき",
    "おくびょう", "せっかち", "まじめ", "ようき", "むじゃき",
    "ひかえめ", "おっとり", "れいせい", "てれや", "うっかりや",
    "おだやか", "おとなしい", "なまいき", "しんちょう", "きまぐれ",
}

OCR_NAME_FIXES = {
    "ウインティ": "ウインディ",
    "ビクシー": "ピクシー",
    "二ヨロトノ": "ニョロトノ",
    "ニヨロトノ": "ニョロトノ",
    "アローラキュウコン": "アローラキュウコン",
    "マスカーニヤ": "マスカーニャ",
    "クケンカニ": "ケケンカニ",
    "三ミズズ": "ミミズズ",
    "プリムオン": "ブリムオン",
    "グッコウガ": "ゲッコウガ",
    "スコヴイラン": "スコヴィラン",
    "三ミッキュ": "ミミッキュ",
    "三三ロップ": "ミミロップ",
    "三ミロップ": "ミミロップ",
    "ニヤオニクス": "ニャオニクス",
    "れいじゅう": "ライチュウ",
}

HEADER_Y_MIN = 0.82
PANEL_Y_MIN = 0.08
PANEL_Y_MAX = 0.72
CURRENT_X_MIN = 0.25
CURRENT_X_MAX = 0.72
RANK_X_MAX = 0.38
PERCENT_X_MAX = 0.39
NAME_X_MIN = 0.40
NAME_X_MAX = 0.72
EV_BINS = [0.395, 0.445, 0.500, 0.550, 0.600, 0.650]


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


def find_best_match(raw: str, candidates: list[str], max_distance: int = 2) -> str | None:
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
    for candidate in candidates:
        dist = levenshtein(normalized_input, normalize_ja(candidate))
        if dist <= max_distance and dist < best_distance:
            best = candidate
            best_distance = dist
    return best


def load_env() -> tuple[str, str]:
    text = ENV_FILE.read_text()
    url_match = re.search(r"^NEXT_PUBLIC_SUPABASE_URL=(.+)$", text, re.M)
    key_match = re.search(r"^SUPABASE_SERVICE_ROLE_KEY=(.+)$", text, re.M)
    if not url_match or not key_match:
        raise SystemExit(".env.local に Supabase の URL / service role key がありません")
    return url_match.group(1).strip(), key_match.group(1).strip()


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
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: {err.code} {raw}") from err


def load_kv_names(path: Path) -> set[str]:
    src = path.read_text()
    return {m.group(1).strip() for m in KV_JA_RE.finditer(src) if re.search(r"[ぁ-んァ-ン一-龯]", m.group(1))}


def load_item_names(path: Path) -> set[str]:
    src = path.read_text()
    return {m.group(1).strip() for m in ITEM_JA_RE.finditer(src) if re.search(r"[ぁ-んァ-ン一-龯]", m.group(1))}


def load_slug_map() -> tuple[dict[str, str], dict[str, str], dict[str, list[str]]]:
    text = POKEMON_NAMES_TS.read_text()
    slug_to_ja = {}
    ja_to_slug = {}
    ja_to_slugs = defaultdict(list)
    for quoted_slug, bare_slug, ja in SLUG_JA_RE.findall(text):
        slug = quoted_slug or bare_slug
        slug_to_ja[slug] = ja
        ja_to_slug.setdefault(ja, slug)
        ja_to_slugs[ja].append(slug)
    return slug_to_ja, ja_to_slug, dict(ja_to_slugs)


def ocr_image(path: Path) -> list[dict]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"{path.name}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    output = subprocess.check_output(["swift", str(OCR_SWIFT), str(path)], cwd=str(ROOT))
    rows = json.loads(output)
    cache_path.write_text(json.dumps(rows, ensure_ascii=False))
    return rows


def clean_text(text: str) -> str:
    stripped = text.strip()
    if stripped in OCR_NAME_FIXES:
        return OCR_NAME_FIXES[stripped]
    normalized = normalize_ja(stripped)
    for raw, fixed in OCR_NAME_FIXES.items():
        if normalize_ja(raw) == normalized:
            return fixed
    return stripped


def parse_percent(text: str) -> float | None:
    t = (
        clean_text(text)
        .replace("％", "%")
        .replace("O", "0")
        .replace("o", "0")
    )
    m = PERCENT_RE.search(t)
    if not m:
        return None
    whole = int(m.group(1))
    frac = m.group(2) or "0"
    return float(f"{whole}.{frac}")


def parse_int(text: str) -> int | None:
    t = (
        clean_text(text)
        .replace("O", "0")
        .replace("o", "0")
        .replace("I", "1")
        .replace("l", "1")
    )
    if not INT_RE.fullmatch(t):
        return None
    return int(t)


def panel_type_from_rows(rows: list[dict]) -> str | None:
    for row in rows:
        text = clean_text(row["text"])
        if text in PANEL_TITLES:
            return PANEL_TITLES[text]
        for title, panel in PANEL_TITLES.items():
            if title in text:
                return panel
    return None


def resolve_header_name(rows: list[dict], known_names: list[str]) -> str | None:
    candidates = []
    for row in rows:
        if row["y"] < HEADER_Y_MIN:
            continue
        text = clean_text(row["text"])
        if RANK_HEADER_RE.fullmatch(text) or DEX_HEADER_RE.fullmatch(text):
            continue
        if text in PANEL_TITLES:
            continue
        if not re.search(r"[ぁ-んァ-ン一-龯]", text):
            continue
        if len(normalize_ja(text)) < 2:
            continue
        candidates.append(text)

    for text in candidates:
        match = find_best_match(text, known_names, max_distance=2)
        if match:
            return match
    return candidates[0] if candidates else None


def parse_header(rows: list[dict], known_names: list[str]) -> dict:
    rank = None
    dex_no = None
    for row in rows:
        text = clean_text(row["text"])
        if rank is None:
            m = RANK_HEADER_RE.fullmatch(text)
            if m:
                rank = int(m.group(1))
        if dex_no is None:
            m = DEX_HEADER_RE.fullmatch(text)
            if m:
                dex_no = int(m.group(1))
    return {
        "rank": rank,
        "dex_no": dex_no,
        "pokemon_ja": resolve_header_name(rows, known_names),
        "panel_type": panel_type_from_rows(rows),
    }


def center_y(row: dict) -> float:
    return row["y"] + row["h"] / 2


def pick_name_for_row(panel_type: str, y: float, name_rows: list[dict], known: list[str]) -> str | None:
    candidates = []
    for row in name_rows:
        cy = center_y(row)
        if abs(cy - y) > 0.065:
            continue
        text = clean_text(row["text"])
        if len(normalize_ja(text)) < 2:
            continue
        candidates.append(row)
    if not candidates:
        return None

    if panel_type == "natures":
        left_side = [r for r in candidates if r["x"] < 0.56]
        if left_side:
            candidates = left_side

    candidates.sort(key=lambda r: (r["x"], -len(clean_text(r["text"]))))
    raw = clean_text(candidates[0]["text"])
    max_distance = 1 if panel_type == "natures" else 2
    return find_best_match(raw, known, max_distance=max_distance) or raw


def parse_usage_entries(rows: list[dict], panel_type: str, known: list[str]) -> list[dict]:
    panel_rows = [
        row for row in rows
        if PANEL_Y_MIN <= row["y"] <= PANEL_Y_MAX and CURRENT_X_MIN <= row["x"] <= CURRENT_X_MAX
    ]
    rank_rows = [
        row for row in panel_rows
        if row["x"] <= RANK_X_MAX and (value := parse_int(row["text"])) is not None and 1 <= value <= 10
    ]
    percent_rows = [
        row for row in panel_rows
        if row["x"] <= PERCENT_X_MAX and parse_percent(row["text"]) is not None
    ]
    name_rows = [
        row for row in panel_rows
        if NAME_X_MIN <= row["x"] <= NAME_X_MAX
        and parse_percent(row["text"]) is None
        and parse_int(row["text"]) is None
        and panel_type_from_rows([row]) is None
    ]

    entries = []
    used_percents = set()
    for rank_row in sorted(rank_rows, key=center_y, reverse=True):
        rank_value = parse_int(rank_row["text"])
        if rank_value is None:
            continue
        y = center_y(rank_row)

        chosen_percent = None
        best_dist = 10**9
        for idx, percent_row in enumerate(percent_rows):
            if idx in used_percents:
                continue
            cy = center_y(percent_row)
            if abs(cy - y) > 0.06:
                continue
            dist = abs(cy - y) + abs(percent_row["x"] - 0.33)
            if dist < best_dist:
                best_dist = dist
                chosen_percent = (idx, percent_row)
        if chosen_percent is None:
            continue
        used_percents.add(chosen_percent[0])
        percentage = parse_percent(chosen_percent[1]["text"])
        name = pick_name_for_row(panel_type, y, name_rows, known)
        if percentage is None or not name:
            continue
        entries.append({"rank": rank_value, "name": name, "percentage": percentage})
    return dedupe_entries(entries)


def parse_partner_names(rows: list[dict], known: list[str]) -> list[dict]:
    panel_rows = [
        row for row in rows
        if PANEL_Y_MIN <= row["y"] <= PANEL_Y_MAX and CURRENT_X_MIN <= row["x"] <= CURRENT_X_MAX
    ]
    rank_rows = [
        row for row in panel_rows
        if row["x"] <= RANK_X_MAX and (value := parse_int(row["text"])) is not None and 1 <= value <= 10
    ]
    name_rows = [
        row for row in panel_rows
        if NAME_X_MIN <= row["x"] <= NAME_X_MAX
        and parse_int(row["text"]) is None
        and panel_type_from_rows([row]) is None
        and len(normalize_ja(clean_text(row["text"]))) >= 2
    ]

    entries = []
    for rank_row in sorted(rank_rows, key=center_y, reverse=True):
        rank_value = parse_int(rank_row["text"])
        if rank_value is None:
            continue
        name = pick_name_for_row("partners", center_y(rank_row), name_rows, known)
        if not name:
            continue
        entries.append({"rank": rank_value, "name": name, "percentage": 0.0})
    return dedupe_entries(entries)


def parse_evs(rows: list[dict]) -> list[dict]:
    panel_rows = [
        row for row in rows
        if PANEL_Y_MIN <= row["y"] <= PANEL_Y_MAX and CURRENT_X_MIN <= row["x"] <= CURRENT_X_MAX
    ]
    rank_rows = [
        row for row in panel_rows
        if row["x"] <= RANK_X_MAX and (value := parse_int(row["text"])) is not None and 1 <= value <= 10
    ]
    percent_rows = [
        row for row in panel_rows
        if row["x"] <= PERCENT_X_MAX and parse_percent(row["text"]) is not None
    ]
    value_rows = [
        row for row in panel_rows
        if 0.38 <= row["x"] <= 0.68 and "%" not in row["text"] and parse_int(row["text"]) is not None
    ]

    entries = []
    used_percents = set()
    for rank_row in sorted(rank_rows, key=center_y, reverse=True):
        rank_value = parse_int(rank_row["text"])
        if rank_value is None:
            continue
        y = center_y(rank_row)

        chosen_percent = None
        best_dist = 10**9
        for idx, percent_row in enumerate(percent_rows):
            if idx in used_percents:
                continue
            cy = center_y(percent_row)
            if abs(cy - y) > 0.06:
                continue
            dist = abs(cy - y) + abs(percent_row["x"] - 0.33)
            if dist < best_dist:
                best_dist = dist
                chosen_percent = (idx, percent_row)
        if chosen_percent is None:
            continue
        used_percents.add(chosen_percent[0])
        percentage = parse_percent(chosen_percent[1]["text"])
        if percentage is None:
            continue

        chosen_values = []
        used_value_indexes = set()
        for bin_x in EV_BINS:
            best_idx = None
            best_score = 10**9
            for idx, row in enumerate(value_rows):
                if idx in used_value_indexes:
                    continue
                cy = center_y(row)
                if abs(cy - y) > 0.06:
                    continue
                score = abs(row["x"] - bin_x) + abs(cy - y) * 1.5
                if score < best_score:
                    best_score = score
                    best_idx = idx
            if best_idx is None:
                chosen_values = []
                break
            used_value_indexes.add(best_idx)
            value = parse_int(value_rows[best_idx]["text"])
            if value is None:
                chosen_values = []
                break
            chosen_values.append(value)

        if len(chosen_values) != 6:
            continue

        entries.append({
            "rank": rank_value,
            "percentage": percentage,
            "hp": chosen_values[0],
            "atk": chosen_values[1],
            "def": chosen_values[2],
            "spAtk": chosen_values[3],
            "spDef": chosen_values[4],
            "speed": chosen_values[5],
        })
    return dedupe_entries(entries)


def dedupe_entries(entries: list[dict]) -> list[dict]:
    by_rank = {}
    for entry in entries:
        by_rank[entry["rank"]] = entry
    return [by_rank[k] for k in sorted(by_rank)]


def resolve_slug(
    rank: int,
    dex_no: int | None,
    pokemon_ja: str,
    ja_to_slug: dict[str, str],
    ja_to_slugs: dict[str, list[str]],
    ranking_by_rank: dict[int, dict],
    existing_details: list[dict],
) -> tuple[str, str]:
    ranking_row = ranking_by_rank.get(rank)
    if ranking_row:
        ranking_name = ranking_row["pokemon_ja"]
        if (
            normalize_ja(ranking_name) == normalize_ja(pokemon_ja)
            or normalize_ja(ranking_name).find(normalize_ja(pokemon_ja)) >= 0
            or normalize_ja(pokemon_ja).find(normalize_ja(ranking_name)) >= 0
        ):
            return ranking_row["pokemon_slug"], ranking_name

    if dex_no is not None:
        dex_matches = [row for row in existing_details if row.get("dex_no") == dex_no]
        if len(dex_matches) == 1:
            return dex_matches[0]["pokemon_slug"], dex_matches[0]["pokemon_ja"]

    direct = ja_to_slug.get(pokemon_ja)
    if direct:
        return direct, pokemon_ja

    variants = ja_to_slugs.get(pokemon_ja, [])
    if len(variants) == 1:
        return variants[0], pokemon_ja

    dex_matches = [
        row for row in existing_details
        if row.get("dex_no") == dex_no and normalize_ja(row["pokemon_ja"]) == normalize_ja(pokemon_ja)
    ]
    if len(dex_matches) == 1:
        return dex_matches[0]["pokemon_slug"], dex_matches[0]["pokemon_ja"]

    return "unknown", pokemon_ja


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images-dir", required=True)
    parser.add_argument("--season", default="M-1")
    parser.add_argument("--format", default="double", choices=["single", "double"])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    images_dir = Path(os.path.expanduser(args.images_dir))
    files = sorted([p for p in images_dir.iterdir() if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"}])
    if not files:
        raise SystemExit(f"no files: {images_dir}")

    base_url, key = load_env()
    slug_to_ja, ja_to_slug, ja_to_slugs = load_slug_map()
    known_pokemon = sorted(set(slug_to_ja.values()), key=len, reverse=True)
    known_moves = sorted(load_kv_names(MOVE_NAMES_TS), key=len, reverse=True)
    known_abilities = sorted(load_kv_names(ABILITY_NAMES_TS), key=len, reverse=True)
    known_items = sorted(load_item_names(ITEMS_TS), key=len, reverse=True)
    known_natures = sorted(NATURES, key=len, reverse=True)

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
        f"/rest/v1/pokemon_details?season_id=eq.{urllib.parse.quote(args.season)}&format=eq.{args.format}&select=*",
    ) or []
    ranking_by_rank = {row["rank"]: row for row in existing_rankings}
    ranking_by_slug = {row["pokemon_slug"]: row for row in existing_rankings}
    existing_by_slug = {row["pokemon_slug"]: row for row in existing_details}

    groups = {}
    warnings = []
    for path in files:
        rows = ocr_image(path)
        header = parse_header(rows, known_pokemon)
        if not header["rank"] or not header["pokemon_ja"] or not header["panel_type"]:
            warnings.append(f"{path.name}: header unresolved -> {header}")
            continue

        slug, resolved_name = resolve_slug(
            header["rank"],
            header["dex_no"],
            header["pokemon_ja"],
            ja_to_slug,
            ja_to_slugs,
            ranking_by_rank,
            existing_details,
        )
        if slug == "unknown":
            warnings.append(f"{path.name}: slug unresolved rank={header['rank']} name={header['pokemon_ja']} dex={header['dex_no']}")
            continue

        group = groups.setdefault(slug, {
            "season_id": args.season,
            "format": args.format,
            "rank": header["rank"],
            "pokemon_ja": resolved_name,
            "pokemon_slug": slug,
            "dex_no": header["dex_no"],
            "files": [],
            "panels": defaultdict(list),
        })
        group["rank"] = header["rank"]
        group["pokemon_ja"] = resolved_name
        if header["dex_no"] is not None:
            group["dex_no"] = header["dex_no"]
        group["files"].append({"file": path.name, "panel": header["panel_type"]})

        if header["panel_type"] == "moves":
            parsed = parse_usage_entries(rows, "moves", known_moves)
        elif header["panel_type"] == "items":
            parsed = parse_usage_entries(rows, "items", known_items)
        elif header["panel_type"] == "abilities":
            parsed = parse_usage_entries(rows, "abilities", known_abilities)
        elif header["panel_type"] == "natures":
            parsed = parse_usage_entries(rows, "natures", known_natures)
        elif header["panel_type"] == "partners":
            parsed = parse_partner_names(rows, known_pokemon)
        elif header["panel_type"] == "evs":
            parsed = parse_evs(rows)
        else:
            parsed = []
        group["panels"][header["panel_type"]].extend(parsed)

    by_rank = defaultdict(list)
    for slug, group in groups.items():
        by_rank[group["rank"]].append((slug, group))

    filtered_groups = {}
    for rank, items in by_rank.items():
        items.sort(key=lambda item: len(item[1]["files"]), reverse=True)
        filtered_groups[items[0][0]] = items[0][1]
        for slug, group in items[1:]:
            warnings.append(
                f"rank {rank}: duplicate group skipped slug={slug} pokemon={group['pokemon_ja']} files={len(group['files'])}"
            )

    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    upserts = []
    for slug, group in sorted(filtered_groups.items(), key=lambda item: item[1]["rank"]):
        existing = existing_by_slug.get(slug, {})
        merged = {
            "season_id": args.season,
            "format": args.format,
            "rank": group["rank"],
            "pokemon_ja": group["pokemon_ja"],
            "pokemon_slug": slug,
            "dex_no": group["dex_no"] or existing.get("dex_no"),
            "moves": dedupe_entries(group["panels"].get("moves", [])) or existing.get("moves"),
            "items": dedupe_entries(group["panels"].get("items", [])) or existing.get("items"),
            "abilities": dedupe_entries(group["panels"].get("abilities", [])) or existing.get("abilities"),
            "natures": dedupe_entries(group["panels"].get("natures", [])) or existing.get("natures"),
            "evs": dedupe_entries(group["panels"].get("evs", [])) or existing.get("evs"),
            "partners": dedupe_entries(group["panels"].get("partners", [])) or existing.get("partners"),
        }
        upserts.append(merged)

        (DEBUG_DIR / f"{group['rank']:03d}-{slug}.json").write_text(
            json.dumps({
                "summary": {
                    "rank": group["rank"],
                    "pokemon_ja": group["pokemon_ja"],
                    "pokemon_slug": slug,
                    "counts": {k: len(dedupe_entries(v)) for k, v in group["panels"].items()},
                },
                "files": group["files"],
                "payload": merged,
            }, ensure_ascii=False, indent=2)
        )

    print(f"groups: {len(upserts)}")
    for row in upserts[:10]:
        print(
            f"  {row['rank']:>3} {row['pokemon_ja']} "
            f"moves={len(row['moves'] or [])} items={len(row['items'] or [])} "
            f"abilities={len(row['abilities'] or [])} natures={len(row['natures'] or [])} "
            f"partners={len(row['partners'] or [])} evs={len(row['evs'] or [])}"
        )

    if warnings:
        print("warnings:", file=sys.stderr)
        for item in warnings[:40]:
            print(f"  {item}", file=sys.stderr)

    if args.dry_run:
        print("dry-run: no DB writes")
        return 0

    if not upserts:
        raise SystemExit("no rows to upsert")

    for i in range(0, len(upserts), 50):
        chunk = upserts[i:i + 50]
        supabase_request(
            base_url,
            key,
            "POST",
            "/rest/v1/pokemon_details?on_conflict=season_id,format,pokemon_slug",
            chunk,
            headers={"Prefer": "return=representation,resolution=merge-duplicates"},
        )

    min_rank = min(row["rank"] for row in upserts)
    max_rank = max(row["rank"] for row in upserts)
    new_rows_by_rank = {row["rank"]: row for row in upserts}
    ranking_rows = []
    for rank in range(min_rank, max_rank + 1):
        replacement = new_rows_by_rank.get(rank)
        if replacement:
            previous = ranking_by_slug.get(replacement["pokemon_slug"]) or ranking_by_rank.get(rank) or {}
            ranking_rows.append({
                "season_id": args.season,
                "format": args.format,
                "rank": rank,
                "pokemon_ja": replacement["pokemon_ja"],
                "pokemon_slug": replacement["pokemon_slug"],
                "tera_icons": previous.get("tera_icons"),
            })
        elif rank in ranking_by_rank:
            existing_rank = ranking_by_rank[rank]
            ranking_rows.append({
                "season_id": args.season,
                "format": args.format,
                "rank": rank,
                "pokemon_ja": existing_rank["pokemon_ja"],
                "pokemon_slug": existing_rank["pokemon_slug"],
                "tera_icons": existing_rank.get("tera_icons"),
            })

    supabase_request(
        base_url,
        key,
        "DELETE",
        f"/rest/v1/rankings?season_id=eq.{urllib.parse.quote(args.season)}&format=eq.{args.format}&rank=gte.{min_rank}&rank=lte.{max_rank}",
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
    print(f"upserted pokemon_details: {len(upserts)}")
    print(f"updated rankings slice: {min_rank}..{max_rank}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
