import { useState } from "react";
import { Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../../lib/api-client";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { slpKeys } from "../../base/state/slp-query-keys";
import type { SlpActionPreview, SlpStirStep } from "../../../../../shared/src/slp/slp-stir.js";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { SlpStirCard, slpStirCantLine, useSlpStirDoIt } from "./SlpStirCards";

const HIDDEN_KEY = "slurp2:stir-support-hidden";

/** Support plans the player said "Not now" to, so they stay closed when the thread opens again. */
const readHidden = (): string[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};
const hide = (messageId: string) => {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...readHidden(), messageId].slice(-100)));
  } catch {
    // Private mode: the plan shows again next time, which is fine.
  }
};

/** What a Creator's reply in a Support thread proposes (server: `stirProposal` on the message). */
export type SlpStirProposal = { steps: SlpStirStep[]; cant?: string[]; playId?: string | null };

export function readSlpStirProposal(metadata: Record<string, unknown> | null | undefined): SlpStirProposal | null {
  const value = metadata?.stirProposal as SlpStirProposal | undefined;
  return value && Array.isArray(value.steps) && (value.steps.length > 0 || (value.cant?.length ?? 0) > 0)
    ? value
    : null;
}

/**
 * Slurp Support can Stir too (W): what the talk would change comes as the same preview cards, under
 * the Creator's reply, and nothing changes until "Do it". Support stays the voice in the chat; the
 * cards are the paperwork.
 */
export function SlpStirSupportCards({ messageId, proposal }: { messageId: string; proposal: SlpStirProposal }) {
  const { t } = useTranslation();
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [hidden, setHidden] = useState(() => readHidden().includes(messageId));
  const played = Boolean(proposal.playId);
  // Tapped once: stays off until the thread refetches with playId. A failed play is retried from Pulse.
  const [sent, setSent] = useState(false);
  const query = useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "stir-support", messageId, played],
    enabled: proposal.steps.length > 0,
    queryFn: () =>
      api.post<{ cards: SlpActionPreview[]; cant: string[] }>("/slurp2/slurp/stir/preview", { steps: proposal.steps }),
  });
  const doIt = useSlpStirDoIt();
  if (hidden) return null;
  const all = query.data?.cards ?? [];
  const cards = all.filter((_, index) => !removed.has(index));
  const cant = [...(proposal.cant ?? []), ...(query.data?.cant ?? [])];
  return (
    <section
      data-slp-stir-support
      aria-label={t("ui.slurp.stir.support.title")}
      className="w-full max-w-md space-y-2 self-start rounded-3xl bg-[image:var(--slurp-nav-active)] p-3 ring-1 ring-inset ring-[var(--noodle-accent)]/30"
    >
      <p className={cn(SLP_TYPE.meta, "flex items-center gap-1.5 px-1 font-semibold text-[var(--slurp-ink)]")}>
        <SlpSparkleGlyph size={14} aria-hidden="true" />
        {played ? t("ui.slurp.stir.support.played") : t("ui.slurp.stir.support.title")}
      </p>
      {query.isPending && proposal.steps.length > 0 ? (
        <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>{t("ui.slurp.stir.looking")}</p>
      ) : query.isError ? (
        <p role="alert" className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-danger)]")}>
          {errorMessage(query.error)}
        </p>
      ) : (
        <ul className="space-y-2">
          {all.map((card, index) =>
            removed.has(index) ? null : (
              <SlpStirCard
                key={`${card.action}:${index}`}
                card={card}
                onRemove={played ? undefined : () => setRemoved((current) => new Set(current).add(index))}
              />
            ),
          )}
        </ul>
      )}
      {cant.map((line, index) => (
        <p key={`${index}:${line}`} className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>
          {slpStirCantLine(t, line)}
        </p>
      ))}
      {played ? (
        <p className={cn(SLP_TYPE.meta, "flex items-center gap-1.5 px-1 text-[var(--slurp-success)]")}>
          <Check size={14} aria-hidden="true" />
          {t("ui.slurp.stir.support.inPlay")}
        </p>
      ) : (
        <div className="flex gap-2">
          <SlpButton
            variant="quiet"
            className="flex-1"
            disabled={doIt.pending}
            onClick={() => {
              hide(messageId);
              setHidden(true);
            }}
          >
            {t("ui.slurp.stir.support.notNow")}
          </SlpButton>
          <SlpPrimaryButton
            className="flex-1"
            disabled={!cards.some((card) => !card.error) || doIt.pending || sent}
            onClick={(event) => {
              setSent(true);
              doIt.run(cards, "support", {
                from: event.currentTarget.getBoundingClientRect(),
                supportMessageId: messageId,
              });
            }}
          >
            {doIt.pending ? t("ui.slurp.stir.doing") : t("ui.slurp.stir.doIt")}
          </SlpPrimaryButton>
        </div>
      )}
    </section>
  );
}
