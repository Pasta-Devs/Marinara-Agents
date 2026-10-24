import { AsyncLocalStorage as ForgeStoryScope } from "node:async_hooks";

const forgeStoryScope = new ForgeStoryScope();
const forgeStoryCancelled = () => new DOMException("Story generation cancelled.", "AbortError");

export function forgeStoryGenerationSignal() {
  return forgeStoryScope.getStore()?.signal;
}

export function forgeStoryAssertActive() {
  const scope = forgeStoryScope.getStore();
  if (!scope) return;
  scope.signal.throwIfAborted();
  if (!scope.current()) throw forgeStoryCancelled();
}

export function forgeStoryDocuments(documents) {
  return {
    ...documents,
    create(...args) {
      forgeStoryAssertActive();
      return documents.create(...args);
    },
    update(...args) {
      forgeStoryAssertActive();
      return documents.update(...args);
    },
  };
}

export function createForgeStoryCancellation() {
  const worlds = new Map();
  let disposed = false;
  return {
    async run(runId, operation) {
      if (typeof runId !== "string" || !runId.trim()) return { ok: false, error: "bad-request" };
      if (disposed) return { ok: false, error: "cancelled" };
      let state = worlds.get(runId);
      if (!state || state.controller.signal.aborted) {
        state = { controller: new AbortController(), epoch: state?.epoch || 0 };
        worlds.set(runId, state);
      }
      const { signal } = state.controller,
        epoch = state.epoch;
      return forgeStoryScope.run(
        { signal, current: () => worlds.get(runId) === state && state.epoch === epoch },
        async () => {
          let onAbort;
          const aborted = new Promise((_, reject) => {
            onAbort = () => reject(signal.reason);
            signal.addEventListener("abort", onAbort, { once: true });
          });
          try {
            const result = await Promise.race([
              Promise.resolve().then(() => {
                forgeStoryAssertActive();
                return operation(signal);
              }),
              aborted,
            ]);
            forgeStoryAssertActive();
            return result;
          } catch (error) {
            if (signal.aborted) return { ok: false, error: "cancelled" };
            throw error;
          } finally {
            signal.removeEventListener("abort", onAbort);
          }
        },
      );
    },
    cancel(runId) {
      const state = worlds.get(runId);
      if (!state) return false;
      state.epoch++;
      state.controller.abort(forgeStoryCancelled());
      return true;
    },
    dispose() {
      disposed = true;
      for (const state of worlds.values()) state.controller.abort(forgeStoryCancelled());
      worlds.clear();
    },
  };
}
