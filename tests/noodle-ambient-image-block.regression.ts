import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The Engine's shared package is not installed here, so these guards are asserted against the
// source the way tests/noodle-public-boundary.regression.ts does it.
const media = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-generated-activity.service.ts",
  "utf8",
);
const storage = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/storage/noodle.storage.ts",
  "utf8",
);
const routes = readFileSync("packages/noodle/src/engine/packages/server/src/routes/noodle.routes.ts", "utf8");

// Ambient roster accounts are background texture and never earn an image slot.
assert.match(media, /remainingImagePrompts > 0 && !isAmbientNoodleAccount\(account\)/u);
assert.match(media, /import \{ isAmbientNoodleAccount \} from "\.\/noodle-ambient-profiles\.js";/u);

// listPostPage builds its cursor with or(); an unimported helper only fails on page two.
assert.match(storage, /^import \{[^}]*\bor\b[^}]*\} from "\.\.\/\.\.\/db\/file-query\.js";/mu);

// A manual profile edit must outrank the character card on the next bootstrap sync.
assert.match(routes, /profileManuallyEdited: true/u);

console.log("Noodle ambient image and profile guard regressions passed.");
