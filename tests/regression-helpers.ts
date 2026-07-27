export async function runWithSafeCleanup(
  label: string,
  run: () => Promise<void>,
  cleanupSteps: Array<() => unknown | Promise<unknown>>,
) {
  let primaryError: unknown;
  try {
    await run();
  } catch (error) {
    primaryError = error;
  }
  let cleanupError: unknown;
  for (const cleanup of cleanupSteps) {
    try {
      await cleanup();
    } catch (error) {
      cleanupError ??= error;
    }
  }
  if (primaryError) {
    if (cleanupError) console.error(`${label} cleanup failed after the primary failure`, cleanupError);
    throw primaryError;
  }
  if (cleanupError) throw cleanupError;
}
