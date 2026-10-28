import assert from "node:assert/strict";
import { join } from "node:path";

import {
  resolveSlurpAudienceCharacterIds,
  selectSlurpAudienceCharacterIds,
  slurpAudienceCharacterFanTypeId,
  slurpAudienceCharacterTraits,
  slurpAudienceCharacterVoice,
  slurpCharacterFanEntityId,
  slurpCharacterIdFromFanEntityId,
  isSlurpCharacterFanAccount,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-audience-characters.js";
import { slurp2Source } from "./slurp2-source";

const settings = {
  audienceCharacters: { explicit: "whale", excluded: false, automatic: true },
  audienceCharacterGroupIds: ["group-a"],
};
const groups = [{ id: "group-a", characterIds: JSON.stringify(["excluded", "group-member", "automatic"]) }];

assert.deepEqual(resolveSlurpAudienceCharacterIds(settings, groups), ["explicit", "automatic", "group-member"]);
assert.equal(slurpAudienceCharacterFanTypeId(settings, "explicit"), "whale");
assert.equal(slurpAudienceCharacterFanTypeId(settings, "automatic"), null);

const voice = slurpAudienceCharacterVoice(
  { data: { personality: "Blunt, funny, and impatient.", description: "An archivist who hates small talk." } },
  32,
);
assert.equal(voice, "Blunt, funny, and impatient. An");
assert.equal(slurpAudienceCharacterVoice({ data: { scenario: "private chat only" } }, 32), undefined);
assert.deepEqual(slurpAudienceCharacterTraits({ data: { tags: '["archivist", "funny", "archivist", "night owl"]' } }), [
  "archivist",
  "funny",
  "night owl",
]);

const ids = ["one", "two", "three", "four", "five"];
assert.deepEqual(
  selectSlurpAudienceCharacterIds(ids, 2, "same-run"),
  selectSlurpAudienceCharacterIds(ids, 2, "same-run"),
);
assert.equal(selectSlurpAudienceCharacterIds(ids, 0, "same-run").length, 0);
assert.deepEqual(selectSlurpAudienceCharacterIds(["one"], 8, "same-run"), ["one"]);

assert.equal(slurpCharacterIdFromFanEntityId(slurpCharacterFanEntityId("char-1")), "char-1");
assert.equal(slurpCharacterIdFromFanEntityId("slurp-fan:char-1"), null);

const worldSource = slurp2Source(
  join(
    import.meta.dirname,
    "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  ),
);
const storageSource = slurp2Source(
  join(import.meta.dirname, "../packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
);
const messageSource = slurp2Source(
  join(
    import.meta.dirname,
    "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-message-generation.service.ts",
  ),
);
const pendingSource = slurp2Source(
  join(
    import.meta.dirname,
    "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-pending-text.service.ts",
  ),
);

assert.match(worldSource, /characterFanPinnedTypeIds/u);
assert.match(worldSource, /payingFanTypeFor/u);
assert.match(worldSource, /audienceCharacterLimit/u);
assert.match(storageSource, /audienceCharacterLimit: z\.number\(\)\.int\(\)\.min\(0\)\.max\(10\)/u);
assert.match(storageSource, /audienceCharacterLimit: 5/u);
assert.match(messageSource, /resolveSlurpCharacterFanVoice/u);
assert.match(pendingSource, /resolveSlurpCharacterFanVoice/u);

// 0.3.0 report B: a character imported as a Creator and again from the audience panel.
{
  const fan = { id: "fan-row", kind: "random_user", entityId: slurpCharacterFanEntityId("mira") };
  const creator = { id: "creator-row", kind: "character", entityId: "mira" };
  const ambient = { id: "ambient-row", kind: "random_user", entityId: "ambient-1" };
  // The fan row is not a Creator: the Creators list, needs-attention and the world tick skip it.
  assert.deepEqual(
    [creator, fan, ambient].filter((account) => !isSlurpCharacterFanAccount(account)).map((account) => account.id),
    ["creator-row", "ambient-row"],
  );
  // Deleting the fan row sets the character to false; that wins over its group, so no tick makes it again.
  const before = { audienceCharacters: { mira: true }, audienceCharacterGroupIds: ["g"] };
  const groupsWithMira = [{ id: "g", characterIds: JSON.stringify(["mira", "kai"]) }];
  assert.deepEqual(resolveSlurpAudienceCharacterIds(before, groupsWithMira), ["mira", "kai"]);
  const deletedFan = slurpCharacterIdFromFanEntityId(fan.entityId);
  assert.equal(deletedFan, "mira");
  const after = { ...before, audienceCharacters: { ...before.audienceCharacters, [deletedFan!]: false } };
  assert.deepEqual(resolveSlurpAudienceCharacterIds(after, groupsWithMira), ["kai"], "only what was chosen stays");

  const engine = "packages/slurp2/src/engine/packages";
  const creatorsStorage = slurp2Source(`${engine}/server/src/slp/data/creators/slp-creators-storage-3.ts`);
  assert.match(
    creatorsStorage,
    /async buildNoodlerStageProfiles\(\)[\s\S]{0,400}!isSlurpViewerActorAccount\(account\) && !isSlurpCharacterFanAccount\(account\)/u,
  );
  assert.match(
    slurp2Source(`${engine}/server/src/slp/features/world/slp-world-operation.ts`),
    /automaticCreators = accounts\.filter\([\s\S]{0,200}!isSlurpCharacterFanAccount\(account\)/u,
  );
  assert.match(
    slurp2Source(`${engine}/server/src/slp/features/maintenance/slp-maintenance-routes.ts`),
    /isSlurpCharacterFanAccount\(target\)\s+\? slurpCharacterIdFromFanEntityId\(target\.entityId\)\s+: null;\s+if \(fanOf\) await noodle\.setAudienceCharacter\(fanOf, false\);/u,
  );
  // Duplicate import: the audience list names the character's Creator and opens it.
  assert.match(
    slurp2Source(`${engine}/server/src/slp/features/audience/slp-audience-routes.ts`),
    /creatorAccountId: \(await noodle\.getNoodlerAccountForSource\("character", summary\.id\)\)\?\.id \?\? null/u,
  );
  const panel = slurp2Source(`${engine}/client/src/slp/features/audience/SlpAudiencePanel.tsx`);
  assert.match(panel, /disabled=\{Boolean\(creatorId\) && !enabled\}/u);
  assert.match(panel, /onClick=\{\(\) => openSlpCreatorSettings\(creatorId\)\}/u);
  // Delete ends with feedback: awaited, and a Creator that is gone closes the modal.
  const sections = slurp2Source(`${engine}/client/src/slp/features/creators/settings/SlpCreatorSettingsSections.tsx`);
  assert.match(
    sections,
    /await deleteCreator\.mutateAsync\(creator\.id\);\s+toast\.success\([^\n]+\);\s+onClose\(\);/u,
  );
  const modal = slurp2Source(`${engine}/client/src/slp/features/creators/settings/SlpCreatorSettingsModal.tsx`);
  assert.match(
    modal,
    /const gone = creatorId !== null && accountsQuery\.isSuccess && !accountsQuery\.isFetching && !creator;/u,
  );
  assert.match(modal, /if \(gone\) close\(\);/u);
}

console.log("slurp2 character audience regression passed");
