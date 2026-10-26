import { AsyncLocalStorage as ForgePreforgeArtGate } from "node:async_hooks";

// Pre-forge paints a chapter's art on its own chain beside the text. The text chain writes beats back
// to back and opens the chapter menu when the last one is written; this chain follows it in reading
// order, painting each written beat's new places and then its key image on the image connection's
// low-priority lane. A scene opened first joins the paint in flight (both share its dedupe key) or
// paints on open, as before. Painting ahead is not an unlock: Home backgrounds still need
// /artwork/witness from a played scene.
// ponytail: only beats a chain run writes are queued. A beat written earlier (Story only, Backgrounds
// turned on later, or the beat a Cancel interrupted) paints on open, and a paint in flight at a hard
// Cancel is paid and discarded. Art still queued once the menu opens has no Cancel on the chapter
// screen; switching to Story only or Off, or the story Cancel, stops it. Upgrades: at chain start, also
// queue written-but-unpainted beats; report pending art from /preforge and keep its Cancel while it paints.
const forgePreforgeArtConnectionErrors = new Set(["no-image-connection", "engine-unreachable"]);
const forgePreforgeArtGate = new ForgePreforgeArtGate();

// The painters ask this inside the image connection's slot, right before the paid call, so a pre-forge
// paint that waited behind other images still stops if pre-forge was stopped meanwhile. Lock order stays
// dedupe entry, then connection slot: the art chain never holds a slot while it waits on another paint.
// ponytail: a scene opened during that wait shares the refused paint and paints when reopened.
export function forgePreforgeArtAllowed() {
  const gate = forgePreforgeArtGate.getStore();
  return gate ? gate() : true;
}

export function createForgePreforgeArt({ settings, paintPlace, paintKeyImage, assertActive, logger }) {
  const chains = new Map();
  return (runId, chapter) => {
    const key = `${runId}:${chapter}`;
    let stopped = false,
      failures = 0;
    // settings() is null once the world leaves Story and images, loses its image connection or
    // cancels this chapter's pre-forge: the chain stops before its next paid image.
    const allowed = async (place) => {
      const current = await settings(runId, chapter);
      if (!current) stopped = true;
      return current && (!place || current.backgrounds) ? current.run : null;
    };
    const attempt = async (label, place, work) => {
      const run = await allowed(place);
      if (!run) return;
      let result;
      try {
        result = await forgePreforgeArtGate.run(
          async () => Boolean(await allowed(place)),
          () => {
            assertActive(); // a Cancel anywhere in the world ends the chain before it asks for a paint
            return work(run);
          },
        );
      } catch (error) {
        result = { ok: false, error: "generation-failed", detail: error?.message || String(error) };
      }
      if (result?.ok) return void (failures = 0);
      // A beat without a key image, a place without a name, or a stop that landed while the paint queued.
      if (result?.error === "not-found" || result?.error === "stopped") return;
      assertActive(); // a hard Cancel or chapter reset ends the chain; its paint was not saved
      failures += 1;
      logger.warn(
        "[gacha-forge] pre-forge art failed for %s (%s): %s",
        key,
        label,
        result?.detail || result?.error || "unknown",
      );
      // One bad place is skipped; a missing connection or a second failure in a row stops painting ahead.
      if (forgePreforgeArtConnectionErrors.has(result?.error) || failures >= 2) stopped = true;
    };
    const paintBeat = async (beat, places) => {
      for (const place of Array.isArray(places) ? places : []) {
        if (stopped) return;
        if (!place?.slug || place.url) continue; // painting an already painted place returns it unpainted
        await attempt(place.name, true, (run) => paintPlace(run, runId, place));
      }
      if (!stopped) await attempt(`key image ${beat}`, false, (run) => paintKeyImage(run, runId, chapter, beat));
    };
    return (beat, places) => {
      const tail = (chains.get(key) ?? Promise.resolve())
        .then(() => (stopped ? undefined : paintBeat(beat, places)))
        .catch((error) => {
          stopped = true;
          logger.warn("[gacha-forge] pre-forge art stopped for %s: %s", key, error?.message || String(error));
        });
      chains.set(key, tail);
      void tail.then(() => chains.get(key) === tail && chains.delete(key));
    };
  };
}
