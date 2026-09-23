import assert from "node:assert/strict";

import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/client/src/slp/features/creators/";
const modal = slurp2Source(`${root}settings/SlpCreatorSettingsModal.tsx`);
const editor = slurp2Source(`${root}SlpCreatorProfileEditor.tsx`);

assert.match(modal, /accountsQuery\.isError/u, "Creator load failures must render an error state");
assert.match(modal, /accountsQuery\.refetch\(\)/u, "Creator load failures must offer retry");
assert.match(modal, /sections\.map\(\(section\) =>/u, "all sections stay mounted across tab changes");
assert.match(modal, /hidden=\{section\.id !== activeSection\?\.id\}/u, "inactive sections stay out of view");
assert.match(modal, /dirtyRef\.current &&[\s\S]*showConfirmDialog/u, "modal exit confirms dirty profile edits");
assert.match(modal, /onDirtyChange=\{section\.id === "identity"/u, "Identity reports dirty state to the modal");
assert.match(editor, /onDirtyChange\?\.\(JSON\.stringify\(draft\) !== JSON\.stringify\(initialDraft\)\)/u);
assert.match(editor, /onDirtyChange\?\.\(false\)/u, "save and discard clear the dirty state");

console.log("slurp2 Creator settings safety regression passed");
