import type { LtmLastInjectionResponse } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { StatusSurface } from "./shared-controls";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";

export function LastInjectionSummary({
  data,
  loading = false,
  error = false,
  onOpenMemory,
}: {
  data?: LtmLastInjectionResponse;
  loading?: boolean;
  error?: boolean;
  onOpenMemory?: (noteId: string) => void;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  return (
    <details
      data-ltm-last-injection
      aria-busy={loading}
      className="mari-editor-panel mari-editor-panel--soft"
    >
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-semibold">
        <span>
          {loading
            ? localizeUi(
                "ui.longTermMemory.lastinjectionsummary.loadingLastInjection",
              )
            : data?.memoryCount
              ? localizeUi(
                  selectLtmPluralForm(locale, data.memoryCount) === "one"
                    ? "ui.longTermMemory.lastinjectionsummary.injectedOne"
                    : "ui.longTermMemory.lastinjectionsummary.injectedOther",
                  {
                    count: data.memoryCount,
                  },
                )
              : error
                ? localizeUi(
                    "ui.longTermMemory.lastinjectionsummary.lastInjectionUnavailable",
                  )
                : localizeUi(
                    "ui.longTermMemory.lastinjectionsummary.noMemoriesInjectedYet",
                  )}
        </span>
        {data ? (
          <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
            {data.tokenCount.toLocaleString(locale)}{" "}
            {localizeUi("ui.longTermMemory.activityview.tokens")}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-[var(--border)] px-3 py-2">
        {loading ? (
          <StatusSurface busy>
            {localizeUi(
              "ui.longTermMemory.lastinjectionsummary.loadingRecalledMemories",
            )}
          </StatusSurface>
        ) : null}
        {error ? (
          <StatusSurface tone="danger">
            {localizeUi(
              "ui.longTermMemory.lastinjectionsummary.theLastRecallCouldNotLoad",
            )}
          </StatusSurface>
        ) : null}
        {!loading && !error && data?.memories.length ? (
          <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
            {data.memories.map((memory) => (
              <li
                key={memory.noteId}
                className="mari-editor-panel mari-editor-panel--soft flex min-h-9 items-center justify-between gap-3 px-2"
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
                <span className="shrink-0 text-[0.6875rem]">
                  {memory.tokenCount.toLocaleString(locale)}{" "}
                  {localizeUi("ui.longTermMemory.activityview.tokens")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {!loading && !error && !data?.memories.length ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi(
              "ui.longTermMemory.lastinjectionsummary.noMemoriesWereInjectedInTheLastRecall",
            )}
          </p>
        ) : null}
      </div>
    </details>
  );
}
