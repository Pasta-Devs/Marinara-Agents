// ──────────────────────────────────────────────
// Otome Forge: a story CG takes over the stage (plan M2b, design "CG moments"). The reader's UI fades, letterbox bars
// close in, and the image pans slowly for about 6 s; then the bars open, the box returns at 80% and the image stays
// behind the rest of the beat. A tap anywhere, Enter or Space ends the pan at once; under reduced motion there is no pan
// and the box is back straight away. While it plays the faded UI is inert and the picture holds focus (tabIndex −1),
// so nothing unseen can be pressed. When the pan ends the reader marks the CG seen (the server unlocks it in the Album).
// ──────────────────────────────────────────────
import { forwardRef, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/** How long the pan holds the stage before the box returns. */
export const CG_PAN_MS = 6_000;

interface CgTakeoverProps {
  url: string;
  /** Who is in it, for its accessible name. */
  names: string[];
  /** The pan is playing (the reader's UI is faded); false once it has ended. */
  intro: boolean;
  reducedMotion: boolean;
  /** The pan ended (by itself, or because the player went on). */
  onIntroEnd: () => void;
  /** Whether its picture loaded (the reader then shows the brief in place of one that failed). */
  onArtStatus?: (url: string, loaded: boolean) => void;
}

export const CgTakeover = forwardRef<HTMLElement, CgTakeoverProps>(function CgTakeover(
  { url, names, intro, reducedMotion, onIntroEnd, onArtStatus },
  ref,
) {
  const { t } = useTranslation();
  const ended = useRef(onIntroEnd);
  ended.current = onIntroEnd;
  useEffect(() => {
    if (!intro) return;
    const timer = window.setTimeout(() => ended.current(), reducedMotion ? 0 : CG_PAN_MS);
    return () => window.clearTimeout(timer);
  }, [intro, reducedMotion]);
  const label = names.length
    ? t("ui.otomeForge.reader.cgLabel", { names: names.join(", ") })
    : t("ui.otomeForge.reader.cgLabelPlain");
  return (
    <figure
      ref={ref}
      className="of-cg"
      data-intro={intro}
      role="img"
      aria-label={label}
      tabIndex={-1}
      // The faded header and box let taps through to the picture: a tap anywhere ends the pan.
      onClick={intro ? onIntroEnd : undefined}
    >
      <img
        className="of-cg-img"
        src={url}
        alt=""
        decoding="async"
        onLoad={() => onArtStatus?.(url, true)}
        onError={() => onArtStatus?.(url, false)}
      />
      <span className="of-cg-bar of-cg-bar--top" aria-hidden="true" />
      <span className="of-cg-bar of-cg-bar--bottom" aria-hidden="true" />
    </figure>
  );
});
