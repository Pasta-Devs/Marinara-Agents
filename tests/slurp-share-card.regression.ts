import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import { wrapSlpShareCardText } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-share-card-text";

// One character per unit of width: enough to exercise the wrap without a canvas.
const measure = (value: string) => value.length;

assert.deepEqual(
  wrapSlpShareCardText(measure, "the quick brown fox jumps", 10, 5),
  ["the quick", "brown fox", "jumps"],
  "words must wrap at the measured width, never mid-word",
);
assert.deepEqual(
  wrapSlpShareCardText(measure, "one two three four five six", 9, 2),
  ["one two", "three…"],
  "text past the line budget must be ellipsised, not silently dropped",
);
assert.deepEqual(wrapSlpShareCardText(measure, "alpha\nbeta", 20, 4), ["alpha", "beta"], "newlines must break lines");
assert.deepEqual(wrapSlpShareCardText(measure, "", 20, 4), [], "empty text must produce no lines");

const card = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-share-card.ts");
// The card is drawn on a canvas in the browser. It used to be a sharp/SVG render on the server,
// which draws text only if the host has fonts installed — Engine hosts routinely have none, so
// every card came out as the bare post image with no name, title, or caption on it.
assert.match(card, /getContext\("2d"\)/u, "the card must be drawn on a canvas");
assert.doesNotMatch(card, /from "sharp"|<svg /u, "the card must not go back to a server-side SVG render");
// Package media sits behind the admin-secret gate, so a plain <img src> gets a 403.
assert.match(card, /api\.raw\(/u, "package media must be fetched through the API client");
assert.match(card, /toBlob/u);

const menu = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/post/SlpPostMenu.tsx");
// Share is on every post; edit and delete stay behind the management capability.
assert.match(menu, /ui\.slurp\.post\.share/u);
assert.match(menu, /\{ctx\.postManagement && \(/u, "edit and delete must stay gated");
assert.match(menu, /downloadSlpShareCard/u, "share must fall back to the share card when the host has no share action");

// A menu item that quietly does nothing is worse than no menu item: the host only supplies its
// own share action when a viewer persona exists, so the fallback can take over otherwise.
const home = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/slp-home-state.ts");
assert.match(home, /sharePost: viewerPersonaId\s*\n?\s*\?/u, "sharePost must be undefined without a persona");

console.log("slurp-share-card regression passed");
