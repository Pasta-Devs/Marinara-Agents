// ──────────────────────────────────────────────
// Otome Forge: a wish's results, one card or ten, each in its rarity's frame, with a NEW ribbon on a first copy and the
// Starlight a repeat gave back. A card opens the item's page here (ItemDetail, which the Album reuses): its first open
// (the story it writes and the art it paints, with their cost), Paint or Try again for held or failed art, Read for its
// story, and the Wardrobe for a look.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useSpriteDisplay } from "../../hooks/use-sprite-display";
import { BookOpen, ChevronLeft, Feather, Paintbrush, RotateCcw, Shirt, Sparkle, Star } from "lucide-react";
import { CostHint } from "../../components/CostHint";
import { PromptReviewDialog } from "../../components/PromptReviewDialog";
import {
  imagesOn,
  needsOpen,
  paintWaits,
  paintsOnOpen,
  readyArt,
  useRefocus,
  writesOnOpen,
  type ItemActions,
} from "../../hooks/use-items";
import { useOtomeAudio, useAudioSnapshot } from "../../hooks/use-otome-audio";
import { accentOf, initialsOf } from "../../lib/accent";
import { useOtomeProps } from "../../props";
import type { RunLiView, RunView } from "../../shared/api-types";
import { isLookKind, type ItemKind, type ItemView, type PullResult, type Rarity } from "../../shared/wish";
import { RARITY_NAMES } from "./SealedLetter";

const KIND_KEYS: Record<ItemKind, string> = {
  memory5: "ui.otomeForge.wish.kindMemory",
  moment4: "ui.otomeForge.wish.kindMoment",
  snapshot3: "ui.otomeForge.wish.kindSnapshot",
  "his-look5": "ui.otomeForge.wish.kindTheirLook",
  "his-look4": "ui.otomeForge.wish.kindTheirLook",
  "her-look5": "ui.otomeForge.wish.kindMyLook",
  "her-look4": "ui.otomeForge.wish.kindMyLook",
};

const RARITY_KEYS: Record<Rarity, string> = {
  3: "ui.otomeForge.wish.rarity3",
  4: "ui.otomeForge.wish.rarity4",
  5: "ui.otomeForge.wish.rarity5",
};

/** Whose item it is: the love interest it is about, or null for the protagonist's own look. */
export function itemPerson(item: Pick<ItemView, "li" | "kind">, view: RunView): RunLiView | null {
  return item.kind.startsWith("her-look") && !item.li ? null : (view.lis.find((li) => li.id === item.li) ?? null);
}

export function useKindLabel() {
  const { t } = useTranslation();
  return (item: Pick<ItemView, "kind" | "li">, view: RunView) => {
    const li = itemPerson(item, view);
    return t(KIND_KEYS[item.kind], { name: li?.name ?? "" });
  };
}

/** Stars for a rarity, read as "5★" by screen readers. */
export function RarityStars({ rarity }: { rarity: Rarity }) {
  const { t } = useTranslation();
  return (
    <span className="of-stars" data-rarity={RARITY_NAMES[rarity]} role="img" aria-label={t(RARITY_KEYS[rarity])}>
      {Array.from({ length: rarity }, (_, index) => (
        <Star key={index} size={11} strokeWidth={0} fill="currentColor" aria-hidden="true" />
      ))}
    </span>
  );
}

/** The item's picture: its ready art, or a quiet card in the person's colour with their initials. */
export function ItemArt({ item, view, fallbackUrl }: { item: ItemView; view: RunView; fallbackUrl?: string | null }) {
  const li = itemPerson(item, view);
  const name = li?.name ?? view.player.name;
  const look = isLookKind(item.kind);
  const url = useSpriteDisplay(readyArt(item.art) ?? fallbackUrl ?? null, look);
  const accent = li ? accentOf(li) : undefined;
  return (
    <span
      className="of-item-art"
      data-rarity={RARITY_NAMES[item.rarity]}
      data-look={look}
      data-painting={item.art?.state === "pending"}
      style={accent ? ({ "--of-li-accent": accent } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="of-item-initials">{initialsOf(name)}</span>
      )}
    </span>
  );
}

