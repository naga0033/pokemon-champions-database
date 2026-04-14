// 18 タイプのアイコン: 実画像を優先し、未用意タイプのみ SVG フォールバック

const TYPE_BG: Record<string, string> = {
  normal: "bg-slate-400",
  fire: "bg-amber-700",
  water: "bg-blue-500",
  electric: "bg-yellow-400",
  grass: "bg-lime-500",
  ice: "bg-cyan-400",
  fighting: "bg-red-700",
  poison: "bg-violet-600",
  ground: "bg-amber-700",
  flying: "bg-sky-400",
  psychic: "bg-fuchsia-500",
  bug: "bg-fuchsia-400",
  rock: "bg-stone-600",
  ghost: "bg-purple-700",
  dragon: "bg-indigo-700",
  dark: "bg-zinc-700",
  steel: "bg-slate-500",
  fairy: "bg-fuchsia-300",
};

const TYPE_IMAGE: Partial<Record<string, string>> = {
  normal: "/type-icons/normal.png",
  fire: "/type-icons/fire.jpeg",
  water: "/type-icons/water.jpg",
  electric: "/type-icons/electric.jpeg",
  grass: "/type-icons/grass.jpeg",
  ice: "/type-icons/ice-v2.png",
  fighting: "/type-icons/fighting.jpeg",
  poison: "/type-icons/poison.jpeg",
  ground: "/type-icons/ground.jpeg",
  flying: "/type-icons/flying.jpg",
  psychic: "/type-icons/psychic-v2.png",
  bug: "/type-icons/bug-v2.png",
  rock: "/type-icons/rock.jpeg",
  ghost: "/type-icons/ghost.jpeg",
  dragon: "/type-icons/dragon.jpeg",
  dark: "/type-icons/dark.jpg",
  steel: "/type-icons/steel.jpeg",
  fairy: "/type-icons/fairy.jpeg",
};

