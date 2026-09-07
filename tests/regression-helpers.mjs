export class RegressionCompletionTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} regression did not reach completion within ${timeoutMs}ms`);
    this.name = "RegressionCompletionTimeoutError";
  }
}

export async function runRegressionToCompletion(label, run, timeoutMs = 10 * 60 * 1000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new RegressionCompletionTimeoutError(label, timeoutMs)), timeoutMs);
  });

  try {
    await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
