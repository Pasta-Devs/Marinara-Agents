let active = false;

export function isSlurpDataDeletionActive(): boolean {
  return active;
}

export function claimSlurpDataDeletion(): (() => void) | null {
  if (active) return null;
  active = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active = false;
  };
}
