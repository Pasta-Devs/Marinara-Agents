import { useTranslation as useUiTranslation } from "react-i18next";
import {
  SLURP_CONTENT_DELIVERIES,
  SLURP_CONTENT_INTENTS,
  slurpContentDeliveryFits,
  slurpIntentFitsAccess,
  type SlurpContentDelivery,
  type SlurpContentIntent,
} from "../../../../../shared/src/slp/slp-content-axes.js";

const selectClass =
  "h-9 rounded-lg border border-[var(--noodle-divider)] bg-transparent px-2 text-xs font-bold disabled:opacity-50";

/**
 * The composer's one-off purpose and delivery.
 *
 * Both are offered against the post's audience: a locked post never teases what the reader already
 * owns, and a delivery is only listed when it fits the chosen purpose.
 */
export function SlpComposerPurpose({
  access,
  contentIntent,
  contentDelivery,
  disabled,
  onChange,
}: {
  access: "public" | "locked";
  contentIntent: SlurpContentIntent | null;
  contentDelivery: SlurpContentDelivery | null;
  disabled: boolean;
  onChange: (next: {
    contentIntent?: SlurpContentIntent | null;
    contentDelivery?: SlurpContentDelivery | null;
  }) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      <label className="inline-flex h-9 items-center gap-1.5 text-xs font-bold">
        <span className="sr-only">{localizeUi("ui.slurp.composer.purpose")}</span>
        <select
          value={contentIntent ?? ""}
          disabled={disabled}
          title={localizeUi(`ui.slurp.composer.purposeHint.${contentIntent ?? "auto"}`)}
          onChange={(event) => {
            const next = (event.target.value || null) as SlurpContentIntent | null;
            onChange({
              contentIntent: next,
              contentDelivery:
                next && contentDelivery && slurpContentDeliveryFits(next, contentDelivery) ? contentDelivery : null,
            });
          }}
          className={selectClass}
        >
          {(["", ...SLURP_CONTENT_INTENTS] as const)
            .filter((intent) => !intent || slurpIntentFitsAccess(intent, access))
            .map((intent) => (
              <option key={intent || "auto"} value={intent}>
                {localizeUi(`ui.slurp.composer.intent.${intent || "auto"}`)}
              </option>
            ))}
        </select>
      </label>
      <label className="inline-flex h-9 items-center gap-1.5 text-xs font-bold">
        <span className="sr-only">{localizeUi("ui.slurp.composer.delivery")}</span>
        <select
          value={contentDelivery ?? ""}
          disabled={disabled || !contentIntent}
          title={localizeUi(`ui.slurp.composer.deliveryHint.${contentDelivery ?? "auto"}`)}
          onChange={(event) =>
            onChange({ contentDelivery: (event.target.value || null) as SlurpContentDelivery | null })
          }
          className={`${selectClass} max-w-40`}
        >
          <option value="">{localizeUi("ui.slurp.composer.delivery.auto")}</option>
          {SLURP_CONTENT_DELIVERIES.filter(
            (delivery) => contentIntent && slurpContentDeliveryFits(contentIntent, delivery),
          ).map((delivery) => (
            <option key={delivery} value={delivery}>
              {localizeUi(`ui.slurp.composer.delivery.${delivery}`)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
