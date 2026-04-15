#!/bin/bash
# トレーナーランキングを動画 or 画像から自動更新
# 使い方:
#   ./scripts/update-trainers.sh <画像 or 動画ファイル>
#
# 例:
#   ./scripts/update-trainers.sh ~/Downloads/ranking.mp4
#   ./scripts/update-trainers.sh ~/Downloads/screenshot.jpg
#
# 環境変数:
#   ADMIN_API_TOKEN    必須 (save-trainers API の認証)
#   SEASON_ID          省略可、デフォルト "M-1"
#   FORMAT             省略可、"single" or "double"、デフォルト "single"
#   API_BASE           省略可、デフォルト本番 (pokemon-champions-stats.vercel.app)
set -e

FILE="${1:-}"
if [ -z "$FILE" ]; then
  echo "usage: $0 <image or video file or folder>"
  exit 1
fi
if [ ! -e "$FILE" ]; then
  echo "ERROR: ファイル or フォルダが見つかりません: $FILE"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# .env.local から ADMIN_API_TOKEN を読む (なければエラー)
if [ -z "${ADMIN_API_TOKEN:-}" ] && [ -f "$ROOT_DIR/.env.local" ]; then
  ADMIN_API_TOKEN=$(grep -E "^ADMIN_API_TOKEN=" "$ROOT_DIR/.env.local" | cut -d= -f2- | tr -d '"' || true)
fi
if [ -z "${ADMIN_API_TOKEN:-}" ]; then
  echo "ERROR: ADMIN_API_TOKEN が未設定。.env.local に追加してください"
  exit 1
fi

SEASON_ID="${SEASON_ID:-M-1}"
FORMAT="${FORMAT:-single}"
API_BASE="${API_BASE:-https://pokemon-champions-stats.vercel.app}"

WORK=$(mktemp -d)
trap "rm -rf $WORK" EXIT

echo "📁 入力: $FILE"
echo "📅 シーズン: $SEASON_ID / フォーマット: $FORMAT"
echo ""

mkdir -p "$WORK/frames"
if [ -d "$FILE" ]; then
  echo "📂 フォルダ内の画像をまとめて処理..."
  i=1
  for img in "$FILE"/*.{jpg,jpeg,JPG,JPEG,png,PNG}; do
    [ -f "$img" ] || continue
    printf -v n "%03d" "$i"
    cp "$img" "$WORK/frames/f_${n}.jpg"
    i=$((i+1))
  done
  echo "   画像数: $((i-1))"
else
  EXT=$(echo "$FILE" | tr '[:upper:]' '[:lower:]' | sed 's/.*\.//')
  case "$EXT" in
    mp4|mov|m4v|avi|mkv|webm)
      echo "🎬 動画としてフレーム抽出..."
      ffmpeg -i "$FILE" -vf "fps=2" "$WORK/frames/f_%03d.jpg" -hide_banner -loglevel error
      echo "   フレーム数: $(ls $WORK/frames | wc -l | tr -d ' ')"
      ;;
    jpg|jpeg|png)
      echo "🖼  画像として処理..."
      cp "$FILE" "$WORK/frames/f_001.jpg"
      ;;
    *)
      echo "ERROR: 未対応の拡張子 (.$EXT)"
      exit 1
      ;;
  esac
fi

# OCR
echo ""
echo "🔍 OCR 中 (macOS Vision)..."
mkdir -p "$WORK/ocr"
for f in "$WORK/frames"/*; do
  name=$(basename "$f" | sed 's/\.[^.]*$//')
  swift "$SCRIPT_DIR/ocr.swift" "$f" > "$WORK/ocr/${name}.txt" 2>/dev/null
done
echo "   OCR 完了: $(ls $WORK/ocr | wc -l | tr -d ' ') ファイル"

# パース
echo ""
echo "📊 トレーナーデータ抽出..."
python3 "$SCRIPT_DIR/parse-trainers.py" "$WORK/ocr" "$WORK/trainers.json"

# 投入
echo ""
echo "💾 API 投入中..."
BODY=$(python3 -c "
import json
with open('$WORK/trainers.json') as f: t = json.load(f)
print(json.dumps({'seasonId':'$SEASON_ID','format':'$FORMAT','trainers':t}, ensure_ascii=False))
")

RESPONSE=$(curl -sS -X POST "$API_BASE/api/save-trainers" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_API_TOKEN" \
  -d "$BODY")

echo "   レスポンス: $RESPONSE"
echo ""
echo "✅ 完了! $API_BASE/?view=trainer で確認してください"
