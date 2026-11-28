import type { LtmDebugEvent } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

/**
 * Chat Settings is its own host view and cannot navigate inside the detail view, so it leaves a short-lived request
 * that the detail view reads when it opens. A stale request (the detail view was already open) is ignored.
 */
export type LtmOpenTarget = "review" | "extraction" | "sources" | "memory" | "setup" | "activity";

const OPEN_REQUEST_MAX_AGE_MS = 5000;
let openRequest: { target: LtmOpenTarget; at: number; id?: string } | null = null;

/** `id` goes with the "memory" target (the memory the Vault opens on) and the "activity" target (the recall attempt Activity selects). */
export function requestLtmOpen(target: LtmOpenTarget, id?: string) {
  openRequest = { target, at: Date.now(), ...(id ? { id } : {}) };
}

export function peekLtmOpenRequest(): LtmOpenTarget | null {
  return openRequest && Date.now() - openRequest.at < OPEN_REQUEST_MAX_AGE_MS ? openRequest.target : null;
}

function peekOpenId(target: LtmOpenTarget): string | null {
  return openRequest?.target === target && Date.now() - openRequest.at < OPEN_REQUEST_MAX_AGE_MS
    ? (openRequest.id ?? null)
    : null;
}

export const peekLtmOpenNoteId = () => peekOpenId("memory");
export const peekLtmOpenOperationId = () => peekOpenId("activity");

export function clearLtmOpenRequest() {
  openRequest = null;
}

type AutoImportEvents = Pick<LtmDebugEvent, "ts" | "action" | "status" | "chatId" | "source" | "counts" | "error">;

/** Memories background import saved for this chat after `sinceMs` (the last recall; 0 counts them all). */
export function autoImportSavedSince(events: AutoImportEvents[], chatId: string, sinceMs: number) {
  return events.reduce(
    (sum, event) =>
      event.action === "auto_import" && event.chatId === chatId && Date.parse(event.ts) > sinceMs
        ? sum + (event.counts?.applied ?? 0)
        : sum,
    0,
  );
}

/** When the last recall for the chat ran (0 when none did): what "new" is measured against on the card. */
export function lastRecallAt(data?: { dispatchedAt?: string | null; attempt?: { at: string } | null } | null) {
  const times = [data?.dispatchedAt, data?.attempt?.at].map((value) => (value ? Date.parse(value) : 0));
  return Math.max(0, ...times.filter(Number.isFinite));
}

/** The messages an import hid after `sinceMs`, or null once a later reply has used the chat. */
export function hiddenSince(hidden: { from: number; to: number; at: string } | null | undefined, sinceMs: number) {
  return hidden && Date.parse(hidden.at) > sinceMs ? hidden : null;
}

/** The one sentence for a hide, as the card line and the toast both say it: the locale key and its values. */
export function ltmHiddenLine(hidden: { from: number; to: number }) {
  return hidden.from === hidden.to
    ? (["ui.longTermMemory.lastinjectionsummary.hiddenOne", { from: hidden.from }] as const)
    : (["ui.longTermMemory.lastinjectionsummary.hiddenRange", { from: hidden.from, to: hidden.to }] as const);
}

/**
 * What the hidden-messages toast does with a read: `seen` is the newest hide it already dealt with (undefined before the
 * first read of the chat, which only records one: an old hide is not news). Says the hide once, unless the card says it.
 */
export function hiddenToastStep(
  seen: string | undefined,
  hidden: { at: string } | null | undefined,
  cardOpen: boolean,
) {
  return {
    seen: hidden?.at ?? seen ?? "",
    say: seen !== undefined && !!hidden && hidden.at !== seen && !cardOpen,
  };
}

// Chats whose card (Chat Settings or the Agent activity panel) is open right now: the hidden-messages line is on screen there, so no toast says it too.
const cardOpen = new Map<string, number>();
export function markLtmCardOpen(chatId: string) {
  cardOpen.set(chatId, (cardOpen.get(chatId) ?? 0) + 1);
  return () => {
    const left = (cardOpen.get(chatId) ?? 1) - 1;
    if (left > 0) cardOpen.set(chatId, left);
    else cardOpen.delete(chatId);
  };
}
export const isLtmCardOpen = (chatId: string) => cardOpen.has(chatId);

/**
 * The latest finished background import of each source of this chat, or of any chat without `chatId`. Background import
 * once also read chat summaries (source "chats"); those events never get a newer run now, so a failure among them
 * would stay shown for good and is ignored.
 */
function latestAutoImports(events: AutoImportEvents[], chatId?: string | null) {
  const latest = new Map<string, AutoImportEvents>();
  for (const event of events) {
    if (event.action !== "auto_import" || event.status === "started") continue;
    if (chatId && event.chatId !== chatId) continue;
    if (event.source === "chats") continue;
    const key = event.source ?? "";
    const current = latest.get(key);
    if (!current || Date.parse(event.ts) >= Date.parse(current.ts)) latest.set(key, event);
  }
  return [...latest.values()];
}

/**
 * The latest background import stopped for lack of a language model connection. A later run of that
 * source that works clears it, so it never outlives the cause.
 */
export function autoImportNeedsConnection(events: AutoImportEvents[], chatId?: string | null) {
  return latestAutoImports(events, chatId).some(
    (event) => event.status === "error" && event.error?.code === "ltm_model_configuration",
  );
}

/**
 * When the latest background read of this chat failed for another reason (a provider error, an unusable answer), the
 * time it failed and its cause: the event's first line when it is short enough to read in a sentence. A later run that
 * works clears it.
 */
export function autoImportFailure(events: AutoImportEvents[], chatId: string) {
  const failed = latestAutoImports(events, chatId).filter(
    (event) => event.status === "error" && event.error?.code !== "ltm_model_configuration",
  );
  if (!failed.length) return null;
  const newest = failed.reduce((latest, event) => (Date.parse(event.ts) >= Date.parse(latest.ts) ? event : latest));
  const cause = newest.error?.message?.split("\n")[0]?.trim() ?? "";
  return { at: Date.parse(newest.ts), cause: cause && cause.length <= 60 ? cause : null };
}

// A run that never logged its end (the server stopped mid-run) must not leave the chip up for good.
const READING_MAX_AGE_MS = 10 * 60 * 1000;

/** True while a source-note extraction has started and not yet ended: an operation whose newest event is `started`. */
export function isReadingNow(
  events: Pick<LtmDebugEvent, "ts" | "action" | "status" | "operationId">[],
  now = Date.now(),
) {
  const latest = new Map<string, (typeof events)[number]>();
  for (const event of events) {
    if (event.action !== "extract_source_note") continue;
    const current = latest.get(event.operationId);
    if (!current || Date.parse(event.ts) >= Date.parse(current.ts)) latest.set(event.operationId, event);
  }
  return [...latest.values()].some(
    (event) => event.status === "started" && now - Date.parse(event.ts) < READING_MAX_AGE_MS,
  );
}
