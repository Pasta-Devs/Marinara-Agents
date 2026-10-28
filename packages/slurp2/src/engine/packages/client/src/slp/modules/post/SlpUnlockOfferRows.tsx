import type { MouseEvent, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCoin } from "../coin/SlpCoin";

// The price rows of the unlock sheet (moved out of SlpLockedPostCard.tsx to keep it under the size limit).

export function SlpCreatorFictionalPrice({ amount, suffix }: { amount?: number | null; suffix?: string }) {
  const { t: localizeUi } = useUiTranslation();
  if (typeof amount !== "number" || amount < 0) return null;
  return (
    <span
      title={localizeUi("ui.noodle.unlocksheet.priceHint")}
      className="inline-flex shrink-0 cursor-help items-center gap-1 text-[15px] font-extrabold tabular-nums text-[var(--slurp-text)]"
    >
      <span>{localizeUi("ui.noodle.unlocksheet.price", { amount })}</span>
      <SlurpCoin size={16} />
      {suffix && <span className="ms-0.5 text-xs font-semibold text-[var(--slurp-muted)]">{suffix}</span>}
    </span>
  );
}

export function SlpDiscountOfferButton({
  label,
  actionLabel,
  oldPrice,
  newPrice,
  suffix,
  busy,
  disabled,
  onClick,
  icon,
  localizeUi,
}: {
  label: string;
  actionLabel: string;
  oldPrice: number;
  newPrice: number;
  suffix?: string;
  busy: boolean;
  disabled: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  icon: ReactNode;
  localizeUi: (key: string, options?: Record<string, unknown>) => string;
}) {
  const valid = Number.isInteger(oldPrice) && oldPrice >= 0 && Number.isInteger(newPrice) && newPrice >= 0;
  if (!valid || newPrice >= oldPrice) return null;
  return (
    <button
      type="button"
      data-slurp-discount-offer
      disabled={disabled || busy}
      onClick={onClick}
      className="relative flex min-h-[4.75rem] w-full items-center gap-3 overflow-visible rounded-xl bg-[linear-gradient(110deg,color-mix(in_srgb,var(--slurp-success)_16%,var(--slurp-surface-raised)),color-mix(in_srgb,var(--noodle-accent)_10%,var(--slurp-surface-raised)))] px-4 py-3 text-left shadow-[0_14px_32px_-26px_var(--slurp-success)] ring-1 ring-inset ring-[var(--slurp-success)]/35 transition-[filter,transform,box-shadow] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none"
    >
      {busy ? <Loader2 size={20} className="animate-spin motion-reduce:animate-none" /> : icon}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold leading-5 text-[var(--slurp-text)]">{actionLabel}</span>
          <span className="rounded-full bg-[var(--slurp-success)]/15 px-2 py-0.5 text-[11px] font-black text-[var(--slurp-success)] ring-1 ring-inset ring-[var(--slurp-success)]/35">
            {label || localizeUi("ui.slurp.unlocksheet.specialOffer", { defaultValue: "Special offer" })}
          </span>
        </span>
        <span className="block text-xs text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1 line-through">
            {localizeUi("ui.slurp.unlocksheet.offerOldPrice", { defaultValue: "Was {{price}}", price: oldPrice })}
            <SlurpCoin size={12} />
            {suffix}
          </span>
        </span>
      </span>
      {newPrice === 0 ? (
        <span className="shrink-0 rounded-full bg-[var(--slurp-success)]/15 px-3 py-1 text-sm font-black text-[var(--slurp-success)] ring-1 ring-inset ring-[var(--slurp-success)]/35">
          {localizeUi("ui.slurp.unlocksheet.free", { defaultValue: "Free" })}
        </span>
      ) : (
        <SlpCreatorFictionalPrice amount={newPrice} suffix={suffix} />
      )}
    </button>
  );
}
