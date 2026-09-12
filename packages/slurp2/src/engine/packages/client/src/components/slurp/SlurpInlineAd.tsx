import { Ban, ExternalLink, Megaphone, X } from "lucide-react";
import type { SlurpPromotion } from "../../hooks/use-slurp";

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
        <img
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
            className="mt-3 min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 hover:opacity-90"
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
