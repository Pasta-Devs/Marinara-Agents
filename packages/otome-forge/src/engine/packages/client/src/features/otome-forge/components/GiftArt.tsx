// ──────────────────────────────────────────────
// Otome Hearth: the Shop's gifts, drawn by hand in SVG, and a love interest's figurine (#2128, painted since #2138)
// ──────────────────────────────────────────────
// Four gifts in the plush shelf's style (C/components/PlushShelf.tsx): a 64 × 64 box, flat fills, the plush ink outline
// and a soft white shine. A heart-shaped box of chocolates, a wrapped bouquet, a bottle of wine with a glass, and a
// small pink heart-shaped potion bottle for the aphrodisiac. Each is decorative: its name is the parent's to say.
// A figurine is painted once it is bought (S/art/figurine.ts) and shown cut out of its backdrop, like a look (LookImage:
// the server's cut-out, else the free display cleanup of the painted image, never its chroma matte); until then, their
// plush frame stands in for it (their look in a round frame, or their initials).
import type { CSSProperties } from "react";
import type { RunLiView } from "../shared/api-types";
import { PLUSH_INK, liPlushId } from "../shared/claw";
import type { GiftId } from "../shared/shop";
import { LookImage } from "./LookImage";
import { PlushArt } from "./PlushShelf";

/** Each gift's name (literal keys, so the locale validator sees them). */
export const GIFT_NAME_KEYS: Record<GiftId, string> = {
  flowers: "ui.otomeForge.shop.giftFlowers",
  chocolates: "ui.otomeForge.shop.giftChocolates",
  wine: "ui.otomeForge.shop.giftWine",
  aphrodisiac: "ui.otomeForge.shop.giftAphrodisiac",
};

const INK = PLUSH_INK;
const LINE = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const HEART =
  "M32 56 C17 46 9 37 9 27 C9 19 15 13 22 13 C26.6 13 30 15.6 32 19.4 C34 15.6 37.4 13 42 13 C49 13 55 19 55 27 C55 37 47 46 32 56 Z";

