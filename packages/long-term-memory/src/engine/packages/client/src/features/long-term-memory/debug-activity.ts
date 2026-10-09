import type { LtmDebugEvent } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export type DebugOperation = { operationId: string; events: LtmDebugEvent[] };
export type DebugActivityFilter = "all" | "errors" | LtmDebugEvent["phase"];
export type DebugOperationStatus = LtmDebugEvent["status"] | "completed_with_warnings" | "incomplete";

/** A started-only operation older than this reads "No completion recorded" instead of "Running". */
export const LTM_DEBUG_STALE_OPERATION_MS = 60 * 60 * 1000;

// Ids are lowercase snake_case (`schema.ts` `ltmIdentifierSchema`); UUIDs are the
// internal record identifiers. Match whole tokens so an id that is a prefix of an
// unknown id (deleted, proposed, another vault) is left alone instead of mangled.
const UUID_SOURCE = "\\b[0-9a-f]{8}-[0-9a-f-]{27,}\\b";
const NOTE_ID_SOURCE = "[a-z][a-z0-9]*(?:_[a-z0-9]+)*";
const NOTE_ID_ONLY_PATTERN = new RegExp(`^${NOTE_ID_SOURCE}$`);
const DEBUG_TOKEN_PATTERN = new RegExp(
  `(?:${UUID_SOURCE})|(?<![A-Za-z0-9_])(?:${NOTE_ID_SOURCE})(?![A-Za-z0-9_])`,
  "gi",
);
const UUID_ONLY_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

export function isTruncatedResponse(event: LtmDebugEvent) {
  return (
    event.action === "evidence_unit_response" &&
    ["length", "max_tokens", "token_limit"].includes(String(event.details?.finishReason ?? "").toLowerCase())
  );
}

export function groupOperations(events: readonly LtmDebugEvent[]): DebugOperation[] {
  const operations = new Map<string, LtmDebugEvent[]>();
  for (const event of events) {
    const operation = operations.get(event.operationId) ?? [];
    operation.push(event);
    operations.set(event.operationId, operation);
  }
  return [...operations.entries()]
    .map(([operationId, operationEvents]) => ({
      operationId,
      events: [...operationEvents].sort((left, right) => left.ts.localeCompare(right.ts)),
    }))
    .sort((left, right) => right.events.at(-1)!.ts.localeCompare(left.events.at(-1)!.ts));
}

/** Filters whole operations: an operation is kept when any of its events matches, and it keeps all of its events. */
export function filterOperations(operations: readonly DebugOperation[], filter: DebugActivityFilter): DebugOperation[] {
  if (filter === "all") return [...operations];
  return operations.filter((operation) =>
    operation.events.some((event) => (filter === "errors" ? event.status === "error" : event.phase === filter)),
  );
}

export function deriveOperationStatus(
  events: readonly LtmDebugEvent[],
  options: { now?: number; staleMs?: number } = {},
): DebugOperationStatus {
  const started = events.find((event) => event.status === "started");
  const terminal = started
    ? events.findLast(
        (event) =>
          event.phase === started.phase &&
          (event.action === started.action ||
            (started.action === "evidence_unit_request" && event.action === "evidence_unit_response")) &&
          event.status !== "started",
      )
    : events.at(-1);
  const status =
    terminal?.status ?? (events.some((event) => event.status === "error") ? "error" : started ? "started" : "warning");
  if (
    status === "ok" &&
    events.some((event) => event.status === "warning" || event.status === "error" || isTruncatedResponse(event))
  ) {
    return "completed_with_warnings";
  }
  if (status === "started" && options.now != null && options.staleMs != null) {
    const lastMs = Date.parse(events.at(-1)?.ts ?? "");
    if (Number.isFinite(lastMs) && options.now - lastMs > options.staleMs) return "incomplete";
  }
  return status;
}

/** Collects the note ids that can appear in an event's rendered text or structured fields. */
export function collectDebugNoteIds(events: readonly LtmDebugEvent[]): string[] {
  const ids = new Set<string>();
  const collectText = (value: unknown) => {
    if (typeof value !== "string") return;
    for (const [token] of value.matchAll(DEBUG_TOKEN_PATTERN)) {
      // ponytail: only multi-segment ids are collected from prose, so ordinary
      // lowercase words are not requested as ids. Single-segment ids in prose
      // stay raw; collect them too if that shows up in practice.
      // Ids are capped at 120 chars (`ltmIdentifierSchema`); a longer prose
      // token would fail the whole batch and blank every title.
      if (!UUID_ONLY_PATTERN.test(token) && token.includes("_") && token.length <= 120) ids.add(token.toLowerCase());
    }
  };
  for (const event of events) {
    if (event.sourceNoteId) ids.add(event.sourceNoteId);
    if (event.noteId) ids.add(event.noteId);
    collectText(event.error?.message);
    collectText(event.message);
    collectText(event.uiSummary);
    const details = event.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) continue;
    collectText((details as Record<string, unknown>).summary);
    if (Array.isArray(details.targetNoteIds))
      for (const id of details.targetNoteIds)
        if (typeof id === "string" && id.length <= 120 && NOTE_ID_ONLY_PATTERN.exec(id)?.[0] === id) ids.add(id);
    for (const key of ["selected", "rejected"] as const) {
      const candidates = (details as Record<string, unknown>)[key];
      if (!Array.isArray(candidates)) continue;
      for (const candidate of candidates) {
        if (
          candidate &&
          typeof candidate === "object" &&
          typeof (candidate as { noteId?: unknown }).noteId === "string"
        )
          ids.add((candidate as { noteId: string }).noteId);
      }
    }
  }
  return [...ids].sort();
}

/** Replaces known note ids with their titles and UUIDs with the internal-record label. */
export function humanizeDebugText(
  text: string,
  titlesByNoteId: ReadonlyMap<string, string>,
  internalRecordLabel: string,
) {
  return text.replace(DEBUG_TOKEN_PATTERN, (token) => {
    if (UUID_ONLY_PATTERN.test(token)) return internalRecordLabel;
    return titlesByNoteId.get(token.toLowerCase()) ?? token;
  });
}
