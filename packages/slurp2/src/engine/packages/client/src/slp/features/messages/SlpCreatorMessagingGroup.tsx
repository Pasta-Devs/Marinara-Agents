// Per-creator messaging group, moved out of components/slurp/SlurpBackstageWorkflow.tsx in
// Slice 10. It drives Messages hooks and the Economy price mutation, so Messages owns it.

import { Field, NumberSetting, SettingsGroup, Toggle } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useSetSlurpCreatorPrice } from "../economy/slp-economy-contract";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpCreatorMessaging } from "./slp-messages-contract";
import { useSetSlurpCreatorMessaging, useSlurpCreatorMessagingSettings } from "./slp-messages-hooks";
import { toast } from "sonner";

export function CreatorMessagingGroup({
  creatorId,
  personaId,
  setMessaging,
  setPrice,
  worldRulesAction,
}: {
  creatorId: string;
  personaId: string;
  setMessaging: ReturnType<typeof useSetSlurpCreatorMessaging>;
  setPrice: ReturnType<typeof useSetSlurpCreatorPrice>;
  /** Optional way back to the world defaults these values start from. */
  worldRulesAction?: ReactNode;
}) {
  const { t } = useTranslation();
  const query = useSlurpCreatorMessagingSettings(creatorId, personaId);
  const messaging = query.data?.messaging;
  const busy = setMessaging.isPending || setPrice.isPending;
  if (query.isLoading) {
    return (
      <div className="flex justify-center py-6 text-[var(--muted-foreground)]" role="status">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }
  if (query.isError || !messaging) {
    return (
      <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-xs">
        {t("ui.slurp.settings.creators.messagingLoadError")}
      </p>
    );
  }
  const patch = (input: Parameters<typeof setMessaging.mutate>[0]) =>
    setMessaging.mutate(input, { onError: (error) => toast.error(errorMessage(error)) });
  return (
    <SettingsGroup title={t("ui.slurp.settings.creators.messagingTitle")}>
      {worldRulesAction && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          <p className="min-w-0 flex-1">
            {t("ui.slurp.settings.creators.messagingInheritsWorld", {
              defaultValue: "Each value starts from the Slurp world default and stays there until you change it here.",
            })}
          </p>
          {worldRulesAction}
        </div>
      )}
      <Field label={t("ui.slurp.settings.creators.dmPolicy")} detail={t("ui.slurp.settings.creators.dmPolicyDetail")}>
        <select
          value={messaging.dmPolicy}
          disabled={busy}
          onChange={(event) =>
            patch({
              creatorAccountId: creatorId,
              personaId,
              dmPolicy: event.target.value as SlurpCreatorMessaging["dmPolicy"],
            })
          }
          className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
        >
          <option value="open">{t("ui.slurp.settings.creators.dmPolicyOpen")}</option>
          <option value="subscribers">{t("ui.slurp.settings.creators.dmPolicySubscribers")}</option>
          <option value="paid">{t("ui.slurp.settings.creators.dmPolicyPaid")}</option>
          <option value="closed">{t("ui.slurp.settings.creators.dmPolicyClosed")}</option>
        </select>
      </Field>
      {messaging.dmPolicy === "paid" && (
        <Field
          label={t("ui.slurp.settings.creators.requestFee")}
          detail={t("ui.slurp.settings.creators.requestFeeDetail")}
        >
          <NumberSetting
            value={messaging.requestFee}
            min={0}
            max={9999}
            onSave={(value) => patch({ creatorAccountId: creatorId, personaId, requestFee: value })}
          />
        </Field>
      )}
      <Toggle
        label={t("ui.slurp.settings.creators.proactiveMessages", { defaultValue: "Writes first" })}
        detail={t("ui.slurp.settings.creators.proactiveMessagesDetail", {
          defaultValue: "Off: this Creator only answers. No follow-ups and no unprompted direct messages.",
        })}
        value={messaging.proactiveMessages}
        onChange={(value) => patch({ creatorAccountId: creatorId, personaId, proactiveMessages: value })}
      />
      <Field label={t("ui.slurp.settings.creators.ppvPrice")} detail={t("ui.slurp.settings.creators.ppvPriceDetail")}>
        <NumberSetting
          value={messaging.ppvPrice}
          min={0}
          max={9999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, ppvPrice: value })}
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.subscriptionPrice")}
        detail={t("ui.slurp.settings.creators.subscriptionPriceDetail")}
      >
        <NumberSetting
          value={query.data?.subscriptionPrice ?? 0}
          min={0}
          max={9999}
          onSave={(value) =>
            setPrice.mutate(
              { accountId: creatorId, personaId, price: value },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.unlockPrice", { defaultValue: "Locked post price" })}
        detail={t("ui.slurp.settings.creators.unlockPriceDetail", {
          defaultValue: "Default price for this Creator's locked posts. Zero uses the Wallet default.",
        })}
      >
        <NumberSetting
          value={messaging.unlockPrice ?? 0}
          min={0}
          max={9999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, unlockPrice: value ?? null })}
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.commissionBase", { defaultValue: "Commission base price" })}
        detail={t("ui.slurp.settings.creators.commissionBaseDetail", {
          defaultValue:
            "Price for an average brief. A quick sketch quotes lower, a detailed scene or a set quotes higher.",
        })}
      >
        <NumberSetting
          value={messaging.commissionBase}
          min={1}
          max={99999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, commissionBase: value })}
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.commissionMin", { defaultValue: "Lowest commission price" })}
        detail={t("ui.slurp.settings.creators.commissionMinDetail", {
          defaultValue: "No quote goes below this, and haggling never meets a fan under it.",
        })}
      >
        <NumberSetting
          value={messaging.commissionMin}
          min={1}
          max={99999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, commissionMin: value })}
        />
      </Field>
      <Field
        label={t("ui.slurp.settings.creators.commissionMax", { defaultValue: "Highest commission price" })}
        detail={t("ui.slurp.settings.creators.commissionMaxDetail", {
          defaultValue: "No quote goes above this, however large the brief.",
        })}
      >
        <NumberSetting
          value={messaging.commissionMax}
          min={1}
          max={99999}
          onSave={(value) => patch({ creatorAccountId: creatorId, personaId, commissionMax: value })}
        />
      </Field>
      <Toggle
        label={t("ui.slurp.settings.creators.autoQuote", { defaultValue: "Quote audience commissions automatically" })}
        detail={t("ui.slurp.settings.creators.autoQuoteDetail", {
          defaultValue:
            "Audience briefs get a quote from the prices above. You still answer offers and your own fans by hand.",
        })}
        value={messaging.autoQuote}
        onChange={(value) => patch({ creatorAccountId: creatorId, personaId, autoQuote: value })}
      />
      {query.data?.suggested && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--accent)] p-3 text-xs">
          <span>
            {t("ui.slurp.settings.creators.suggestedPrices", {
              defaultValue:
                "Suggested for your audience: {{subscription}}/week · {{unlock}} per locked post · {{commission}} commission base",
              subscription: query.data.suggested.subscriptionPrice,
              unlock: query.data.suggested.unlockPrice,
              commission: query.data.suggested.commissionBase,
            })}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const suggested = query.data?.suggested;
              if (!suggested) return;
              patch({
                creatorAccountId: creatorId,
                personaId,
                unlockPrice: suggested.unlockPrice || null,
                commissionBase: suggested.commissionBase,
              });
              setPrice.mutate(
                { accountId: creatorId, personaId, price: suggested.subscriptionPrice },
                { onError: (error) => toast.error(errorMessage(error)) },
              );
            }}
            className="min-h-9 rounded-lg px-3 font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
          >
            {t("ui.slurp.settings.creators.useSuggestedPrices", { defaultValue: "Use suggestions" })}
          </button>
        </div>
      )}
    </SettingsGroup>
  );
}
