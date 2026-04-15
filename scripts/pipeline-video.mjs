/**
 * 動画フレーム自動収集パイプライン
 *
 * 処理フロー:
 *   1. 動画 → ffmpeg でフレーム抽出 (SKIP_EXTRACT=1 でスキップ可)
 *   2. 未処理フレームを Vision API で解析
 *   3. バリデーション・ファジー補正
 *   4. ポケモン別にパネルをマージ
 *   5. /api/save-detail へ POST → Supabase 保存
 *
 * 環境変数:
 *   ANTHROPIC_API_KEY   (必須) Anthropic API キー
 *   ADMIN_API_TOKEN     (必須) save-detail API の管理者トークン
 *   VIDEO_FILE          (必須 or SKIP_EXTRACT=1) 入力動画ファイルパス
 *   FRAMES_DIR          フレーム保存先ディレクトリ (デフォルト: tmp/video-frames)
 *   OUTPUT_DIR          パイプライン出力ディレクトリ (デフォルト: tmp/video-pipeline)
 *   API_BASE            API ベース URL (デフォルト: http://localhost:3200)
 *   SEASON_ID           シーズン ID (デフォルト: M-1)
 *   FORMAT              "single" | "double" (デフォルト: single)
 *   SKIP_EXTRACT        "1" でフレーム抽出をスキップ（既存フレームを再利用）
 *   SCENE_THRESHOLD     シーン変化検出閾値 (デフォルト: 0.25)
 *   DRY_RUN             "1" で API 保存をスキップ（バリデーションのみ）
 *   LIMIT               処理するフレーム数上限 (デフォルト: 無制限)
 *   CONCURRENCY         並列 API 呼び出し数 (デフォルト: 3)
 *
 * 実行例:
 *   VIDEO_FILE=~/Desktop/capture.mp4 node scripts/pipeline-video.mjs
 *   SKIP_EXTRACT=1 FRAMES_DIR=~/Desktop/frames node scripts/pipeline-video.mjs
 *   DRY_RUN=1 SKIP_EXTRACT=1 FRAMES_DIR=~/Desktop/frames node scripts/pipeline-video.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { loadKnownNames, validateParsedResult } from "./validate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── 設定 ──────────────────────────────────────────────────────────────────────

const CONFIG = {
  videoFile:       process.env.VIDEO_FILE ?? "",
  framesDir:       process.env.FRAMES_DIR ?? path.join(PROJECT_ROOT, "tmp", "video-frames"),
  outputDir:       process.env.OUTPUT_DIR ?? path.join(PROJECT_ROOT, "tmp", "video-pipeline"),
  apiBase:         process.env.API_BASE   ?? "http://localhost:3200",
  seasonId:        process.env.SEASON_ID  ?? "M-1",
  format:          (process.env.FORMAT    ?? "single"),
  skipExtract:     process.env.SKIP_EXTRACT === "1",
  sceneThreshold:  process.env.SCENE_THRESHOLD ?? "0.25",
  dryRun:          process.env.DRY_RUN === "1",
  limit:           Number(process.env.LIMIT ?? "0") || Infinity,
  concurrency:     Number(process.env.CONCURRENCY ?? "3"),
  apiKey:          process.env.ANTHROPIC_API_KEY ?? "",
  adminToken:      process.env.ADMIN_API_TOKEN ?? "",
};

// ── Vision API システムプロンプト ─────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたはポケモンチャンピオンズのゲーム内「ポケモン詳細画面」を解析するアシスタントです。

【詳細画面の構造】
- 画面上部中央: 「順位 No.XXX ポケモン日本語名」+ テラスアイコン
  例: "3位 No.006 リザードン"
- 画面中央: 現在表示中のパネル（1つだけ）
- 左右の見切れパネルは無視すること
- 下部: 操作ボタン（メニュー / 戻る）

【パネル種別と JSON 形式】

(1) 技パネル  タイトル「技」  panelType: "moves"
    entries: [{ rank: number, name: string, percentage: number }]

(2) 持ち物パネル  タイトル「持ち物」  panelType: "items"
    entries: [{ rank: number, name: string, percentage: number }]

(3) 特性パネル  タイトル「特性」  panelType: "abilities"
    entries: [{ rank: number, name: string, percentage: number }]

(4) 性格補正パネル  タイトル「性格補正」  panelType: "natures"
    entries: [{ rank: number, name: string, percentage: number }]

(5) 能力ポイントパネル  タイトル「能力ポイント」  panelType: "evs"
    entries: [{ rank: number, percentage: number, hp: number, atk: number, def: number, spAtk: number, spDef: number, speed: number }]
    ※ 能力値の順序は必ず HP → ATK → DEF → SPA → SPD → SPE

(6) 同じチームのポケモンパネル  タイトル「同じチームのポケモン」  panelType: "partners"
    entries: [{ rank: number, name: string, percentage: number }]

【詳細画面の場合の出力 JSON】
{
  "rank": 3,
  "pokemonJa": "リザードン",
  "dexNo": 6,
  "panelType": "moves",
  "entries": [...]
}

【詳細画面でない場合（ランキング画面・メニュー・ロード中・トランジション等）】
{ "skip": true, "reason": "ランキング画面" }

【厳守事項】
- 中央に表示中のパネルのみ解析。左右の見切れは無視
- percentage は小数1桁の数値 (例: 73.2)
- dexNo は図鑑番号の整数
- 純粋な JSON のみ出力。説明・マークダウン不要`;

// ── ユーティリティ ────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text) {
  let value = text.trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) value = fenced[1].trim();
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  return first >= 0 && last > first ? value.slice(first, last + 1) : value;
}

function sortEntries(map) {
  return [...map.values()].sort((a, b) => a.rank - b.rank);
}

function normalizeEntry(panelType, entry) {
  if (!entry || typeof entry !== "object") return null;
  if (panelType === "evs") {
    const { rank, percentage, hp = 0, atk = 0, def = 0, spAtk = 0, spDef = 0, speed = 0 } = entry;
    if (typeof rank !== "number" || typeof percentage !== "number") return null;
    return { rank, percentage, hp, atk, def, spAtk, spDef, speed };
  }
  const name = [entry.name, entry.move, entry.item, entry.ability, entry.nature, entry.partner, entry.pokemon]
    .find((v) => typeof v === "string" && v.trim().length > 0);
  if (typeof name !== "string" || typeof entry.rank !== "number" || typeof entry.percentage !== "number") {
    return null;
  }
  return { rank: entry.rank, name: name.trim(), percentage: entry.percentage };
}

// 進捗表示
function progress(current, total, label = "") {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
  process.stdout.write(`\r  [${bar}] ${pct}% (${current}/${total}) ${label}`.padEnd(80));
}

// ── フレーム抽出 ──────────────────────────────────────────────────────────────

async function extractFrames() {
  if (!CONFIG.videoFile) {
    throw new Error("VIDEO_FILE が設定されていません。SKIP_EXTRACT=1 で既存フレームを使うか、VIDEO_FILE を指定してください。");
  }
  if (!(await fs.stat(CONFIG.videoFile).catch(() => null))) {
    throw new Error(`動画ファイルが見つかりません: ${CONFIG.videoFile}`);
  }

  await fs.mkdir(CONFIG.framesDir, { recursive: true });

  const scriptPath = path.join(__dirname, "extract-frames.sh");
  console.log(`\nフレーム抽出中: ${CONFIG.videoFile}`);
  console.log(`出力先: ${CONFIG.framesDir}`);

  execFileSync("bash", [scriptPath, CONFIG.videoFile, CONFIG.framesDir, CONFIG.sceneThreshold], {
    stdio: "inherit",
    env: { ...process.env, SCENE_THRESHOLD: CONFIG.sceneThreshold },
  });
}

// ── 処理済みフレーム追跡 ──────────────────────────────────────────────────────

const PROCESSED_FILE = () => path.join(CONFIG.outputDir, ".processed.json");

async function loadProcessed() {
  try {
    const raw = await fs.readFile(PROCESSED_FILE(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveProcessed(processed) {
  await fs.writeFile(PROCESSED_FILE(), JSON.stringify(processed, null, 2), "utf-8");
}

// ── Vision API 呼び出し ───────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: CONFIG.apiKey });

async function parseFrame(filePath, retries = 5) {
  const image = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
            { type: "text", text: "この画像を解析して JSON を返してください。" },
          ],
        }],
      });
      const text = res.content.find((c) => c.type === "text")?.text ?? "";
      return JSON.parse(extractJson(text));
    } catch (err) {
      // レートリミット: 65 秒待ってリトライ
      if (attempt < retries && err?.status === 429) {
        const waitMs = 65_000 * attempt;
        console.error(`\n[rate-limit] ${Math.round(waitMs / 1000)}秒待機 (試行 ${attempt}/${retries})`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
}

// ── 並列処理ユーティリティ ────────────────────────────────────────────────────

async function runConcurrent(tasks, concurrency, onDone) {
  const queue = [...tasks];
  const results = [];
  let running = 0;
  let done = 0;

  return new Promise((resolve, reject) => {
    function next() {
      while (running < concurrency && queue.length > 0) {
        const task = queue.shift();
        running++;
        task()
          .then((r) => {
            results.push(r);
            running--;
            done++;
            onDone?.(done, tasks.length);
            next();
            if (running === 0 && queue.length === 0) resolve(results);
          })
          .catch(reject);
      }
    }
    next();
  });
}

// ── Supabase 保存 (API 経由) ──────────────────────────────────────────────────

async function saveToApi(payload) {
  if (CONFIG.dryRun) {
    console.log(`  [dry-run] save-detail スキップ: rank=${payload.rank} ${payload.pokemonJa}`);
    return { ok: true, dryRun: true };
  }

  const url = `${CONFIG.apiBase}/api/save-detail`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": CONFIG.adminToken,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`save-detail 失敗: ${JSON.stringify(json)}`);
  return json;
}

async function saveRankingToApi(entries) {
  if (CONFIG.dryRun) {
    console.log(`  [dry-run] save-ranking スキップ: ${entries.length} 件`);
    return { ok: true, dryRun: true };
  }

  const url = `${CONFIG.apiBase}/api/save-ranking`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": CONFIG.adminToken,
    },
    body: JSON.stringify({
      seasonId: CONFIG.seasonId,
      seasonLabel: `シーズン${CONFIG.seasonId}`,
      startDate: "2026-04-08",
      endDate:   "2026-05-13",
      format: CONFIG.format,
      entries,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`save-ranking 失敗: ${JSON.stringify(json)}`);
  return json;
}

// ── メイン処理 ────────────────────────────────────────────────────────────────

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ポケモンチャンピオンズ 動画パイプライン");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  シーズン  : ${CONFIG.seasonId}`);
  console.log(`  フォーマット: ${CONFIG.format}`);
  console.log(`  API ベース : ${CONFIG.apiBase}`);
  if (CONFIG.dryRun) console.log("  [DRY RUN] API 保存はスキップ");

  // ── 検証 ──
  if (!CONFIG.apiKey) throw new Error("ANTHROPIC_API_KEY が未設定です");
  if (!CONFIG.adminToken && !CONFIG.dryRun) throw new Error("ADMIN_API_TOKEN が未設定です");

  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  await fs.mkdir(CONFIG.framesDir, { recursive: true });

  // ── ステップ 1: フレーム抽出 ──
  if (!CONFIG.skipExtract) {
    await extractFrames();
  } else {
    console.log(`\nフレーム抽出スキップ (SKIP_EXTRACT=1)\n既存フレームを使用: ${CONFIG.framesDir}`);
  }

  // ── フレームファイルリスト取得 ──
  const allFrames = (await fs.readdir(CONFIG.framesDir))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, CONFIG.limit === Infinity ? undefined : CONFIG.limit);

  if (allFrames.length === 0) {
    console.error(`\nエラー: ${CONFIG.framesDir} にフレームが見つかりません`);
    process.exit(1);
  }
  console.log(`\nフレーム数: ${allFrames.length} 枚`);

  // ── ステップ 2: 既知名前リスト読み込み ──
  console.log("\n既知名前リスト読み込み中...");
  const known = await loadKnownNames();

  // ── ステップ 3: 処理済みリスト読み込み ──
  const processed = await loadProcessed();
  const unprocessed = allFrames.filter((f) => !processed[f]);
  console.log(`処理済: ${allFrames.length - unprocessed.length} / 未処理: ${unprocessed.length}`);

  if (unprocessed.length === 0) {
    console.log("全フレーム処理済。マージ・保存ステップへ進みます。");
  }

  // ── ステップ 4: Vision API で並列解析 ──
  if (unprocessed.length > 0) {
    console.log(`\nVision API 解析中 (並列数: ${CONFIG.concurrency})...`);
    let skipCount = 0;
    let errorCount = 0;

    const tasks = unprocessed.map((fname) => async () => {
      const filePath = path.join(CONFIG.framesDir, fname);
      try {
        const raw = await parseFrame(filePath);

        // スキップフレーム（ランキング画面等）
        if (raw?.skip) {
          processed[fname] = { skip: true, reason: raw.reason ?? "" };
          await saveProcessed(processed);
          skipCount++;
          return;
        }

        // バリデーション
        const { result, warnings, hasUnknown } = validateParsedResult(raw, known);

        processed[fname] = { result, warnings, hasUnknown, skip: false };
        await saveProcessed(processed);

      } catch (err) {
        processed[fname] = { error: String(err), skip: false };
        await saveProcessed(processed);
        errorCount++;
        console.error(`\n[error] ${fname}: ${err.message ?? err}`);
      }
    });

    await runConcurrent(tasks, CONFIG.concurrency, (done, total) => {
      progress(done, total, unprocessed[done - 1] ?? "");
    });

    console.log(`\n  スキップ: ${skipCount} / エラー: ${errorCount}`);
  }

  // ── ステップ 5: ポケモン別にパネルをマージ ──
  console.log("\nパネルマージ中...");

  const PANEL_TYPES = ["moves", "items", "abilities", "natures", "evs", "partners"];

  /** @type {Map<string, { rank, pokemonJa, dexNo, files: string[], panels: Record<string, Map> }>} */
  const grouped = new Map();

  for (const [fname, entry] of Object.entries(processed)) {
    if (!entry || entry.skip || entry.error || !entry.result) continue;
    const r = entry.result;
    if (!r.rank || !r.pokemonJa || !r.panelType || !r.entries) continue;

    const key = `${r.rank}-${r.pokemonJa}`;
    let group = grouped.get(key);
    if (!group) {
      group = {
        rank: r.rank,
        pokemonJa: r.pokemonJa,
        dexNo: r.dexNo ?? null,
        files: [],
        panels: Object.fromEntries(PANEL_TYPES.map((t) => [t, new Map()])),
      };
      grouped.set(key, group);
    }

    group.files.push(fname);
    if (r.dexNo && !group.dexNo) group.dexNo = r.dexNo;

    for (const entry of r.entries) {
      const normalized = normalizeEntry(r.panelType, entry);
      if (normalized) {
        group.panels[r.panelType].set(normalized.rank, normalized);
      }
    }
  }

  console.log(`  検出ポケモン数: ${grouped.size}`);

  // ── ステップ 6: バリデーション警告レポート ──
  const allWarnings = [];
  for (const [fname, entry] of Object.entries(processed)) {
    if (entry?.warnings?.length > 0) {
      allWarnings.push({ file: fname, warnings: entry.warnings });
    }
  }
  if (allWarnings.length > 0) {
    console.log(`\nバリデーション警告 (${allWarnings.length} フレーム):`);
    for (const { file, warnings } of allWarnings.slice(0, 20)) {
      console.log(`  ${file}:`);
      for (const w of warnings) console.log(`    ${w}`);
    }
    if (allWarnings.length > 20) {
      console.log(`  ... 他 ${allWarnings.length - 20} 件 (${CONFIG.outputDir}/report.json を参照)`);
    }
  }

  // ── ステップ 7: Supabase に保存 ──
  console.log(`\nSupabase 保存中${CONFIG.dryRun ? " (dry-run)" : ""}...`);

  const rankingEntries = [];
  const saved = [];
  const saveErrors = [];

  for (const group of [...grouped.values()].sort((a, b) => a.rank - b.rank)) {
    const payload = {
      seasonId: CONFIG.seasonId,
      format: CONFIG.format,
      rank: group.rank,
      pokemonJa: group.pokemonJa,
      dexNo: group.dexNo,
      panels: Object.fromEntries(
        PANEL_TYPES.map((t) => [t, sortEntries(group.panels[t])])
      ),
    };

    try {
      const saveResult = await saveToApi(payload);
      saved.push({ rank: group.rank, pokemonJa: group.pokemonJa, ...saveResult });
      rankingEntries.push({ rank: group.rank, pokemonJa: group.pokemonJa });
      process.stdout.write(
        `  rank=${String(group.rank).padStart(3)} ${group.pokemonJa.padEnd(12)} ` +
        `moves=${String(sortEntries(group.panels.moves).length).padStart(2)} ` +
        `items=${String(sortEntries(group.panels.items).length).padStart(2)} ` +
        `abilities=${String(sortEntries(group.panels.abilities).length).padStart(2)}\n`
      );
    } catch (err) {
      saveErrors.push({ rank: group.rank, pokemonJa: group.pokemonJa, error: String(err) });
      console.error(`  [save-error] rank=${group.rank} ${group.pokemonJa}: ${err.message ?? err}`);
    }
  }

  // ランキング一括保存
  if (rankingEntries.length > 0) {
    try {
      await saveRankingToApi(rankingEntries);
      console.log(`\nランキング保存完了: ${rankingEntries.length} 件`);
    } catch (err) {
      console.error(`\n[save-ranking-error]: ${err.message ?? err}`);
    }
  }

  // ── ステップ 8: レポート保存 ──
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      seasonId: CONFIG.seasonId,
      format: CONFIG.format,
      framesDir: CONFIG.framesDir,
      dryRun: CONFIG.dryRun,
    },
    stats: {
      totalFrames: allFrames.length,
      processed: Object.keys(processed).length,
      skipped: Object.values(processed).filter((e) => e?.skip).length,
      errors: Object.values(processed).filter((e) => e?.error).length,
      pokemonDetected: grouped.size,
      saved: saved.length,
      saveErrors: saveErrors.length,
    },
    warnings: allWarnings,
    saveErrors,
  };

  await fs.writeFile(
    path.join(CONFIG.outputDir, "report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  // ── 最終サマリー ──
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  完了");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  フレーム数     : ${report.stats.totalFrames}`);
  console.log(`  スキップ       : ${report.stats.skipped} (ランキング画面等)`);
  console.log(`  エラー         : ${report.stats.errors}`);
  console.log(`  ポケモン検出   : ${report.stats.pokemonDetected}`);
  console.log(`  Supabase 保存  : ${report.stats.saved}${CONFIG.dryRun ? " (dry-run)" : ""}`);
  console.log(`  保存エラー     : ${report.stats.saveErrors}`);
  console.log(`  レポート       : ${path.join(CONFIG.outputDir, "report.json")}`);
  if (saveErrors.length > 0) {
    console.log("\n  ※ 保存エラーは report.json を確認してください");
  }
}

main().catch((err) => {
  console.error("\n[fatal]", err.message ?? err);
  process.exit(1);
});
