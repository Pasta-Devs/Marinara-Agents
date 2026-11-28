// ──────────────────────────────────────────────
// Otome Hearth: a Tarot card (#2151), drawn as one SVG in the deck's own palette
// ──────────────────────────────────────────────
// A face (TarotFace) is midnight with a champagne double rule and rose corner flourishes; the art panel fills the card
// inside the rule: the painted picture when it is ready (clipped, "slice"), our gold emblem (lib/tarot-emblems.ts)
// otherwise, crossfading as the picture arrives (no fade under reduced motion: the stylesheet stops it). The numeral
// and the localized name ribbon sit on top of the art, so a painted card never needs lettering of its own. A reversed
// card turns only the art and wears a "Reversed" tag. The back (TarotBack) is a lattice of stars round a crescent in
// the love interest's accent. TarotCard flips from the back to the face (400 ms, none under reduced motion).
import { useId, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { arcanaNumeral, TAROT_EMBLEMS } from "../lib/tarot-emblems";
import { ARCANA, type Arcana } from "../shared/tarot";

/** The deck's own palette, the same in every look. */
const INK = { midnight: "#15122B", panel: "#201B3D", champagne: "#E6C98A", rose: "#E7A6B8" } as const;

/** Each card's name, literal keys so the locale validator sees each one. */
export const ARCANA_NAME_KEYS: Record<Arcana, string> = {
  fool: "ui.otomeForge.tarot.cardFool",
  magician: "ui.otomeForge.tarot.cardMagician",
  "high-priestess": "ui.otomeForge.tarot.cardHighPriestess",
  empress: "ui.otomeForge.tarot.cardEmpress",
  emperor: "ui.otomeForge.tarot.cardEmperor",
  hierophant: "ui.otomeForge.tarot.cardHierophant",
  lovers: "ui.otomeForge.tarot.cardLovers",
  chariot: "ui.otomeForge.tarot.cardChariot",
  strength: "ui.otomeForge.tarot.cardStrength",
  hermit: "ui.otomeForge.tarot.cardHermit",
  wheel: "ui.otomeForge.tarot.cardWheel",
  justice: "ui.otomeForge.tarot.cardJustice",
  "hanged-man": "ui.otomeForge.tarot.cardHangedMan",
  death: "ui.otomeForge.tarot.cardDeath",
  temperance: "ui.otomeForge.tarot.cardTemperance",
  devil: "ui.otomeForge.tarot.cardDevil",
  tower: "ui.otomeForge.tarot.cardTower",
  star: "ui.otomeForge.tarot.cardStar",
  moon: "ui.otomeForge.tarot.cardMoon",
  sun: "ui.otomeForge.tarot.cardSun",
  judgement: "ui.otomeForge.tarot.cardJudgement",
  world: "ui.otomeForge.tarot.cardWorld",
};

/** The four corner flourishes, inside the double rule. */
const FLOURISHES = [
  [16, 16, 1, 1],
  [124, 16, -1, 1],
  [16, 224, 1, -1],
  [124, 224, -1, -1],
]
  .map(
    ([x, y, sx, sy]) => `M${x} ${y! + 10 * sy!}Q${x} ${y} ${x! + 10 * sx!} ${y}M${x! + 3 * sx!} ${y! + 3 * sy!}l0.1 0`,
  )
  .join("");

interface TarotFaceProps {
  card: Arcana;
  reversed?: boolean;
  /** The painted picture, once it is ready. */
  art?: string | null;
  /** "Past: The Tower, reversed": the card's name for assistive tech; none hides it (a card not turned yet). */
  label?: string;
}

/** A card's face (see the header). */
export function TarotFace({ card, reversed = false, art, label }: TarotFaceProps) {
  const { t } = useTranslation();
  const clip = `${useId().replace(/:/g, "")}-clip`;
  const name = t(ARCANA_NAME_KEYS[card]);
  // The ribbon holds about 16 letters at their size; a longer name is squeezed to fit.
  const fit = name.length > 15 ? { textLength: 104, lengthAdjust: "spacingAndGlyphs" as const } : {};
  return (
    <svg
      className="of-tarot-svg"
      viewBox="0 0 140 240"
      data-card={card}
      data-reversed={reversed || undefined}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        <clipPath id={clip}>
          <rect x="12" y="12" width="116" height="216" rx="5" />
        </clipPath>
      </defs>
      <rect width="140" height="240" rx="10" fill={INK.midnight} />
      <g clipPath={`url(#${clip})`}>
        <g transform={reversed ? "rotate(180 70 120)" : undefined}>
          <rect x="12" y="12" width="116" height="216" fill={INK.panel} />
          <path
            d={TAROT_EMBLEMS[card]}
            transform="translate(20 66)"
            fill="none"
            stroke={INK.champagne}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {art ? (
            <image
              key={art}
              className="of-tarot-art"
              href={art}
              x="12"
              y="12"
              width="116"
              height="216"
              preserveAspectRatio="xMidYMid slice"
            />
          ) : null}
        </g>
      </g>
      <rect x="6" y="6" width="128" height="228" rx="7" fill="none" stroke={INK.champagne} strokeWidth="1.2" />
      <rect x="10" y="10" width="120" height="220" rx="5" fill="none" stroke={INK.champagne} strokeWidth="0.6" />
      <path d={FLOURISHES} fill="none" stroke={INK.rose} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M52 12h36v14q-18 6-36 0Z" fill={INK.midnight} stroke={INK.champagne} strokeWidth="0.8" />
      <text
        x="70"
        y="23"
        textAnchor="middle"
        fill={INK.champagne}
        fontFamily="var(--of-font-display)"
        fontWeight="700"
        fontSize="11"
      >
        {arcanaNumeral(ARCANA.indexOf(card))}
      </text>
      {reversed ? (
        <text x="70" y="40" textAnchor="middle" fill={INK.rose} fontSize="7.5" fontWeight="800" letterSpacing="1.2">
          {t("ui.otomeForge.tarot.reversed").toLocaleUpperCase()}
        </text>
      ) : null}
      <path
        d="M10 194h120l-6 9 6 9H10l6-9Z"
        fill={INK.midnight}
        stroke={INK.champagne}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <text
        x="70"
        y="207"
        textAnchor="middle"
        fill={INK.champagne}
        fontFamily="var(--of-font-display)"
        fontWeight="700"
        fontSize="12"
        {...fit}
      >
        {name}
      </text>
    </svg>
  );
}

/** The back every card shares: a lattice of stars round a crescent, in `accent`. */
export function TarotBack({ accent }: { accent: string }) {
  const pattern = `${useId().replace(/:/g, "")}-lattice`;
  return (
    <svg className="of-tarot-svg" viewBox="0 0 140 240" aria-hidden="true">
      <defs>
        <pattern id={pattern} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 10L10 0L20 10L10 20Z" fill="none" stroke={accent} strokeWidth="0.6" opacity="0.55" />
          <path d="M10 8.2l0.6 1.2 1.2 0.6-1.2 0.6-0.6 1.2-0.6-1.2-1.2-0.6 1.2-0.6Z" fill={INK.champagne} />
        </pattern>
      </defs>
      <rect width="140" height="240" rx="10" fill={INK.midnight} />
      <rect x="12" y="12" width="116" height="216" rx="5" fill={`url(#${pattern})`} />
      <rect x="6" y="6" width="128" height="228" rx="7" fill="none" stroke={INK.champagne} strokeWidth="1.2" />
      <rect x="10" y="10" width="120" height="220" rx="5" fill="none" stroke={accent} strokeWidth="0.8" />
      <circle cx="70" cy="120" r="26" fill={INK.midnight} stroke={INK.champagne} strokeWidth="1" />
      <path d="M74 101A19 19 0 1 0 74 139A14 19 0 1 1 74 101Z" fill={accent} stroke={INK.champagne} strokeWidth="0.8" />
    </svg>
  );
}

interface TarotCardProps extends TarotFaceProps {
  accent: string;
  /** Face up: the flip shows the face. */
  turned: boolean;
  /** A small note on the card ("Painting…"). */
  badge?: string;
}

/** A card that turns from its back to its face (see the header). */
export function TarotCard({ accent, turned, badge, label, ...face }: TarotCardProps) {
  return (
    <span className="of-tarot-card" data-turned={turned} style={{ "--of-li-accent": accent } as CSSProperties}>
      <span className="of-tarot-flip">
        <span className="of-tarot-side of-tarot-back">
          <TarotBack accent={accent} />
        </span>
        <span className="of-tarot-side of-tarot-front">
          <TarotFace {...face} label={turned ? label : undefined} />
        </span>
      </span>
      {badge ? <span className="of-tarot-badge">{badge}</span> : null}
    </span>
  );
}
