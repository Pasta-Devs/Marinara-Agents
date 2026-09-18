import { Ban, ExternalLink, Megaphone, X } from "lucide-react";
import type { SlurpPromotion } from "../../slp/features/ads/slp-ads-hooks";
import { SlurpMediaImg } from "./SlurpShell";

/**
 * The same ad as a wall tile.
 *
 * The wall is a square image grid, so the list card's stacked text would break the row. An ad with
 * Text-only promotions still need a visible slot so the wall does not hide the feed's ad setting.
 */
export function SlurpInlineAdTile({
  promotion,
  onHide,
  onAction,
  labels,
}: {
  promotion: SlurpPromotion;
  onHide: () => void;
  onAction: () => void;
  labels: { sponsored: string; hide: string; actionFallback: string };
}) {
  return (
    <div className="relative aspect-square overflow-hidden bg-[var(--background)]">
      <button
        type="button"
        onClick={onAction}
        className="group block h-full w-full text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
        aria-label={`${labels.sponsored}: ${promotion.brand} — ${promotion.actionLabel ?? labels.actionFallback}`}
      >
        {promotion.imageUrl ? (
          <SlurpMediaImg
            src={promotion.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="flex h-full items-center justify-center bg-[linear-gradient(145deg,color-mix(in_srgb,var(--noodle-accent)_18%,var(--slurp-surface)),var(--slurp-surface))] p-4 text-center text-sm font-bold">
            {promotion.brand}
          </span>
        )}
        {/* An unlabelled ad inside a wall of real posts reads as a post. The gradient keeps the
            label legible on any image without hiding the image behind a panel. */}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
          <span className="block text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
            <Megaphone size={10} aria-hidden="true" className="mr-1 inline align-[-1px]" />
            {labels.sponsored}
          </span>
          <span className="mt-0.5 block truncate text-xs font-bold text-white">{promotion.brand}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onHide}
        aria-label={labels.hide}
        title={labels.hide}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SlurpInlineAd({
  promotion,
  onHide,
  onHideBrand,
  onAction,
  labels,
}: {
  promotion: SlurpPromotion;
  onHide: () => void;
  onHideBrand?: () => void;
  onAction: () => void;
  labels: { sponsored: string; hide: string; hideBrand: string; actionFallback: string };
}) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--slurp-surface)] shadow-sm">
      {/* imageUrl has always been on the promotion; without it an ad never reads
          as feed content, which is the whole point of an inline ad. */}
      {promotion.imageUrl ? (
        <SlurpMediaImg
          src={promotion.imageUrl}
          alt=""
          loading="lazy"
          className="max-h-56 w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]">
          <Megaphone size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
            {labels.sponsored}
          </p>
          <h2 className="mt-1 break-words text-sm font-bold">{promotion.brand}</h2>
          <p className="mt-0.5 break-words text-xs font-semibold text-[var(--muted-foreground)]">{promotion.product}</p>
          <p className="mt-2 break-words text-sm leading-6">{promotion.copy}</p>
          <button
            type="button"
            onClick={onAction}
            className="mt-3 min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90"
          >
            <ExternalLink size={13} aria-hidden="true" />
            {promotion.actionLabel ?? labels.actionFallback}
          </button>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onHide}
            aria-label={labels.hide}
            title={labels.hide}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X size={15} aria-hidden="true" />
          </button>
          {/* Hiding one ad used to leave the same brand free to come back. */}
          {onHideBrand ? (
            <button
              type="button"
              onClick={onHideBrand}
              aria-label={labels.hideBrand}
              title={labels.hideBrand}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <Ban size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
