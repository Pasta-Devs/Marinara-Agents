import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  slurpPollBackoffMs,
  SLURP_POLL_BACKOFF_MAX_MS,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-poll-backoff.js";

// A healthy poll keeps its normal cadence; a connection that keeps failing is retried
// exponentially slower instead of once a minute forever, and never slower than the cap.
assert.equal(slurpPollBackoffMs(60_000, 0), 60_000);
assert.equal(slurpPollBackoffMs(60_000, -1), 60_000);
assert.equal(slurpPollBackoffMs(60_000, 1), 120_000);
assert.equal(slurpPollBackoffMs(60_000, 3), 480_000);
assert.equal(slurpPollBackoffMs(60_000, 50), SLURP_POLL_BACKOFF_MAX_MS);

const root = join(import.meta.dirname, "..");
const read = (path: string) =>
  readFileSync(join(root, "packages/slurp/src/engine/packages/server/src/services/slurp", path), "utf8");

const storage = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
);
const autoPost = read("slurp-autopost-scheduler.service.ts");
assert.match(autoPost, /slurpPollBackoffMs\(POLL_MS, consecutiveFailures\)/);
assert.match(autoPost, /consecutiveFailures = failed \? consecutiveFailures \+ 1 : 0;/);
assert.match(autoPost, /failed = artwork === "unavailable";/);

const fanActivity = read("slurp-fan-activity-scheduler.service.ts");
assert.match(fanActivity, /schedule\(slurpPollBackoffMs\(POLL_MS, consecutiveFailures\)\)/);

// Unattended artwork must yield the image connection to the user's own work.
const artwork = read("slurp-artwork.operation.ts");
const backfill = artwork.slice(artwork.indexOf("export async function backfillNextNoodlerCreatorArtwork"));
assert.match(backfill, /admissionMode: \{ kind: "background" \}/);
assert.match(backfill, /if \(isConnectionAdmissionFailure\(error\)\) return "idle";/);

console.log("slurp poll backoff regression passed");

// A post whose image failed publishes anyway, keeps its prompt, and is redrawn later — bounded
// by an attempt budget so a broken image connection cannot retry for ever.
const images = read("slurp-images.service.ts");
assert.match(images, /imageRetryAttempts: attempts/);
assert.match(images, /imagePrompt: attempts >= NOODLER_POST_IMAGE_RETRY_LIMIT \? null : undefined/);
assert.match(images, /if \(isConnectionAdmissionFailure\(error\)\) \{\s*await noodle\.releasePostImageClaim/);
assert.match(images, /retryNextFailedPostImage/);
assert.match(images, /admissionMode: \{ kind: "background" \}/);
assert.match(autoPost, /retryNextFailedPostImage\(\)/);

const awaiting = storage.slice(storage.indexOf("async listNoodlerPostsAwaitingImageRetry"));
// Posts waiting on the user's own prompt review are never hijacked by the automatic retry.
assert.match(
  awaiting.slice(0, 1200),
  /metadata\.imagePendingReview === true \|\| metadata\.imageGenerationFailed !== true/,
);
assert.match(awaiting.slice(0, 1400), /noodlerPostImageRetryAttempts\(metadata\) >= NOODLER_POST_IMAGE_RETRY_LIMIT/);

// The failure fallbacks persist the prompt, or there would be nothing to redraw from.
const generation = read("slurp-generation.service.ts");
assert.equal(generation.split("imagePrompt: draftImagePrompt").length - 1, 6);

// A busy or unconfigured image connection is a deferral, not a provider failure: counting it as
// a failure would back the whole poll off while the user is simply using the connection.
assert.match(images, /let deferred = 0;/);
assert.match(images, /return result\.deferred > 0 \? "idle" : "failed";/);
// The attempt counter comes from persisted JSON: a NaN would read as "under the limit" for ever.
const retryHelper = read("slurp-image-retry.ts");
assert.match(retryHelper, /Number\.isFinite\(attempts\) && attempts > 0 \? attempts : 0/);
assert.doesNotMatch(images, /Number\(claimed\.metadata\.imageRetryAttempts/);
assert.doesNotMatch(storage, /Number\(metadata\.imageRetryAttempts/);
// The per-minute candidate scan is bounded.
assert.match(storage, /\.limit\(IMAGE_RETRY_SCAN_LIMIT\)/);

console.log("slurp image retry regression passed");

// The Engine's fallback wrapper takes no admission mode. Passing one there compiles (the
// package bundles with esbuild, which does not typecheck) but drops it, so the generation ran
// unadmitted and never booked its daily attempt — the reserve poll then regenerated a post on
// every pass. Admission must wrap the composed provider instead.
for (const file of ["slurp-generation.service.ts", "slurp-public-generation.service.ts"]) {
  const source = read(file);
  const fallbackCall = source.slice(
    source.indexOf("withConnectionFallbackProvider({"),
    source.indexOf("withConnectionAdmissionProvider("),
  );
  assert.doesNotMatch(fallbackCall, /admissionMode/, `${file} passes admissionMode to the fallback wrapper`);
  assert.match(source, /withConnectionAdmissionProvider\(\s*fallbackProvider,/, `${file} does not admit its provider`);
}

// The text-only retry and the correction pass are steps inside an already-admitted refresh.
const publicGeneration = read("slurp-public-generation.service.ts");
assert.match(
  publicGeneration,
  /stepProvider = withConnectionAdmissionProvider\(fallbackProvider, input\.connection\.id, \{ kind: "none" \}\)/,
);
assert.equal(publicGeneration.split("stepProvider.chatComplete").length - 1, 2);

console.log("slurp connection admission regression passed");