const PATHS: Record<string, React.ReactNode> = {
  normal: <circle cx="10" cy="10" r="5.5" />,
  fire: <path d="M3 14 L7.8 6.2 L10.4 10 L13.2 7.6 L17 14 Z" />,
  water: <path d="M10 3 C10 3 5.2 8.8 5.2 12.6 C5.2 15.6 7.2 17.6 10 17.6 C12.8 17.6 14.8 15.6 14.8 12.6 C14.8 8.8 10 3 10 3 Z" />,
  electric: <path d="M11 2.5 L5.6 10.2 L9.2 10.2 L7.3 17.6 L14.7 8.7 L10.8 8.7 L11 2.5 Z" />,
  grass: (
    <g>
      <path d="M5 16 C5.3 9.8 7.5 6.4 10 4.2 C10.3 9.5 8.6 13.4 5 16 Z" />
      <path d="M10 4.2 C12.5 6.4 14.7 9.8 15 16 C11.4 13.4 9.7 9.5 10 4.2 Z" />
    </g>
  ),
  ice: (
    <g stroke="white" strokeWidth="1.5" strokeLinecap="round">
      <line x1="10" y1="3" x2="10" y2="17" />
      <line x1="4.5" y1="6" x2="15.5" y2="14" />
      <line x1="4.5" y1="14" x2="15.5" y2="6" />
    </g>
  ),
  fighting: <path d="M6 6 L9 6 L9 8 L10.8 8 L10.8 6 L12.8 6 L12.8 8.2 L14.8 8.2 L14.8 14 C14.8 15.8 13.4 17 11.6 17 L8 17 C6.4 17 5.2 15.8 5.2 14.2 L5.2 8 Z" />,
  poison: <path d="M10 3 C10 3 6 8.4 6 11.7 C6 14.1 7.7 15.8 10 15.8 C12.3 15.8 14 14.1 14 11.7 C14 8.4 10 3 10 3 Z" />,
  ground: <path d="M2.5 14.5 L7 7.5 L10 11 L12.6 8.6 L17.5 14.5 Z" />,
  flying: <path d="M3 11 C5.6 8 8.7 6.7 17 7.3 C13.5 9.4 11.7 11.8 10 15.5 C8.6 13.1 6.3 11.9 3 11 Z" />,
  psychic: (
    <g>
      <path d="M2.5 10 C4.2 6.5 7 4.8 10 4.8 C13 4.8 15.8 6.5 17.5 10 C15.8 13.5 13 15.2 10 15.2 C7 15.2 4.2 13.5 2.5 10 Z" />
      <circle cx="10" cy="10" r="2.2" fill="currentColor" />
    </g>
  ),
  bug: (
    <g>
      <path d="M7.2 6.6 C7.2 5.1 8.5 4 10 4 C11.5 4 12.8 5.1 12.8 6.6 L12.8 7.2 C14.2 7.8 15.1 9.2 15.1 10.9 C15.1 13.8 12.9 16 10 16 C7.1 16 4.9 13.8 4.9 10.9 C4.9 9.2 5.8 7.8 7.2 7.2 Z" />
      <path d="M7 5.7 L5.1 4.2 M13 5.7 L14.9 4.2" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </g>
  ),
  rock: <path d="M5.5 5 L13.8 5 L16.5 9.2 L14.4 15 L5.6 15 L3.5 9.2 Z" />,
  ghost: <path d="M5 9 C5 5.2 7.2 3.6 10 3.6 C12.8 3.6 15 5.2 15 9 L15 15.8 L13.2 14.2 L11.4 15.8 L10 14.2 L8.6 15.8 L6.8 14.2 L5 15.8 Z" />,
  dragon: <path d="M10 2.8 L16.7 10 L10 17.2 L3.3 10 Z" />,
  dark: (
    <g>
      <path d="M2.8 11.6 C4.1 8.2 6.6 6.1 10 6.1 C13.4 6.1 15.9 8.2 17.2 11.6 C15.9 14 13.4 15.5 10 15.5 C6.6 15.5 4.1 14 2.8 11.6 Z" />
      <circle cx="10" cy="10.9" r="1.9" fill="currentColor" />
    </g>
  ),
  steel: (
    <g>
      <circle cx="10" cy="10" r="5.6" fill="none" stroke="white" strokeWidth="1.6" />
      <g stroke="white" strokeWidth="1.6" strokeLinecap="round">
        <line x1="10" y1="2.5" x2="10" y2="4.4" />
        <line x1="10" y1="15.6" x2="10" y2="17.5" />
        <line x1="2.5" y1="10" x2="4.4" y2="10" />
        <line x1="15.6" y1="10" x2="17.5" y2="10" />
      </g>
    </g>
  ),
  fairy: (
    <g>
      <path d="M10 9.4 C8.8 6.3 6.8 4.8 4.7 4.8 C4.7 7.6 6 9.8 8.4 10.8 C6.2 11.2 4.9 12.6 4.9 15 C7.6 15 9.5 13.9 10 11.7 C10.5 13.9 12.4 15 15.1 15 C15.1 12.6 13.8 11.2 11.6 10.8 C14 9.8 15.3 7.6 15.3 4.8 C13.2 4.8 11.2 6.3 10 9.4 Z" />
    </g>
  ),
};

export function TypeIcon({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  const imageSrc = TYPE_IMAGE[type];
  const imageBox = size === "sm" ? "h-6 w-6 rounded-[7px]" : "h-7 w-7 rounded-[8px]";
  if (imageSrc) {
    // 画像周囲にグレーの padding があるので overflow-hidden + scale で中心部だけを表示
    return (
      <span
        title={type}
        className={`relative inline-block ${imageBox} shrink-0 overflow-hidden`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={type}
          className="absolute inset-0 h-full w-full scale-[1.35] object-cover"
          loading="lazy"
        />
      </span>
    );
  }

  const bg = TYPE_BG[type] ?? "bg-slate-400";
  const svg = PATHS[type] ?? PATHS.normal;
  const box = size === "sm" ? "h-6 w-6 rounded-[7px]" : "h-7 w-7 rounded-[8px]";
  const icon = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  return (
    <span
      title={type}
      className={`inline-flex ${box} shrink-0 items-center justify-center ${bg} text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]`}
    >
      <svg viewBox="0 0 20 20" className={`${icon} fill-white`}>
        {svg}
      </svg>
    </span>
  );
}
