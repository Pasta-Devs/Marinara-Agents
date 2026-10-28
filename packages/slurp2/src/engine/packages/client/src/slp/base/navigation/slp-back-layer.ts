// ──────────────────────────────────────────────
// Android / browser back for Slurp's own sub-pages (release step: Stir sub-pages). While one is
// open, a back step is cancelled before it happens and the top page closes instead, so back
// returns to the screen under it and does not close Slurp.
//
// Why the Navigation API and not `popstate`: the Engine's back handler (lib/back-navigation.ts) is
// a separate copy in the Engine bundle, listens on `popstate` from startup and closes its top layer
// (the browser Slurp runs in). Window listeners run in the order they were added, so a package
// listener always comes after it. The `navigate` event comes before any `popstate`; cancelling it
// leaves history and the Engine's own back entry as they were.
// ponytail: no Navigation API (older Safari / Firefox) or no tap since the last cancel (the browser's
// anti-trap rule): back behaves as before and leaves Slurp. Upgrade path: a host API to register a
// back layer in the Engine's own stack.
// ──────────────────────────────────────────────

type SlpNavigateEvent = Event & {
  navigationType?: string;
  cancelable: boolean;
  destination?: { index: number };
};
type SlpNavigation = EventTarget & { currentEntry?: { index: number } | null };

const layers: { close: () => void }[] = [];
let listening = false;

function onNavigate(event: Event) {
  const navigate = event as SlpNavigateEvent;
  if (navigate.navigationType !== "traverse" || !navigate.cancelable || layers.length === 0) return;
  const navigation = (window as { navigation?: SlpNavigation }).navigation;
  const from = navigation?.currentEntry?.index ?? -1;
  // Forward stays the browser's.
  if (from >= 0 && (navigate.destination?.index ?? from) > from) return;
  navigate.preventDefault();
  layers.at(-1)?.close();
}

/** Registers an open Slurp sub-page for back. Returns the unregister function. */
export function registerSlpBackLayer(close: () => void): () => void {
  const navigation = typeof window === "undefined" ? undefined : (window as { navigation?: SlpNavigation }).navigation;
  if (!navigation) return () => {};
  if (!listening) {
    listening = true;
    navigation.addEventListener("navigate", onNavigate);
  }
  const layer = { close };
  layers.push(layer);
  return () => {
    const index = layers.indexOf(layer);
    if (index >= 0) layers.splice(index, 1);
  };
}
