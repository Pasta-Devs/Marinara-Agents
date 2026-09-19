import { hasActiveCreatorAccountOperations } from "./slp-account-operation-lock.js";
import {
  hasActiveSlurpMutations,
  isSlurpBackupActive as readSlurpBackupActive,
  setSlurpBackupActive,
} from "./slp-backup-state.js";
import { claimSlurpDataDeletion, isSlurpDataDeletionActive } from "./slp-data-deletion-state.js";

const activeSlpOperations = new Set<string>();

function claimSlpOperation(key: string): (() => void) | null {
  if (activeSlpOperations.has(key)) return null;
  activeSlpOperations.add(key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeSlpOperations.delete(key);
  };
}

/**
 * Claim exclusive access for a backup export or a restore.
 *
 * A backup is only meaningful if nothing mutates underneath it, and a restore replaces every
 * table, so both refuse to start while any write, account operation, deletion, or fan-activity
 * pass is in flight. Callers must treat `null` as "busy, try again", never as a failure.
 */
export function claimSlurpBackup(): (() => void) | null {
  if (
    isSlurpDataDeletionActive() ||
    readSlurpBackupActive() ||
    hasActiveCreatorAccountOperations() ||
    hasActiveSlurpMutations() ||
    activeSlpOperations.size > 0
  )
    return null;
  const releaseWrite = claimSlpOperation("slurp-write");
  if (!releaseWrite) return null;
  setSlurpBackupActive(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    setSlurpBackupActive(false);
    releaseWrite();
  };
}

/** Runs an operation while owning its claim lifecycle, or reports that the key is busy. */
export async function trySlpOperation<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<{ acquired: true; value: T } | { acquired: false }> {
  if (readSlurpBackupActive() || isSlurpDataDeletionActive()) return { acquired: false };
  const release = claimSlpOperation(key);
  if (!release) return { acquired: false };
  try {
    return { acquired: true, value: await operation() };
  } finally {
    release();
  }
}

export async function trySlurpWrite<T>(operation: () => Promise<T>) {
  if (isSlurpDataDeletionActive() || readSlurpBackupActive()) return { acquired: false as const };
  return trySlpOperation("slurp-write", operation);
}

export async function trySlurpDataDeletion<T>(operation: () => Promise<T>) {
  if (readSlurpBackupActive() || hasActiveCreatorAccountOperations() || activeSlpOperations.size > 0)
    return { acquired: false as const };
  const release = claimSlurpDataDeletion();
  if (!release) return { acquired: false as const };
  try {
    return { acquired: true as const, value: await operation() };
  } finally {
    release();
  }
}

export function isSlpOperationActive(key: string): boolean {
  return activeSlpOperations.has(key);
}

export function getSlurpOperationStatus() {
  return {
    backup: readSlurpBackupActive(),
    deletion: isSlurpDataDeletionActive(),
    account: hasActiveCreatorAccountOperations(),
    mutation: hasActiveSlurpMutations() || activeSlpOperations.size > 0,
  };
}

export function resetSlpOperationsForTests() {
  activeSlpOperations.clear();
}
