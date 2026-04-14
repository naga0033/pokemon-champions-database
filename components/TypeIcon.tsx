// 18 タイプのアイコン: 色付き角丸四角に白シルエット SVG
// ポケモンチャンピオンズのゲーム内アイコンに寄せたオリジナル意匠

const TYPE_BG: Record<string, string> = {
  normal:"bg-slate-400", fire:"bg-orange-500", water:"bg-blue-500",
  electric:"bg-yellow-400", grass:"bg-green-500", ice:"bg-cyan-400",
  fighting:"bg-red-700", poison:"bg-purple-600", ground:"bg-amber-700",
  flying:"bg-sky-400", psychic:"bg-pink-500", bug:"bg-lime-600",
  rock:"bg-stone-600", ghost:"bg-purple-900", dragon:"bg-indigo-700",
  dark:"bg-slate-800", steel:"bg-slate-500", fairy:"bg-pink-400",
};

/** 各タイプの SVG path (20x20 viewBox、白で塗る前提) */
const PATHS: Record<string, React.ReactNode> = {
  // 炎: 雫型フレーム
  fire: <path d="M10 2 C11.5 5 13 6 13 9 C13 10.5 12 11 12 11 C13.5 11.5 15 13 15 15 C15 17.5 12.8 19 10 19 C7.2 19 5 17.5 5 15 C5 12 7 11 7 11 C7 11 6.5 9.5 7.5 7.5 C8.5 5.5 10 5 10 2 Z" />,
  // 水: 水滴
  water: <path d="M10 2 C10 2 4.5 9 4.5 13 C4.5 16.5 7 18.5 10 18.5 C13 18.5 15.5 16.5 15.5 13 C15.5 9 10 2 10 2 Z" />,
  // 草: 2 枚の葉
  grass: <g><path d="M10 3 C6 5 4 9 5 14 C5 14 8 13 10 11 C12 9 13 5 10 3 Z" /><path d="M10 17 L10 10" stroke="white" strokeWidth="1.2" fill="none"/></g>,
  // 電: 稲妻
  electric: <path d="M11 2 L4 11 L9 11 L7 18 L16 8 L11 8 L13 2 Z" />,
  // 氷: 雪結晶
  ice: (
    <g stroke="white" strokeWidth="1.3" strokeLinecap="round">
      <line x1="10" y1="2" x2="10" y2="18" />
      <line x1="3" y1="6" x2="17" y2="14" />
      <line x1="3" y1="14" x2="17" y2="6" />
    </g>
  ),
  // 闘: 拳
  fighting: <path d="M5 6 L5 14 C5 16 6 17 8 17 L13 17 C15 17 16 15 16 13 L16 10 L13 10 L13 8 L11 8 L11 6 Z" />,
  // 毒: 雫 (紫背景に白で)
  poison: <path d="M10 3 C10 3 5 10 5 13.5 C5 16 7 17.5 10 17.5 C13 17.5 15 16 15 13.5 C15 10 10 3 10 3 Z" />,
  // 地: 山
  ground: <path d="M2 16 L7 7 L11 12 L14 9 L18 16 Z" />,
  // 飛: 翼
  flying: <path d="M2 11 C5 7 10 6 18 7 C14 10 12 14 10 18 C8 14 5 13 2 11 Z" />,
  // 超: 目
  psychic: (
    <g>
      <ellipse cx="10" cy="10" rx="7" ry="4" />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </g>
  ),
  // 虫: 触角付き丸
  bug: (
    <g>
      <circle cx="10" cy="12" r="5" />
      <path d="M6 7 L4 3 M14 7 L16 3" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    </g>
  ),
  // 岩: 岩石
  rock: <path d="M4 8 L8 4 L14 4 L17 9 L15 15 L5 15 Z" />,
  // ゴースト: オバケ
  ghost: <path d="M5 8 C5 4 7 3 10 3 C13 3 15 4 15 8 L15 17 L13 15 L11 17 L9 15 L7 17 L5 15 Z" />,
  // 竜: ダイヤ
  dragon: <path d="M10 2 L17 10 L10 18 L3 10 Z" />,
  // 悪: 月
  dark: <path d="M14 3 C12 3 10 4 9 5 C10 6 10.5 7.5 10.5 9 C10.5 13 7.5 16 3.5 16 C5 17.5 7 18 9 18 C13 18 17 14 17 10 C17 7 16 5 14 3 Z" />,
  // 鋼: 歯車
  steel: (
    <g>
      <circle cx="10" cy="10" r="5" fill="none" stroke="white" strokeWidth="1.5" />
      <g stroke="white" strokeWidth="2" strokeLinecap="round">
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="10" y1="16" x2="10" y2="18" />
        <line x1="2" y1="10" x2="4" y2="10" />
        <line x1="16" y1="10" x2="18" y2="10" />
      </g>
    </g>
  ),
  // フェアリー: 星
  fairy: <path d="M10 2 L12 8 L18 8 L13 12 L15 18 L10 14 L5 18 L7 12 L2 8 L8 8 Z" />,
};

export function TypeIcon({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  const bg = TYPE_BG[type] ?? "bg-slate-400";
  const svg = PATHS[type];
  const box = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span
      title={type}
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-md ${bg} text-purple-900`}
    >
      <svg viewBox="0 0 20 20" className={`${icon} fill-white`}>
        {svg}
      </svg>
    </span>
  );
}
