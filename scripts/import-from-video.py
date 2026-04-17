#!/usr/bin/env python3
"""動画ファイルからポケモン詳細をインポートするラッパースクリプト。

処理フロー:
  1. ffmpeg で動画から 1fps フレーム抽出（tmp/video-frames/）
  2. 既存の import-double-detail-ocr.py を呼び出し
     （Mac Vision OCR でパネル解析 → Supabase 保存）

Claude API 等の有料サービスは一切使わない（完全無料）。

usage:
  python3 scripts/import-from-video.py ~/Desktop/動画.mp4 \\
    --season M-1 --format single [--dry-run] [--keep-frames] [--fps 1]
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OCR_SCRIPT = ROOT / "scripts" / "import-double-detail-ocr.py"
OCR_CACHE = ROOT / "tmp" / "detail-ocr-cache"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("video", help="動画ファイルのパス")
    parser.add_argument("--season", default="M-1", help="シーズンID (例: M-1)")
    parser.add_argument("--format", default="single", choices=["single", "double"])
    parser.add_argument("--fps", default="1", help="フレーム抽出のFPS (デフォルト: 1)")
    parser.add_argument("--frames-dir", default=str(ROOT / "tmp" / "video-frames"))
    parser.add_argument("--dry-run", action="store_true", help="DB保存をスキップ")
    parser.add_argument("--keep-frames", action="store_true", help="処理後もフレーム画像を残す")
    parser.add_argument("--clear-cache", action="store_true", help="OCRキャッシュをクリアしてから実行")
    args = parser.parse_args()

    video_path = Path(args.video).expanduser().resolve()
    if not video_path.exists():
        print(f"エラー: 動画ファイルが見つかりません: {video_path}", file=sys.stderr)
        return 1

    frames_dir = Path(args.frames_dir).expanduser().resolve()

    # フレームディレクトリ初期化
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True)

    # OCR キャッシュクリア（前の動画の残骸を除去）
    if args.clear_cache and OCR_CACHE.exists():
        shutil.rmtree(OCR_CACHE)

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  ポケモンチャンピオンズ 動画インポート (無料Mac OCR)")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  動画      : {video_path}")
    print(f"  シーズン  : {args.season}")
    print(f"  フォーマット: {args.format}")
    print(f"  FPS       : {args.fps}")
    print(f"  フレーム  : {frames_dir}")
    if args.dry_run:
        print("  [DRY RUN] DB保存はスキップ")
    print()

    # ── ステップ1: ffmpeg でフレーム抽出 ──
    print("[1/2] ffmpeg でフレーム抽出中...")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-hide_banner", "-loglevel", "warning",
        "-i", str(video_path),
        "-vf", f"fps={args.fps}",
        "-q:v", "2",
        str(frames_dir / "frame_%06d.jpg"),
    ]
    try:
        subprocess.run(ffmpeg_cmd, check=True)
    except FileNotFoundError:
        print("エラー: ffmpeg がインストールされていません (brew install ffmpeg)", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as e:
        print(f"エラー: ffmpeg 失敗 ({e})", file=sys.stderr)
        return 1

    frame_count = len(list(frames_dir.glob("frame_*.jpg")))
    print(f"  抽出完了: {frame_count} フレーム\n")
    if frame_count == 0:
        print("エラー: フレームが抽出できませんでした", file=sys.stderr)
        return 1

    # ── ステップ2: 既存 OCR スクリプトで解析＆保存 ──
    print("[2/2] Mac Vision OCR で解析＆DB保存中...")
    ocr_cmd = [
        sys.executable,
        str(OCR_SCRIPT),
        "--images-dir", str(frames_dir),
        "--season", args.season,
        "--format", args.format,
    ]
    if args.dry_run:
        ocr_cmd.append("--dry-run")

    result = subprocess.run(ocr_cmd)
    exit_code = result.returncode

    # ── 後片付け ──
    if not args.keep_frames:
        shutil.rmtree(frames_dir, ignore_errors=True)
        print(f"\nフレームディレクトリを削除: {frames_dir}")
    else:
        print(f"\nフレームディレクトリ保持: {frames_dir}")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
