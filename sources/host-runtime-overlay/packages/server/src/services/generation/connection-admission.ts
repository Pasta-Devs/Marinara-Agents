// Host overlay for services/generation/connection-admission.ts (Pasta-Devs/Marinara-Agents#1487). Admission
// is the Engine's (api.runtime.integrations.admission): one slot table per connection, shared with the
// user's chats, so package background work waits while a chat is streaming. The vendored copy kept its
// own table, which never saw the Engine's foreground work.
import type { BaseLLMProvider } from "../llm/base-provider.js";
import { hostIntegrations, hostRuntime, requireHostMember, type HostProvider } from "../../lib/host-runtime.js";

export const BACKGROUND_CONNECTION_IDLE_MS = 30_000;

export type ConnectionAttemptOutcome = "completed" | "failed";
export type ConnectionAttemptFinalizer = (outcome: ConnectionAttemptOutcome) => void | Promise<void>;
export type ConnectionAdmissionMode =
  | { kind: "foreground" }
  | {
      kind: "background";
      beforeAttempt?: () => void | ConnectionAttemptFinalizer | Promise<void | ConnectionAttemptFinalizer>;
    }
  | { kind: "none" };

/**
 * Marks a request the server issued to itself on a scheduler's behalf. Background admission is
 * strictly self-limiting, so this is a routing hint, not a privilege.
 */
export const AUTOMATIC_GENERATION_HEADER = "x-marinara-automatic-generation";

export function admissionModeForRequest(headers: Record<string, unknown>): ConnectionAdmissionMode {
  return headers[AUTOMATIC_GENERATION_HEADER] === "1" ? { kind: "background" } : { kind: "foreground" };
}

function admission() {
  return requireHostMember("Waiting for a busy connection", hostIntegrations().admission);
}

const ADMISSION_ERROR_NAMES = new Set([
  "BackgroundConnectionBusyError",
  "ConnectionAttemptRejectedError",
  "ConnectionAttemptFinalizationError",
]);

/** The Engine's own check; by class name when the Engine has no admission member to ask. Never throws: it runs in catch blocks. */
export function isConnectionAdmissionFailure(error: unknown): boolean {
  const host = hostRuntime().integrations?.admission;
  if (host) return host.isFailure(error);
  return error instanceof Error && ADMISSION_ERROR_NAMES.has(error.name);
}

export function tryBackgroundConnection(
  connectionId: string,
  at: Date,
): { acquired: false } | { acquired: true; release: (outcome?: ConnectionAttemptOutcome) => void } {
  return admission().tryBackground(connectionId, at);
}

export function withConnectionAdmission<T>(
  connectionId: string,
  mode: ConnectionAdmissionMode,
  operation: () => Promise<T>,
): Promise<T> {
  return admission().run(connectionId, mode, operation);
}

/** The provider must be one the Engine created (createLLMProvider, withConnectionFallbackProvider). */
export function withConnectionAdmissionProvider(
  provider: BaseLLMProvider,
  connectionId: string,
  mode: ConnectionAdmissionMode = { kind: "foreground" },
): BaseLLMProvider {
  if (mode.kind === "none") return provider;
  return admission().withProvider(
    provider as unknown as HostProvider,
    connectionId,
    mode,
  ) as unknown as BaseLLMProvider;
}
