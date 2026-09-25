import { useSetStoryOccurrenceStatus, useSlpStoryTimeline } from "./slp-story-hooks.js";

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm font-semibold hover:bg-[var(--slurp-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50";

/**
 * What the world is doing: suggested, running and recent events. It sits with the event list it
 * comes from, not with Packs, which only imports content.
 */
export function SlpWorldTimeline() {
  const timeline = useSlpStoryTimeline();
  const setStatus = useSetStoryOccurrenceStatus();
  return (
    <section aria-labelledby="slurp-world-timeline-heading" className="space-y-3">
      <div>
        <h2 id="slurp-world-timeline-heading" className="text-base font-black">
          World timeline
        </h2>
        <p className="mt-1 text-sm text-[var(--slurp-muted)]">
          Suggestions, active events, and recent history keep their original participants and rules.
        </p>
      </div>
      {(timeline.data?.occurrences ?? []).length === 0 ? (
        <p className="text-sm text-[var(--slurp-muted)]">
          No event occurrences yet. Start a manual event or wait for a scheduled date.
        </p>
      ) : (
        <ul className="space-y-3">
          {timeline.data?.occurrences.map((occurrence) => (
            <li
              key={occurrence.id}
              className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{occurrence.blueprint.name}</h3>
                  <p className="mt-1 text-xs text-[var(--slurp-muted)]">
                    {occurrence.status} · {occurrence.participantIds.length} Creators · {occurrence.triggerEvidence}
                  </p>
                </div>
                {occurrence.status === "suggested" && (
                  <div className="flex gap-2">
                    <button
                      className={button}
                      type="button"
                      onClick={() => setStatus.mutate({ id: occurrence.id, status: "dismissed" })}
                    >
                      Dismiss
                    </button>
                    <button
                      className={button}
                      type="button"
                      onClick={() => setStatus.mutate({ id: occurrence.id, status: "active" })}
                    >
                      Start event
                    </button>
                  </div>
                )}
                {occurrence.status === "active" && (
                  <button
                    className={button}
                    type="button"
                    onClick={() => setStatus.mutate({ id: occurrence.id, status: "completed" })}
                  >
                    End event
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