interface ItemDetailProps {
  view: RunView;
  item: ItemView;
  actions: ItemActions;
  /** The banner's art, shown for its featured item until the item's own is ready. */
  fallbackUrl?: string | null;
  onOpenStory?: (key: string) => void;
  onOpenWardrobe?: () => void;
  /** Where focus starts (the item's title, so a screen reader reads it). */
  autoFocus?: boolean;
}

/** An item's page: what it is, its art, and what can be done with it now. */
export function ItemDetail({
  view,
  item,
  actions,
  fallbackUrl,
  onOpenStory,
  onOpenWardrobe,
  autoFocus,
}: ItemDetailProps) {
  const { t } = useTranslation();
  const kindLabel = useKindLabel();
  const audio = useOtomeAudio();
  const { speaking } = useAudioSnapshot();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const readRef = useRef<HTMLButtonElement>(null);
  const li = itemPerson(item, view);
  const images = imagesOn(view);
  const busy = actions.busy.has(item.id);
  const error = actions.errors[item.id] ?? null;
  const opening = needsOpen(item, images);
  const held = paintWaits(item.art);
  const voiceRef = `item:${item.id}`;
  // Open or Paint leaves once it is done: focus goes on to Read, or to the item's title.
  const onFocus = useRefocus(`${opening}|${held}`, () => readRef.current ?? titleRef.current);

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus({ preventScroll: true });
  }, [autoFocus, item.id]);

  // A page that closes takes its own line with it, not one another screen started.
  useEffect(
    () => () => {
      if (audio?.getSnapshot().speaking === voiceRef) audio.stopVoice();
    },
    [audio, voiceRef],
  );

  const lineSegment = item.voicedLine && li ? { speaker: li.name, text: item.voicedLine } : null;
  const canVoice = !!lineSegment && !!audio?.wouldSpeak(lineSegment);
  const story = item.story?.key ?? null;
  const lookKind = item.kind.includes("-look");

  return (
    <article className="of-item-detail" data-rarity={RARITY_NAMES[item.rarity]} onFocus={onFocus}>
      <ItemArt item={item} view={view} fallbackUrl={fallbackUrl} />
      <div className="of-item-body">
        <p className="of-item-kind">
          <RarityStars rarity={item.rarity} />
          <span>{kindLabel(item, view)}</span>
        </p>
        <h3 ref={titleRef} className="of-item-title" tabIndex={-1}>
          {item.look?.name || item.title}
        </h3>
        {li ? <p className="of-item-who">{t("ui.otomeForge.wish.with", { name: li.name })}</p> : null}
        {item.premise ? <p className="of-item-text">{item.premise}</p> : null}
        {item.text ? <p className="of-item-text of-item-text--snapshot">{item.text}</p> : null}
        {item.voicedLine ? (
          <blockquote className="of-item-line">
            <p>“{item.voicedLine}”</p>
            {canVoice && lineSegment ? (
              <button
                type="button"
                className="of-button of-button--text of-button--small"
                onClick={() => (speaking === voiceRef ? audio?.stopVoice() : void audio?.speak(lineSegment, voiceRef))}
              >
                {speaking === voiceRef
                  ? t("ui.otomeForge.audio.stopVoice")
                  : t("ui.otomeForge.audio.playVoice", { name: li?.name ?? "" })}
              </button>
            ) : null}
          </blockquote>
        ) : null}
        {item.art?.state === "pending" ? (
          <p className="of-hint" role="status">
            {t("ui.otomeForge.wish.painting")}
          </p>
        ) : null}
        {item.art?.state === "failed" ? <p className="of-hint">{t("ui.otomeForge.wish.paintFailed")}</p> : null}
        {item.art?.state === "stopped" ? <p className="of-hint">{t("ui.otomeForge.reader.cgStopped")}</p> : null}
        <div className="of-item-actions">
          {opening ? (
            <>
              <button
                type="button"
                className="of-button of-button--primary"
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) void actions.open(item);
                }}
              >
                <Sparkle size={16} strokeWidth={2} aria-hidden="true" />
                {busy ? t("ui.otomeForge.wish.opening") : t("ui.otomeForge.wish.open")}
              </button>
              <OpenCost item={item} images={images} ask={view.world.images.ask} />
            </>
          ) : null}
          {!opening && held ? (
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) void actions.paintItem(item);
                }}
              >
                {item.art?.state === "waiting-consent" ? (
                  <Paintbrush size={16} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                )}
                {item.art?.state === "waiting-consent"
                  ? t("ui.otomeForge.wish.paint")
                  : t("ui.otomeForge.wish.paintRetry")}
              </button>
              <CostHint images={1} />
            </>
          ) : null}
          {/* A story written before there was an image connection reads while its art still waits for an open. */}
          {story && onOpenStory ? (
            <button
              ref={readRef}
              type="button"
              className="of-button of-button--primary"
              onClick={() => onOpenStory(story)}
            >
              <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
              {lookKind ? t("ui.otomeForge.wish.readFirstWear") : t("ui.otomeForge.wish.read")}
            </button>
          ) : null}
          {lookKind && item.owned && onOpenWardrobe ? (
            <button type="button" className="of-button of-button--quiet of-glass" onClick={onOpenWardrobe}>
              <Shirt size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.wish.toWardrobe")}
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="of-notice of-notice--error" role="alert">
            {error}
          </p>
        ) : null}
        <span className="of-visually-hidden" aria-live="polite">
          {busy ? t("ui.otomeForge.wish.opening") : ""}
        </span>
      </div>
    </article>
  );
}

