import { Minus, Plus } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpChip } from "../chrome/SlpButton";
import { SlurpCoinAmount, SlpCoinText } from "../coin/SlpCoin";
import { slpComposerAudienceOf, type SlpComposerAudience } from "./slp-composer-audience";

// Small prices move by one coin, bigger ones by five.
const priceStep = (price: number) => (price < 20 ? 1 : 5);
const clampPrice = (value: number) => Math.min(9999, Math.max(0, Math.floor(value)));

/** The composer's access chips: Public · Subscribers · Locked · price, with a price stepper for Locked. */
export function SlpComposerAudience({
  access,
  unlockPrice,
  usualUnlockPrice,
  disabled,
  onChange,
}: {
  access: "public" | "locked";
  unlockPrice: number | null;
  /** The Creator's usual unlock price: what "Subscribers" charges everyone else. */
  usualUnlockPrice: number;
  disabled: boolean;
  onChange: (patch: { access?: "public" | "locked"; unlockPrice?: number | null }) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const audience = slpComposerAudienceOf({ access, unlockPrice });
  const price = unlockPrice ?? usualUnlockPrice;
  const choose = (next: SlpComposerAudience) =>
    onChange({
      access: next === "public" ? "public" : "locked",
      unlockPrice: next === "locked" ? price : null,
    });
  const stepButton =
    "grid size-11 place-items-center rounded-full bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-highlight)] disabled:opacity-40 [&_svg]:!text-[var(--slurp-ink)]";
  const hint =
    audience === "public"
      ? localizeUi("ui.slurp.composer.audienceHint.public", { defaultValue: "Everyone can see it." })
      : localizeUi(`ui.slurp.composer.audienceHint.${audience}`, {
          defaultValue:
            audience === "subscribers"
              ? "Your subscribers see it. Everyone else unlocks it for {{price}} <coin/>."
              : "Your subscribers see it. Everyone else pays {{price}} <coin/> to unlock it.",
          price: audience === "subscribers" ? usualUnlockPrice : price,
        });
  return (
    <section aria-labelledby="slurp-composer-audience" className="space-y-2">
      <h3 id="slurp-composer-audience" className="sr-only">
        {localizeUi("ui.noodle.noodlerpostcomposer.whoCanSeeThisPost")}
      </h3>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby="slurp-composer-audience">
        <SlpChip selected={audience === "public"} disabled={disabled} onClick={() => choose("public")}>
          {localizeUi("ui.slurp.composer.audience.public", { defaultValue: "Public" })}
        </SlpChip>
        <SlpChip selected={audience === "subscribers"} disabled={disabled} onClick={() => choose("subscribers")}>
          {localizeUi("ui.slurp.composer.audience.subscribers", { defaultValue: "Subscribers" })}
        </SlpChip>
        <SlpChip selected={audience === "locked"} disabled={disabled} onClick={() => choose("locked")}>
          {localizeUi("ui.slurp.composer.audience.locked", { defaultValue: "Locked" })}
          <span aria-hidden="true">·</span>
          <SlurpCoinAmount amount={price} size={13} className="tabular-nums" />
        </SlpChip>
      </div>
      {audience === "locked" && (
        <div className="flex items-center gap-2">
          <span className={cn(SLP_TYPE.body, "me-auto text-[var(--slurp-muted)]")}>
            {localizeUi("ui.noodle.noodlerpostcomposer.unlockPrice", { defaultValue: "Price" })}
          </span>
          <button
            type="button"
            disabled={disabled || price <= 0}
            onClick={() => onChange({ unlockPrice: clampPrice(price - priceStep(price - 1)) })}
            aria-label={localizeUi("ui.slurp.composer.priceDown", { defaultValue: "Lower price" })}
            className={stepButton}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            value={price}
            disabled={disabled}
            aria-label={localizeUi("ui.noodle.noodlerpostcomposer.unlockPrice", { defaultValue: "Price" })}
            onChange={(event) => onChange({ unlockPrice: clampPrice(Number(event.target.value) || 0) })}
            className="h-11 w-20 rounded-xl bg-[var(--slurp-surface-raised)] text-center text-base font-bold tabular-nums shadow-[var(--slurp-highlight)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          />
          <button
            type="button"
            disabled={disabled || price >= 9999}
            onClick={() => onChange({ unlockPrice: clampPrice(price + priceStep(price)) })}
            aria-label={localizeUi("ui.slurp.composer.priceUp", { defaultValue: "Raise price" })}
            className={stepButton}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
        <SlpCoinText>{hint}</SlpCoinText>
      </p>
    </section>
  );
}
