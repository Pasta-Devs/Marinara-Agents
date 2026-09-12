const activeAccountOperations = new Set<string>();

export type NoodlerAccountOperationResult<T> = { acquired: true; value: T } | { acquired: false };

/**
 * Serializes identity-sensitive work for one NoodleR account in this server process.
 * It intentionally does not coordinate multiple Marinara processes.
 */
/** True while any account operation is in flight. A backup must not run across one. */
export function hasActiveNoodlerAccountOperations(): boolean {
  return activeAccountOperations.size > 0;
}

export async function tryNoodlerAccountOperation<T>(
  accountId: string,
  operation: () => Promise<T>,
): Promise<NoodlerAccountOperationResult<T>> {
  if (activeAccountOperations.has(accountId)) return { acquired: false };
  activeAccountOperations.add(accountId);
  try {
    return { acquired: true, value: await operation() };
  } finally {
    activeAccountOperations.delete(accountId);
  }
}
