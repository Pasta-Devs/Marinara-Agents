// "What's switched on" (docs/CONFIGURATOR.md, Existing installs): a one-time note on the Backstage
// Overview for installs from before the switches. Per browser; the new first run marks it seen,
// because its "Add extras" step already asked.
const SEEN_KEY = "slurp2:switched-on-seen";

export function slpSwitchedOnNoteSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

export function markSlpSwitchedOnNoteSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Blocked storage: the note shows again next time, which is harmless.
  }
}
