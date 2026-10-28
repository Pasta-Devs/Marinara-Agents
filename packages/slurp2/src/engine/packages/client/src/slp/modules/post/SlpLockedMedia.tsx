import type { CSSProperties } from "react";
import { Image as ImageIcon, Images } from "lucide-react";
import { SlpLockGlyph } from "../../base/chrome/SlpGlyphs";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import { slpImgFade } from "../../base/chrome/SlpChrome";
import { SlurpCoinAmount } from "../coin/SlpCoin";
import { SlpRingGlint, SlpTwinkle } from "../sparkle/SlpSparkle";

// The shared locked media (design language §7 "Locked media tile"): the sparkle lock badge and the
// locked picture as a grid tile. Used by the locked post card, the profile Media tab and the paywall card.

/**
 * The lock as a signature badge: a frosted glass disc inside a hero-gradient ring with a glint, and
 * one sparkle on its shoulder. Shared by the locked card and the locked media tile.
 */
export function SlpSparkleLock({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "relative isolate flex items-center justify-center rounded-full bg-white/15 text-white shadow-[0_10px_28px_-10px_rgba(0,0,0,0.85),inset_0_1px_0_rgb(255_255_255/0.3)] backdrop-blur-md [&_svg]:!text-white",
        small ? "h-9 w-9" : "h-14 w-14",
      )}
      aria-hidden="true"
    >
      <SlpLockGlyph size={small ? 16 : 22} strokeWidth={2.25} />
      <SlpRingGlint />
      <SlpTwinkle points={[{ x: small ? "70%" : "74%", y: small ? "-6px" : "-4px", size: small ? 9 : 12 }]} />
    </span>
  );
}

/**
 * A locked picture as a grid tile (profile Media tab, paywall card): the blurred teaser under the
 * Sparkle Veil, the sparkle lock and the unlock price.
 */
export function SlpLockedMediaTile({
  imageUrl,
  unlockPrice,
  label,
  onOpen,
  className,
  style,
}: {
  imageUrl: string | null;
  unlockPrice?: number | null;
  label: string;
  onOpen?: () => void;
  className?: string;
  /** A frame in the post's own ratio (V: shared-post cards). */
  style?: CSSProperties;
}) {
  const { src, observe } = useNearViewportSlurpMediaSrc(imageUrl, { width: 480 });
  const frame = cn(
    "relative isolate block aspect-square overflow-hidden bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--noodle-accent)_45%,transparent),var(--slurp-media-stage,#17131a)_75%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]",
    className,
  );
  const content = (
    <>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          {...slpImgFade}
          className="slp-crop-top h-full w-full scale-110 object-cover blur-[8px]"
        />
      )}
      <span
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(8,4,10,0.1),rgba(8,4,10,0.55)_85%)]"
        aria-hidden="true"
      />
      <SlurpSparkleVeil />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <SlpSparkleLock small />
        {typeof unlockPrice === "number" && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[var(--noodle-accent)] px-2 text-[11px] font-extrabold tabular-nums text-[var(--slurp-on-accent)] shadow-[0_4px_14px_-4px_var(--noodle-accent)]">
            <SlurpCoinAmount amount={unlockPrice} />
          </span>
        )}
      </span>
    </>
  );
  return onOpen ? (
    <button ref={observe} type="button" onClick={onOpen} aria-label={label} className={frame} style={style}>
      {content}
    </button>
  ) : (
    <span ref={observe} className={frame} style={style}>
      {content}
    </span>
  );
}

/** Where the price pill's twinkles land (round the pill, never on its text). */
export const SLP_PILL_TWINKLES = [
  { x: "-14px", y: "-8px", size: 11 },
  { x: "calc(100% + 4px)", y: "-10px", size: 8 },
  { x: "calc(100% + 8px)", y: "calc(100% - 6px)", size: 12 },
  { x: "-8px", y: "calc(100% - 2px)", size: 7 },
];

/** What is behind the veil, said plainly ("4 photos"), bottom-left on the locked picture. */
export function SlpLockedContentsChip({ count }: { count: number }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <span className="pointer-events-none absolute bottom-3 start-3 z-10 inline-flex h-7 items-center gap-1.5 rounded-full bg-black/40 px-2.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] ring-1 ring-inset ring-white/20 backdrop-blur-md [&_svg]:!text-white">
      {count > 1 ? <Images size={14} aria-hidden="true" /> : <ImageIcon size={14} aria-hidden="true" />}
      {localizeUi("ui.slurp.locked.photos", { count, defaultValue: "{{count}} photos" })}
    </span>
  );
}
