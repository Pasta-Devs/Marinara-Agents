import { AsyncLocalStorage } from "node:async_hooks";
import { resolve } from "node:path";
import { withKeyedLock } from "../package-runtime.js";
const locks = new Map<string, Promise<void>>();
const active = new AsyncLocalStorage<Set<string>>();
export async function withLtmVaultLock<T>(root: string, operation: () => Promise<T>) {
  const key = resolve(root);
  const held = active.getStore();
  if (held?.has(key)) return operation();
  return withKeyedLock(locks, key, () => {
    const next = new Set(held);
    next.add(key);
    return active.run(next, operation);
  });
}
/** True when this async context already holds the root's vault lock (and so would not wait for it). */
export function holdsLtmVaultLock(root: string) {
  return active.getStore()?.has(resolve(root)) ?? false;
}
/**
 * Run `operation` outside every vault lock this context holds. Timers and promises created inside a held lock
 * inherit its context, so work started there would skip waiting for the lock it later takes.
 */
export function outsideLtmVaultLock<T>(operation: () => T) {
  return active.exit(operation);
}
