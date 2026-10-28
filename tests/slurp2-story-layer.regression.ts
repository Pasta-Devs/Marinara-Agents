/**
 * S — a Story opens in Slurp's own layer, not inside the Engine modal: the Engine modal brought a second close
 * button next to the Story's own one (its header was only hidden by a `first-child` CSS guess).
 */
import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source.ts";

const helpers = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpHomeHelpers.tsx");
const dialog = helpers.slice(helpers.indexOf("export function SlurpMediaDialog("));
assert.match(dialog, /if \(story\)\s*return \(?\s*<SlpStoryLayer title=\{title\} onClose=\{onClose\}>/);
assert.doesNotMatch(helpers, /first-child\]:hidden/, "no hidden Engine modal header");
assert.match(helpers, /function SlpStoryLayer\([\s\S]*?createPortal\(/);
assert.match(helpers, /function SlpStoryLayer\([\s\S]*?useDialogFocusScope\(true, panelRef\)/);

// Slurp's portal deliberately lets pointer events through; each full-screen layer must opt back in.
const layer = helpers.slice(helpers.indexOf("function SlpStoryLayer("));
assert.match(
  layer,
  /className="pointer-events-auto fixed inset-0/,
  "the Story layer receives clicks instead of passing controls and scrim taps to the feed",
);

console.log("slurp2 story layer: ok");
