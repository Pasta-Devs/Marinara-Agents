import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SlpOpenContinuityButton } from "../../base/navigation/SlpOpenContinuityButton";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useSlurpRequestAction, useSlurpThreadRequests, type SlurpThreadRequest } from "./slp-messages-hooks";

const ACTIONS = ["fulfill", "tease", "delay", "decline", "aggregate", "ignore"] as const;
const TOPIC_ACTIONS = new Set<string>(["fulfill", "tease", "delay", "aggregate"]);

/**
 * What the fan asked for, and what the Creator did about it.
 *
 * Fulfil, tease, and delay owe the planner a post; decline records a limit; aggregate counts the
 * ask under a label the player types, with no fan and no wording attached; ignore files it away.
 * Each request takes one answer.
 */
export function SlurpThreadRequestsPanel({
  threadId,
  personaId,
  creatorAccountId,
}: {
  threadId: string | null;
  personaId: string | null;
  creatorAccountId?: string | null;
}) {
  const { t } = useTranslation();
  const requests = useSlurpThreadRequests(threadId, personaId, true);
  const apply = useSlurpRequestAction(threadId, personaId);
  const [topics, setTopics] = useState<Record<string, string>>({});
  const rows = requests.data?.requests ?? [];
  if (rows.length === 0) return null;

  const run = (request: SlurpThreadRequest, action: (typeof ACTIONS)[number]) => {
    const topic = topics[request.id]?.trim();
    if (action === "aggregate" && !topic) {
      toast.error(t("ui.slurp.messages.requests.topicRequired", { defaultValue: "Name the kind of request first." }));
      return;
    }
    apply.mutate(
      // The label is what a kept promise delivers too, so it travels with every action that makes one.
      { requestId: request.id, action, ...(topic && TOPIC_ACTIONS.has(action) ? { topic } : {}) },
      { onError: (error) => toast.error(errorMessage(error)) },
    );
  };

  return (
    <section
      className="space-y-3 px-4 py-4"
      aria-label={t("ui.slurp.messages.requests.title", { defaultValue: "Requests" })}
    >
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--slurp-muted)]">
        {t("ui.slurp.messages.requests.title", { defaultValue: "Requests" })}
      </h3>
      {creatorAccountId && (
        <SlpOpenContinuityButton
          creatorAccountId={creatorAccountId}
          className="text-xs font-semibold text-[var(--slurp-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        />
      )}
      {rows.map((request) => (
        <article key={request.id} className="space-y-2 rounded-lg bg-[var(--slurp-surface-raised)] p-3">
          <p className="text-sm leading-6 text-pretty">{request.text}</p>
          {request.action ? (
            <p className="text-xs font-semibold text-[var(--slurp-muted)]">
              {t(`ui.slurp.messages.requests.done.${request.action}`, { defaultValue: request.action })}
            </p>
          ) : (
            <>
              <input
                value={topics[request.id] ?? ""}
                onChange={(event) => setTopics((current) => ({ ...current, [request.id]: event.target.value }))}
                placeholder={t("ui.slurp.messages.requests.topicPlaceholder", {
                  defaultValue: "What they asked for, e.g. red dress set",
                })}
                maxLength={60}
                className="min-h-10 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-sm ring-1 ring-inset ring-[var(--slurp-outline)]"
              />
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={apply.isPending}
                    onClick={() => run(request, action)}
                    title={t(`ui.slurp.messages.requests.hint.${action}`, { defaultValue: "" })}
                    className="min-h-9 rounded-lg px-3 text-xs font-bold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    {t(`ui.slurp.messages.requests.action.${action}`, { defaultValue: action })}
                  </button>
                ))}
              </div>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
