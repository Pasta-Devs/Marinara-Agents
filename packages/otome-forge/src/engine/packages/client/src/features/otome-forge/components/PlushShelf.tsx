// ──────────────────────────────────────────────
// Otome Forge: the plushies (drawn in SVG, never painted) and the shelf they line up on
// ──────────────────────────────────────────────
// Six series plushes and each love interest's own: the look he wears at home (M4's Wardrobe, else his portrait; cut out
// of its background once Home has made the cut-out, M3; GET /play names the picture), or his initials in his colour, in
// a round plush frame with ears and stitches. The shelf shows what the protagonist has won (with a count), a silhouette
// for what is still in the machine, and a "New" ribbon on what a round just added.
// ponytail: the shelf stands on Dates and after a round only; the upgrade path is a shelf page in M4's Album.
import { useId, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { accentOf, initialsOf } from "../lib/accent";
import type { RunLiView } from "../shared/api-types";
import { PLUSH_SERIES, liPlushId, plushLi, type PlayView, type PlushSeries } from "../shared/claw";

/** A love interest as their plush wears them: `plush` is GET /play's picture for it (their look, or its cut-out). */
export type PlushOwner = Pick<RunLiView, "name" | "accent" | "portrait"> & { plush?: string };

/** `li` with the picture GET /play gives their plush, when it gives one. */
export function withPlush<T extends RunLiView>(li: T, play: Pick<PlayView, "lis"> | undefined): T & { plush?: string } {
  const plush = play?.lis[li.id]?.plush;
  return plush ? { ...li, plush } : li;
}

/** Each series plush's name (literal keys, so the locale validator sees them). */
export const PLUSH_NAME_KEYS: Record<PlushSeries, string> = {
  chick: "ui.otomeForge.claw.plushChick",
  bunny: "ui.otomeForge.claw.plushBunny",
  kitty: "ui.otomeForge.claw.plushKitty",
  star: "ui.otomeForge.claw.plushStar",
  bear: "ui.otomeForge.claw.plushBear",
  whale: "ui.otomeForge.claw.plushWhale",
};

const INK = "#3b2a40";
const BLUSH = "#ff8fab";

/** The shared face: two dot eyes, a small smile, and blush. `y` is the eye line. */
function Face({ y = 36, spread = 7 }: { y?: number; spread?: number }) {
  return (
    <g>
      <ellipse cx={32 - spread - 5} cy={y + 5} rx={3.4} ry={2.1} fill={BLUSH} opacity={0.55} />
      <ellipse cx={32 + spread + 5} cy={y + 5} rx={3.4} ry={2.1} fill={BLUSH} opacity={0.55} />
      <circle cx={32 - spread} cy={y} r={2.5} fill={INK} />
      <circle cx={32 + spread} cy={y} r={2.5} fill={INK} />
      <circle cx={32 - spread + 0.9} cy={y - 0.9} r={0.8} fill="#fff" />
      <circle cx={32 + spread + 0.9} cy={y - 0.9} r={0.8} fill="#fff" />
      <path d={`M${29.6} ${y + 4.2} q2.4 2.4 4.8 0`} fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
}

const shine = <ellipse cx={24} cy={25} rx={7} ry={4} fill="#fff" opacity={0.35} transform="rotate(-24 24 25)" />;

function SeriesShape({ kind }: { kind: PlushSeries }) {
  switch (kind) {
    case "chick":
      return (
        <g>
          <path d="M29 19 q1-9 5-3 q2-6 4 1" fill="none" stroke="#e7b93e" strokeWidth={2.4} strokeLinecap="round" />
          <ellipse cx={13} cy={42} rx={6} ry={8} fill="#f1c95a" transform="rotate(20 13 42)" />
          <ellipse cx={51} cy={42} rx={6} ry={8} fill="#f1c95a" transform="rotate(-20 51 42)" />
          <circle cx={32} cy={38} r={20} fill="#f8da72" />
          {shine}
          <Face y={35} spread={7} />
          <path d="M29.4 40 L34.6 40 L32 43.6 Z" fill="#f29a4a" />
        </g>
      );
    case "bunny":
      return (
        <g>
          <ellipse cx={23} cy={15} rx={5.4} ry={13} fill="#f7b9cc" transform="rotate(-8 23 15)" />
          <ellipse cx={41} cy={15} rx={5.4} ry={13} fill="#f7b9cc" transform="rotate(8 41 15)" />
          <ellipse cx={23} cy={16} rx={2.5} ry={9} fill="#f28baa" transform="rotate(-8 23 16)" />
          <ellipse cx={41} cy={16} rx={2.5} ry={9} fill="#f28baa" transform="rotate(8 41 16)" />
          <circle cx={32} cy={39} r={20} fill="#f7b9cc" />
          <ellipse cx={24} cy={57} rx={5.5} ry={3.2} fill="#f6a6bf" />
          <ellipse cx={40} cy={57} rx={5.5} ry={3.2} fill="#f6a6bf" />
          {shine}
          <Face y={37} />
        </g>
      );
    case "kitty":
      return (
        <g>
          <path d="M13 29 L17 9 L30 21 Z" fill="#c9b3f2" strokeLinejoin="round" stroke="#c9b3f2" strokeWidth={3} />
          <path d="M51 29 L47 9 L34 21 Z" fill="#c9b3f2" strokeLinejoin="round" stroke="#c9b3f2" strokeWidth={3} />
          <path d="M17 24 L18.6 14 L25 20 Z" fill="#f2a8c8" />
          <path d="M47 24 L45.4 14 L39 20 Z" fill="#f2a8c8" />
          <ellipse cx={32} cy={39} rx={21} ry={19} fill="#c9b3f2" />
          {shine}
          <Face y={37} />
          <g stroke={INK} strokeWidth={1} strokeLinecap="round" opacity={0.55}>
            <path d="M12 40 L20 41" />
            <path d="M12 45 L20 44" />
            <path d="M52 40 L44 41" />
            <path d="M52 45 L44 44" />
          </g>
        </g>
      );
    case "star":
      return (
        <g>
          <path
            d="M32 9 L38.6 25.3 L56 26.4 L42.6 37.6 L46.9 54.6 L32 45.3 L17.1 54.6 L21.4 37.6 L8 26.4 L25.4 25.3 Z"
            fill="#f1d18c"
            stroke="#f1d18c"
            strokeWidth={5}
            strokeLinejoin="round"
          />
          {shine}
          <Face y={34} spread={6} />
        </g>
      );
    case "bear":
      return (
        <g>
          <circle cx={16} cy={21} r={7.5} fill="#d9a877" />
          <circle cx={48} cy={21} r={7.5} fill="#d9a877" />
          <circle cx={16} cy={21} r={3.6} fill="#b9835a" />
          <circle cx={48} cy={21} r={3.6} fill="#b9835a" />
          <circle cx={32} cy={38} r={21} fill="#d9a877" />
          <ellipse cx={32} cy={44} rx={8.5} ry={6.4} fill="#f2d3b0" />
          {shine}
          <Face y={34} spread={8} />
          <ellipse cx={32} cy={41.4} rx={2.8} ry={2} fill={INK} />
        </g>
      );
    case "whale":
      return (
        <g>
          <path d="M50 37 q9-11 12-3 q-5 4-6 7 q5 3 6 7 q-3 8-12-3 Z" fill="#8bb8e8" />
          <ellipse cx={30} cy={40} rx={24} ry={17} fill="#9dc4ee" />
          <ellipse cx={30} cy={48} rx={16} ry={8} fill="#d9ecfb" />
          <path
            d="M30 16 q-3-5 0-8 M30 16 q3-5 6-4 M30 16 q-4-4-7-2"
            fill="none"
            stroke="#9dc4ee"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {shine}
          <Face y={38} spread={7} />
        </g>
      );
  }
}

interface PlushArtProps {
  prize: string;
  /** For a love interest's plush: him (his name, colour, and the picture it wears). */
  li?: PlushOwner | null;
  className?: string;
  style?: CSSProperties;
}

/** One plush, decorative (its name is the parent's to say). */
export function PlushArt({ prize, li, className, style }: PlushArtProps) {
  const clip = `of-plush-${useId().replace(/[^a-zA-Z0-9_-]/gu, "")}`;
  const series = (PLUSH_SERIES as readonly string[]).includes(prize) ? (prize as PlushSeries) : null;
  const accent = li ? accentOf(li) : "#e7a6b8";
  const picture = li?.plush ?? li?.portrait;
  return (
    <svg
      className={className ? `of-plush ${className}` : "of-plush"}
      style={style}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {series ? (
        <SeriesShape kind={series} />
      ) : (
        <g>
          <circle cx={17} cy={16} r={7.5} fill={accent} />
          <circle cx={47} cy={16} r={7.5} fill={accent} />
          <circle cx={17} cy={16} r={3.4} fill="#fff" opacity={0.45} />
          <circle cx={47} cy={16} r={3.4} fill="#fff" opacity={0.45} />
          <circle cx={32} cy={36} r={24} fill={accent} />
          <clipPath id={clip}>
            <circle cx={32} cy={36} r={18} />
          </clipPath>
          {picture ? (
            <image
              href={picture}
              x={14}
              y={18}
              width={36}
              height={36}
              preserveAspectRatio="xMidYMin slice"
              clipPath={`url(#${clip})`}
            />
          ) : (
            <>
              <circle cx={32} cy={36} r={18} fill="#fff" opacity={0.28} />
              <text
                x={32}
                y={42.5}
                textAnchor="middle"
                fontSize={li && initialsOf(li.name).length > 1 ? 16 : 19}
                fontWeight={700}
                fill={INK}
                style={{ fontFamily: "var(--of-font-display)" }}
              >
                {li ? initialsOf(li.name) : "?"}
              </text>
            </>
          )}
          <circle
            cx={32}
            cy={36}
            r={21}
            fill="none"
            stroke="#fff"
            strokeWidth={1.4}
            strokeDasharray="2.6 2.4"
            opacity={0.8}
          />
          <ellipse cx={13.5} cy={45} rx={3} ry={2} fill={BLUSH} opacity={0.6} />
          <ellipse cx={50.5} cy={45} rx={3} ry={2} fill={BLUSH} opacity={0.6} />
          <ellipse cx={22} cy={20} rx={6} ry={3.4} fill="#fff" opacity={0.3} transform="rotate(-30 22 20)" />
        </g>
      )}
    </svg>
  );
}

/** A plush's name: the series name, or "{{name}} plush" for a love interest's own. */
export function usePlushName() {
  const { t } = useTranslation();
  return (prize: string, lis: ReadonlyArray<Pick<RunLiView, "id" | "name">>) => {
    const series = (PLUSH_SERIES as readonly string[]).includes(prize) ? (prize as PlushSeries) : null;
    if (series) return t(PLUSH_NAME_KEYS[series]);
    const owner = lis.find((li) => li.id === plushLi(prize));
    return t("ui.otomeForge.claw.plushOf", { name: owner?.name ?? "" });
  };
}

interface PlushShelfProps {
  /** Prize id → how many the protagonist owns. */
  plush: Record<string, number>;
  lis: Array<RunLiView & { plush?: string }>;
  /** Prizes a round just added: they wear a "New" ribbon. */
  fresh?: readonly string[];
  /** The id of the shelf's visible heading, which names the list. */
  labelledBy?: string;
}

/** The plush shelf: every series plush and each love interest's own, won (with a count) or still a silhouette. */
export function PlushShelf({ plush, lis, fresh = [], labelledBy }: PlushShelfProps) {
  const { t } = useTranslation();
  const nameOf = usePlushName();
  const slots = [...PLUSH_SERIES, ...lis.map((li) => liPlushId(li.id))];
  return (
    <ul className="of-shelf" aria-labelledby={labelledBy}>
      {slots.map((prize) => {
        const count = plush[prize] ?? 0;
        const owner = lis.find((li) => li.id === plushLi(prize)) ?? null;
        const isNew = fresh.includes(prize);
        const name = nameOf(prize, lis);
        return (
          <li key={prize} className="of-shelf-slot" data-owned={count > 0} data-new={isNew || undefined}>
            <PlushArt prize={prize} li={owner} className="of-shelf-plush" />
            {count > 1 ? (
              <span className="of-shelf-count" aria-hidden="true">
                ×{count}
              </span>
            ) : null}
            {isNew ? (
              <span className="of-shelf-new" aria-hidden="true">
                {t("ui.otomeForge.claw.shelfNew")}
              </span>
            ) : null}
            <span className="of-visually-hidden">
              {count > 0
                ? t("ui.otomeForge.claw.shelfOwned", { name, count })
                : t("ui.otomeForge.claw.shelfMissing", { name })}
              {isNew ? ` ${t("ui.otomeForge.claw.shelfNew")}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
