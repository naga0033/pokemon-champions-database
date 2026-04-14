"use client";
import { useState, useCallback, useEffect } from "react";

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

export function AdminUploader() {
  const [mode, setMode] = useState<Mode>("ranking");
  const [adminToken, setAdminToken] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [rankingResult, setRankingResult] = useState<ParsedRanking | null>(null);
  const [detailResult, setDetailResult] = useState<ParsedDetail | null>(null);

  // 詳細パネル保存のためのメタ (ランキング保存結果から引っ張る想定)
  const [seasonId, setSeasonId] = useState("");
  const [format, setFormat] = useState<"single" | "double">("single");

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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <label className="block text-xs font-bold text-amber-900">管理者トークン</label>
        <input
          type="password"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          placeholder="ADMIN_API_TOKEN"
          className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-amber-800">
          解析系 / 保存系 API はこのトークンがないと動きません。
        </p>
      </div>

      {/* シーズン/フォーマット (詳細保存用、ランキング解析後に自動セット) */}
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
        </div>
      )}

      {/* ファイル入力 */}
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
    </div>
  );
}
