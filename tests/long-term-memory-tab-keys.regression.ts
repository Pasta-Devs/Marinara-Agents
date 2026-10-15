import assert from "node:assert/strict";

import { nextTabIndex } from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/tab-keys.js";

// One helper drives every tab rail, so the wrap and the end keys are pinned here once.
assert.equal(nextTabIndex("ArrowRight", 1, 5), 2, "ArrowRight moves to the next tab");
assert.equal(nextTabIndex("ArrowRight", 4, 5), 0, "ArrowRight wraps from the last tab to the first");
assert.equal(nextTabIndex("ArrowLeft", 2, 5), 1, "ArrowLeft moves to the previous tab");
assert.equal(nextTabIndex("ArrowLeft", 0, 5), 4, "ArrowLeft wraps from the first tab to the last");
assert.equal(nextTabIndex("Home", 3, 5), 0, "Home selects the first tab");
assert.equal(nextTabIndex("End", 1, 5), 4, "End selects the last tab");
assert.equal(nextTabIndex("ArrowRight", 0, 1), 0, "a single tab stays selected");
assert.equal(nextTabIndex("ArrowRight", -1, 3), 0, "an unknown current tab starts from the first");

for (const key of ["ArrowDown", "ArrowUp", "Tab", "Enter", " ", "a"]) {
  assert.equal(nextTabIndex(key, 1, 5), null, `${JSON.stringify(key)} is not a tab-rail key`);
}
assert.equal(nextTabIndex("ArrowRight", 0, 0), null, "an empty rail has nowhere to move");
