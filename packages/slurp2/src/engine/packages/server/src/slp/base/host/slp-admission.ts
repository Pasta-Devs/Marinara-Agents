/**
 * Connection-admission errors, recognised by name.
 *
 * The package build bundles its own copy of the Engine's `connection-admission` classes, while the
 * host integrations throw the Engine's. `instanceof` therefore never matched a host error: a busy
 * connection was logged as a failed poll, counted as a failed image attempt, and backed the
 * publishing poll off. The class names are the stable contract across both copies.
 */
const ADMISSION_ERROR_NAMES = new Set([
  "BackgroundConnectionBusyError",
  "ConnectionAttemptRejectedError",
  "ConnectionAttemptFinalizationError",
]);

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

/** Nothing was sent to the provider: a deferral, not a failure. */
export function slpIsAdmissionFailure(error: unknown): boolean {
  return ADMISSION_ERROR_NAMES.has(errorName(error));
}

/** The connection is taken by foreground work right now. */
export function slpIsBackgroundBusy(error: unknown): boolean {
  return errorName(error) === "BackgroundConnectionBusyError";
}

/** An attempt rejected before provider work, with its cause. */
export function slpAdmissionRejectionCause(error: unknown): unknown {
  return errorName(error) === "ConnectionAttemptRejectedError" ? (error as { cause?: unknown }).cause : undefined;
}
