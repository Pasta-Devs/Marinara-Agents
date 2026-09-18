import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  resolveSlurpAudienceCharacterIds,
  selectSlurpAudienceCharacterIds,
  slurpAudienceCharacterFanTypeId,
  slurpAudienceCharacterTraits,
  slurpAudienceCharacterVoice,
  slurpCharacterFanEntityId,
  slurpCharacterIdFromFanEntityId,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-audience-characters.js";
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

const worldSource = readFileSync(
  join(
    import.meta.dirname,
    "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  ),
  "utf8",
);
const storageSource = slurp2Source(
  join(import.meta.dirname, "../packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
);
const messageSource = readFileSync(
  join(
    import.meta.dirname,
    "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-message-generation.service.ts",
  ),
  "utf8",
);
const pendingSource = readFileSync(
  join(
    import.meta.dirname,
    "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-pending-text.service.ts",
  ),
  "utf8",
);

assert.match(worldSource, /characterFanPinnedTypeIds/u);
assert.match(worldSource, /payingFanTypeFor/u);
assert.match(worldSource, /audienceCharacterLimit/u);
assert.match(storageSource, /audienceCharacterLimit: z\.number\(\)\.int\(\)\.min\(0\)\.max\(10\)/u);
assert.match(storageSource, /audienceCharacterLimit: 5/u);
assert.match(messageSource, /resolveSlurpCharacterFanVoice/u);
assert.match(pendingSource, /resolveSlurpCharacterFanVoice/u);

console.log("slurp2 character audience regression passed");
