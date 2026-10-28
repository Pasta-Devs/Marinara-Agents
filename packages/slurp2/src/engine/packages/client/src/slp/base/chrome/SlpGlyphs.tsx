// ──────────────────────────────────────────────
// Slurp's own glyphs (design language §5, de-vibe pass): the bottom nav, like, lock and the ✦
// sparkle. One grid (24), one stroke (1.75, round caps and joins), soft candy shapes. `filled` is
// the active state: the shape fills and its small inner mark (heart, star) is cut out of it. In the
// outline state the inner mark is solid, so it reads at 16 px.
//
// They take Lucide's props and ref, so a glyph drops in wherever a Lucide icon is expected
// (`icon={SlpSparkleGlyph}`). Lucide stays for small utility icons.
// ──────────────────────────────────────────────
import { forwardRef, type ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "../../../lib/utils";

/**
 * The ✦ four-point star, centred on (cx, cy), radius r. The same curve as the sparkle particles
 * (`slp-sparkle-styles.ts`), so every star in Slurp is one shape; `plump` (the glyphs) pulls the
 * sides out a little so a 1.75 stroke does not look spindly at 16 px.
 */
export function slpStarPath(cx: number, cy: number, r: number, plump = false) {
  const a = plump ? r * 0.14 : r / 12;
  const b = plump ? r * 0.4 : r / 3;
  return (
    `M${cx} ${cy - r}C${cx + a} ${cy - b} ${cx + b} ${cy - a} ${cx + r} ${cy}` +
    `C${cx + b} ${cy + a} ${cx + a} ${cy + b} ${cx} ${cy + r}` +
    `C${cx - a} ${cy + b} ${cx - b} ${cy + a} ${cx - r} ${cy}` +
    `C${cx - b} ${cy - a} ${cx - a} ${cy - b} ${cx} ${cy - r}Z`
  );
}

export type SlpGlyphProps = LucideProps & { filled?: boolean };

function slpGlyph(name: string, draw: (filled: boolean) => ReactNode) {
  const Glyph = forwardRef<SVGSVGElement, SlpGlyphProps>(
    (
      {
        size = 24,
        strokeWidth = 1.75,
        color = "currentColor",
        filled = false,
        absoluteStrokeWidth: _abs,
        className,
        children,
        ...props
      },
      ref,
    ) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={props["aria-label"] ? undefined : true}
        data-slp-glyph={name}
        className={cn("slp-glyph", className)}
        {...props}
      >
        {draw(filled)}
        {children}
      </svg>
    ),
  );
  Glyph.displayName = `Slp${name}Glyph`;
  return Glyph;
}

/** A shape that fills in the active state, with `hole` cut out of the fill (never stroked). */
function shape(outline: string, filled: boolean, hole?: string) {
  return (
    <>
      {filled && <path d={hole ? `${outline}${hole}` : outline} fill="currentColor" fillRule="evenodd" stroke="none" />}
      <path d={outline} />
      {hole && !filled && <path d={hole} fill="currentColor" stroke="none" />}
    </>
  );
}

const HEART = "M12 20.5S3.5 15.4 3.5 9.4a4.6 4.6 0 0 1 8.5-2.5 4.6 4.6 0 0 1 8.5 2.5c0 6-8.5 11.1-8.5 11.1Z";
/** Hub: the ramen bowl with two curls of steam. */
export const SlpHubGlyph = slpGlyph("Hub", (filled) => (
  <>
    {shape("M3.5 11.25h17c0 3.4-2.1 6-5 7l.5 2.5H8l.5-2.5c-2.9-1-5-3.6-5-7Z", filled)}
    <path d="M9 3.25c-.9.9-.9 1.85 0 2.75s.9 1.85 0 2.75M13.25 3.25c-.9.9-.9 1.85 0 2.75s.9 1.85 0 2.75" />
    <path d="M15.75 9.25 20.5 4.5" />
  </>
));

/** Profile: head and shoulders, with a ✦ on the shoulder, because every profile here is a creator's. */
export const SlpProfileGlyph = slpGlyph("Profile", (filled) => (
  <>
    {shape("M15.75 8.25a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z", filled)}
    {shape("M4.75 20.25c.75-3.75 3.75-6 7.25-6s6.5 2.25 7.25 6Z", filled)}
    <path d={slpStarPath(19.25, 5, 2.75, true)} fill="currentColor" stroke="none" />
  </>
));

