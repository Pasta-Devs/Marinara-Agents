// Whether this browser has already seen the Noodle first-run explainer.
// ponytail: one localStorage key, so the explainer returns on another browser. Move it into
// Noodle settings if that turns out to annoy anyone.
export const NOODLE_INTRO_SEEN_KEY = "marinara:noodle:intro-seen";

export function noodleIntroSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(NOODLE_INTRO_SEEN_KEY) === "true";
  } catch {
    // Private browsing refuses storage. Showing the explainer again beats crashing the timeline.
    return false;
  }
}

export function markNoodleIntroSeen(): void {
  try {
    globalThis.localStorage?.setItem(NOODLE_INTRO_SEEN_KEY, "true");
  } catch {
    // The tab stays usable; the explainer simply returns next time.
  }
}
