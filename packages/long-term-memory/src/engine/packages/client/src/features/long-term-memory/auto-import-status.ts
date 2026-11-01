import { useQuery } from "@tanstack/react-query";
import type { LtmDebugEvent } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { queryKeys, request } from "./api";

/**
 * Chat Settings is its own host view and cannot navigate inside the detail view, so it leaves a short-lived request
 * that the detail view reads when it opens. A stale request (the detail view was already open) is ignored.
 */
export type LtmOpenTarget = "review" | "extraction" | "sources";

const OPEN_REQUEST_MAX_AGE_MS = 5000;
let openRequest: { target: LtmOpenTarget; at: number } | null = null;

export function requestLtmOpen(target: LtmOpenTarget) {
  openRequest = { target, at: Date.now() };
}

export function peekLtmOpenRequest(): LtmOpenTarget | null {
  return openRequest && Date.now() - openRequest.at < OPEN_REQUEST_MAX_AGE_MS ? openRequest.target : null;
}

export function clearLtmOpenRequest() {
  openRequest = null;
}

type AutoImportEvents = Pick<LtmDebugEvent, "ts" | "action" | "status" | "chatId" | "source" | "counts" | "error">;

/** The newest import events (the route's largest page, since manual imports share the phase); reading them needs no new server route. */
export function useAutoImportEvents(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: [...queryKeys.activity, "auto-import"],
    queryFn: () => request<{ events: LtmDebugEvent[] }>("/debug-log?phase=import&limit=1000"),
  });
}

/** Memories background import saved for this chat since local midnight. */
export function autoImportSavedToday(events: AutoImportEvents[], chatId: string, now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return events.reduce(
    (sum, event) =>
      event.action === "auto_import" && event.chatId === chatId && Date.parse(event.ts) >= midnight
        ? sum + (event.counts?.applied ?? 0)
        : sum,
    0,
  );
}

/**
 * The latest background import of either source (chats, messages) of this chat, or of any chat without `chatId`,
 * stopped for lack of a language model connection. A later run of that source that works clears it, so it never
 * outlives the cause.
 */
export function autoImportNeedsConnection(events: AutoImportEvents[], chatId?: string | null) {
  const latest = new Map<string, AutoImportEvents>();
  for (const event of events) {
    if (event.action !== "auto_import" || event.status === "started") continue;
    if (chatId && event.chatId !== chatId) continue;
    const key = event.source ?? "";
    const current = latest.get(key);
    if (!current || Date.parse(event.ts) >= Date.parse(current.ts)) latest.set(key, event);
  }
  return [...latest.values()].some(
    (event) => event.status === "error" && event.error?.code === "ltm_model_configuration",
  );
}
