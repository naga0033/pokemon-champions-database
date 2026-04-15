#!/usr/bin/env bash
# 動画ファイルからゲーム画面フレームを抽出する
#
# 使い方:
#   ./extract-frames.sh <動画ファイル> <出力ディレクトリ> [オプション]
#
# 環境変数:
#   SCENE_THRESHOLD  シーン変化検出閾値 (0.0〜1.0, デフォルト: 0.25)
#   FPS              フレームレート上限 (シーン検出モードの補助, デフォルト: 1)
#   MODE             "scene" (シーン変化検出) | "fps" (固定FPS) | "both" (デフォルト: scene)
#   QUALITY          JPEG品質 (1=最高〜31=最低, デフォルト: 2)
#
# 例:
#   # シーン変化検出（デフォルト・推奨）
#   ./extract-frames.sh ~/Desktop/capture.mp4 ~/Desktop/frames/
#
#   # FPS指定で0.5fps抽出（補助的に使用）
#   MODE=fps FPS=0.5 ./extract-frames.sh ~/Desktop/capture.mp4 ~/Desktop/frames/
#
#   # 両方組み合わせ（より多くのフレームを取りたい場合）
#   MODE=both ./extract-frames.sh ~/Desktop/capture.mp4 ~/Desktop/frames/

set -euo pipefail

# ── 引数チェック ──────────────────────────────────────────────────────────────
if [ $# -lt 2 ]; then
    echo "使い方: $0 <動画ファイル> <出力ディレクトリ> [シーン閾値] [FPS]" >&2
    echo "" >&2
    echo "環境変数で設定可能:" >&2
    echo "  SCENE_THRESHOLD=0.25  MODE=scene  FPS=1  QUALITY=2" >&2
    exit 1
fi

VIDEO_FILE="$1"
OUTPUT_DIR="$2"

# 引数 or 環境変数 or デフォルト値
SCENE_THRESHOLD="${3:-${SCENE_THRESHOLD:-0.25}}"
FPS="${4:-${FPS:-1}}"
MODE="${MODE:-scene}"
QUALITY="${QUALITY:-2}"

# ── 事前チェック ──────────────────────────────────────────────────────────────
if [ ! -f "$VIDEO_FILE" ]; then
    echo "エラー: 動画ファイルが見つかりません: $VIDEO_FILE" >&2
    exit 1
fi

if ! command -v ffmpeg &>/dev/null; then
    echo "エラー: ffmpeg がインストールされていません" >&2
    echo "  brew install ffmpeg  でインストールしてください" >&2
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# ── 動画情報の表示 ───────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  フレーム抽出"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  入力   : $VIDEO_FILE"
echo "  出力   : $OUTPUT_DIR"
echo "  モード : $MODE"
if [ "$MODE" != "fps" ]; then
    echo "  シーン閾値: $SCENE_THRESHOLD"
fi
if [ "$MODE" != "scene" ]; then
    echo "  FPS上限: $FPS"
fi

# 動画の長さを表示
DURATION=$(ffprobe -v quiet -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 "$VIDEO_FILE" 2>/dev/null || echo "不明")
if [ "$DURATION" != "不明" ]; then
    MINS=$(echo "$DURATION / 60" | bc 2>/dev/null || echo "?")
    echo "  長さ   : ${DURATION%.*}秒 (約${MINS}分)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── ffmpeg フィルタ構築 ───────────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_PATTERN="${OUTPUT_DIR}/frame_%06d.jpg"

build_filter() {
    local mode="$1"
    case "$mode" in
        scene)
            # シーン変化検出: 閾値以上の変化があったフレームのみ抽出
            # select はフレームを選択し、setpts は PTS を再計算
            echo "select='gt(scene,${SCENE_THRESHOLD})',setpts=N/FRAME_RATE/TB"
            ;;
        fps)
            # 固定 FPS で抽出（シンプルで確実）
            echo "fps=${FPS}"
            ;;
        both)
            # シーン変化 OR 一定時間経過 の両方でフレームを取得
            echo "select='gt(scene,${SCENE_THRESHOLD})+isnan(prev_selected_t)+gte(t-prev_selected_t,1/${FPS})',setpts=N/FRAME_RATE/TB"
            ;;
        *)
            echo "fps=${FPS}"
            ;;
    esac
}

FILTER=$(build_filter "$MODE")

# ── 抽出実行 ──────────────────────────────────────────────────────────────────
echo "抽出中... (Ctrl+C で中断可)"
echo ""

ffmpeg -hide_banner -loglevel warning \
    -i "$VIDEO_FILE" \
    -vf "$FILTER" \
    -vsync vfr \
    -q:v "$QUALITY" \
    "$OUTPUT_PATTERN" \
    2>&1

# ── 結果レポート ──────────────────────────────────────────────────────────────
COUNT=$(ls "${OUTPUT_DIR}"/frame_*.jpg 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  完了: ${COUNT} フレーム抽出 → ${OUTPUT_DIR}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$COUNT" -eq 0 ]; then
    echo "" >&2
    echo "警告: フレームが1枚も抽出されませんでした。" >&2
    echo "  シーン検出モードの場合は MODE=fps で再試行してみてください:" >&2
    echo "  MODE=fps FPS=0.5 $0 \"$VIDEO_FILE\" \"$OUTPUT_DIR\"" >&2
    exit 1
fi

echo ""
echo "次のステップ: pipeline-video.mjs を実行してフレームを解析"
echo "  FRAMES_DIR=\"${OUTPUT_DIR}\" node scripts/pipeline-video.mjs"
