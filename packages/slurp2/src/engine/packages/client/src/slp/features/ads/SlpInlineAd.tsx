import { Ban, ExternalLink, EyeOff, MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpPromotion } from "./slp-ads-contract";
import { Avatar, SLP_IMG_FRAME_CLASS, SLP_TYPE, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { SlpButton, slpTagClass } from "../../modules/chrome/SlpButton";
import { SlpSheet, SlpSheetItem } from "../../modules/chrome/SlpSheet";
import { cn } from "../../../lib/utils";

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
  const [open, setOpen] = useState(false);
  return (
    <div className="relative aspect-square overflow-hidden bg-[var(--background)]">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onAction();
        }}
        className="group block h-full w-full text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
        aria-label={`${labels.sponsored}: ${promotion.brand}, ${promotion.actionLabel ?? labels.actionFallback}`}
      >
        {promotion.imageUrl ? (
          <SlurpMediaImg
            src={promotion.imageUrl}
            alt=""
            loading="lazy"
            className="slp-crop-top h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="flex h-full items-center justify-center bg-[linear-gradient(145deg,color-mix(in_srgb,var(--noodle-accent)_18%,var(--slurp-surface)),var(--slurp-surface))] p-4 text-center text-sm font-bold">
            {promotion.brand}
          </span>
        )}
        {/* An unlabelled ad inside a wall of real posts reads as a post. The gradient keeps the
            label legible on any image without hiding the image behind a panel. */}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
          <span className="block truncate text-xs font-bold text-white">{promotion.brand}</span>
          <span className="mt-0.5 block text-[11px] font-semibold text-white/75">{labels.sponsored}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onHide}
        aria-label={labels.hide}
        title={labels.hide}
        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65"
      >
        <EyeOff size={15} aria-hidden="true" />
      </button>
      <SlurpAdSheet promotion={promotion} open={open} onClose={() => setOpen(false)} sponsored={labels.sponsored} />
    </div>
  );
}

/**
 * An ad in the shape of a post (feed, Discover, Backstage preview): the brand's avatar and name
 * with a quiet "Sponsored" chip, the caption, the picture, and one tinted button. Hide lives in
 * the ⋯ sheet, like a post's own menu.
 */