/** The prompt of a paint waiting for review (the Engine's "Review image prompts before sending"), when one is. */
export function PaintReviewDialog({ actions }: { actions: ItemActions }) {
  const { review } = actions;
  if (!review) return null;
  return (
    <PromptReviewDialog
      subject={review.target.subject}
      initial={review.initial}
      busy={review.busy}
      error={review.error}
      onSend={actions.sendReview}
      onSkip={actions.skipReview}
    />
  );
}

/**
 * What a first open costs: the story it writes (a model call) and the art it paints, unless Ask holds it. A look's
 * faces are not painted on open but when it is worn (the Wardrobe's Wear carries that cost).
 */
export function OpenCost({ item, images, ask }: { item: ItemView; images: boolean; ask: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="of-item-cost">
      {writesOnOpen(item) && !item.story ? (
        <p className="of-cost">
          <Feather size={14} strokeWidth={2} aria-hidden="true" />
          <span>
            {item.kind === "memory5" ? t("ui.otomeForge.wish.costStory") : t("ui.otomeForge.wish.costScene")}
            <span className="of-cost-note"> · {t("ui.otomeForge.wish.costStoryNote")}</span>
          </span>
        </p>
      ) : null}
      {paintsOnOpen(item, images) && !item.art ? (
        <CostHint images={1} note={ask ? t("ui.otomeForge.wish.costAskNote") : undefined} />
      ) : null}
    </div>
  );
}

interface TenPullGridProps {
  view: RunView;
  results: PullResult[];
  /** The newest copy of an item (the wish view refetches after an open or a paint). */
  resolve: (item: ItemView) => ItemView;
  /** The Starlight the wish cost. */
  spent: number;
  actions: ItemActions;
  /** The banner's art, for its featured item until the item's own is ready. */
  bannerArt: string | null;
  reducedMotion: boolean;
  onDone: () => void;
  onOpenStory?: (key: string) => void;
  onOpenWardrobe?: () => void;
}

