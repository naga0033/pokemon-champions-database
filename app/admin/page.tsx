// 管理者用: ゲームスクショをアップ → Vision 解析 → DB 保存
import { AdminUploader } from "@/components/AdminUploader";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="font-display text-[11px] font-bold tracking-[0.3em] text-indigo-600">
          ADMIN
        </p>
        <h1 className="mt-1 font-display text-2xl font-black text-slate-900">
          スクショ投入
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          ゲーム内「使用率ランキング画面」または「ポケモン詳細画面」のスクショをアップロードしてください。
          画像解析 (Claude Vision) でデータを抽出し、内容を確認して保存します。
        </p>
      </header>
      <AdminUploader />
    </div>
  );
}
