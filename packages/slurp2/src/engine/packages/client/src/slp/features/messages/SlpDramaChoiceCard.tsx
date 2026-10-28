import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "../../../lib/utils";
import { api } from "../../../lib/api-client";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpChip } from "../../modules/chrome/SlpButton";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { invalidateSlurpMessages } from "./slp-message-keys.js";
import type { SlurpMessage } from "./slp-messages-contract";

type SlpDramaChoice = { runId: string; options: string[]; chosen: number | "late" | null };

/** A drama's question in a DM (`docs/DRAMA.md`), as the message metadata carries it, or null. */
export function readSlpDramaChoice(message: Pick<SlurpMessage, "metadata">): SlpDramaChoice | null {
  const raw = (message.metadata as Record<string, unknown> | null | undefined)?.dramaChoice as
    Record<string, unknown> | undefined;
  if (!raw || typeof raw.runId !== "string" || !Array.isArray(raw.options)) return null;
  const options = raw.options.filter((option): option is string => typeof option === "string").slice(0, 4);
  const chosen = typeof raw.chosen === "number" || raw.chosen === "late" ? raw.chosen : null;
  return options.length >= 2 ? { runId: raw.runId, options, chosen } : null;
}

/**
 * The answers under a Creator's question in a drama: one tap answers, the story goes that way. No
 * answer in time: the story takes its own default. Answered: the chosen one stays marked.
 */
export function SlpDramaChoiceCard({ message, personaId }: { message: SlurpMessage; personaId: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const answer = useMutation({
    mutationFn: (option: number) =>
      api.post<{ chosen: number }>("/slurp2/slurp/drama/choice", { personaId, messageId: message.id, option }),
    onError: (error: unknown) => toast.error(errorMessage(error)),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
  const choice = readSlpDramaChoice(message);
  if (!choice || !personaId) return null;
  const settled = choice.chosen !== null;
  return (
    <div
      data-slurp-drama-choice={settled ? "answered" : "open"}
      className="flex w-[min(20rem,78vw)] flex-col gap-2 self-start"
      role="group"
      aria-label={t("ui.slurp.drama.choice.label")}
    >
      <div className="flex flex-wrap gap-2">
        {choice.options.map((option, index) => (
          <SlpChip
            key={option}
            selected={choice.chosen === index}
            disabled={settled || answer.isPending}
            onClick={() => answer.mutate(index)}
          >
            {option}
          </SlpChip>
        ))}
      </div>
      <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
        {choice.chosen === "late"
          ? t("ui.slurp.drama.choice.late")
          : settled
            ? t("ui.slurp.drama.choice.answered")
            : t("ui.slurp.drama.choice.hint")}
      </p>
    </div>
  );
}
