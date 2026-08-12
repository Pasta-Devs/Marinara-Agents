import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isNoodlerDisclosureDowngrade,
  noodlerDisclosureReviewReasons,
  projectNoodlerAudienceProfile,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodler-disclosure";
import {
  compareMinimizedNoodlerSourceSnapshot,
  isMinimizedNoodlerSourceSnapshot,
  minimizeNoodlerSourceSnapshot,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-noodler-source";

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
  [
    { code: "published_posts", count: 2, label: "2 published posts" },
    { code: "published_media", count: 1, label: "1 published media item" },
    { code: "creator_avatar", count: 1, label: "the current creator avatar" },
    { code: "prepared_posts", count: 1, label: "1 prepared automatic post" },
  ],
);

const snapshot = {
  publicDisplayName: "Source Name",
  publicHandle: "source",
  name: "Source Name",
  description: "A quiet archivist",
  personality: "thoughtful and witty",
  scenario: "Runs a night library",
  appearance: "Tall, grey coat",
  backstory: "Left the city years ago",
};

// Open keeps the snapshot; hinted and secret store only salted digests.
assert.deepEqual(minimizeNoodlerSourceSnapshot(snapshot, "open"), snapshot);
const secret = minimizeNoodlerSourceSnapshot(snapshot, "secret");
Object.values(secret).forEach((value) => {
  assert.match(value, /^revision:[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/u);
});
Object.entries(snapshot).forEach(([field, value]) => {
  assert.equal(secret[field as keyof typeof secret].includes(value), false);
});
assert.equal(isMinimizedNoodlerSourceSnapshot(secret), true);
assert.equal(isMinimizedNoodlerSourceSnapshot(snapshot), false);
// Legacy unsalted tokens are not accepted, so storage re-minimizes them.
assert.equal(
  isMinimizedNoodlerSourceSnapshot({
    ...secret,
    name: `revision:${"a".repeat(43)}`,
  }),
  false,
);

// Hinted mode keeps personality themes readable, and nothing else.
const hinted = minimizeNoodlerSourceSnapshot(snapshot, "hinted");
assert.match(hinted.personality, /^thoughtful witty revision:/u);
assert.match(hinted.name, /^revision:/u);

// Each minimization salts independently, so two stores of the same source do not
// produce the same token — but a comparison against a baseline reuses its salt.
assert.notEqual(minimizeNoodlerSourceSnapshot(snapshot, "secret").name, secret.name);
assert.deepEqual(
  compareMinimizedNoodlerSourceSnapshot(secret, snapshot, "secret"),
  { state: "current" },
);
assert.deepEqual(
  compareMinimizedNoodlerSourceSnapshot(
    secret,
    { ...snapshot, backstory: "Came back last spring" },
    "secret",
  ),
  {
    state: "changed",
    changes: [
      {
        field: "backstory",
        previous: "Stored private revision",
        current: "Current private revision",
      },
    ],
  },
);

const generationPrivacy = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-noodler-generation.service.ts",
  "utf8",
);
assert.match(generationPrivacy, /stageProfileContainsSourceDetails/u);
assert.match(generationPrivacy, /source\.scenario/u);
assert.match(generationPrivacy, /source\.appearance/u);
assert.match(generationPrivacy, /source\.backstory/u);

console.log("NoodleR disclosure contract regressions passed.");
