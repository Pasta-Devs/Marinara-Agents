import type { LtmLastInjectionResponse } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { StatusSurface } from "./shared-controls";

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
  return (
    <details
      data-ltm-last-injection
      className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30"
    >
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-semibold">
        <span>
          {loading
            ? "Loading last injection"
            : data?.memoryCount
              ? `${data.memoryCount} ${data.memoryCount === 1 ? "memory" : "memories"} injected`
              : error
                ? "Last injection unavailable"
                : "No memories injected yet"}
        </span>
        {data ? (
          <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
            {data.tokenCount.toLocaleString()} tokens
          </span>
        ) : null}
      </summary>
      <div className="border-t border-[var(--border)] px-3 py-2">
        {loading ? (
          <StatusSurface busy>Loading recalled memories.</StatusSurface>
        ) : null}
        {error ? (
          <StatusSurface tone="danger">
            The last recall could not load.
          </StatusSurface>
        ) : null}
        {!loading && !error && data?.memories.length ? (
          <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
            {data.memories.map((memory) => (
              <li
                key={memory.noteId}
                className="flex min-h-9 items-center justify-between gap-3 rounded bg-[var(--background)] px-2"
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
                  {memory.tokenCount.toLocaleString()} tokens
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {!loading && !error && !data?.memories.length ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            No memories were injected in the last recall.
          </p>
        ) : null}
      </div>
    </details>
  );
}
