"use client";

// グローバルエラーバウンダリ: サーバー/クライアント問わず例外をキャッチしてフォールバックUIを表示

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background:
            "radial-gradient(circle at 85% 25%, rgba(255, 255, 255, 0.45), transparent 45%), radial-gradient(circle at 15% 30%, rgba(170, 150, 240, 0.3), transparent 55%), linear-gradient(225deg, #f4f2ff 0%, #ece9f7 40%, #e0dcef 100%)",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Noto Sans JP', sans-serif",
          color: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(30, 30, 60, 0.08)",
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 38, margin: 0 }}>⚠️</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "12px 0 8px" }}>
            一時的にエラーが発生しました
          </h1>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
            しばらく時間を置いて再度アクセスしてください。
            <br />
            何度も発生する場合は X @poketool2 までご連絡ください。
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              color: "#ffffff",
              background:
                "linear-gradient(90deg, #818cf8, #a78bfa, #c084fc)",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            再読み込みする
          </button>
          {error.digest && (
            <p style={{ marginTop: 14, fontSize: 11, color: "#94a3b8" }}>
              Digest: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
