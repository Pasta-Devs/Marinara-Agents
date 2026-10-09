import type { LtmLastInjectionResponse } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { StatusSurface } from "./shared-controls";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";

export function LastInjectionSummary({
  data,
  loading = false,
  error = false,
  onOpenMemory,
  onRetry,
  compact = false,
  // D27 uses initial-load state for the title, so a retry needs its own in-flight
  // guard: without it, a cached-data refetch could be restarted by repeated clicks.
  retryPending = false,
}: {
  data?: LtmLastInjectionResponse;
  loading?: boolean;
  error?: boolean;
  onOpenMemory?: (noteId: string) => void;
  onRetry?: () => void;
  compact?: boolean;
  retryPending?: boolean;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const observedAttempt = data?.attempt ?? null;
  // A missing attempt stays unknown; only package-observed outcomes are shown.
  // A confirmed completed attempt (or a no-match attempt) is the response's own
  // receipt, so its state copy is current. Any other observed attempt overrides an
  // older confirmed receipt: the panel must never present a stale injection as the
  // latest recall result.
  const observedRecallMessage = !observedAttempt
    ? null
    : observedAttempt.outcome === "cancelled"
      ? localizeUi("ui.longTermMemory.lastinjectionsummary.recallCancelled")
      : observedAttempt.outcome === "failed"
        ? localizeUi("ui.longTermMemory.lastinjectionsummary.recallFailed")
        : observedAttempt.outcome === "skipped"
          ? observedAttempt.reason === "chat_not_found"
            ? localizeUi("ui.longTermMemory.lastinjectionsummary.recallSkippedChatUnavailable")
            : observedAttempt.reason === "empty_query"
              ? localizeUi("ui.longTermMemory.lastinjectionsummary.recallSkippedEmptyQuery")
              : observedAttempt.reason === "prompt_budget"
                ? localizeUi("ui.longTermMemory.lastinjectionsummary.recallSkippedPromptBudget")
                : localizeUi("ui.longTermMemory.lastinjectionsummary.recallSkipped")
          : observedAttempt.reason === "no_matches" || observedAttempt.confirmed
            ? null
            : localizeUi("ui.longTermMemory.lastinjectionsummary.recallCompletedNotConfirmed");
  const attemptOverridesInjection = observedRecallMessage !== null;
  return (
    <details
      data-ltm-last-injection
      aria-busy={loading}
      className={
        compact ? "mari-chat-option-field overflow-hidden !rounded-md" : "mari-editor-panel mari-editor-panel--soft"
      }
    >
      <summary
        className={`flex cursor-pointer items-center justify-between font-semibold ${compact ? "min-h-9 gap-2 px-3 py-2 text-[0.6875rem]" : "min-h-11 gap-3 px-3 py-2 text-xs"}`}
      >
        <span>
          {error
            ? localizeUi("ui.longTermMemory.lastinjectionsummary.lastInjectionUnavailable")
            : loading
              ? localizeUi("ui.longTermMemory.lastinjectionsummary.loadingLastInjection")
              : attemptOverridesInjection
                ? observedRecallMessage
                : data?.state === "not_recorded"
                  ? localizeUi("ui.longTermMemory.lastinjectionsummary.noRecallRecorded")
                  : data?.state === "no_matches"
                    ? localizeUi("ui.longTermMemory.lastinjectionsummary.recallFoundNoMemories")
                    : data?.memoryCount
                      ? localizeUi(
                          selectLtmPluralForm(locale, data.memoryCount) === "one"
                            ? "ui.longTermMemory.lastinjectionsummary.injectedOne"
                            : "ui.longTermMemory.lastinjectionsummary.injectedOther",
                          {
                            count: data.memoryCount,
                          },
                        )
                      : localizeUi("ui.longTermMemory.lastinjectionsummary.noMemoriesInjectedYet")}
        </span>
        {data && !error && !attemptOverridesInjection && (data.dispatchedAt || data.memoryCount > 0) ? (
          <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
            {data.dispatchedAt
              ? localizeUi("ui.longTermMemory.lastinjectionsummary.recalledAt", {
                  timestamp: new Date(data.dispatchedAt).toLocaleString(locale),
                })
              : null}
            {data.memoryCount > 0
              ? `${data.dispatchedAt ? " · " : ""}${data.tokenCount.toLocaleString(locale)} ${localizeUi("ui.longTermMemory.activityview.tokens")}`
              : null}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-[var(--border)] px-3 py-2">
        {error ? (
          <StatusSurface tone="danger" compact={compact}>
            {localizeUi("ui.longTermMemory.lastinjectionsummary.theLastRecallCouldNotLoad")}
            {onRetry ? (
              <button
                type="button"
                className={`inline-flex items-center underline ${compact ? "min-h-6" : "min-h-11"}`}
                onClick={onRetry}
                disabled={loading || retryPending}
              >
                {localizeUi("ui.longTermMemory.activityview.retry")}
              </button>
            ) : null}
          </StatusSurface>
        ) : loading ? (
          <StatusSurface busy compact={compact}>
            {localizeUi("ui.longTermMemory.lastinjectionsummary.loadingRecalledMemories")}
          </StatusSurface>
        ) : null}
        {!loading && !error && !attemptOverridesInjection && data?.memories.length ? (
          <ul className={`${compact ? "text-[0.625rem]" : "text-xs"} space-y-1 text-[var(--muted-foreground)]`}>
            {data.memories.map((memory) => (
              <li
                key={memory.noteId}
                className={`mari-editor-panel mari-editor-panel--soft flex items-center justify-between gap-3 px-2 ${compact ? "min-h-7" : "min-h-9"}`}
              >
                {onOpenMemory ? (
                  <button
                    type="button"
                    data-ltm-recalled-note={memory.noteId}
                    className="inline-flex min-h-11 min-w-0 items-center truncate text-left text-[var(--primary)] underline underline-offset-2"
                    onClick={() => onOpenMemory(memory.noteId)}
                  >
                    {memory.title}
                  </button>
                ) : (
                  <span className="min-w-0 truncate">{memory.title}</span>
                )}
                {memory.sourceTitle ? (
                  <span className="min-w-0 truncate text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.longTermMemory.lastinjectionsummary.sourceFrom", { source: memory.sourceTitle })}
                  </span>
                ) : null}
                <span className="shrink-0 text-[0.6875rem]">
                  {memory.tokenCount.toLocaleString(locale)} {localizeUi("ui.longTermMemory.activityview.tokens")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {!loading && !error && (attemptOverridesInjection || !data?.memories.length) ? (
          <p
            className={`${compact ? "text-[0.625rem]" : "text-xs"} text-[var(--muted-foreground)]`}
            data-ltm-last-injection-state={data?.state ?? "not_recorded"}
          >
            {observedRecallMessage ??
              localizeUi(
                data?.state === "not_recorded"
                  ? "ui.longTermMemory.lastinjectionsummary.noRecallRecorded"
                  : data?.state === "no_matches"
                    ? "ui.longTermMemory.lastinjectionsummary.recallRanButFoundNoRelevantMemories"
                    : "ui.longTermMemory.lastinjectionsummary.noMemoriesWereInjectedInTheLastRecall",
              )}
          </p>
        ) : null}
      </div>
    </details>
  );
}
