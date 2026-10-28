// ──────────────────────────────────────────────
// Otome Forge: a 5★ arrives. The stage dims and gathers gold for 600 ms; then a stock UI sound from the Engine's
// library plays, the art pans slowly (the item's own, or its banner's), the title rises in serif and, once the item has
// been opened, the line in their voice plays. Its first open (the story it writes, the art it paints) is offered here
// with its cost, never started by the reveal. Under reduced motion everything shows at once, with no pan.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Sparkle, Sparkles } from "lucide-react";
import { imagesOn, needsOpen, readyArt, useRefocus, type ItemActions } from "../../hooks/use-items";
import { useOtomeAudio } from "../../hooks/use-otome-audio";
import { accentOf, initialsOf } from "../../lib/accent";
import type { RunView } from "../../shared/api-types";
import type { ItemView } from "../../shared/wish";
import { itemPerson, OpenCost, RarityStars, useKindLabel } from "./TenPullGrid";

/** The dim before the reveal. */
export const REVEAL_HOLD_MS = 600;
export const REVEAL_SOUND = "sfx:ui:notification";

interface Reveal5Props {
  view: RunView;
  item: ItemView;
  isNew: boolean;
  /** The banner's art, shown until the item's own is ready. */
  fallbackUrl: string | null;
  /** "1 of 2" when one wish brought more than one. */
  position: { index: number; total: number } | null;
  actions: ItemActions;
  reducedMotion: boolean;
  onContinue: () => void;
}

export function Reveal5({
  view,
  item,
  isNew,
  fallbackUrl,
  position,
  actions,
  reducedMotion,
  onContinue,
}: Reveal5Props) {
  const { t } = useTranslation();
  const kindLabel = useKindLabel();
  const audio = useOtomeAudio();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(reducedMotion);
  const spoken = useRef<string | null>(null);
  const li = itemPerson(item, view);
  const url = readyArt(item.art) ?? fallbackUrl;
  const title = item.look?.name || item.title;
  const busy = actions.busy.has(item.id);
  const opening = needsOpen(item, imagesOn(view));
  // Once opened, "Open it now" leaves: focus goes on to Continue, inside the takeover, so Escape and Tab still work.
  const onFocus = useRefocus(String(opening), () => continueRef.current);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    if (reducedMotion) {
      setShown(true);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), REVEAL_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [item.id, reducedMotion]);

  useEffect(() => {
    if (shown) audio?.playSfx(REVEAL_SOUND);
  }, [audio, shown]);

  // The voiced line, once per line: when it is shown, or as soon as an open here brings it.
  useEffect(() => {
    if (!shown || !li || !item.voicedLine || spoken.current === item.voicedLine) return;
    spoken.current = item.voicedLine;
    void audio?.speak({ speaker: li.name, text: item.voicedLine }, `item:${item.id}`);
  }, [audio, item.id, item.voicedLine, li, shown]);

  // A reveal that leaves takes its voice with it.
  useEffect(() => () => audio?.stopVoice(), [audio]);

  const accent = li ? accentOf(li) : undefined;
  return (
    <div
      className="of-reveal"
      onFocus={onFocus}
      data-shown={shown}
      data-motion={!reducedMotion}
      style={accent ? ({ "--of-li-accent": accent } as CSSProperties) : undefined}
    >
      <div className="of-reveal-art" aria-hidden="true">
        {url ? (
          <img src={url} alt="" decoding="async" />
        ) : (
          <span className="of-reveal-quiet">
            <span className="of-item-initials">{initialsOf(li?.name ?? view.player.name)}</span>
          </span>
        )}
      </div>
      <div className="of-reveal-glow" aria-hidden="true" />
      <div className="of-reveal-card">
        {position ? <p className="of-reveal-count">{t("ui.otomeForge.wish.revealCount", position)}</p> : null}
        <p className="of-reveal-kind">
          <RarityStars rarity={5} />
          <span>{kindLabel(item, view)}</span>
          {isNew ? <span className="of-ribbon of-ribbon--inline">{t("ui.otomeForge.wish.new")}</span> : null}
        </p>
        <h2 ref={headingRef} className="of-reveal-title" tabIndex={-1}>
          {title}
        </h2>
        {li ? <p className="of-reveal-who">{li.name}</p> : null}
        {item.voicedLine ? <p className="of-reveal-line">“{item.voicedLine}”</p> : null}
        {item.premise && !item.voicedLine ? <p className="of-reveal-premise">{item.premise}</p> : null}
        <div className="of-reveal-actions">
          {opening ? (
            <div className="of-reveal-open">
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) void actions.open(item);
                }}
              >
                <Sparkle size={16} strokeWidth={2} aria-hidden="true" />
                {busy ? t("ui.otomeForge.wish.opening") : t("ui.otomeForge.wish.openNow")}
              </button>
              <OpenCost item={item} images={imagesOn(view)} ask={view.world.images.ask} />
            </div>
          ) : null}
          <button ref={continueRef} type="button" className="of-button of-button--primary" onClick={onContinue}>
            <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.wish.continue")}
            <ChevronRight className="of-back-icon" size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {actions.errors[item.id] ? (
          <p className="of-notice of-notice--error" role="alert">
            {actions.errors[item.id]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
