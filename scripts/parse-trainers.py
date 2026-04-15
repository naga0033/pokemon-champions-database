#!/usr/bin/env python3
"""
OCR 結果ディレクトリから トレーナー行を抽出して JSON 出力。
usage: python3 parse-trainers.py <ocr_dir> <out.json>
"""
import os, re, json, sys

COUNTRY_RE = re.compile(r"^(JPN|KOR|CHT|CHN|USA|GBR|FRA|DEU|ITA|ESP|CAN|AUS|MEX|BRA|HKG|SGP|TWN|NLD|RUS|ARG|CHL|PER|COL|VEN|PRT|BEL|CHE|AUT|SWE|NOR|FIN|DNK|POL|CZE|UKR|PHL|MYS|IDN|THA|VNM|IND|ISR|TUR|NZL|HUN|IRE|ROU|GRC|BGR|HRV|SVK|SVN|EST|LTU|LVA|CYP|LUX|MLT|ISL)$")
RATING_RE = re.compile(r"^\d{4}\.\d{3}$")
RANK_RE = re.compile(r"^\d{1,4}$")
NOISE = {"→", "メニュー", "メニューー", "B", "戻る", "R", "L", "X", "Y", "@"}

def parse_frame(lines):
    pairs = []
    i = 0
    while i < len(lines) - 1:
        if RANK_RE.match(lines[i]) and RATING_RE.match(lines[i+1]):
            rank = int(lines[i])
            if 1 <= rank <= 9999:
                pairs.append((rank, float(lines[i+1]), i))
            i += 2
        else:
            i += 1
    if not pairs:
        return []
    start = pairs[-1][2] + 2
    cleaned = [l for l in lines[start:] if l not in NOISE]
    results = []
    j = 0
    for rank, rating, _ in pairs:
        if j >= len(cleaned):
            break
        name = cleaned[j]
        j += 1
        country = None
        if j < len(cleaned) and COUNTRY_RE.match(cleaned[j]):
            country = cleaned[j]
            j += 1
        results.append({"rank": rank, "rating": rating, "name": name, "country": country})
    return results

def main():
    if len(sys.argv) != 3:
        print("usage: parse-trainers.py <ocr_dir> <out.json>", file=sys.stderr)
        sys.exit(1)
    ocr_dir, out_path = sys.argv[1], sys.argv[2]
    trainers_by_rank = {}
    for fname in sorted(os.listdir(ocr_dir)):
        if not fname.endswith(".txt"):
            continue
        with open(os.path.join(ocr_dir, fname)) as f:
            lines = [line.strip() for line in f if line.strip()]
        for t in parse_frame(lines):
            existing = trainers_by_rank.get(t["rank"])
            better = (not existing) or (t["country"] and not existing.get("country"))
            if better:
                trainers_by_rank[t["rank"]] = t
    sorted_list = [trainers_by_rank[r] for r in sorted(trainers_by_rank.keys())]
    with open(out_path, "w") as f:
        json.dump(sorted_list, f, ensure_ascii=False, indent=2)
    print(f"extracted {len(sorted_list)} trainers → {out_path}")

if __name__ == "__main__":
    main()
