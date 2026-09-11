const activeNoodleOperations = new Set<string>();
let slurpDataDeletionActive = false;
import { hasActiveNoodlerAccountOperations } from "./slurp-account-operation-lock.js";
import {
  hasActiveSlurpMutations,
  isSlurpBackupActive as readSlurpBackupActive,
  resetSlurpBackupState,
  setSlurpBackupActive,
} from "./slurp-backup-state.js";

function claimNoodleOperation(key: string): (() => void) | null {
  if (activeNoodleOperations.has(key)) return null;
  activeNoodleOperations.add(key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeNoodleOperations.delete(key);
  };
}

export function claimSlurpBackup(): (() => void) | null {
  if (
    slurpDataDeletionActive ||
    readSlurpBackupActive() ||
    hasActiveNoodlerAccountOperations() ||
    hasActiveSlurpMutations() ||
    activeNoodleOperations.has("noodler-fan-activity")
  )
    return null;
  const releaseWrite = claimNoodleOperation("slurp-write");
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
export async function tryNoodleOperation<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<{ acquired: true; value: T } | { acquired: false }> {
  if (readSlurpBackupActive()) return { acquired: false };
  const release = claimNoodleOperation(key);
  if (!release) return { acquired: false };
  try {
    return { acquired: true, value: await operation() };
  } finally {
    release();
  }
}

export async function trySlurpWrite<T>(operation: () => Promise<T>) {
  if (slurpDataDeletionActive) return { acquired: false as const };
  return tryNoodleOperation("slurp-write", operation);
}

export async function trySlurpDataDeletion<T>(operation: () => Promise<T>) {
  if (slurpDataDeletionActive || readSlurpBackupActive() || activeNoodleOperations.has("slurp-write"))
    return { acquired: false as const };
  slurpDataDeletionActive = true;
  try {
    return { acquired: true as const, value: await operation() };
  } finally {
    slurpDataDeletionActive = false;
  }
}

export function isNoodleOperationActive(key: string): boolean {
  return activeNoodleOperations.has(key);
}

export function isSlurpBackupActive(): boolean {
  return readSlurpBackupActive();
}

export function resetNoodleOperationsForTests() {
  activeNoodleOperations.clear();
  resetSlurpBackupState();
}
