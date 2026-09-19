import assert from "node:assert/strict";
import {
  isNoodlerDisclosureDowngrade,
  noodlerDisclosureReviewReasons,
  projectNoodlerAudienceProfile,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-disclosure";
import {
  compareMinimizedNoodlerSourceSnapshot,
  isMinimizedNoodlerSourceSnapshot,
  minimizeNoodlerSourceSnapshot,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/identity/slp-source";
import { slurp2Source } from "./slurp2-source";

const managedProfile = {
  id: "creator",
  slurpSourceAccountId: "source-account",
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
assert.equal(hintedAudience.slurpSourceAccountId, null);
assert.equal(hintedAudience.publicIdentity, null);
assert.equal("access" in hintedAudience, false);
assert.equal("sourceStatus" in hintedAudience, false);

const openAudience = projectNoodlerAudienceProfile({
  ...managedProfile,
  disclosureMode: "open",
});
assert.equal(openAudience.slurpSourceAccountId, "source-account");
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
assert.equal(isMinimizedNoodlerSourceSnapshot(hinted), true);
// The themes prefix pushes the token off the start of the string, so the salt has to be
// read through the leading-space branch of the pattern. Without it a hinted personality
// would draw a fresh salt on every comparison and report as changed forever.
assert.deepEqual(compareMinimizedNoodlerSourceSnapshot(hinted, snapshot, "hinted"), { state: "current" });
assert.equal(minimizeNoodlerSourceSnapshot(snapshot, "hinted", hinted).personality, hinted.personality);

// Each minimization salts independently, so two stores of the same source do not
// produce the same token — but a comparison against a baseline reuses its salt.
assert.notEqual(minimizeNoodlerSourceSnapshot(snapshot, "secret").name, secret.name);
assert.deepEqual(compareMinimizedNoodlerSourceSnapshot(secret, snapshot, "secret"), { state: "current" });
assert.deepEqual(
  compareMinimizedNoodlerSourceSnapshot(secret, { ...snapshot, backstory: "Came back last spring" }, "secret"),
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

const generationPrivacy = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
);
// The privacy core now lives in a leaf module so tests can execute it instead of grepping it.
// slurp-identity-protection.regression.ts covers the behaviour; these assertions only hold the
// wiring in place. Do not move this logic back into the service: nothing there can be imported.
assert.match(generationPrivacy, /stageProfileContainsSourceDetails/u);
const identityPrivacy = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-identity-protection.ts",
);
assert.match(identityPrivacy, /source\.scenario/u);
assert.match(identityPrivacy, /source\.appearance/u);
assert.match(identityPrivacy, /source\.backstory/u);

// Hinted is an open secret, not a near-secret: the posts tease the other life, the images keep
// the same appearance, and only the name and handle stay protected.
assert.match(generationPrivacy, /Disclosure is hinted\. The creator's other public life is an open secret\./u);
assert.match(generationPrivacy, /Never confirm a guess/u);
assert.match(identityPrivacy, /mode === "hinted" \? "you-know-who" : "someone"/u);

const imagesPrivacy = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-images.service.ts",
);
// Open and Hinted both get image references, for personas as well as characters. Slurp has no
// Secret tier any more, so nothing gates references on disclosure.
assert.match(
  imagesPrivacy,
  /!input\.suppressCharacterContext && input\.linkedPublicAccount \? input\.linkedPublicAccount/u,
);
assert.doesNotMatch(imagesPrivacy, /"secret"/u);
// A stored or submitted Secret Creator becomes Hinted, and a Creator with no mode is Open.
const storagePrivacy = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
assert.match(storagePrivacy, /rawIdentityDisclosure === "secret" \? "hinted" : rawIdentityDisclosure/u);
assert.doesNotMatch(storagePrivacy, /\?\? "secret"/u);

const draftPrivacy = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-stage-profile-draft.service.ts",
);
assert.match(draftPrivacy, /# Open-secret inspiration brief/u);
assert.match(draftPrivacy, /noodlerConcealedSourceText\(input\.source\?\.data\)/u);
// The concealed seed still withholds the canonical story beats, which are what someone could look up.
const promptSafety = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-prompt-safety.ts",
);
const concealedStart = promptSafety.indexOf("export function noodlerConcealedSourceText");
const concealedEnd = promptSafety.indexOf("/** Character canon is private behavioral context");
assert.ok(concealedStart >= 0 && concealedEnd > concealedStart, "concealed-seed slice markers must exist");
const concealedPrompt = promptSafety.slice(concealedStart, concealedEnd);
assert.doesNotMatch(concealedPrompt, /scenario|backstory|source\.name/u);

const artworkPrivacy = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-public-profiles.service.ts",
);
// Only an OPEN creator may inherit the literal source photo as its avatar/banner. Hinted must
// look like the same person through *generated* artwork (see the images-service reference-image
// gate above), never by copying the actual source image — that photo would identify a hinted
// creator on sight, defeating the one promise hinted disclosure makes.
assert.match(artworkPrivacy, /if \(input\.disclosureMode !== "open"\) return \{ avatarUrl: null, bannerUrl: null \};/u);

const fanActivityPrivacy = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-activity.service.ts",
);
// Locked posts are eligible fan-activity targets, but only their title reaches the prompt — a
// fan reply must never be able to restate paid content it was never shown.
// A locked post still withholds its body, but its picture is public, so the image line stays.
// Anchored on the locked branch's opening rather than its closing brace: appending another
// optional field (comments, most recently) must not read as a privacy regression.
assert.match(fanActivityPrivacy, /access === "locked"[\s\S]*\? \{ id, title, access/u);
assert.doesNotMatch(fanActivityPrivacy, /\? \{ id, title, content/u, "a locked body must never reach the prompt");
assert.match(fanActivityPrivacy, /Posts marked locked are paid posts\. Only subscribers see them/u);

// The client re-declares the disclosure rank table because it cannot import from the server
// bundle. A shared module across the two bundles is more machinery than one three-line constant
// is worth, so the drift is caught here instead: if the orders ever disagree, a downgrade warning
// fires on the wrong transition.
const disclosureRankTable = /secret: 0,\s*hinted: 1,\s*open: 2,/u;
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-disclosure.ts"),
  disclosureRankTable,
);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx"),
  disclosureRankTable,
  "the client disclosure rank must match the server's",
);

console.log("NoodleR disclosure contract regressions passed.");
