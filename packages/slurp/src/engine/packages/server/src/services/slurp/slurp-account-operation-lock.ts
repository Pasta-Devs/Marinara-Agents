const activeAccountOperations = new Set<string>();
import { isSlurpBackupActive } from "./slurp-backup-state.js";

export type NoodlerAccountOperationResult<T> = { acquired: true; value: T } | { acquired: false };

export function hasActiveNoodlerAccountOperations(): boolean {
  return activeAccountOperations.size > 0;
}

/**
 * Serializes identity-sensitive work for one NoodleR account in this server process.
 * It intentionally does not coordinate multiple Marinara processes.
 */
export async function tryNoodlerAccountOperation<T>(
  accountId: string,
  operation: () => Promise<T>,
): Promise<NoodlerAccountOperationResult<T>> {
  if (isSlurpBackupActive() || activeAccountOperations.has(accountId)) return { acquired: false };
  activeAccountOperations.add(accountId);
  try {
    return { acquired: true, value: await operation() };
  } finally {
    activeAccountOperations.delete(accountId);
  }
}
