import { isConnectionAdmissionFailure } from "../generation/connection-admission.js";

/**
 * A post whose image failed still publishes — the text is the post — so the picture is retried on
 * a later poll instead of being lost. Bounded, because a misconfigured image connection must not
 * mean one provider call per post per poll for ever.
 */
export const NOODLER_POST_IMAGE_RETRY_LIMIT = 3;

/**
 * Post metadata is parsed from persisted JSON, so the counter is whatever was written last —
 * possibly a string, null, or absent. A NaN here would read as "under the limit" for ever and
 * write back null, so the retry budget would never advance and the loop this limit exists to
 * stop would run anyway.
 */
export function noodlerPostImageRetryAttempts(metadata: Record<string, unknown>): number {
  const attempts = Math.floor(Number(metadata.imageRetryAttempts));
  return Number.isFinite(attempts) && attempts > 0 ? attempts : 0;
}

export const NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS = 2;
export const NOODLE_IMAGE_GENERATION_RETRY_DELAY_MS = 500;

export async function generateNoodleImageWithRetry<T>(
  generate: (attempt: number) => Promise<T>,
  onAttemptFailure?: (error: unknown, attempt: number, maxAttempts: number) => void | Promise<void>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await generate(attempt);
    } catch (error) {
      // A busy connection is not a transient provider fault: retrying cannot admit us any
      // sooner, and the caller needs the rejection now so the run defers instead of degrading.
      if (isConnectionAdmissionFailure(error)) throw error;
      lastError = error;
      await onAttemptFailure?.(error, attempt, NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS);
      if (attempt < NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, NOODLE_IMAGE_GENERATION_RETRY_DELAY_MS * attempt));
      }
    }
  }

  throw lastError;
}
