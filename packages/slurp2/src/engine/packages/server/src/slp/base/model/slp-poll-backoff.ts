/**
 * Scheduler polls that call a provider must not retry a broken connection once a minute forever:
 * a failed automatic attempt does not burn daily budget (by design), so nothing else slows the
 * poll down. Back off on consecutive failures and reset as soon as one pass gets through.
 */
export const SLURP_POLL_BACKOFF_MAX_MS = 30 * 60_000;

export function slurpPollBackoffMs(
  baseMs: number,
  consecutiveFailures: number,
  maxMs = SLURP_POLL_BACKOFF_MAX_MS,
): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, consecutiveFailures));
}