function GiftShape({ gift }: { gift: GiftId }) {
  switch (gift) {
    case "chocolates":
      return (
        <g>
          <path d={HEART} fill="#b23a5e" {...LINE} />
          <path d={HEART} fill="#e0668b" transform="translate(32 33) scale(0.78) translate(-32 -33)" />
          <path d="M12 26 C24 30 40 30 52 26" fill="none" stroke="#f1d18c" strokeWidth={3.2} strokeLinecap="round" />
          <ellipse
            cx={26}
            cy={22}
            rx={6}
            ry={4}
            fill="#f1d18c"
            transform="rotate(-24 26 22)"
            stroke={INK}
            strokeWidth={1.2}
          />
          <ellipse
            cx={38}
            cy={22}
            rx={6}
            ry={4}
            fill="#f1d18c"
            transform="rotate(24 38 22)"
            stroke={INK}
            strokeWidth={1.2}
          />
          <circle cx={32} cy={24} r={3} fill="#e7b93e" stroke={INK} strokeWidth={1.2} />
          <ellipse cx={22} cy={34} rx={6} ry={3.5} fill="#fff" opacity={0.35} transform="rotate(-30 22 34)" />
        </g>
      );
    case "flowers":
      return (
        <g>
          <path
            d="M26 30 L24 18 M32 30 L32 14 M38 30 L41 18"
            stroke="#6aa86a"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <ellipse cx={20} cy={27} rx={6} ry={3} fill="#7fbf7f" transform="rotate(-30 20 27)" />
          <ellipse cx={44} cy={27} rx={6} ry={3} fill="#7fbf7f" transform="rotate(30 44 27)" />
          <circle cx={23} cy={18} r={6.5} fill="#f28baa" {...LINE} />
          <circle cx={41} cy={18} r={6.5} fill="#c9b3f2" {...LINE} />
          <circle cx={32} cy={12} r={7} fill="#f7b9cc" {...LINE} />
          <circle cx={23} cy={18} r={2.2} fill="#f1c95a" />
          <circle cx={41} cy={18} r={2.2} fill="#f1c95a" />
          <circle cx={32} cy={12} r={2.4} fill="#f1c95a" />
          <path d="M16 28 L48 28 L36 58 L28 58 Z" fill="#f6e7d0" {...LINE} />
          <path
            d="M16 28 L32 36 L48 28"
            fill="none"
            stroke={INK}
            strokeWidth={1.2}
            strokeLinejoin="round"
            opacity={0.5}
          />
          <path d="M27 46 L37 46" stroke="#e7a6b8" strokeWidth={3.6} strokeLinecap="round" />
          <path d="M32 46 l-6 7 M32 46 l6 7" stroke="#e7a6b8" strokeWidth={2.2} strokeLinecap="round" />
          <ellipse cx={24} cy={36} rx={4} ry={2.4} fill="#fff" opacity={0.35} transform="rotate(-60 24 36)" />
        </g>
      );
    case "wine":
      return (
        <g>
          <rect x={18} y={7} width={7} height={6} rx={1.5} fill="#b33a4b" {...LINE} />
          <path
            d="M18.5 13 L24.5 13 L24.5 22 C24.5 25 29 26 29 31 L29 56 C29 57.6 27.6 59 26 59 L17 59 C15.4 59 14 57.6 14 56 L14 31 C14 26 18.5 25 18.5 22 Z"
            fill="#3d7d5c"
            {...LINE}
          />
          <rect x={15.5} y={36} width={12} height={12} rx={2} fill="#f3dcaa" />
          <path d="M18 42 h7" stroke="#b33a4b" strokeWidth={1.6} strokeLinecap="round" />
          <ellipse cx={18} cy={30} rx={1.6} ry={5} fill="#fff" opacity={0.35} />
          <path d="M37 28 L55 28 C55 38 51 43 46 43 C41 43 37 38 37 28 Z" fill="#fff" fillOpacity={0.28} {...LINE} />
          <path d="M38.4 34 L53.6 34 C52.6 39.6 49.6 42 46 42 C42.4 42 39.4 39.6 38.4 34 Z" fill="#9b2335" />
          <path d="M46 43 L46 55" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
          <ellipse cx={46} cy={56} rx={7} ry={2.2} fill="#fff" fillOpacity={0.4} {...LINE} />
          <ellipse cx={41} cy={31} rx={1.4} ry={2.6} fill="#fff" opacity={0.45} />
        </g>
      );
    case "aphrodisiac":
      return (
        <g>
          <rect x={27} y={6} width={10} height={6} rx={2} fill="#c79a6b" {...LINE} />
          <rect x={28.5} y={12} width={7} height={17} fill="#f7d6e0" {...LINE} />
          <path
            d="M32 58 C19 49 13 42 13 34 C13 27.6 17.6 23 23.2 23 C27 23 30.2 25 32 28.4 C33.8 25 37 23 40.8 23 C46.4 23 51 27.6 51 34 C51 42 45 49 32 58 Z"
            fill="#ffb3c8"
            {...LINE}
          />
          <path
            d="M15.6 40 C21 37.4 26 41 32 39 C38 37 43 37.6 48.4 40 C46 45.4 40.6 50.4 32 56.2 C23.4 50.4 18 45.4 15.6 40 Z"
            fill="#e75a8c"
          />
          <circle cx={26} cy={45} r={1.6} fill="#fff" opacity={0.7} />
          <circle cx={36} cy={48} r={1.1} fill="#fff" opacity={0.7} />
          <circle cx={39} cy={43} r={1.4} fill="#fff" opacity={0.6} />
          <ellipse cx={22} cy={31} rx={4.5} ry={2.6} fill="#fff" opacity={0.4} transform="rotate(-35 22 31)" />
          <path d="M50 12 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" fill="#fff" opacity={0.85} />
          <path d="M12 16 l0.8 2 2 0.8 -2 0.8 -0.8 2 -0.8 -2 -2 -0.8 2 -0.8 Z" fill="#fff" opacity={0.7} />
        </g>
      );
  }
}

/** One gift, decorative (its name is the parent's to say). */
export function GiftArt({ gift, className, style }: { gift: GiftId; className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={className ? `of-gift ${className}` : "of-gift"}
      style={style}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <GiftShape gift={gift} />
    </svg>
  );
}

/** A love interest's figurine, decorative: the painted one cut out, or until then their plush frame. */
export function FigurineArt({
  li,
  url,
  className,
}: {
  li: Pick<RunLiView, "id" | "name" | "accent" | "portrait">;
  /** The figurine as shown (FigurinePicture `url`): its cut-out, else the painted image. */
  url?: string;
  className?: string;
}) {
  const classes = className ? `of-figurine ${className}` : "of-figurine";
  return (
    <LookImage
      className={classes}
      src={url}
      alt=""
      aria-hidden="true"
      decoding="async"
      fallback={<PlushArt prize={liPlushId(li.id)} li={li} className={`${classes} of-figurine--waiting`} />}
    />
  );
}
