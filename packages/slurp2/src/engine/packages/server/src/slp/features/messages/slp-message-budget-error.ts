/** Expected throttling, kept distinct from connection and generation failures. */
export class SlurpMessageBudgetUnavailableError extends Error {
  constructor(readonly retryAt: string | null) {
    super("Slurp AI reply budget is unavailable.");
    this.name = "SlurpMessageBudgetUnavailableError";
  }
}
