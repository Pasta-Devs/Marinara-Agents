import { AsyncLocalStorage } from "node:async_hooks";
import { resolve } from "node:path";
import { withKeyedLock } from "./package-runtime.js";
const locks = new Map<string, Promise<void>>();
const active = new AsyncLocalStorage<Set<string>>();
export async function withLtmVaultLock<T>(root: string, operation: () => Promise<T>) {
  const key = resolve(root); const held = active.getStore(); if (held?.has(key)) return operation();
  return withKeyedLock(locks, key, () => { const next = new Set(held); next.add(key); return active.run(next, operation); });
}
