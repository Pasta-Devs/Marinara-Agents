// Support offers an extra that is still off (docs/CONFIGURATOR.md, slice 4), as a notice on top of the
// feed: "Add" switches it on, "Not now" puts it away. The server decides when (shared slp-extras-offer).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../lib/api-client";
import { SLP_TYPE, SlpLogo } from "../../base/chrome/SlpChrome";
import { slpKeys } from "../../base/state/slp-query-keys";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SLP_EXTENSION_KEYS } from "../../../../../shared/src/slp/slp-extensions.js";
import type { SlpExtrasOffer } from "../../../../../shared/src/slp/slp-extras-offer.js";
import { useUpdateSlurpSettings } from "./slp-settings-hooks";

const offerKey = () => [...slpKeys.settings(), "extras-offer"] as const;

export function SlpExtrasOfferCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const update = useUpdateSlurpSettings();
  const query = useQuery({
    queryKey: offerKey(),
    queryFn: () => api.get<{ offer: SlpExtrasOffer | null }>("/slurp2/extras/offer"),
    staleTime: 60_000,
    // The feed stays mounted behind the first run while its first posts are written: ask again now and then.
    refetchInterval: 120_000,
  });
  const answer = useMutation({
    mutationFn: async ({ id, add }: { id: SlpExtrasOffer["id"]; add: boolean }) => {
      if (add) await update.mutateAsync({ [SLP_EXTENSION_KEYS[id]]: true });
      return api.post("/slurp2/extras/offer/answer", { id, add });
    },
    onSuccess: () => queryClient.setQueryData(offerKey(), { offer: null }),
    onError: () => toast.error(t("ui.slurp.extrasOffer.error")),
  });
  const offer = query.data?.offer;
  if (!offer) return null;
  const name = t(`ui.slurp.settings.ext.${offer.id}.label`);
  return (
    <section
      aria-label={t("ui.slurp.extrasOffer.from")}
      className="mx-4 mt-3 flex flex-col gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:mx-5"
    >
      <div className="flex items-start gap-3">
        <SlpLogo className="mt-0.5 h-5 w-auto shrink-0" />
        <div className="min-w-0">
          <p className={`${SLP_TYPE.meta} font-bold text-[var(--slurp-muted)]`}>{t("ui.slurp.extrasOffer.from")}</p>
          <p className="mt-0.5 text-sm text-pretty">
            {t(`ui.slurp.extrasOffer.ask.${offer.trigger}`, { name })}{" "}
            <span className="text-[var(--slurp-muted)]">{t(`ui.slurp.settings.ext.${offer.id}.detail`)}</span>
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <SlpButton disabled={answer.isPending} onClick={() => answer.mutate({ id: offer.id, add: false })}>
          {t("ui.slurp.extrasOffer.notNow")}
        </SlpButton>
        <SlpPrimaryButton disabled={answer.isPending} onClick={() => answer.mutate({ id: offer.id, add: true })}>
          {t("ui.slurp.extrasOffer.add", { name })}
        </SlpPrimaryButton>
      </div>
    </section>
  );
}
