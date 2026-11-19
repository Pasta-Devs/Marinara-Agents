import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  LtmStoryDatesApplyResponse,
  LtmStoryDatesApplyRow,
  LtmStoryDatesPreviewResponse,
  LtmStoryDatesPreviewRow,
  LtmStoryDatesRejected,
  LtmStoryDatesScopeResponse,
  LtmStoryTime,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request } from "../api";
import { connectionLabel, languageConnectionsQueryOptions } from "../language-connections";
import { selectLtmPluralForm, useLtmTranslation, type LtmTranslationFunction } from "../localization";
import { Button, ModalDialog, Spinner, StatusSurface, lockedActionProps } from "../shared-controls";
import { STORY_DATE_SOURCE_KEYS, describeStoryJump } from "../story-dates";

type Phase = "confirm" | "checking" | "results" | "empty" | "error" | "done";

const REJECTED_REASON_KEYS: Record<LtmStoryDatesRejected["reason"], string> = {
  missing: "ui.longTermMemory.storyDates.reasonMissing",
  unknown_id: "ui.longTermMemory.storyDates.reasonUnknownId",
  duplicate_id: "ui.longTermMemory.storyDates.reasonDuplicateId",
  invalid: "ui.longTermMemory.storyDates.reasonInvalid",
  quote_not_found: "ui.longTermMemory.storyDates.reasonQuoteNotFound",
  date_not_in_quote: "ui.longTermMemory.storyDates.reasonDateNotInQuote",
  not_a_date: "ui.longTermMemory.storyDates.reasonNotADate",
  time_not_in_quote: "ui.longTermMemory.storyDates.reasonTimeNotInQuote",
  implied_without_morning: "ui.longTermMemory.storyDates.reasonImpliedWithoutMorning",
  amount_not_in_quote: "ui.longTermMemory.storyDates.reasonAmountNotInQuote",
  unit_not_in_quote: "ui.longTermMemory.storyDates.reasonUnitNotInQuote",
  weekday_after_jump: "ui.longTermMemory.storyDates.reasonWeekdayAfterJump",
  jump_before_date: "ui.longTermMemory.storyDates.reasonJumpBeforeDate",
};

const pointText = (point: { date?: string; time?: string }) => [point.date, point.time].filter(Boolean).join(", ");

function storyTimeText(storyTime: LtmStoryTime, localizeUi: LtmTranslationFunction) {
  const start = pointText(storyTime.start);
  const end = storyTime.end ? pointText(storyTime.end) : "";
  return end && end !== start ? localizeUi("ui.longTermMemory.storyDates.range", { start, end }) : start;
}

/** What a row says about its piece: the date and where it came from. Empty when only time jumps were found. */
function rowLine(row: LtmStoryDatesPreviewRow, localizeUi: LtmTranslationFunction) {
  if (row.kind === "engine")
    return [
      storyTimeText(row.storyTime, localizeUi),
      localizeUi(STORY_DATE_SOURCE_KEYS[row.storyTime.origin] ?? STORY_DATE_SOURCE_KEYS.unknown!),
    ].join(" · ");
  if (!row.stated) return row.jumps.length ? "" : localizeUi("ui.longTermMemory.storyDates.nothingFound");
  return [
    pointText(row.stated),
    localizeUi(STORY_DATE_SOURCE_KEYS.stated!),
    localizeUi("ui.longTermMemory.storyDates.quoted", { quote: row.stated.quote }),
  ].join(" · ");
}

function applyRow(row: LtmStoryDatesPreviewRow): LtmStoryDatesApplyRow {
  return row.kind === "engine"
    ? { kind: "engine", noteId: row.noteId, sourceHash: row.sourceHash }
    : { kind: "scan", noteId: row.noteId, sourceHash: row.sourceHash, stated: row.stated, jumps: row.jumps };
}

/**
 * Find story dates: chat pieces in the vault get a story date from what the Engine saved (World State, the game clock,
 * message times) or from dates and time jumps the extraction model found in their text. The server checks every quote
 * against the text; only the rows kept here are saved, and nothing is sent until Start.
 */
