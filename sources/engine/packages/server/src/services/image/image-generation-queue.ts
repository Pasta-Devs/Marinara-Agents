type MediaGenerationQueueTask<T> = () => Promise<T>;

const mediaGenerationQueueTails = new Map<string, Promise<void>>();

function mediaGenerationAbortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Media generation request aborted");
}

async function waitForMediaGenerationTurn(previous: Promise<void>, signal?: AbortSignal): Promise<void> {
  const settledPrevious = previous.catch(() => undefined);
  if (!signal) {
    await settledPrevious;
    return;
  }
  if (signal.aborted) throw mediaGenerationAbortError(signal);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(mediaGenerationAbortError(signal)));

    signal.addEventListener("abort", onAbort, { once: true });
    void settledPrevious.then(() => finish(resolve));
  });
}

/**
 * Serialize media provider requests per configured connection when the caller's
 * global queue preference is enabled. Callers that disable the preference
 * bypass the queue entirely, while queued callers retain FIFO ordering.
 */
export async function runMediaGenerationRequest<T>(args: {
  connectionKey: string;
  queue: boolean;
  task: MediaGenerationQueueTask<T>;
  signal?: AbortSignal;
}): Promise<T> {
  if (!args.queue) {
    if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
    return args.task();
  }

  const connectionKey = args.connectionKey.trim() || "default";
  const previous = mediaGenerationQueueTails.get(connectionKey) ?? Promise.resolve();
  let releaseCurrent: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const queuedTail = previous.catch(() => undefined).then(() => current);
  mediaGenerationQueueTails.set(connectionKey, queuedTail);

  try {
    await waitForMediaGenerationTurn(previous, args.signal);
    if (args.signal?.aborted) throw mediaGenerationAbortError(args.signal);
    return await args.task();
  } finally {
    releaseCurrent();
    void queuedTail.finally(() => {
      if (mediaGenerationQueueTails.get(connectionKey) === queuedTail) {
        mediaGenerationQueueTails.delete(connectionKey);
      }
    });
  }
}

/** Backward-compatible image-specific entry point for existing callers. */
export const runImageGenerationRequest = runMediaGenerationRequest;
