import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isNoodlerDisclosureDowngrade,
  noodlerDisclosureReviewReasons,
  projectNoodlerAudienceProfile,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodler-disclosure";

const managedProfile = {
  id: "creator",
  noodleAccountId: "source-account",
  handle: "stage",
  displayName: "Stage Name",
  bio: "Stage bio",
  avatarUrl: null,
  avatarCrop: null,
  disclosureMode: "hinted" as const,
  stagePersonality: "Brief and playful",
  access: { hiddenFromAccountIds: [] },
  autoPosting: { enabled: false, imagesEnabled: false },
  fanActivity: null,
  sourceStatus: { state: "current" as const },
  publicIdentity: { displayName: "Source Name", handle: "source" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const hintedAudience = projectNoodlerAudienceProfile(managedProfile);
assert.equal(hintedAudience.noodleAccountId, null);
assert.equal(hintedAudience.publicIdentity, null);
assert.equal("access" in hintedAudience, false);
assert.equal("sourceStatus" in hintedAudience, false);

const openAudience = projectNoodlerAudienceProfile({
  ...managedProfile,
  disclosureMode: "open",
});
assert.equal(openAudience.noodleAccountId, "source-account");
assert.deepEqual(openAudience.publicIdentity, managedProfile.publicIdentity);

assert.equal(isNoodlerDisclosureDowngrade("open", "hinted"), true);
assert.equal(isNoodlerDisclosureDowngrade("open", "secret"), true);
assert.equal(isNoodlerDisclosureDowngrade("hinted", "secret"), true);
assert.equal(isNoodlerDisclosureDowngrade("secret", "open"), false);
assert.deepEqual(
  noodlerDisclosureReviewReasons({
    currentMode: "open",
    nextMode: "secret",
    postCount: 2,
    mediaCount: 1,
    hasAvatar: true,
    preparedPostCount: 1,
  }),
  ["2 published posts", "1 published media item", "the current creator avatar", "1 prepared automatic post"],
);

const sourcePrivacy = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-noodler-source.ts",
  "utf8",
);
assert.match(sourcePrivacy, /createHash\("sha256"\)/u);
assert.match(sourcePrivacy, /mode === "open"\) return snapshot/u);
assert.match(sourcePrivacy, /mode === "hinted" && field === "personality"/u);
assert.match(sourcePrivacy, /revision:/u);

const generationPrivacy = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-noodler-generation.service.ts",
  "utf8",
);
assert.match(generationPrivacy, /stageProfileContainsSourceDetails/u);
assert.match(generationPrivacy, /source\.scenario/u);
assert.match(generationPrivacy, /source\.appearance/u);
assert.match(generationPrivacy, /source\.backstory/u);

console.log("NoodleR disclosure contract regressions passed.");
