"use client";
import { useState, useCallback, useEffect, useRef } from "react";

type Mode = "ranking" | "detail";

type ParsedRanking = {
  seasonId: string;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  format: "single" | "double";
  entries: Array<{ rank: number; pokemonJa: string; teraIcons?: string[] }>;
};

type UsageEntry = { rank: number; name: string; percentage: number };
type EvEntry = {
  rank: number; percentage: number;
  hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number;
};

type ParsedDetail = {
  rank: number;
  pokemonJa: string;
  dexNo?: number;
  panelType: "moves" | "items" | "abilities" | "natures" | "evs" | "partners";
  entries: Array<UsageEntry | EvEntry>;
};

// バッチキューのアイテム
type QueueItem = {
  id: string;
  file: File;
  dataUrl: string;
  status: "pending" | "processing" | "done" | "error";
  result?: ParsedDetail;
  error?: string;
};

export function AdminUploader() {
  const [mode, setMode] = useState<Mode>("ranking");
  const [adminToken, setAdminToken] = useState("");

  // シングルモード用
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [rankingResult, setRankingResult] = useState<ParsedRanking | null>(null);
  const [detailResult, setDetailResult] = useState<ParsedDetail | null>(null);

  // 詳細保存メタ
  const [seasonId, setSeasonId] = useState("");
  const [format, setFormat] = useState<"single" | "double">("single");

  // バッチモード用
  const [batchMode, setBatchMode] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRef = useRef(false); // 中断フラグ

  useEffect(() => {
    const saved = window.localStorage.getItem("admin-api-token");
    if (saved) setAdminToken(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("admin-api-token", adminToken);
  }, [adminToken]);

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(adminToken ? { "x-admin-token": adminToken } : {}),
    }),
    [adminToken],
  );

  // ── シングルモード ────────────────────────────────────

  const onFile = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const analyze = useCallback(async () => {
    if (!imageDataUrl) return;
    setLoading(true); setError(null); setRankingResult(null); setDetailResult(null); setRawText(null);
    try {
      const base64 = imageDataUrl.split(",")[1];
      const mediaType = imageDataUrl.match(/^data:(.*?);/)?.[1] ?? "image/jpeg";
      const endpoint = mode === "ranking" ? "/api/parse-ranking" : "/api/parse-detail";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ imageBase64: base64, imageMediaType: mediaType }),
      });
      const data = await res.json();
      setRawText(data.rawText ?? null);
      if (!res.ok) throw new Error(data.error ?? "解析失敗");
      if (mode === "ranking") {
        setRankingResult(data.result as ParsedRanking);
        setSeasonId((data.result as ParsedRanking).seasonId);
        setFormat((data.result as ParsedRanking).format);
      } else {
        setDetailResult(data.result as ParsedDetail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, imageDataUrl, mode]);

  const saveRanking = useCallback(async () => {
    if (!rankingResult) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/save-ranking", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(rankingResult),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失敗");
      alert(`保存完了: ${data.saved}件`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, rankingResult]);

  const saveDetail = useCallback(async () => {
    if (!detailResult) return;
    if (!seasonId) { setError("先にランキング画面を登録してシーズン ID を確定してください"); return; }
    setLoading(true); setError(null);
    try {
      const panels = { [detailResult.panelType]: detailResult.entries };
      const res = await fetch("/api/save-detail", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          seasonId,
          format,
          rank: detailResult.rank,
          pokemonJa: detailResult.pokemonJa,
          dexNo: detailResult.dexNo,
          panels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失敗");
      alert(`保存完了: ${data.pokemon} の ${detailResult.panelType}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, detailResult, seasonId, format]);

  // ── バッチモード ────────────────────────────────────

  // ファイルを複数選択してキューに追加
  const onBatchFiles = useCallback((files: FileList) => {
    const newItems: QueueItem[] = [];
    const readers: Promise<void>[] = [];
    Array.from(files).forEach((file) => {
      const p = new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          newItems.push({
            id: `${Date.now()}-${Math.random()}`,
            file,
            dataUrl: reader.result as string,
            status: "pending",
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
      readers.push(p);
    });
    Promise.all(readers).then(() => {
      setQueue((prev) => [...prev, ...newItems]);
    });
  }, []);

  // 1枚分の処理（解析→保存）
  const processOne = useCallback(async (item: QueueItem): Promise<void> => {
    if (!seasonId) throw new Error("シーズン ID が未設定です");

    const base64 = item.dataUrl.split(",")[1];
    const mediaType = item.dataUrl.match(/^data:(.*?);/)?.[1] ?? "image/jpeg";

    // 解析
    const parseRes = await fetch("/api/parse-detail", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ imageBase64: base64, imageMediaType: mediaType }),
    });
    const parseData = await parseRes.json();
    if (!parseRes.ok) throw new Error(parseData.error ?? "解析失敗");
    const detail = parseData.result as ParsedDetail;

    // 保存
    const saveRes = await fetch("/api/save-detail", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        seasonId,
        format,
        rank: detail.rank,
        pokemonJa: detail.pokemonJa,
        dexNo: detail.dexNo,
        panels: { [detail.panelType]: detail.entries },
      }),
    });
    const saveData = await saveRes.json();
    if (!saveRes.ok) throw new Error(saveData.error ?? "保存失敗");

    // item に結果をセット (コールバック外からセットするので返り値で渡す)
    item.result = detail;
  }, [authHeaders, seasonId, format]);

  // バッチ実行
  const startBatch = useCallback(async () => {
    if (!seasonId) {
      alert("シーズン ID を入力してください");
      return;
    }
    batchRef.current = true;
    setBatchRunning(true);

    for (let i = 0; i < queue.length; i++) {
      if (!batchRef.current) break;
      const item = queue[i];
      if (item.status !== "pending") continue;

      // 処理中に更新
      setQueue((prev) =>
        prev.map((q) => q.id === item.id ? { ...q, status: "processing" } : q)
      );

      try {
        await processOne(item);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "done", result: item.result }
              : q
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "エラー";
        setQueue((prev) =>
          prev.map((q) => q.id === item.id ? { ...q, status: "error", error: msg } : q)
        );
      }
    }

    setBatchRunning(false);
    batchRef.current = false;
  }, [queue, processOne, seasonId]);

  const stopBatch = useCallback(() => {
    batchRef.current = false;
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // ── 統計 ────────────────────────────────────────────
  const doneCount = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const pendingCount = queue.filter((q) => q.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* モード切替 */}
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {(["ranking", "detail"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              mode === m
                ? "rounded-full bg-indigo-600 px-5 py-1.5 text-xs font-bold text-white shadow"
                : "rounded-full px-5 py-1.5 text-xs font-bold text-slate-500"
            }
          >
            {m === "ranking" ? "全体ランキング" : "ポケモン詳細"}
          </button>
        ))}
      </div>

      {/* 管理者トークン */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <label className="block text-xs font-bold text-amber-900">管理者トークン</label>
        <input
          type="password"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          placeholder="ADMIN_API_TOKEN"
          className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {/* シーズン/フォーマット */}
      {mode === "detail" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <label className="text-xs font-bold text-slate-500">シーズン ID</label>
          <input
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            placeholder="M-1"
            className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <label className="text-xs font-bold text-slate-500">フォーマット</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "single" | "double")}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="single">シングル</option>
            <option value="double">ダブル</option>
          </select>

          {/* バッチ切替 */}
          <div className="ml-auto">
            <button
              onClick={() => setBatchMode((v) => !v)}
              className={
                batchMode
                  ? "rounded-full bg-violet-600 px-4 py-1.5 text-xs font-bold text-white"
                  : "rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-600"
              }
            >
              {batchMode ? "✓ バッチモード" : "バッチモードに切替"}
            </button>
          </div>
        </div>
      )}

      {/* ────── バッチモード UI ────── */}
      {mode === "detail" && batchMode ? (
        <div className="space-y-4">
          {/* ファイル選択 */}
          <div
            className="rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length > 0) onBatchFiles(e.dataTransfer.files);
            }}
          >
            <p className="mb-3 text-sm font-bold text-violet-700">
              スクリーンショットをまとめてドロップ
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && onBatchFiles(e.target.files)}
              className="text-sm"
            />
          </div>

          {/* キューが空でない場合 */}
          {queue.length > 0 && (
            <>
              {/* 進捗サマリー */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 text-sm">
                <span className="font-bold text-slate-700">合計 {queue.length} 枚</span>
                <span className="text-emerald-600 font-bold">✓ {doneCount} 完了</span>
                {errorCount > 0 && <span className="text-rose-600 font-bold">✗ {errorCount} エラー</span>}
                <span className="text-slate-500">{pendingCount} 未処理</span>

                <div className="ml-auto flex gap-2">
                  {!batchRunning ? (
                    <button
                      onClick={startBatch}
                      disabled={pendingCount === 0}
                      className="rounded-full bg-violet-600 px-5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      ▶ 一括登録開始
                    </button>
                  ) : (
                    <button
                      onClick={stopBatch}
                      className="rounded-full bg-rose-500 px-5 py-1.5 text-xs font-bold text-white"
                    >
                      ■ 停止
                    </button>
                  )}
                  <button
                    onClick={clearQueue}
                    disabled={batchRunning}
                    className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-40"
                  >
                    クリア
                  </button>
                </div>
              </div>

              {/* キューリスト */}
              <div className="max-h-[500px] overflow-y-auto rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                {queue.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                    {/* ステータスアイコン */}
                    <span className="mt-0.5 text-base shrink-0">
                      {item.status === "done" && "✅"}
                      {item.status === "error" && "❌"}
                      {item.status === "processing" && "⏳"}
                      {item.status === "pending" && "⬜"}
                    </span>

                    {/* ファイル名 + 結果 */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-slate-500">{item.file.name}</p>
                      {item.status === "done" && item.result && (
                        <p className="mt-0.5 text-sm font-bold text-slate-800">
                          {item.result.rank}位 {item.result.pokemonJa}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {item.result.panelType}
                          </span>
                        </p>
                      )}
                      {item.status === "error" && (
                        <p className="mt-0.5 text-xs text-rose-600">{item.error}</p>
                      )}
                      {item.status === "processing" && (
                        <p className="mt-0.5 text-xs text-violet-600 animate-pulse">解析・保存中…</p>
                      )}
                    </div>

                    {/* 個別リトライ */}
                    {item.status === "error" && !batchRunning && (
                      <button
                        onClick={async () => {
                          setQueue((prev) =>
                            prev.map((q) => q.id === item.id ? { ...q, status: "processing", error: undefined } : q)
                          );
                          try {
                            await processOne(item);
                            setQueue((prev) =>
                              prev.map((q) =>
                                q.id === item.id ? { ...q, status: "done", result: item.result } : q
                              )
                            );
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : "エラー";
                            setQueue((prev) =>
                              prev.map((q) => q.id === item.id ? { ...q, status: "error", error: msg } : q)
                            );
                          }
                        }}
                        className="shrink-0 rounded-full border border-rose-300 px-3 py-1 text-xs font-bold text-rose-600"
                      >
                        再試行
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        /* ────── 通常モード UI ────── */
        <>
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="text-sm"
            />
          </div>

          {imageDataUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageDataUrl} alt="preview" className="max-h-80 rounded-xl border border-slate-200" />
              <button
                onClick={analyze}
                disabled={loading}
                className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {loading ? "解析中…" : "画像を解析"}
              </button>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              ⚠ {error}
            </div>
          )}

          {/* ランキング結果 */}
          {rankingResult && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-900">
                {rankingResult.seasonLabel} · {rankingResult.format === "single" ? "シングル" : "ダブル"}
              </p>
              <p className="text-xs text-slate-500">
                {rankingResult.startDate} 〜 {rankingResult.endDate}
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {rankingResult.entries.map((e) => (
                  <li key={e.rank}>
                    {e.rank}. {e.pokemonJa}
                    {e.teraIcons && e.teraIcons.length > 0 && (
                      <span className="ml-2 text-xs text-slate-500">[{e.teraIcons.join(", ")}]</span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                onClick={saveRanking}
                disabled={loading}
                className="mt-4 rounded-full bg-emerald-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                保存 ({rankingResult.entries.length}件)
              </button>
            </div>
          )}

          {/* 詳細結果 */}
          {detailResult && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-slate-900">
                {detailResult.rank}位 {detailResult.pokemonJa} · {detailResult.panelType}
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {detailResult.entries.map((e) => (
                  <li key={e.rank}>
                    {detailResult.panelType === "evs" && "hp" in e
                      ? `${e.rank}. ${e.percentage.toFixed(1)}% — H${e.hp}/A${e.atk}/B${e.def}/C${e.spAtk}/D${e.spDef}/S${e.speed}`
                      : `${e.rank}. ${(e as UsageEntry).name} — ${e.percentage.toFixed(1)}%`}
                  </li>
                ))}
              </ul>
              <button
                onClick={saveDetail}
                disabled={loading}
                className="mt-4 rounded-full bg-emerald-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                保存 ({detailResult.panelType})
              </button>
            </div>
          )}

          {rawText && (
            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-500">
                Claude 生レスポンス (デバッグ)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-700">{rawText}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}
