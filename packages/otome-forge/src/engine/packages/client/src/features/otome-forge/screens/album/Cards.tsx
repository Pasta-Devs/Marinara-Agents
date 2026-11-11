// ──────────────────────────────────────────────
// Otome Hearth: the Album's Cards (#2151): every card of the Tarot deck, the cards drawn at Tarot night, in Arcana
// order, then by love interest in cast order, each drawn with Tarot night's own face (components/TarotCard.tsx
// TarotFace: the painted picture once it is ready, our gold emblem until then). A card of the love interest, or of the
// two of you, is labelled with whose it is ("The Lovers · Ren"). A painted card opens large in the Album's viewer, to
// step through and save as a CG is (CgViewer); one still painting wears Tarot night's "Painting…" badge (the Album
// reads itself again meanwhile); one held for consent, failed or stopped offers Paint it or Try painting it again with
// its cost, through Tarot night's own paint tap (hooks/use-items tarotPaintTarget, with the Engine's prompt review),
// held in place while its tap runs. Without an image connection there are no paint controls.
// ──────────────────────────────────────────────
// Route: GET /runs/:run/album's `cards` (S/routes/album.ts); a tap POSTs /runs/:run/art/tarot {li, card}.
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { MoonStar, Paintbrush, RotateCcw } from "lucide-react";
import { CostHint } from "../../components/CostHint";
import { ARCANA_NAME_KEYS, TarotFace } from "../../components/TarotCard";
import { imagesOn, paintWaits, readyArt, tarotPaintTarget, type ItemActions } from "../../hooks/use-items";
import type { RunView } from "../../shared/api-types";
import type { AlbumCard, AlbumImage } from "../../shared/wardrobe";

/** The Album's cards with their labels ("The Lovers · Ren"), and the painted ones as viewer images (`card:<key>`). */
export function useCardImages(view: RunView, cards: readonly AlbumCard[]) {
  const { t } = useTranslation();
  const tiles = cards.map((card) => {
    const name = t(ARCANA_NAME_KEYS[card.card]);
    const li = card.li ? view.lis.find((item) => item.id === card.li) : undefined;
    return { card, title: li ? t("ui.otomeForge.album.cardOf", { card: name, name: li.name }) : name };
  });
  const images = tiles.flatMap(({ card, title }): AlbumImage[] => {
    const url = readyArt(card.art);
    if (!url) return [];
    return [
      { key: `card:${card.key}`, url, at: card.art.at, source: "card", title, ...(card.li ? { li: card.li } : {}) },
    ];
  });
  return { tiles, images };
}

interface CardGridProps {
  runKey: string;
  view: RunView;
  cards: ReturnType<typeof useCardImages>;
  actions: ItemActions;
  /** Opens a painted card in the viewer, by its image key. */
  onView: (key: string) => void;
}

/** The deck's drawn cards (see the header). */
export function CardGrid({ runKey, view, cards, actions, onView }: CardGridProps) {
  const { t } = useTranslation();
  const id = useId();
  const images = imagesOn(view);
  if (!cards.tiles.length) {
    return (
      <p className="of-empty of-glass">
        <MoonStar size={20} strokeWidth={1.8} aria-hidden="true" />
        {images ? t("ui.otomeForge.album.cardsEmpty") : t("ui.otomeForge.album.cardsNoImages")}
      </p>
    );
  }
  // A card of the story's one set is the same card whichever love interest asks for it: the first of the cast does.
  const asker = view.lis[0]?.id;
  return (
    <ul className="of-album-cgs of-album-cgs--card">
      {cards.tiles.map(({ card, title }) => {
        const url = readyArt(card.art);
        const li = card.li ?? asker;
        const target = li ? tarotPaintTarget(runKey, li, card.card, title) : null;
        const busy = !!target && actions.busy.has(target.id);
        const error = target ? actions.errors[target.id] : undefined;
        const titleId = `${id}-${card.key}`;
        const consent = card.art.state === "waiting-consent";
        // 0.24.0: a painted card can be painted again; its picture stays until the new one is saved.
        const repaint = !!url && card.art.state === "ready";
        return (
          <li key={card.key} className="of-album-card">
            {url ? (
              <button
                type="button"
                className="of-album-card-view"
                aria-label={t("ui.otomeForge.album.viewCg", { title })}
                onClick={() => onView(`card:${card.key}`)}
              >
                <span className="of-tarot-card">
                  <TarotFace card={card.card} art={url} />
                  {busy || card.art.state === "pending" ? (
                    <span className="of-tarot-badge" role="status">
                      {t("ui.otomeForge.wish.painting")}
                    </span>
                  ) : null}
                </span>
                <span id={titleId} className="of-album-cg-title" aria-hidden="true">
                  {title}
                </span>
              </button>
            ) : (
              <>
                <span className="of-tarot-card">
                  <TarotFace card={card.card} />
                  {busy || card.art.state === "pending" ? (
                    <span className="of-tarot-badge" role="status">
                      {t("ui.otomeForge.wish.painting")}
                    </span>
                  ) : null}
                </span>
                <span id={titleId} className="of-album-cg-title">
                  {title}
                </span>
              </>
            )}
            {images && target && (paintWaits(card.art) || repaint) ? (
              <>
                <button
                  type="button"
                  className="of-button of-button--quiet of-button--small of-glass"
                  aria-describedby={titleId}
                  aria-label={repaint ? t("ui.otomeForge.album.repaintCard", { title }) : undefined}
                  aria-disabled={busy}
                  onClick={() => {
                    if (!busy) void actions.paint(target);
                  }}
                >
                  {consent || repaint ? (
                    <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                  )}
                  {repaint
                    ? t("ui.otomeForge.album.repaintCardShort")
                    : consent
                      ? t("ui.otomeForge.wish.paint")
                      : t("ui.otomeForge.wish.paintRetry")}
                </button>
                <CostHint images={1} />
              </>
            ) : null}
            {error ? (
              <span className="of-error" role="alert">
                {error}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
