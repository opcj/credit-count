import Link from "next/link";

export function Brand({
  href = "/",
  compact = false,
}: {
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="brand" aria-label="Credit Count home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path
            d="M5 21c3-18 10-18 13-5s7 11 10-8M5 25h23M9 25V13m7 12V9m7 16v-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && (
        <span className="brand-wordmark">
          credit<span className="brand-count">count</span>
          <span className="brand-dot">★</span>
        </span>
      )}
    </Link>
  );
}
/** Hand-drawn accents shared by the decorative coaster scenes. */
export function JoyDoodles({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`joy-doodles ${className}`}
      viewBox="0 0 600 400"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        <path d="m61 51 9 14m-27 4 13 5m26-35-2 16" stroke="var(--accent)" />
        <path d="m523 270 10 16 19-9-10-16Z" stroke="var(--violet)" />
        <path d="M433 49q12-23 24-5t24-5" stroke="var(--turquoise)" />
        <path
          d="m94 302 4 11 12 1-9 8 3 12-11-6-10 7 1-12-10-7 12-2Z"
          stroke="var(--blue)"
        />
        <path d="M548 106q18-22 22 2t15 4" stroke="var(--accent)" />
      </g>
      <circle cx="331" cy="357" r="7" fill="var(--mango)" />
      <circle cx="31" cy="218" r="5" fill="var(--violet)" />
    </svg>
  );
}
export function TrackArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 400"
      className={`track-art ${className}`}
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <circle cx="391" cy="142" r="103" fill="var(--sun, #ffc83d)" />
      <g fill="var(--cloud, #ffffff)">
        <path d="M57 112h91a15 15 0 0 0 0-30h-6a26 26 0 0 0-49-11 18 18 0 0 0-29 17h-7a12 12 0 0 0 0 24Z" />
        <path d="M435 68h94a13 13 0 0 0 0-26h-12a22 22 0 0 0-42-3 16 16 0 0 0-26 6h-14a12 12 0 0 0 0 23Z" />
      </g>
      <g stroke="var(--support, #269e9a)" strokeWidth="3" opacity=".65">
        <path d="M65 326v-19m43 19v-79m43 79V143m43 183V113m43 213V147m43 179v-86m43 86v-8m46 8V192m40 134V117m40 209V112m40 214V190m40 136v-7" />
        <path d="m108 326 43-183 43 183 43-179 43 179m89 0 40-209 40 209 40-136 40 136" />
        <path d="M87 286h200m-163-64h140m-115-59h94m132 91h117m-101-72h73" />
      </g>
      <path d="M25 330h553" stroke="var(--rail, #4062ff)" strokeWidth="3" />
      <path
        d="M51 346h73m13 0h286m15 0h94"
        stroke="var(--rail, #4062ff)"
        strokeWidth="2"
        opacity=".25"
      />
      <path
        d="M-25 308C84 358 116 100 193 103S268 312 329 312C398 312 474 236 474 153C474 66 370 66 370 153C370 243 470 363 624 279"
        stroke="var(--rail, #4062ff)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M-25 308C84 358 116 100 193 103S268 312 329 312C398 312 474 236 474 153C474 66 370 66 370 153C370 243 470 363 624 279"
        stroke="var(--cloud, #ffffff)"
        strokeWidth="5"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />
      <g className="track-train">
        <g stroke="var(--rail, #4062ff)" strokeWidth="3" strokeLinecap="round">
          <path d="m-20-19-9-17m9 17 7-17m25 17-7-17m7 17 10-17" />
          <circle cx="-20" cy="-25" r="5" fill="var(--cloud, #ffffff)" />
          <circle cx="12" cy="-25" r="5" fill="var(--cloud, #ffffff)" />
          <path
            d="M-35-18H-3V-4h-25a7 7 0 0 1-7-7Zm34 0h33v7a7 7 0 0 1-7 7H-1Z"
            fill="var(--car, #ff5a5f)"
          />
          <circle cx="-25" cy="0" r="4" fill="var(--cloud, #ffffff)" />
          <circle cx="-10" cy="0" r="4" fill="var(--cloud, #ffffff)" />
          <circle cx="7" cy="0" r="4" fill="var(--cloud, #ffffff)" />
          <circle cx="23" cy="0" r="4" fill="var(--cloud, #ffffff)" />
        </g>
      </g>
      <g fill="var(--rail, #4062ff)">
        <path d="m292 41 3 12 12 3-12 3-3 12-3-12-12-3 12-3Z" />
        <path d="m539 202 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z" />
        <circle cx="50" cy="220" r="4" />
        <circle cx="331" cy="79" r="3" />
      </g>
    </svg>
  );
}

/** Decorative type motifs, not measured profiles of individual coasters. */
export function CoasterArt({ type }: { type: "steel" | "wooden" | "hybrid" }) {
  const paths = {
    steel:
      "M-10 120C55 120 84 112 108 76C160-3 204 36 180 72C156 108 108 68 145 40C205-3 235 108 320 91",
    wooden:
      "M-10 119C24 119 37 19 74 19S127 114 154 114S190 54 216 54S258 119 315 96",
    hybrid:
      "M-10 119C32 119 46 34 78 34S120 118 151 102S172 11 208 11S250 115 315 91",
  };
  return (
    <svg
      viewBox="0 0 300 140"
      className="coaster-art"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="230" cy="37" r="32" fill="currentColor" opacity=".12" />
      <g stroke="currentColor" opacity=".28" strokeWidth="2">
        <path d="M30 132V88m30 44V39m30 93V39m30 93V77m30 55V103m30 29V69m30 63V35m30 97V74m30 58V98M12 133h276" />
        {type !== "steel" && (
          <path d="m30 132 30-93 30 93 30-55 30 55 30-63 30 63 30-58 30 58" />
        )}
      </g>
      <path
        d={paths[type]}
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d={paths[type]}
        stroke="var(--surface)"
        strokeWidth="2"
        strokeDasharray="1 6"
      />
      <path d="m20 26 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="currentColor" />
    </svg>
  );
}