export function TenPullGrid({
  view,
  results,
  resolve,
  spent,
  actions,
  bannerArt,
  reducedMotion,
  onDone,
  onOpenStory,
  onOpenWardrobe,
}: TenPullGridProps) {
  const { t } = useTranslation();
  const kindLabel = useKindLabel();
  const { locale } = useOtomeProps().localization;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [shown, setShown] = useState<number | null>(null);
  const back = useRef<number | null>(null);
  const number = new Intl.NumberFormat(locale);
  const refunded = results.reduce((sum, result) => sum + result.refund, 0);

  // Focus starts on the heading (it names what arrived), and comes back to the card a page was opened from.
  useEffect(() => {
    if (shown !== null) return;
    const from = back.current;
    back.current = null;
    (from === null ? headingRef.current : tileRefs.current[from])?.focus({ preventScroll: true });
  }, [shown]);

  if (shown !== null && results[shown]) {
    const result = results[shown];
    return (
      <div className="of-pulls of-pulls--detail">
        <button
          type="button"
          className="of-button of-button--text of-pulls-back"
          onClick={() => {
            back.current = shown;
            setShown(null);
          }}
        >
          <ChevronLeft className="of-back-icon" size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.wish.backToResults")}
        </button>
        <ItemDetail
          view={view}
          item={resolve(result.item)}
          actions={actions}
          fallbackUrl={result.rarity === 5 ? bannerArt : null}
          onOpenStory={onOpenStory}
          onOpenWardrobe={onOpenWardrobe}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="of-pulls" data-count={results.length} data-motion={!reducedMotion}>
      <h2 ref={headingRef} className="of-pulls-title" tabIndex={-1}>
        {results.length > 1 ? t("ui.otomeForge.wish.resultsTitleMany") : t("ui.otomeForge.wish.resultsTitleOne")}
      </h2>
      <p className="of-pulls-summary">
        {t("ui.otomeForge.wish.spent", { amount: number.format(spent) })}
        {refunded ? (
          <span className="of-pulls-refund">
            {" "}
            · {t("ui.otomeForge.wish.refunded", { amount: number.format(refunded) })}
          </span>
        ) : null}
      </p>
      <ul className="of-pulls-grid">
        {results.map((result, index) => {
          const item = resolve(result.item);
          const title = item.look?.name || item.title;
          return (
            <li key={`${result.item.id}-${index}`} style={{ "--of-i": index } as CSSProperties}>
              <button
                ref={(element) => {
                  tileRefs.current[index] = element;
                }}
                type="button"
                className="of-pull-tile"
                data-rarity={RARITY_NAMES[result.rarity]}
                onClick={() => setShown(index)}
              >
                <ItemArt item={item} view={view} fallbackUrl={result.rarity === 5 ? bannerArt : null} />
                {result.isNew ? (
                  <span className="of-ribbon">{t("ui.otomeForge.wish.new")}</span>
                ) : (
                  <span className="of-pull-refund">
                    <Sparkle size={10} strokeWidth={0} fill="currentColor" aria-hidden="true" />
                    {t("ui.otomeForge.wish.refundChip", { amount: number.format(result.refund) })}
                  </span>
                )}
                <span className="of-pull-tile-text">
                  <RarityStars rarity={result.rarity} />
                  <span className="of-pull-tile-title">{title}</span>
                  <span className="of-pull-tile-kind">{kindLabel(item, view)}</span>
                </span>
                <span className="of-visually-hidden">
                  {result.isNew
                    ? t("ui.otomeForge.wish.newLabel")
                    : t("ui.otomeForge.wish.repeatLabel", { amount: number.format(result.refund) })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="of-pulls-actions">
        <button type="button" className="of-button of-button--primary" onClick={onDone}>
          {t("ui.otomeForge.wish.done")}
        </button>
      </div>
    </div>
  );
}
