/**
 * #103: the persona browsing Slurp was kept per browser, so the host PC showed an empty Inbox while
 * the phone and a remote browser showed 87 unread for another persona. The pick now lives in the
 * Slurp settings, which every device reads.
 */
import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

// The settings module needs the Engine's logger, so it is read, not imported.
const settings = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-settings.ts");
assert.match(
  settings,
  /viewerPersonaId: z\.string\(\)\.max\(200\)\.nullable\(\),/u,
  "the settings keep the shared pick",
);
assert.match(settings, /viewerPersonaId: null,\n\};/u, "an install that never picked has no shared pick");

const homeState = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/slp-viewer-persona-sync.ts");
assert.match(
  homeState,
  /if \(serverPersonaId && !lastSavedPersonaId\.current\) return setStoredPersonaId\(serverPersonaId\);/u,
  "a browser follows a pick made on another device, but an older save response never replaces a newer local pick",
);
assert.match(
  homeState,
  /lastSavedPersonaId\.current = storedPersonaId;\n\s+saveViewerPersona\(\{ viewerPersonaId: storedPersonaId \}\);/u,
  "a pick made here (switcher, scene handback, older local pick) is saved for every device",
);

console.log("slurp2 viewer persona shared regression passed");
