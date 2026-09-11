let active = false;
let activeMutations = 0;

export function isSlurpBackupActive(): boolean {
  return active;
}

export function setSlurpBackupActive(value: boolean): void {
  active = value;
}

export function claimSlurpMutation(): (() => void) | null {
  if (active) return null;
  activeMutations += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeMutations -= 1;
  };
}

export function hasActiveSlurpMutations(): boolean {
  return activeMutations > 0;
}

export function resetSlurpBackupState(): void {
  active = false;
  activeMutations = 0;
}