export function SlurpInlineAd({
  promotion,
  onHide,
  onHideBrand,
  onAction,
  labels,
  wide = false,
}: {
  promotion: SlurpPromotion;
  /** Discover: the 1.91:1 banner, so the ad sits between grid rows instead of filling the phone. */
  wide?: boolean;
  onHide: () => void;
  onHideBrand?: () => void;
  onAction: () => void;
  labels: { sponsored: string; hide: string; hideBrand: string; actionFallback: string };
}) {
  const { t: localizeUi } = useUiTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(true);
    onAction();
  };
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const menuLabel = localizeUi("ui.slurp.home.moreActions", { defaultValue: "More actions" });
  // Each slot shows the picture drawn for its shape; an older ad without a banner is cropped from the top.
  const imageUrl = (wide && promotion.wideImageUrl) || promotion.imageUrl;
  return (
    <article
      aria-label={`${labels.sponsored}: ${promotion.brand}`}
      className="rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-4 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
    >
      <div className="flex items-center gap-3">
        {/* The brand's logo, or the initials of the first two words of the brand. */}
        <Avatar
          account={{
            displayName: promotion.brand.split(/\s+/u).slice(0, 2).join(" "),
            avatarUrl: promotion.brandLogoUrl ?? null,
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className={cn(SLP_TYPE.title, "min-w-0 truncate")}>{promotion.brand}</h2>
            <span className={slpTagClass()}>{labels.sponsored}</span>
          </div>
          {promotion.product && (
            <p className="mt-0.5 truncate text-xs font-medium leading-4 text-[var(--slurp-muted)]">
              {promotion.product}
            </p>
          )}
        </div>
        <button
          ref={menuRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={menuLabel}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="-me-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-muted)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <MoreHorizontal size={20} aria-hidden="true" />
        </button>
      </div>
      {promotion.copy && <p className={cn(SLP_TYPE.body, "mt-3 whitespace-pre-line break-words")}>{promotion.copy}</p>}
      {imageUrl && !imageFailed && (
        <button
          type="button"
          onClick={show}
          // The button below does the same; one tab stop per ad.
          tabIndex={-1}
          aria-hidden="true"
          className={cn(
            "relative -mx-4 mt-3 block w-[calc(100%+2rem)] overflow-hidden bg-[var(--slurp-media-stage,#17131a)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
            wide ? "" : "aspect-[4/5] max-h-[32rem]",
            SLP_IMG_FRAME_CLASS,
          )}
          style={wide ? { aspectRatio: "1.91 / 1" } : undefined}
        >
          <SlurpMediaImg
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="slp-crop-top h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        </button>
      )}
      <SlpButton variant="secondary" onClick={show} className="mt-3 w-full">
        <ExternalLink size={16} aria-hidden="true" />
        {promotion.actionLabel ?? labels.actionFallback}
      </SlpButton>
      <SlpSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={menuLabel} kind="menu" anchorRef={menuRef}>
        <SlpSheetItem
          onSelect={() => {
            setMenuOpen(false);
            onHide();
          }}
        >
          <EyeOff aria-hidden="true" />
          {labels.hide}
        </SlpSheetItem>
        {/* Hiding one ad used to leave the same brand free to come back. */}
        {onHideBrand && (
          <SlpSheetItem
            onSelect={() => {
              setMenuOpen(false);
              onHideBrand();
            }}
          >
            <Ban aria-hidden="true" />
            {labels.hideBrand}
          </SlpSheetItem>
        )}
      </SlpSheet>
      <SlurpAdSheet promotion={promotion} open={open} onClose={() => setOpen(false)} sponsored={labels.sponsored} />
    </article>
  );
}

const PRICE_FEEL = { budget: "$", everyday: "$$", premium: "$$$" } as const;

/**
 * Where a tapped ad goes (docs/FEEDBACK-2026-10.md R11): the whole promotion in one sheet, the
 * picture full size, the brand, the product, the copy and the price feel. The brands live inside
 * Slurp, so there is no outside page to open.
 */
function SlurpAdSheet({
  promotion,
  open,
  onClose,
  sponsored,
}: {
  promotion: SlurpPromotion;
  open: boolean;
  onClose: () => void;
  sponsored: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <SlpSheet open={open} onClose={onClose} title={promotion.brand}>
      {promotion.imageUrl && !imageFailed && (
        <div className={cn("aspect-[4/5] max-h-[60dvh] w-full overflow-hidden rounded-2xl", SLP_IMG_FRAME_CLASS)}>
          <SlurpMediaImg
            src={promotion.imageUrl}
            alt=""
            decoding="async"
            className="slp-crop-top h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <Avatar
          account={{
            displayName: promotion.brand.split(/\s+/u).slice(0, 2).join(" "),
            avatarUrl: promotion.brandLogoUrl ?? null,
          }}
        />
        <div className="min-w-0 flex-1">
          {/* The sheet title above already names the brand. */}
          <span className={slpTagClass()}>{sponsored}</span>
          {promotion.product && (
            <p className="mt-0.5 text-sm font-semibold leading-5 text-[var(--slurp-text)]">
              {promotion.product}
              {promotion.priceFeel && (
                <span
                  className="ms-2 text-[var(--slurp-muted)]"
                  aria-label={localizeUi(`ui.slurp.ads.price.${promotion.priceFeel}`)}
                >
                  {PRICE_FEEL[promotion.priceFeel]}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      {promotion.copy && <p className={cn(SLP_TYPE.body, "mt-3 whitespace-pre-line break-words")}>{promotion.copy}</p>}
    </SlpSheet>
  );
}