/** Inbox: a speech bubble with a small heart in it. */
export const SlpInboxGlyph = slpGlyph("Inbox", (filled) =>
  shape(
    "M12 3.75c4.75 0 8.5 3.2 8.5 7.25s-3.75 7.25-8.5 7.25c-.95 0-1.86-.13-2.7-.36L5 19.75l1.05-3.55C4.52 14.9 3.5 13.05 3.5 11c0-4.05 3.75-7.25 8.5-7.25Z",
    filled,
    "M12 13.9c-.2 0-3.15-1.8-3.15-3.8a1.6 1.6 0 0 1 3.15-.85 1.6 1.6 0 0 1 3.15.85c0 2-2.95 3.8-3.15 3.8Z",
  ),
);

/** Discover: a lens with a ✦ in it. */
export const SlpDiscoverGlyph = slpGlyph("Discover", (filled) => (
  <>
    {shape("M17.5 10.75a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z", filled, slpStarPath(10.75, 10.75, 3.6, true))}
    <path d="M15.75 15.75 20.25 20.25" />
  </>
));

/** More: three soft tiles and a ✦. */
export const SlpMoreGlyph = slpGlyph("More", (filled) => (
  <>
    {shape("M4 6.5A2.5 2.5 0 0 1 6.5 4h1A2.5 2.5 0 0 1 10 6.5v1A2.5 2.5 0 0 1 7.5 10h-1A2.5 2.5 0 0 1 4 7.5Z", filled)}
    {shape(
      "M4 16.5A2.5 2.5 0 0 1 6.5 14h1a2.5 2.5 0 0 1 2.5 2.5v1A2.5 2.5 0 0 1 7.5 20h-1A2.5 2.5 0 0 1 4 17.5Z",
      filled,
    )}
    {shape(
      "M14 16.5a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 2.5 2.5v1a2.5 2.5 0 0 1-2.5 2.5h-1a2.5 2.5 0 0 1-2.5-2.5Z",
      filled,
    )}
    <path d={slpStarPath(17, 7, 3.75, true)} fill={filled ? "currentColor" : "none"} />
  </>
));

/** Like: the plump candy heart (the same heart the Pop throws). */
export const SlpHeartGlyph = slpGlyph("Heart", (filled) => shape(HEART, filled));

/** Lock: a soft padlock with a heart for a keyhole. */
export const SlpLockGlyph = slpGlyph("Lock", (filled) => (
  <>
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    {shape(
      "M7.25 10.5h9.5A3.25 3.25 0 0 1 20 13.75v3.5a3.25 3.25 0 0 1-3.25 3.25h-9.5A3.25 3.25 0 0 1 4 17.25v-3.5a3.25 3.25 0 0 1 3.25-3.25Z",
      filled,
      "M12 17.75c-.15 0-2.4-1.35-2.4-2.9a1.25 1.25 0 0 1 2.4-.65 1.25 1.25 0 0 1 2.4.65c0 1.55-2.25 2.9-2.4 2.9Z",
    )}
  </>
));

/** ✦ Slurp's sparkle: one big star and one small one. Replaces Lucide's `Sparkles`. */
export const SlpSparkleGlyph = slpGlyph("Sparkle", (filled) => (
  <>
    <path d={slpStarPath(10, 13.5, 8.5, true)} fill={filled ? "currentColor" : "none"} />
    <path d={slpStarPath(18.75, 5.25, 3.5, true)} fill="currentColor" stroke="none" />
  </>
));

/**
 * Stir (W): a wooden-spoon silhouette, tipped as if it stirs the pot: an egg-shaped bowl, a narrow
 * neck and a handle with a rounded end, drawn upright and turned 45°. The whole spoon fills when
 * active; the small ✦ keeps it in the family.
 */
const SPOON =
  "M12 1.75C13 1.75 13.6 2.4 13.5 3.4L12.8 12.3C14.6 12.8 15.6 14.8 15.6 17.2C15.6 20 14 22.25 12 22.25C10 22.25 8.4 20 8.4 17.2C8.4 14.8 9.4 12.8 11.2 12.3L10.5 3.4C10.4 2.4 11 1.75 12 1.75Z";
export const SlpStirGlyph = slpGlyph("Stir", (filled) => (
  <>
    <g transform="rotate(45 12 12)">{shape(SPOON, filled)}</g>
    <path d={slpStarPath(6.25, 4.75, 2.6, true)} fill="currentColor" stroke="none" />
  </>
));
