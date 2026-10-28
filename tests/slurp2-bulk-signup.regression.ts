/**
 * 0.3.11, user report: 72 Creators in one sign-up ran 15 minutes in one request, and most of them
 * failed with "Unique value already exists for slurp2_accounts.handle". A drafted handle that is
 * taken now gets the next free one; a big batch runs as a server job the wizard polls (and may
 * leave); the first posts of a batch over 24 are queued, not refused.
 */
import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import { nextAvailablePublicHandle } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/records/slp-storage-model.ts";
import { SLP_CREATOR_BULK_ACCOUNT_MAX } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.schema.ts";

const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);

// A taken handle gets the next free one.
assert.equal(nextAvailablePublicHandle("mia", new Set(["mia", "mia_2"])), "mia_3");
assert.equal(nextAvailablePublicHandle("mia", new Set()), "mia");

// The account write picks a free handle and looks again when a parallel sign-up took it first.
const storage = server("data/creators/slp-creators-storage-3.ts");
assert.match(storage, /handle: nextAvailablePublicHandle\(wanted, taken\)/u);
assert.match(storage, /isSlurpFileUniqueConstraintError\(error, "slurp2_accounts", \["handle"\]\)\) continue;/u);

// A background sign-up: answers at once, runs as a job, and finishes what the wizard would have.
const routes = server("features/onboarding/slp-onboarding-routes.ts");
assert.match(
  routes,
  /if \(!parsed\.data\.background \|\| !executionId\) return reply\.code\(201\)\.send\(await signUp\(input\)\);/u,
);
assert.match(routes, /app\.get\("\/slurp\/accounts\/bulk\/:executionId"/u);
assert.match(routes, /if \(then\.firstPosts\) await firstPostQueue\.enqueue\(executionId, ids\);/u);
assert.match(
  routes,
  /accountIds: z\.array\(z\.string\(\)\.trim\(\)\.min\(1\)\.max\(64\)\)\.min\(1\)\.max\(SLP_CREATOR_BULK_ACCOUNT_MAX\)/u,
);
assert.ok(SLP_CREATOR_BULK_ACCOUNT_MAX >= 72, "the reported batch fits");

// The wizard starts the job, polls it, and shows how far it is.
const hooks = client("features/creators/slp-creator-profile-hooks.ts");
assert.match(hooks, /\{ \.\.\.input, background: true \}/u);
assert.match(hooks, /\/slurp2\/slurp\/accounts\/bulk\/\$\{encodeURIComponent\(input\.executionId!\)\}/u);
assert.match(client("features/onboarding/SlpOnboardingPanel.tsx"), /ui\.noodle\.noodlerwizard\.progressSigningUp/u);

console.log("slurp2 bulk sign-up regression passed");
