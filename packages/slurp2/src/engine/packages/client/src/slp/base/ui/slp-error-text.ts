/**
 * The words a failed action shows (R1-138). The server's own sentence only for a request the player
 * can fix (a 4xx with a plain `error` string); "Not enough coins" for a 402 whatever the server said;
 * otherwise the caller's localized fallback, never "Internal Server Error", "Failed to fetch" or the
 * first zod issue. Both `errorMessage` helpers route through here.
 */
export function slpErrorText(error: unknown, fallback: string, notEnoughCoins: string): string {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return fallback;
  if (status === 402) return notEnoughCoins;
  const serverText = ((error as { payload?: unknown }).payload as { error?: unknown } | null | undefined)?.error;
  return status >= 400 && status < 500 && typeof serverText === "string" && serverText.trim()
    ? serverText.trim()
    : fallback;
}
