/**
 * Backstage maintenance, restore, and Creator workshop safety, tested on the pure planners the
 * routes use: purge preview == execution, lock contention, staged restore expiry and unsafe ZIP
 * rejection, settings opt-in, deterministic readiness, stale proposals, the rebrand boundary,
 * atomic tag creation, and retrying failures without losing successful proposals.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selectSlurpAutopurge } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-autopurge-plan.ts";
import {
  createStoredZip,
  isRestoreInspectionExpired,
  isSafeArchiveEntryName,
  readStoredZip,
  restoreImportSettingsRequested,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-backup.ts";
import {
  planSlurpImprovementApply,
  planSlurpImprovementRetry,
  selectUnusedSlurpImprovementRows,
  slurpCreatorReadiness,
  slurpImprovementDraftProposals,
  slurpImprovementModelCalls,
  slurpImprovementSnapshot,
  type SlurpImprovementProfile,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-improvement.ts";
import {
  trySlurpDataDeletion,
  trySlurpWrite,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-operation-lock.ts";

// ── Purge estimate equals execution selection ────────────────────────────────
const media = (metadata: unknown) => (metadata as { path?: string }).path ?? null;
const purgeInput = {
  cutoff: "2026-08-01T00:00:00.000Z",
  creatorIds: ["c1"],
  posts: [
    { id: "old", authorAccountId: "c1", createdAt: "2026-07-01T00:00:00.000Z", metadata: { path: "noodler/a.png" } },
    { id: "new", authorAccountId: "c1", createdAt: "2026-08-02T00:00:00.000Z", metadata: {} },
    { id: "fan", authorAccountId: "x", createdAt: "2026-07-01T00:00:00.000Z", metadata: {} },
  ],
  messages: [{ id: "m", createdAt: "2026-07-01T00:00:00.000Z", metadata: { path: "noodler/a.png" } }],
  includeMessageMedia: true,
  mediaPathOf: media,
};
for (const keepPosts of [true, false]) {
  const preview = selectSlurpAutopurge({ ...purgeInput, keepPosts });
  const execution = selectSlurpAutopurge({ ...purgeInput, keepPosts });
  assert.deepEqual(
    execution.postsToDelete.map((post) => post.id),
    preview.postsToDelete.map((post) => post.id),
  );
  assert.deepEqual(
    preview.postsToDelete.map((post) => post.id),
    keepPosts ? [] : ["old"],
  );
  assert.deepEqual(preview.mediaPaths, ["noodler/a.png"], "shared media is counted once");
}
const autopurge = readFileSync(
  join(import.meta.dirname, "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-autopurge.ts"),
  "utf8",
);
assert.match(
  autopurge,
  /trySlurpDataDeletion\(async \(\) => \{\s*const settings = await storage\.getSettings\(\);\s*const result = await purgeUnlocked/u,
  "execution re-plans inside the lock",
);

// ── Lock contention ──────────────────────────────────────────────────────────
const lockContention = (async () => {
  let release!: () => void;
  const held = trySlurpDataDeletion(() => new Promise<void>((resolve) => (release = resolve)));
  assert.equal((await trySlurpDataDeletion(async () => 1)).acquired, false, "a second deletion is refused");
  assert.equal((await trySlurpWrite(async () => 1)).acquired, false, "writes wait for deletion");
  release();
  assert.equal((await held).acquired, true);
  assert.equal((await trySlurpDataDeletion(async () => 1)).acquired, true, "the lock is released");
})();

// ── Staged restore: expiry, unsafe ZIP paths, settings opt-in ────────────────
assert.equal(isRestoreInspectionExpired(1_000, 999), false);
assert.equal(isRestoreInspectionExpired(1_000, 1_000), true);
for (const name of ["../x.json", "media/../../etc/passwd", "/abs.json", "C:/x", "media\\a.png", "a\0b", "a//b"]) {
  assert.equal(isSafeArchiveEntryName(name), false, name);
}
for (const name of ["manifest.json", "media/a1/image.png", "media/"]) assert.equal(isSafeArchiveEntryName(name), true);
assert.throws(
  () => readStoredZip(createStoredZip([{ name: "media/../../evil.png", data: Buffer.from("x") }])),
  /unsafe path/u,
);
assert.equal(restoreImportSettingsRequested(undefined), false);
assert.equal(restoreImportSettingsRequested({ importSettings: "true" }), false);
assert.equal(restoreImportSettingsRequested({ importSettings: "1" }), true);

// ── Readiness is deterministic and never calls a model ───────────────────────
const profile: SlurpImprovementProfile = {
  id: "c1",
  displayName: "Mira",
  handle: "mira",
  bio: "short",
  stagePersonality: "",
  gender: null,
  tags: ["art"],
  disclosureMode: "secret",
  avatarUrl: null,
  autoPosting: { enabled: false },
};
const originalFetch = globalThis.fetch;
globalThis.fetch = () => assert.fail("readiness must not call a model");
assert.deepEqual(slurpCreatorReadiness(profile), ["bio", "stagePersonality", "tags", "art", "publishing"]);
assert.deepEqual(slurpCreatorReadiness(profile), slurpCreatorReadiness({ ...profile }));
globalThis.fetch = originalFetch;
assert.equal(slurpImprovementModelCalls(3, ["publishing"]), 0);
assert.equal(slurpImprovementModelCalls(3, ["profile", "tags", "publishing"]), 3);

// ── Rebrand boundary and protected fields ────────────────────────────────────
const draft = {
  displayName: "New",
  handle: "new",
  bio: "A longer bio",
  stagePersonality: "Bold",
  tags: ["art", "Neon"],
};
const plain = slurpImprovementDraftProposals(profile, draft, ["profile", "tags", "publishing"], false);
assert.deepEqual(plain.map((row) => row.field).sort(), ["autoPosting", "bio", "stagePersonality", "tags"]);
const rebranded = slurpImprovementDraftProposals(profile, draft, ["profile"], true);
assert.deepEqual(rebranded.map((row) => row.field).sort(), ["bio", "displayName", "handle", "stagePersonality"]);

const fingerprint = slurpImprovementSnapshot(profile);
const row = (id: string, field: string, after: unknown) => ({
  id,
  accountId: "c1",
  field,
  afterValue: JSON.stringify(after),
  sourceFingerprint: fingerprint,
});
const guarded = planSlurpImprovementApply({
  profiles: [profile],
  proposals: [
    row("name", "displayName", "Hijack"),
    row("disc", "disclosureMode", "open"),
    row("price", "price", 1),
    row("bio", "bio", "Better bio"),
  ],
  rebrand: false,
  discoveryTags: [],
});
assert.deepEqual(guarded.rejected.sort(), ["disc", "name", "price"]);
assert.equal(guarded.updates[0].stageProfile.displayName, "Mira");
assert.equal(guarded.updates[0].stageProfile.disclosureMode, "secret", "disclosure is never written by AI");
assert.equal(guarded.updates[0].stageProfile.bio, "Better bio");
const allowedRebrand = planSlurpImprovementApply({
  profiles: [profile],
  proposals: [row("name", "displayName", "Nova")],
  rebrand: true,
  discoveryTags: [],
});
assert.equal(allowedRebrand.updates[0].stageProfile.displayName, "Nova");

// ── Stale proposal detection ─────────────────────────────────────────────────
const stale = planSlurpImprovementApply({
  profiles: [{ ...profile, bio: "edited by hand" }],
  proposals: [row("bio", "bio", "Better bio")],
  rebrand: false,
  discoveryTags: [],
});
assert.deepEqual(stale.stale, ["bio"]);
assert.equal(stale.updates.length, 0, "nothing is written when any selected proposal is stale");
assert.deepEqual(
  planSlurpImprovementApply({ profiles: [], proposals: [row("bio", "bio", "x")], rebrand: false, discoveryTags: [] })
    .stale,
  ["bio"],
  "a deleted Creator makes its proposals stale",
);

// ── Atomic tag create and assign ─────────────────────────────────────────────
const tagged = planSlurpImprovementApply({
  profiles: [profile],
  proposals: [row("tags", "tags", ["ART", "Neon", "neon"])],
  rebrand: false,
  discoveryTags: [{ tag: "art", group: "themes" }],
});
assert.deepEqual(tagged.createdTags, ["Neon"], "only unknown tags are created, once");
assert.deepEqual(tagged.discoveryTags, [
  { tag: "art", group: "themes" },
  { tag: "Neon", group: "AI suggestions" },
]);
assert.ok(tagged.updates[0].stageProfile.tags.includes("Neon"), "the created tag is assigned in the same plan");
const routes = readFileSync(
  join(import.meta.dirname, "../packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts"),
  "utf8",
);
const applyStart = routes.indexOf('app.post("/backstage/improvement-jobs/:id/apply"');
const applyBody = routes.slice(applyStart, routes.indexOf("\n  });", applyStart));
assert.ok(
  applyBody.indexOf("trySlurpWrite") < applyBody.indexOf("planSlurpImprovementApply"),
  "apply plans under the lock",
);
assert.match(
  applyBody,
  /catch \(error\) \{[\s\S]*updateSlurpSettings\(\{ discoveryTags: settings\.discoveryTags \}\)/u,
  "a failed apply rolls back created tags",
);
const readinessStart = routes.indexOf('app.get("/backstage/readiness"');
assert.doesNotMatch(routes.slice(readinessStart, routes.indexOf("\n  });", readinessStart)), /generate|Connection\(/u);

// ── Partial failure retry keeps successful proposals ─────────────────────────
assert.deepEqual(planSlurpImprovementRetry(["a", "b", "c", "d"], ["b", "d"]), {
  accountIds: ["a", "c", "b", "d"],
  completed: 2,
});
const retryStart = routes.indexOf('app.post("/backstage/improvement-jobs/:id/retry"');
const retryBody = routes.slice(retryStart, routes.indexOf("\n  });", retryStart));
assert.match(retryBody, /row\.status === "error" && row\.field === "_creator"/u, "retry deletes only failure rows");

// ── Unused cleanup: finished rows past 30 days, never active jobs ────────────
const old = "2026-01-01T00:00:00.000Z";
const cutoff = Date.parse("2026-06-01T00:00:00.000Z");
const unused = selectUnusedSlurpImprovementRows(
  [
    { id: "done", status: "completed", updatedAt: old },
    { id: "live", status: "running", updatedAt: old },
    { id: "fresh", status: "completed", updatedAt: "2026-07-01T00:00:00.000Z" },
  ],
  [
    { id: "p-done", jobId: "done", status: "pending", updatedAt: old },
    { id: "p-live", jobId: "live", status: "dismissed", updatedAt: old },
    { id: "p-fresh-dismissed", jobId: "fresh", status: "dismissed", updatedAt: old },
    { id: "p-fresh-pending", jobId: "fresh", status: "pending", updatedAt: old },
  ],
  cutoff,
);
assert.deepEqual(unused, { improvementJobIds: ["done"], improvementProposalIds: ["p-done", "p-fresh-dismissed"] });

lockContention.then(
  () => console.log("slurp2 backstage safety regressions passed"),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
