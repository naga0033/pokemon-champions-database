"use client";

// ルートセグメント用エラーバウンダリ: ページ内で発生した例外をキャッチしてレイアウトを維持したままフォールバック表示する
// (global-error.tsx は <html>/<body> ごと置き換える最終防衛線。こちらが先に拾えばヘッダーや背景が保持される)

import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 本番環境でも原因を追えるようにコンソールに残す
    console.error("[RouteError]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-violet-100 bg-white/90 p-6 text-center shadow-sm">
      <p className="text-3xl">⚠️</p>
      <h2 className="mt-2 text-base font-black text-slate-900">
        一時的にエラーが発生しました
      </h2>
      <p className="mt-2 text-xs leading-6 text-slate-500">
        しばらく時間を置いて再度アクセスしてください。
        <br />
        何度も発生する場合は X @poketool2 までご連絡ください。
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 px-5 py-2 text-xs font-bold text-white shadow hover:opacity-90"
      >
        再読み込みする
      </button>
      {error.digest && (
        <p className="mt-3 text-[10px] text-slate-400">Digest: {error.digest}</p>
      )}
    </div>
  );
}
