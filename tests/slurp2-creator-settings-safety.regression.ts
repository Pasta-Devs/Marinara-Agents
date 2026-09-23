import assert from "node:assert/strict";

import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/client/src/slp/features/creators/";
const modal = slurp2Source(`${root}settings/SlpCreatorSettingsModal.tsx`);
const editor = slurp2Source(`${root}SlpCreatorProfileEditor.tsx`);
const sections = slurp2Source(`${root}settings/slp-creator-settings-sections.ts`);
const modalSections = slurp2Source(`${root}settings/SlpCreatorSettingsSections.tsx`);
const publishingSections = slurp2Source(`${root}settings/SlpCreatorPublishingSection.tsx`);
const profileScreen = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpScreenProfile.tsx",
);
const contract = slurp2Source(`${root}settings/slp-creator-settings-contract.ts`);
const creatorsPanel = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/creators/SlpCreatorsPanel.tsx",
);
const bulkEdit = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/creators/SlpCreatorBulkEdit.tsx",
);
const metrics = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/creators/SlpCreatorMetrics.tsx",
);

assert.match(modal, /accountsQuery\.isError/u, "Creator load failures must render an error state");
assert.match(modal, /accountsQuery\.refetch\(\)/u, "Creator load failures must offer retry");
assert.match(modal, /sections\.map\(\(section\) =>/u, "all sections stay mounted across tab changes");
assert.match(modal, /hidden=\{section\.id !== activeSection\?\.id\}/u, "inactive sections stay out of view");
assert.match(modal, /dirtyRef\.current &&[\s\S]*showConfirmDialog/u, "modal exit confirms dirty profile edits");
assert.match(modal, /onDirtyChange=\{section\.id === "identity"/u, "Identity reports dirty state to the modal");
assert.match(editor, /onDirtyChange\?\.\(JSON\.stringify\(draft\) !== JSON\.stringify\(initialDraft\)\)/u);
assert.match(editor, /onDirtyChange\?\.\(false\)/u, "save and discard clear the dirty state");
assert.match(sections, /group: "creator" \| "publishing" \| "interaction" \| "memory" \| "tools" \| "danger"/u);
assert.match(sections, /id: "content-rules"[\s\S]*group: "publishing"/u);
assert.match(publishingSections, /mode === "content-rules"/u);
assert.match(modalSections, /SettingAnchor settingKey="creatorCollabs"/u);
assert.match(contract, /creatorCollabs: "collaborations"/u);
assert.match(contract, /characterImageInstructions: "production"/u);
assert.match(profileScreen, /tab: "automation"/u);
assert.match(creatorsPanel, /attentionReasons\(creator, t\)/u);
assert.match(creatorsPanel, /reasons\.join\(" · "\)/u);
assert.ok(creatorsPanel.indexOf("{!bulkCreatorIds && accountsQuery") < 0, "continuity no longer precedes the roster");
assert.match(creatorsPanel, /<SlpContinuityOverview/u, "continuity remains available below the roster");
assert.match(bulkEdit, /changeSummary/u);
assert.match(bulkEdit, /pendingChanges/u);
assert.match(bulkEdit, /Object\.keys\(patch\)\.length === 0/u, "empty bulk patches stay disabled");
assert.match(metrics, /compact\.format\(metrics\.posts\)/u, "directory rows use compact metrics");

console.log("slurp2 Creator settings safety regression passed");
