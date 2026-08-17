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
}: {
  data?: LtmLastInjectionResponse;
  loading?: boolean;
  error?: boolean;
  onOpenMemory?: (noteId: string) => void;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  return (
    <details data-ltm-last-injection aria-busy={loading} className="mari-editor-panel mari-editor-panel--soft">
      <summary
        className={`flex cursor-pointer items-center justify-between font-semibold ${compact ? "min-h-8 gap-2 px-2.5 py-1.5 text-[0.625rem]" : "min-h-11 gap-3 px-3 py-2 text-xs"}`}
      >
        <span>
          {error
            ? localizeUi("ui.longTermMemory.lastinjectionsummary.lastInjectionUnavailable")
            : loading
              ? localizeUi("ui.longTermMemory.lastinjectionsummary.loadingLastInjection")
              : data?.state === "not_recorded"
                ? localizeUi("ui.longTermMemory.lastinjectionsummary.noRecallRecorded")
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
        {data && !error ? (
          <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
            {data.tokenCount.toLocaleString(locale)} {localizeUi("ui.longTermMemory.activityview.tokens")}
          </span>
        ) : null}
      </summary>
      <div className={`border-t border-[var(--border)] ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
        {error ? (
          <StatusSurface tone="danger" compact={compact}>
            {localizeUi("ui.longTermMemory.lastinjectionsummary.theLastRecallCouldNotLoad")}
            {onRetry ? (
              <button type="button" className="underline" onClick={onRetry} disabled={loading}>
                {localizeUi("ui.longTermMemory.activityview.retry")}
              </button>
            ) : null}
          </StatusSurface>
        ) : loading ? (
          <StatusSurface busy compact={compact}>
            {localizeUi("ui.longTermMemory.lastinjectionsummary.loadingRecalledMemories")}
          </StatusSurface>
        ) : null}
        {!loading && !error && data?.memories.length ? (
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
                    className="min-w-0 truncate text-left text-[var(--primary)] underline underline-offset-2"
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
        {!loading && !error && !data?.memories.length ? (
          <p
            className={`${compact ? "text-[0.625rem]" : "text-xs"} text-[var(--muted-foreground)]`}
            data-ltm-last-injection-state={data?.state ?? "not_recorded"}
          >
            {localizeUi(
              data?.state === "not_recorded"
                ? "ui.longTermMemory.lastinjectionsummary.noRecallRecorded"
                : "ui.longTermMemory.lastinjectionsummary.noMemoriesWereInjectedInTheLastRecall",
            )}
          </p>
        ) : null}
      </div>
    </details>
  );
}
