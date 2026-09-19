import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpPromptErrorKind } from "./slp-messages-contract.js";

export function getSlurpPromptErrorKind(error: unknown): SlurpPromptErrorKind {
  if (error instanceof ApiError) {
    if (
      error.status === 404 &&
      typeof error.payload === "object" &&
      error.payload !== null &&
      "code" in error.payload &&
      error.payload.code === "debug_disabled"
    ) {
      return "disabled";
    }
    if (error.status === 409) return "connection";
    if (error.status === 401 || error.status === 403) return "unauthorized";
    if (error.status === 404) return "not-found";
  }
  return "generic";
}
export const messageKeys = {
  /** Every messaging query hangs off this, so one prefix invalidates the whole surface. */
  root: () => [...slpKeys.noodlerRoot(), "messages"],
  threads: (personaId: string | null) => [...slpKeys.noodlerRoot(), "messages", "threads", personaId ?? "none"],
  thread: (threadId: string, personaId: string | null) => [
    ...slpKeys.noodlerRoot(),
    "messages",
    "thread",
    threadId,
    personaId ?? "none",
  ],
};
/**
 * What a message or commission mutation actually changes.
 *
 * These used to invalidate the whole Slurp root, which re-ran the viewer feed and every profile's
 * post list — and both of those page through the entire history in one request. Sending one chat
 * line refetched the app.
 */
export const invalidateSlurpMessages = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all(
    [
      messageKeys.root(),
      [...slpKeys.noodlerRoot(), "wallet"],
      [...slpKeys.noodlerRoot(), "viewer-wallets"],
      [...slpKeys.noodlerRoot(), "notifications"],
    ].map((queryKey) => qc.invalidateQueries({ queryKey })),
  );
