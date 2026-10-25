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

export function forgeStoryWork(operation) {
  forgeStoryAssertActive();
  const pending = operation();
  forgeStoryScope.getStore()?.trackOperation(pending);
  return pending;
}

export function forgeStoryDocuments(documents) {
  return {
    ...documents,
    create(...args) {
      forgeStoryAssertActive();
      const write = documents.create(...args);
      forgeStoryScope.getStore()?.trackWrite(write);
      return write;
    },
    update(...args) {
      forgeStoryAssertActive();
      const write = documents.update(...args);
      forgeStoryScope.getStore()?.trackWrite(write);
      return write;
    },
  };
}

export function createForgeStoryCancellation() {
  const worlds = new Map();
  let disposed = false;
  const world = (runId) => {
    let state = worlds.get(runId);
    if (!state) {
      state = {
        controller: new AbortController(),
        epoch: 0,
        operations: new Set(),
        writes: new Set(),
        resetting: false,
      };
      worlds.set(runId, state);
    }
    return state;
  };
  const track = (pending, value) => {
    const promise = Promise.resolve(value);
    pending.add(promise);
    const settled = () => pending.delete(promise);
    void promise.then(settled, settled);
  };
  return {
    async run(runId, operation) {
      if (typeof runId !== "string" || !runId.trim()) return { ok: false, error: "bad-request" };
      if (disposed) return { ok: false, error: "cancelled" };
      const state = world(runId);
      // A detached child must not turn its canceled parent's epoch into a fresh request.
      const parent = forgeStoryScope.getStore();
      const admittedChild = parent?.runId === runId && parent.current();
      if (state.resetting && !(state.resetting === "checking" && admittedChild))
        return { ok: false, error: "reset-in-progress" };
      if (parent?.runId === runId && !parent.current()) return { ok: false, error: "cancelled" };
      if (state.controller.signal.aborted) state.controller = new AbortController();
      const { signal } = state.controller,
        epoch = state.epoch;
      return forgeStoryScope.run(
        {
          runId,
          signal,
          current: () => worlds.get(runId) === state && state.epoch === epoch,
          trackWrite: (write) => track(state.writes, write),
          trackOperation: (pending) => track(state.operations, pending),
        },
        async () => {
          let onAbort;
          const aborted = new Promise((_, reject) => {
            onAbort = () => reject(signal.reason);
            if (signal.aborted) onAbort();
            else signal.addEventListener("abort", onAbort, { once: true });
          });
          const operationPromise = Promise.resolve().then(() => {
            forgeStoryAssertActive();
            return operation(signal);
          });
          track(state.operations, operationPromise);
          try {
            const result = await Promise.race([operationPromise, aborted]);
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
    async reset(runId, operation, beforeCancel) {
      if (typeof runId !== "string" || !runId.trim()) return { ok: false, error: "bad-request" };
      if (disposed) return { ok: false, error: "cancelled" };
      if (forgeStoryScope.getStore()?.runId === runId) return { ok: false, error: "reset-in-progress" };
      const state = world(runId);
      if (state.resetting) return { ok: false, error: "reset-in-progress" };
      state.resetting = "checking";
      try {
        // Another reset may have committed after the caller's initial precheck.
        // Deny that stale request before it can cancel the newly generated story.
        const permitted = await beforeCancel?.();
        if (permitted?.ok === false) return permitted;
        if (disposed) return { ok: false, error: "cancelled" };
        state.resetting = "draining";
        state.epoch++;
        state.controller.abort(forgeStoryCancelled());
        // Cancel replies promptly; destructive reset joins the actual work, including writes
        // that entered persistence before their epoch lost permission to start another one.
        while (state.operations.size || state.writes.size) {
          await Promise.allSettled([...state.operations, ...state.writes]);
        }
        if (disposed) return { ok: false, error: "cancelled" };
        return await forgeStoryScope.run(undefined, operation);
      } finally {
        state.resetting = false;
      }
    },
    dispose() {
      disposed = true;
      for (const state of worlds.values()) state.controller.abort(forgeStoryCancelled());
      worlds.clear();
    },
  };
}
