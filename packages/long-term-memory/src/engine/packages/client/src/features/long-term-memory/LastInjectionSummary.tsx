import { useId, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type {
  LtmDebugEvent,
  LtmLastInjectionAttempt,
  LtmLastInjectionMemory,
  LtmLastInjectionResponse,
  LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request, requestNotesByIds } from "./api";
import { Button, Spinner, StatusSurface, lockedActionProps } from "./shared-controls";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";
import { ltmHiddenLine } from "./auto-import-status";
import {
  leftOutFromExplanation,
  pickCardProblem,
  recallExplanationOf,
  recallProblemKey,
  type CardProblem,
  type LeftOutLimit,
} from "./card-problem";

/** Whether the last recall attempt outranks the receipt's memories: they are no longer what the last reply used. */
export function attemptOverrides(attempt: LtmLastInjectionAttempt | null) {
  if (!attempt) return false;
  if (attempt.outcome === "cancelled" || attempt.outcome === "failed" || attempt.outcome === "skipped") return true;
  return attempt.reason !== "no_matches" && !attempt.confirmed;
}

/** The memories the last reply used, as the panel below lists them; none when the attempt overrides the receipt. */
export function lastInjectionNoteIds(data: LtmLastInjectionResponse | undefined) {
  return data && !attemptOverrides(data.attempt) ? data.memories.map((memory) => memory.noteId) : [];
}

/** One used memory's text in place: the section the reply used, read from the note when the title is opened. */
function MemoryText({
  memory,
  compact,
  onOpenMemory,
}: {
  memory: LtmLastInjectionMemory;
  compact: boolean;
  onOpenMemory?: (noteId: string) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const note = useQuery({
    queryKey: [...queryKeys.notes, "last-injection-text", memory.noteId],
    queryFn: ({ signal }) => requestNotesByIds<LtmNote>([memory.noteId], signal, true),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const found = note.data?.[0];
  const sections = found?.sections ?? {};
  // A section the note no longer has shows as missing, not as some other section.
  const text = (memory.sectionKey ? sections[memory.sectionKey] : Object.values(sections)[0])?.text;
  const textClass = compact ? "" : "text-xs text-[var(--muted-foreground)]";
  return (
    <div data-ltm-recalled-text={memory.noteId} className={compact ? "ltm-ac-body" : "mt-1 space-y-1"}>
      {note.isError ? (
        <p role="status" className={textClass}>
          {localizeUi("ui.longTermMemory.lastinjectionsummary.memoryTextFailed")}
        </p>
      ) : note.isLoading ? (
        <p role="status" aria-busy="true" className={textClass}>
          {localizeUi("ui.longTermMemory.lastinjectionsummary.memoryTextLoading")}
        </p>
      ) : text ? (
        <p className={`${textClass} whitespace-pre-wrap break-words`}>{text}</p>
      ) : (
        <p role="status" className={textClass}>
          {localizeUi("ui.longTermMemory.lastinjectionsummary.memoryTextMissing")}
        </p>
      )}
      {onOpenMemory && compact ? (
        <CardAction compact data-ltm-recalled-open-vault={memory.noteId} onClick={() => onOpenMemory(memory.noteId)}>
          {localizeUi("ui.longTermMemory.lastinjectionsummary.openInVault")}
        </CardAction>
      ) : onOpenMemory ? (
        <button
          type="button"
          data-ltm-recalled-open-vault={memory.noteId}
          className="block min-h-11 text-left text-xs text-[var(--primary)] underline underline-offset-2"
          onClick={() => onOpenMemory(memory.noteId)}
        >
          {localizeUi("ui.longTermMemory.lastinjectionsummary.openInVault")}
        </button>
      ) : null}
    </div>
  );
}

const buttonProps = { className: "mari-editor-action--compact text-[0.625rem]", style: { minHeight: "2rem" } };

/** How many used memories the compact card lists before a "more" row; a long recall would otherwise fill the panel. */
const COMPACT_MEMORY_CAP = 5;

/**
 * The compact card's look: the Engine's agent-activity card (tinted, rounded, small type) with its small action chip,
 * so the Long-Term Memory card reads as one of the agent cards beside it. Values mirror the Engine's own classes;
 * they live here because the Engine stylesheet does not serve every arbitrary value the card needs.
 */
const COMPACT_CARD_STYLE = `
  [data-ltm-activity-card].ltm-ac { display: grid; gap: 0.375rem; min-width: 0; border: 1px solid var(--border);
    border-radius: 0.5rem; background: color-mix(in srgb, var(--secondary) 35%, transparent); padding: 0.5rem;
    font-size: 0.625rem; line-height: 1.5; color: var(--muted-foreground); }
  .ltm-ac .ltm-ac-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .ltm-ac .ltm-ac-name { font-size: inherit; font-weight: 600; color: color-mix(in srgb, var(--foreground) 75%, transparent); }
  .ltm-ac .ltm-ac-lead { color: var(--foreground); font-weight: 500; }
  .ltm-ac .ltm-ac-chip { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 0.25rem; min-height: 1.5rem;
    border-radius: 0.375rem; border: 1px solid color-mix(in srgb, var(--foreground) 15%, transparent);
    background: color-mix(in srgb, var(--foreground) 10%, transparent); padding: 0.125rem 0.5rem; font: inherit;
    font-size: 0.5625rem; font-weight: 500; color: color-mix(in srgb, var(--foreground) 70%, transparent);
    cursor: pointer; transition: background-color 150ms, color 150ms; }
  .ltm-ac .ltm-ac-chip:hover { background: color-mix(in srgb, var(--foreground) 15%, transparent);
    color: color-mix(in srgb, var(--foreground) 85%, transparent); }
  .ltm-ac .ltm-ac-chip--primary, .ltm-ac .ltm-ac-chip--primary:hover { border-color: var(--primary);
    background: var(--primary); color: var(--primary-foreground); }
  .ltm-ac .ltm-ac-chip[aria-disabled="true"] { opacity: 0.5; cursor: default; }
  .ltm-ac .ltm-ac-chip:focus-visible, .ltm-ac .ltm-ac-mem:focus-visible { outline: 1px solid var(--ring); outline-offset: 1px; }
  .ltm-ac .ltm-ac-used { display: grid; gap: 0.25rem; }
  .ltm-ac .ltm-ac-mems { display: grid; gap: 0.0625rem; margin: 0; padding: 0; list-style: none; }
  .ltm-ac .ltm-ac-mem { display: flex; width: 100%; min-width: 0; min-height: 1.5rem; align-items: center; gap: 0.375rem;
    border: 0; background: none; padding: 0.125rem 0; font: inherit; color: var(--foreground); text-align: left; cursor: pointer; }
  .ltm-ac .ltm-ac-mem--more { color: var(--muted-foreground); }
  .ltm-ac .ltm-ac-mem > svg { flex: 0 0 auto; color: var(--muted-foreground); transition: transform 150ms; }
  .ltm-ac .ltm-ac-mem[aria-expanded="true"] > svg { transform: rotate(90deg); }
  .ltm-ac .ltm-ac-mem > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ltm-ac .ltm-ac-body { display: grid; justify-items: start; gap: 0.375rem; margin: 0.125rem 0 0.375rem 0.875rem;
    border-radius: 0.375rem; background: var(--card); padding: 0.4375rem 0.5625rem; line-height: 1.6; }
  .ltm-ac .ltm-ac-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem;
    border-top: 1px solid var(--border); padding-top: 0.4375rem; }
  .ltm-ac .ltm-ac-main { display: contents; }
  .ltm-ac .ltm-ac-main > .ltm-ac-row:first-child { border-top: 0; padding-top: 0; }
  .ltm-ac .ltm-ac-row > span { min-width: 0; flex: 1; }
  .ltm-ac .ltm-ac-row--warn { color: var(--warning, var(--foreground)); }
  .ltm-ac .ltm-ac-row--warn .ltm-ac-chip { border-color: color-mix(in srgb, var(--warning, var(--foreground)) 45%, transparent); }
  .ltm-ac .ltm-ac-row--danger { color: var(--destructive); }
  @media (prefers-reduced-motion: reduce) { .ltm-ac .ltm-ac-chip, .ltm-ac .ltm-ac-mem > svg { transition: none; } }
`;

/** One status line: a bordered row in the compact card, the shared status surface elsewhere. */
function CardRow({
  compact,
  tone = "neutral",
  busy = false,
  children,
  ...props
}: {
  compact: boolean;
  tone?: "neutral" | "warning" | "danger";
  busy?: boolean;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  if (!compact)
    return (
      <StatusSurface tone={tone} busy={busy} {...props}>
        {children}
      </StatusSurface>
    );
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live="polite"
      data-ltm-status={tone}
      className={`ltm-ac-row${tone === "neutral" ? "" : ` ltm-ac-row--${tone === "warning" ? "warn" : "danger"}`}`}
      {...props}
    >
      {busy ? <Spinner size="0.625rem" /> : null}
      {tone === "warning" ? (
        <TriangleAlert aria-hidden="true" size="0.625rem" className="shrink-0" data-ltm-status-icon />
      ) : null}
      {children}
    </div>
  );
}

/** The button a status line carries: the agent card's small chip when compact, the shared action elsewhere. */
function CardAction({
  compact,
  primary = false,
  children,
  ...props
}: { compact: boolean; primary?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  if (!compact)
    return (
      <Button {...buttonProps} primary={primary} {...props}>
        {children}
      </Button>
    );
  return (
    <button
      type="button"
      data-ltm-control="button"
      className={`ltm-ac-chip${primary ? " ltm-ac-chip--primary" : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Part 2: the one problem line, amber when memory wasn't used or a save failed, with the button that fixes it. */
function ProblemLine({
  problem,
  compact,
  retrying,
  onOpenActivity,
  onRetrySave,
  onSetUp,
  onRaiseLimit,
}: {
  problem: CardProblem;
  compact: boolean;
  retrying: boolean;
  onOpenActivity?: (attemptId: string) => void;
  onRetrySave?: () => void;
  onSetUp?: () => void;
  onRaiseLimit?: (limit: LeftOutLimit) => void;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  if (problem.kind === "recall") {
    const attemptId = problem.attempt.attemptId;
    return (
      <CardRow tone="warning" compact={compact} data-ltm-card-problem="recall">
        <span className="min-w-0 flex-1">{localizeUi(recallProblemKey(problem.attempt))}</span>
        {onOpenActivity ? (
          <CardAction compact={compact} data-ltm-recall-open-activity onClick={() => onOpenActivity(attemptId)}>
            {localizeUi("ui.longTermMemory.lastinjectionsummary.details")}
          </CardAction>
        ) : null}
      </CardRow>
    );
  }
  if (problem.kind === "saveFailed") {
    return (
      <CardRow tone="warning" compact={compact} data-ltm-card-problem="saveFailed" data-ltm-auto-import-failed>
        <span className="min-w-0 flex-1">
          {problem.cause
            ? localizeUi("ui.longTermMemory.lastinjectionsummary.saveFailedCause", { cause: problem.cause })
            : localizeUi("ui.longTermMemory.lastinjectionsummary.saveFailed")}
        </span>
        {onRetrySave ? (
          <CardAction compact={compact} onClick={onRetrySave} {...lockedActionProps(retrying)}>
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </CardAction>
        ) : null}
      </CardRow>
    );
  }
  if (problem.kind === "setup") {
    return (
      <CardRow compact={compact} data-ltm-card-problem="setup" data-ltm-connection-warning>
        <span className="min-w-0 flex-1">{localizeUi("ui.longTermMemory.lastinjectionsummary.notSaving")}</span>
        {onSetUp ? (
          <CardAction compact={compact} onClick={onSetUp}>
            {localizeUi("ui.longTermMemory.chatsettings.setUp")}
          </CardAction>
        ) : null}
      </CardRow>
    );
  }
  return (
    <CardRow compact={compact} data-ltm-card-problem="leftOut" data-ltm-left-out={problem.limit}>
      <span className="min-w-0 flex-1">
        {localizeUi(
          selectLtmPluralForm(locale, problem.count) === "one"
            ? "ui.longTermMemory.lastinjectionsummary.leftOutOne"
            : "ui.longTermMemory.lastinjectionsummary.leftOutOther",
          { count: problem.count.toLocaleString(locale) },
        )}
      </span>
      {onRaiseLimit ? (
        <CardAction compact={compact} onClick={() => onRaiseLimit(problem.limit)}>
          {localizeUi("ui.longTermMemory.lastinjectionsummary.raiseLimit")}
        </CardAction>
      ) : null}
    </CardRow>
  );
}

/**
 * The Long-Term Memory card at the top of a chat's memory section. Part 1 says what the last reply used; the problem
 * line and the saved lines have their own places below it.
 */
export function LastInjectionSummary({
  data,
  loading = false,
  error = false,
  onOpenMemory,
  onOpenVault,
  onRetry,
  onOpenActivity,
  saveFailed = null,
  onRetrySave,
  retryingSave = false,
  needsSetup = false,
  onSetUp,
  onRaiseLimit,
  toReview = 0,
  onReview,
  savedNew = 0,
  onViewSaved,
  hidden = null,
  reading = false,
  compact = false,
  // D27 uses initial-load state for the title, so a retry needs its own in-flight
  // guard: without it, a cached-data refetch could be restarted by repeated clicks.
  retryPending = false,
}: {
  data?: LtmLastInjectionResponse;
  loading?: boolean;
  error?: boolean;
  /** Opens one memory in the Vault; offered beside its text. */
  onOpenMemory?: (noteId: string) => void;
  /** Opens the Memory Vault. */
  onOpenVault?: () => void;
  onRetry?: () => void;
  /** Opens Activity on one recall attempt; offered beside the reason memory wasn't used. */
  onOpenActivity?: (attemptId: string) => void;
  /** The chat's latest background read failed (the cause when short); the card offers Retry. */
  saveFailed?: { cause: string | null } | null;
  onRetrySave?: () => void;
  retryingSave?: boolean;
  /** Background import is on but no extraction model is chosen. */
  needsSetup?: boolean;
  onSetUp?: () => void;
  /** Focuses the limit field the last recall's cut names; the "left out" line reads the recall's recorded explanation. */
  onRaiseLimit?: (limit: LeftOutLimit) => void;
  /** Part 3, each line only when true: memories waiting for review, memories saved since the last reply, messages an import hid since then, and a read in progress. */
  toReview?: number;
  onReview?: () => void;
  savedNew?: number;
  onViewSaved?: () => void;
  hidden?: { from: number; to: number } | null;
  reading?: boolean;
  compact?: boolean;
  retryPending?: boolean;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const headingId = useId();
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [showAllMemories, setShowAllMemories] = useState(false);
  // A confirmed completed attempt (or a no-match attempt) is the response's own receipt. Any other observed attempt
  // overrides an older confirmed receipt: the card must never present a stale injection as the latest recall result.
  const notUsed = attemptOverrides(data?.attempt ?? null);
  const textClass = "text-xs text-[var(--muted-foreground)]";
  const leadClass = compact ? "ltm-ac-lead" : textClass;
  const memories = !notUsed && data ? data.memories : [];
  const used = memories.length ? (data?.memoryCount ?? memories.length) : 0;
  // What the limits cut comes from the recall's own explanation, which exists only while "Record recall explanations"
  // is on; without it the response cannot tell, so no line is shown rather than a guess.
  const attempt = data?.attempt ?? null;
  const explanation = useQuery({
    enabled: Boolean((onRaiseLimit || onOpenActivity) && attempt?.debugEnabled && !loading && !error),
    queryKey: [...queryKeys.activity, "recall-explanation", attempt?.attemptId],
    queryFn: ({ signal }) =>
      request<{ events: LtmDebugEvent[] }>(
        `/debug-log?operationId=${attempt?.attemptId}&limit=50`,
        "GET",
        undefined,
        signal,
      ),
  });
  const recorded = !loading && !error ? recallExplanationOf(explanation.data?.events) : undefined;
  // The save and set-up problems come from the import events, so a failed or loading receipt read must not hide them.
  const problem = pickCardProblem({
    recall: !loading && !error && notUsed ? attempt : null,
    saveFailed,
    needsSetup,
    leftOut: leftOutFromExplanation(recorded),
  });
  const [hiddenKey, hiddenValues] = hidden ? ltmHiddenLine(hidden) : [null, null];
  const hiddenText = hiddenKey ? localizeUi(hiddenKey, hiddenValues) : null;
  const listed = compact && !showAllMemories ? memories.slice(0, COMPACT_MEMORY_CAP) : memories;
  const unlisted = memories.length - listed.length;
  return (
    <section
      data-ltm-last-injection
      data-ltm-activity-card
      aria-labelledby={headingId}
      aria-busy={loading}
      className={compact ? "ltm-ac" : "mari-editor-panel mari-editor-panel--soft"}
    >
      {compact ? <style>{COMPACT_CARD_STYLE}</style> : null}
      <div className={compact ? "ltm-ac-head" : "flex min-h-11 items-center justify-between gap-2 px-3 py-1 text-xs"}>
        <h3 id={headingId} className={compact ? "ltm-ac-name" : "font-semibold"}>
          {localizeUi("ui.longTermMemory.lastinjectionsummary.cardTitle")}
        </h3>
        {onOpenVault ? (
          <CardAction compact={compact} data-ltm-card-open onClick={onOpenVault}>
            {localizeUi("ui.longTermMemory.lastinjectionsummary.cardOpen")}
          </CardAction>
        ) : null}
      </div>
      <div className={compact ? "ltm-ac-main" : "space-y-1 border-t border-[var(--border)] px-3 py-2"}>
        {/* Part 1: what the last reply used. */}
        {error ? (
          <CardRow tone="danger" compact={compact}>
            <span className="min-w-0 flex-1">
              {localizeUi("ui.longTermMemory.lastinjectionsummary.theLastRecallCouldNotLoad")}
            </span>
            {onRetry ? (
              <CardAction
                compact={compact}
                onClick={() => {
                  if (!loading && !retryPending) onRetry();
                }}
                {...lockedActionProps(loading || retryPending)}
              >
                {localizeUi("ui.longTermMemory.activityview.retry")}
              </CardAction>
            ) : null}
          </CardRow>
        ) : loading ? (
          <CardRow busy compact={compact}>
            {localizeUi("ui.longTermMemory.lastinjectionsummary.loadingRecalledMemories")}
          </CardRow>
        ) : notUsed ? (
          <p data-ltm-last-injection-state="not_used" className={leadClass}>
            {localizeUi("ui.longTermMemory.lastinjectionsummary.notUsedThisReply")}
          </p>
        ) : memories.length ? (
          <div data-ltm-last-injection-state="injected" className={compact ? "ltm-ac-used" : undefined}>
            <p className={compact ? "ltm-ac-lead" : "text-xs font-semibold"}>
              {localizeUi(
                selectLtmPluralForm(locale, used) === "one"
                  ? "ui.longTermMemory.lastinjectionsummary.usedOne"
                  : "ui.longTermMemory.lastinjectionsummary.usedOther",
                { count: used },
              )}
            </p>
            <ul className={compact ? "ltm-ac-mems" : "space-y-0.5"}>
              {listed.map((memory) => {
                const open = openNoteId === memory.noteId;
                return (
                  <li key={memory.noteId} className={compact ? undefined : textClass}>
                    <button
                      type="button"
                      data-ltm-recalled-note={memory.noteId}
                      aria-expanded={open}
                      className={
                        compact
                          ? "ltm-ac-mem"
                          : "block min-h-11 max-w-full truncate text-left text-[var(--primary)] underline underline-offset-2"
                      }
                      onClick={() => setOpenNoteId(open ? null : memory.noteId)}
                    >
                      {compact ? (
                        <>
                          <ChevronRight aria-hidden="true" size="0.625rem" />
                          <span>{memory.title}</span>
                        </>
                      ) : (
                        memory.title
                      )}
                    </button>
                    {open ? <MemoryText memory={memory} compact={compact} onOpenMemory={onOpenMemory} /> : null}
                  </li>
                );
              })}
              {unlisted > 0 ? (
                <li>
                  <button
                    type="button"
                    data-ltm-recalled-more
                    className="ltm-ac-mem ltm-ac-mem--more"
                    onClick={() => setShowAllMemories(true)}
                  >
                    <ChevronDown aria-hidden="true" size="0.625rem" />
                    <span>
                      {localizeUi("ui.longTermMemory.lastinjectionsummary.moreMemories", {
                        count: unlisted.toLocaleString(locale),
                      })}
                    </span>
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <p data-ltm-last-injection-state={data?.state ?? "not_recorded"} className={leadClass}>
            {typeof data?.availableCount === "number"
              ? localizeUi("ui.longTermMemory.lastinjectionsummary.noneUsedAvailable", {
                  count: data.availableCount.toLocaleString(locale),
                })
              : localizeUi("ui.longTermMemory.lastinjectionsummary.noneUsed")}
          </p>
        )}
        {/* Part 2: at most one problem, the most serious, with the one button that fixes it. */}
        {problem ? (
          <ProblemLine
            problem={problem}
            compact={compact}
            retrying={retryingSave}
            // Activity only knows an attempt whose explanation was recorded; otherwise Details would open an empty page.
            onOpenActivity={recorded ? onOpenActivity : undefined}
            onRetrySave={onRetrySave}
            onSetUp={onSetUp}
            onRaiseLimit={onRaiseLimit}
          />
        ) : null}
        {/* Part 3: what was saved, each line only when true. */}
        {toReview > 0 ? (
          <CardRow compact={compact} data-ltm-card-saved="review">
            <span className="min-w-0 flex-1">
              {localizeUi(
                selectLtmPluralForm(locale, toReview) === "one"
                  ? "ui.longTermMemory.lastinjectionsummary.toReviewOne"
                  : "ui.longTermMemory.lastinjectionsummary.toReviewOther",
                { count: toReview.toLocaleString(locale) },
              )}
            </span>
            {onReview ? (
              <CardAction compact={compact} primary onClick={onReview}>
                {localizeUi("ui.longTermMemory.chatsettings.autoImportReview")}
              </CardAction>
            ) : null}
          </CardRow>
        ) : null}
        {savedNew > 0 ? (
          <CardRow compact={compact} data-ltm-card-saved="new">
            <span className="min-w-0 flex-1">
              {localizeUi(
                selectLtmPluralForm(locale, savedNew) === "one"
                  ? "ui.longTermMemory.lastinjectionsummary.savedNewOne"
                  : "ui.longTermMemory.lastinjectionsummary.savedNewOther",
                { count: savedNew.toLocaleString(locale) },
              )}
            </span>
            {onViewSaved ? (
              <CardAction compact={compact} onClick={onViewSaved}>
                {localizeUi("ui.longTermMemory.lastinjectionsummary.savedNewView")}
              </CardAction>
            ) : null}
          </CardRow>
        ) : null}
        {hidden ? (
          <CardRow compact={compact} data-ltm-card-saved="hidden">
            <span className="min-w-0 flex-1">{hiddenText}</span>
          </CardRow>
        ) : null}
        {reading ? (
          <CardRow busy compact={compact} data-ltm-card-saved="reading">
            {localizeUi("ui.longTermMemory.lastinjectionsummary.reading")}
          </CardRow>
        ) : null}
      </div>
    </section>
  );
}