export function FindStoryDatesDialog({ onClose }: { onClose: () => void }) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const titleId = useId();
  const descriptionId = useId();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [preview, setPreview] = useState<LtmStoryDatesPreviewResponse | null>(null);
  // Rows the user left out; only the other rows are sent.
  const [leftOut, setLeftOut] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  // The position the last run began after, so "Try again" after a failed next batch repeats that batch.
  const lastAfter = useRef<string | undefined>(undefined);
  const scope = useQuery({
    queryKey: [...queryKeys.root, "story-dates-scope"],
    queryFn: () => request<LtmStoryDatesScopeResponse>("/story-dates/scope"),
    enabled: phase === "confirm",
    retry: false,
    gcTime: 0,
  });
  const scopeConnectionId = scope.data?.connectionId ?? null;
  const connections = useQuery({ ...languageConnectionsQueryOptions, enabled: scopeConnectionId !== null });

  // Closing while the model reads drops the request.
  useEffect(() => () => controller.current?.abort(), []);
  // A new view takes focus: its first control, or Cancel while the model reads.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("[data-ltm-story-dates-focus]")?.focus({ preventScroll: true });
  }, [phase]);

  const plural = (count: number, one: string, other: string) =>
    localizeUi(selectLtmPluralForm(locale, count) === "one" ? one : other, { count });
  const start = async (after?: string) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    lastAfter.current = after;
    setMessage("");
    setPhase("checking");
    try {
      const response = await request<LtmStoryDatesPreviewResponse, { after: string } | undefined>(
        "/story-dates/preview",
        "POST",
        after === undefined ? undefined : { after },
        current.signal,
      );
      if (current.signal.aborted) return;
      setPreview(response);
      setLeftOut(new Set());
      setPhase(response.pieces.length ? "results" : "empty");
    } catch (error) {
      if (current.signal.aborted) return;
      setMessage(errorMessage(error, localizeUi("ui.longTermMemory.storyDates.failed")));
      setPhase("error");
    }
  };
  const cancel = () => {
    controller.current?.abort();
    setPhase("confirm");
  };
  const kept = preview?.pieces.filter((row) => !leftOut.has(row.noteId)) ?? [];
  // The server counted each chat as if every row were saved. A left-out piece stays not checked, so the count for the
  // later jumps of its chat no longer holds and those jumps show without it.
  // ponytail: a chat with a left-out row loses its counted lines until the row is put back; upgrade path: recount on
  // the server from the kept rows.
  const chatsWithLeftOut = new Set(preview?.pieces.filter((row) => leftOut.has(row.noteId)).map((row) => row.chatId));
  const apply = async () => {
    if (saving || !kept.length) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await request<LtmStoryDatesApplyResponse, { rows: LtmStoryDatesApplyRow[] }>(
        "/story-dates/apply",
        "POST",
        { rows: kept.map(applyRow) },
      );
      const appliedText = plural(
        response.applied.length,
        "ui.longTermMemory.storyDates.appliedOne",
        "ui.longTermMemory.storyDates.appliedOther",
      );
      const skippedText = response.skipped.length
        ? plural(
            response.skipped.length,
            "ui.longTermMemory.storyDates.skippedOne",
            "ui.longTermMemory.storyDates.skippedOther",
          )
        : "";
      const summary = [appliedText, skippedText].filter(Boolean).join(" ");
      setDoneMessage(summary);
      setPhase("done");
      if (response.rebuild?.status === "deferred") {
        const error = response.rebuild.error;
        toast.warning(
          error
            ? localizeUi("ui.longTermMemory.memoryvault.savedButRecallIsStale", { error })
            : localizeUi("ui.longTermMemory.memoryvault.savedButRecallIsStaleNoError"),
          { duration: 12_000 },
        );
      } else if (response.skipped.length) toast.warning(summary, { duration: 12_000 });
      else toast.success(summary);
      // The dates are saved, so a failed reload must not turn that into an error.
      await invalidateLtmQueries(queryClient, [
        queryKeys.notes,
        queryKeys.status,
        queryKeys.integrity,
        queryKeys.activity,
      ]).catch(() => undefined);
    } catch (error) {
      setMessage(errorMessage(error, localizeUi("ui.longTermMemory.storyDates.failed")));
    } finally {
      setSaving(false);
    }
  };
  const toggleRow = (noteId: string) =>
    setLeftOut((current) => {
      const next = new Set(current);
      if (!next.delete(noteId)) next.add(noteId);
      return next;
    });

  // Wait for the connection list before naming a connection, so the line does not change its words once it shows.
  const scopeReady = scope.data && (scopeConnectionId === null || !connections.isPending);
  const scopeConnection = scopeConnectionId
    ? (connections.data?.find((connection) => connection.id === scopeConnectionId) ?? null)
    : null;
  const scopeName = scopeConnection ? connectionLabel(scopeConnection) : (scope.data?.model ?? null);
  const scopeLine = scopeReady
    ? [
        scopeName ? localizeUi("ui.longTermMemory.tidy.scopeUses", { connection: scopeName }) : null,
        plural(scope.data.count, "ui.longTermMemory.storyDates.scopeOne", "ui.longTermMemory.storyDates.scopeOther"),
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const lock = lockedActionProps(saving);
  const nextAfter = preview?.next ?? null;
  const nextButton =
    nextAfter !== null ? (
      <Button
        data-ltm-story-dates-next
        onClick={() => {
          if (!saving) void start(nextAfter);
        }}
        {...lock}
      >
        {localizeUi("ui.longTermMemory.tidy.nextBatch")}
      </Button>
    ) : null;
  const checkedLine =
    preview && (preview.truncated || preview.failedChunks > 0 || preview.unchecked > 0) ? (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.storyDates.checked", { checked: preview.checked, total: preview.total })}
        </p>
        {phase === "results" ? nextButton : null}
      </div>
    ) : null;
  const titleOf = (noteId: string | null) => preview?.pieces.find((row) => row.noteId === noteId)?.title ?? "";
  // What the checks left out, with the reason; the pieces named stay as they were.
  const dropped = preview?.rejected.length ? (
    <details data-ltm-story-dates-dropped>
      <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold">
        {plural(
          preview.rejected.length,
          "ui.longTermMemory.storyDates.droppedOne",
          "ui.longTermMemory.storyDates.droppedOther",
        )}
      </summary>
      <ul className="space-y-1 overflow-y-auto text-xs text-[var(--muted-foreground)]" style={{ maxHeight: "10rem" }}>
        {preview.rejected.map((entry, index) => (
          <li key={index} data-ltm-story-dates-dropped-reason={entry.reason} className="break-words">
            {[
              titleOf(entry.noteId),
              localizeUi(REJECTED_REASON_KEYS[entry.reason]),
              entry.quote ? localizeUi("ui.longTermMemory.storyDates.quoted", { quote: entry.quote }) : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </li>
        ))}
      </ul>
    </details>
  ) : null;
  const back = (
    <Button data-ltm-story-dates-back onClick={onClose}>
      {localizeUi("ui.longTermMemory.longtermmemorydetail.back")}
    </Button>
  );

  return (
    <ModalDialog
      titleId={titleId}
      descriptionId={descriptionId}
      initialFocus="[data-ltm-story-dates-focus]"
      onCancel={onClose}
      panelClassName="max-w-lg max-h-full overflow-y-auto"
      data-ltm-story-dates-dialog
    >
      <h2 id={titleId} className="text-base font-semibold text-[var(--foreground)]">
        {localizeUi("ui.longTermMemory.storyDates.title")}
      </h2>
      <p id={descriptionId} className="text-sm text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.storyDates.text")}
      </p>
      <div ref={root} data-ltm-story-dates-state={phase} className="space-y-3">
        {phase === "confirm" ? (
          <>
            <p className="text-sm text-[var(--foreground)]">{localizeUi("ui.longTermMemory.storyDates.confirm")}</p>
            {/* Always present, one line tall, so Start does not move when the line fills in. */}
            <p
              data-ltm-story-dates-scope
              className="text-xs text-[var(--muted-foreground)]"
              style={{ minHeight: "1rem" }}
            >
              {scopeLine}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              {back}
              <Button primary data-ltm-story-dates-start data-ltm-story-dates-focus onClick={() => void start()}>
                {localizeUi("ui.longTermMemory.tidy.start")}
              </Button>
            </div>
          </>
        ) : null}
        {phase === "checking" ? (
          <>
            <StatusSurface busy>{localizeUi("ui.longTermMemory.storyDates.checking")}</StatusSurface>
            <div className="flex justify-end">
              <Button data-ltm-story-dates-cancel data-ltm-story-dates-focus onClick={cancel}>
                {localizeUi("ui.longTermMemory.memoryvault.cancel")}
              </Button>
            </div>
          </>
        ) : null}
        {phase === "results" && preview ? (
          <>
            <ul
              data-ltm-story-dates-list
              className="space-y-3 overflow-y-auto"
              style={{ maxHeight: "min(20rem, 40vh)" }}
            >
              {preview.pieces.map((row, index) => {
                const out = leftOut.has(row.noteId);
                const line = rowLine(row, localizeUi);
                return (
                  <li
                    key={row.noteId}
                    data-ltm-story-dates-row={row.noteId}
                    data-ltm-story-dates-left-out={out ? "" : undefined}
                    className={`flex items-start gap-2 ${out ? "opacity-50" : ""}`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="break-words text-sm font-medium text-[var(--foreground)]">
                        {row.title || row.noteId}
                      </p>
                      {line ? <p className="break-words text-xs text-[var(--muted-foreground)]">{line}</p> : null}
                      {row.kind === "scan"
                        ? row.jumps.map((jump, jumpIndex) => (
                            <p
                              key={jumpIndex}
                              data-ltm-story-dates-jump
                              className="break-words text-xs text-[var(--muted-foreground)]"
                            >
                              {describeStoryJump(
                                jump,
                                chatsWithLeftOut.has(row.chatId) ? null : row.reaches[jumpIndex],
                                locale,
                                localizeUi,
                              )}
                            </p>
                          ))
                        : null}
                    </div>
                    <Button
                      data-ltm-story-dates-reject={row.noteId}
                      aria-label={`${localizeUi(
                        out ? "ui.longTermMemory.storyDates.putBack" : "ui.longTermMemory.storyDates.leaveOut",
                      )}: ${row.title || row.noteId}`}
                      {...(index === 0 ? { "data-ltm-story-dates-focus": true } : {})}
                      onClick={() => {
                        if (!saving) toggleRow(row.noteId);
                      }}
                      {...lock}
                    >
                      {localizeUi(
                        out ? "ui.longTermMemory.storyDates.putBack" : "ui.longTermMemory.storyDates.leaveOut",
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {checkedLine}
            {dropped}
            {message ? <StatusSurface tone="danger">{message}</StatusSurface> : null}
            <div className="flex flex-wrap justify-end gap-2">
              {back}
              <Button primary data-ltm-story-dates-apply disabled={!kept.length} onClick={() => void apply()} {...lock}>
                {saving ? <Spinner /> : null}
                {plural(
                  kept.length,
                  "ui.longTermMemory.storyDates.applyOne",
                  "ui.longTermMemory.storyDates.applyOther",
                )}
              </Button>
            </div>
          </>
        ) : null}
        {phase === "empty" ? (
          <>
            <StatusSurface>{localizeUi("ui.longTermMemory.storyDates.empty")}</StatusSurface>
            {checkedLine}
            {dropped}
            <div className="flex flex-wrap justify-end gap-2">
              {nextButton}
              <Button data-ltm-story-dates-focus onClick={onClose}>
                {localizeUi("ui.longTermMemory.longtermmemorydetail.back")}
              </Button>
            </div>
          </>
        ) : null}
        {phase === "error" ? (
          <>
            <StatusSurface tone="danger">{message}</StatusSurface>
            <div className="flex flex-wrap justify-end gap-2">
              {back}
              <Button primary data-ltm-story-dates-focus onClick={() => void start(lastAfter.current)}>
                {localizeUi("errors.tryAgain")}
              </Button>
            </div>
          </>
        ) : null}
        {phase === "done" ? (
          <>
            <StatusSurface tone="success">{doneMessage}</StatusSurface>
            <div className="flex flex-wrap justify-end gap-2">
              {nextButton}
              <Button primary data-ltm-story-dates-focus onClick={onClose}>
                {localizeUi("ui.longTermMemory.memoryvault.done")}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </ModalDialog>
  );
}
