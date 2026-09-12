export class RegressionCompletionTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} regression did not reach completion within ${timeoutMs}ms`);
    this.name = "RegressionCompletionTimeoutError";
  }
}

const FORCE_EXIT_GRACE_MS = 1_000;

export async function runRegressionToCompletion(label, run, timeoutMs = 10 * 60 * 1000) {
  let timer;
  let forceExitTimer;
  let timedOut = false;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      process.exitCode = 1;
      forceExitTimer = setTimeout(() => process.exit(1), FORCE_EXIT_GRACE_MS);
      reject(new RegressionCompletionTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  try {
    await Promise.race([Promise.resolve().then(run), timeout]);
  } finally {
    clearTimeout(timer);
    if (!timedOut) clearTimeout(forceExitTimer);
  }
}
