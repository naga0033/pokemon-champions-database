// このサイトについて
export default function AboutPage() {
  return (
    <div className="prose prose-slate max-w-3xl">
      <h1 className="font-display text-2xl font-black text-slate-900">このサイトについて</h1>
      <p className="text-sm text-slate-700">
        ポケモンチャンピオンズのバトルデータベース。ゲーム内のランキング画面から集計した使用率データを、
        スマホからも見やすい形で公開しています。
      </p>
      <h2 className="mt-6 font-display text-lg font-black text-slate-900">データ出典</h2>
      <p className="text-sm text-slate-700">
        ゲーム内のランキング画面をプレイヤーがスクリーンショットで撮影し、画像解析 (Claude Vision) で
        抽出・集計しています。
      </p>
      <h2 className="mt-6 font-display text-lg font-black text-slate-900">免責事項</h2>
      <p className="text-sm text-slate-700">
        当サイトは非公式ファンサイトです。任天堂、株式会社ポケモン、ゲームフリーク、クリーチャーズ、
        及び関係各社とは一切関係がありません。データの正確性は保証されませんのでご了承ください。
      </p>
    </div>
  );
}
