import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createForgeBannerAnimations } from "../packages/gacha-forge/src/animation-server.mjs";
import { forgeAnimationFailureMessage } from "../packages/gacha-forge/src/animation-client.mjs";
import { forgeAnimationEnglish } from "../packages/gacha-forge/src/animation-en.mjs";

const directory = await mkdtemp(join(tmpdir(), "forge-animation-diagnostics-"));
const originalEnglish = globalThis.forgeAnimationEnglish;
globalThis.forgeAnimationEnglish = forgeAnimationEnglish;
const banner = { connectionId: "video", galleryImageId: "gallery", identity: "standard", art: "/saved-image.png" };
const body = { runId: "world", banner: "char-standard" };
const cases = [
  ["Global Gallery image not found", { reason: "source-image" }, "sourceImageMissing"],
  ["The selected gallery image is too large.", { reason: "source-image" }, "sourceImageMissing"],
  ["Video generation connection not found", { reason: "connection" }, "connectionFailed"],
  ["OpenRouter video generation requires an OpenRouter API key", { reason: "connection" }, "connectionFailed"],
  [
    "OpenRouter video generation returned 400: SECRET data:image/png;base64,PRIVATE",
    { reason: "provider", providerStatus: 400 },
    "providerFailed",
  ],
  [
    "OpenRouter video polling returned 503: SECRET https://private.example/?key=PRIVATE",
    { reason: "provider", providerStatus: 503 },
    "providerFailed",
  ],
  ["OpenRouter video generation returned an invalid polling URL", { reason: "invalid-response" }, "responseFailed"],
  ["OpenRouter video generation returned an invalid content URL", { reason: "invalid-response" }, "responseFailed"],
  ["OpenRouter video content URL must not contain credentials", { reason: "invalid-response" }, "responseFailed"],
  [
    "OpenRouter video polling URL must use the configured API origin without credentials",
    { reason: "invalid-response" },
    "responseFailed",
  ],
  ["Invalid banner animation video", { reason: "invalid-response" }, "responseFailed"],
  ["Invalid URL SECRET", { reason: "invalid-response" }, "responseFailed", { code: "ERR_INVALID_URL" }],
  ["OpenRouter returned a non-MP4 video payload", { reason: "invalid-response" }, "responseFailed"],
  // Engine messages that previously fell through to the generic notice.
  ["OpenRouter video generation failed: SECRET upstream rejected input", { reason: "provider" }, "providerRejected"],
  ["OpenRouter video generation expired", { reason: "provider" }, "providerRejected"],
  [
    "Failed to download OpenRouter video (403): SECRET https://private.example/?key=PRIVATE",
    { reason: "provider", providerStatus: 403 },
    "providerFailed",
  ],
  ["Seedance video generation failed: SECRET content policy", { reason: "provider" }, "providerRejected"],
  [
    "Seedance video generation failed after retrying an opaque provider task failure",
    { reason: "provider" },
    "providerRejected",
  ],
  ["Google Veo returned 400: SECRET", { reason: "provider", providerStatus: 400 }, "providerFailed"],
  ["Gemini Omni returned 429: SECRET", { reason: "provider", providerStatus: 429 }, "providerFailed"],
  ["ComfyUI video queue failed (400): SECRET", { reason: "provider", providerStatus: 400 }, "providerFailed"],
  ["Temporary Seedance reference upload returned 500: SECRET", { reason: "seedance-reference-setup" }, "seedanceSetup"],
  [
    "Seedance first frame reference has no public HTTPS URL. Converted images, such as WebP illustrations prepared as PNG, require Upload Seedance reference frames temporarily to be enabled.",
    { reason: "seedance-reference-setup" },
    "seedanceSetup",
  ],
  ["This picture can't be read as a video first frame.", { reason: "source-image" }, "sourceImageMissing"],
  [
    "This ToAPIs adapter currently supports 4-second, 480p, 16:9 video only",
    { reason: "connection" },
    "connectionFailed",
  ],
  [
    "Refused to fetch https://private.example/v1/videos: hostname 'private.example' did not resolve to any address.",
    { reason: "connection" },
    "connectionFailed",
  ],
  ["fetch failed", { reason: "connection" }, "connectionFailed", { cause: { code: "ECONNREFUSED" } }],
  ["fetch failed", { reason: "timeout" }, "timeoutFailed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }],
  ["Video generation timed out after 1800 seconds", { reason: "timeout" }, "timeoutFailed"],
  ["Media generation queue is saturated: waited 600s for one of 4 slots", { reason: "timeout" }, "timeoutFailed"],
  ["Unknown failure with SECRET raw provider details", { reason: "unknown" }, "unknownFailed"],
];
try {
  for (const [index, [message, failure, englishKey, extra]] of cases.entries()) {
    const dataDir = join(directory, String(index));
    await mkdir(dataDir);
    let calls = 0;
    const runtime = {
      logger: { warn() {} },
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            calls++;
            throw Object.assign(new Error(message), extra);
          },
        },
      },
    };
    const create = () => createForgeBannerAnimations({ dataDir, runtime, readBanner: async () => banner });
    const service = create();
    const expected = { ok: false, error: "animation-failed", ...failure, retry: true };
    assert.deepEqual(await service.generate(body), expected);
    assert.equal(calls, 1);
    service.dispose();
    const reopened = create();
    assert.deepEqual(
      await reopened.generate(body),
      expected,
      "Reopen retains the safe diagnostic without resubmission",
    );
    assert.equal(calls, 1, "A failed paid attempt cannot automatically retry");
    const worldFolder = join(dataDir, "capability-package-data", "gacha-forge", "banner-animations");
    const markerFolder = join(worldFolder, (await readdir(worldFolder))[0]);
    const marker = await readFile(join(markerFolder, (await readdir(markerFolder))[0]), "utf8");
    assert.deepEqual(JSON.parse(marker), { state: "failed", ...failure });
    assert.doesNotMatch(marker + JSON.stringify(expected), /SECRET|PRIVATE|data:image|private\.example/);
    assert.equal(
      forgeAnimationFailureMessage(expected),
      forgeAnimationEnglish[englishKey].replace("{status}", String(failure.providerStatus)),
    );
    assert.deepEqual(await reopened.generate({ ...body, retry: true }), expected);
    assert.equal(calls, 2, "Only explicit retry may submit again");
    reopened.dispose();
  }
  const unavailable = createForgeBannerAnimations({ dataDir: directory, runtime: {}, readBanner: async () => banner });
  assert.equal(forgeAnimationFailureMessage(await unavailable.generate(body)), forgeAnimationEnglish.hostUnavailable);
  const missing = createForgeBannerAnimations({
    dataDir: directory,
    runtime: {},
    readBanner: async () => ({ ...banner, galleryImageId: "" }),
  });
  assert.equal(forgeAnimationFailureMessage(await missing.generate(body)), forgeAnimationEnglish.sourceImageMissing);
  const blocked = join(directory, "blocked");
  await mkdir(blocked);
  await writeFile(join(blocked, "capability-package-data"), "owned negative-control file");
  let storageCalls = 0;
  const storage = createForgeBannerAnimations({
    dataDir: blocked,
    runtime: {
      logger: { warn() {} },
      integrations: {
        videos: {
          animateGalleryImage: () => {
            storageCalls++;
          },
        },
      },
    },
    readBanner: async () => banner,
  });
  assert.equal(forgeAnimationFailureMessage(await storage.generate(body)), forgeAnimationEnglish.storageFailed);
  assert.equal(storageCalls, 0, "Local storage failure is distinct from a provider request");
  const clip = await readFile(new URL("./fixtures/gacha-banner-loop.mp4", import.meta.url));
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const storageFailure = { ok: false, error: "animation-failed", reason: "storage", retry: true };
  for (const retainPrevious of [false, true]) {
    const dataDir = join(directory, `clip-commit-${retainPrevious}`);
    await mkdir(dataDir);
    let calls = 0;
    let returnedBytes = clip;
    const options = {
      dataDir,
      readBanner: async () => banner,
      runtime: {
        logger: { warn() {} },
        integrations: {
          videos: {
            animateGalleryImage: async () => {
              calls++;
              return { mimeType: "video/mp4", base64: returnedBytes.toString("base64") };
            },
          },
        },
      },
    };
    const service = createForgeBannerAnimations(options);
    const previous = retainPrevious ? await service.generate(body) : null;
    returnedBytes = Buffer.concat([clip, Buffer.from("commit-failure-candidate")]);
    const folder = join(dataDir, "capability-package-data", "gacha-forge", "banner-animations", digest(body.runId));
    const collision = join(folder, `${digest(returnedBytes)}.mp4`);
    await mkdir(collision, { recursive: true });
    assert.deepEqual(
      await service.generate({ ...body, retry: retainPrevious }),
      storageFailure,
      "A valid returned clip that cannot be renamed over a directory reports storage failure",
    );
    assert.equal(forgeAnimationFailureMessage(storageFailure), forgeAnimationEnglish.storageFailed);
    const markerName = (await readdir(folder)).find((name) => name.endsWith(".json"));
    const marker = JSON.parse(await readFile(join(folder, markerName), "utf8"));
    assert.equal(marker.state, "failed");
    assert.equal(marker.reason, "storage");
    service.dispose();
    const reopened = createForgeBannerAnimations(options);
    const beforeReopen = calls;
    const saved = await reopened.generate(body);
    assert.equal(calls, beforeReopen, "A failed clip commit cannot repeat a paid attempt on reopening");
    if (retainPrevious) {
      assert.equal(saved.cached, true);
      assert.equal(saved.animation.url, previous.animation.url);
      assert.deepEqual(await readFile(join(folder, `${digest(clip)}.mp4`)), clip);
      assert.equal(marker.mediaKey, digest(clip));
    } else assert.deepEqual(saved, storageFailure);
    await rm(collision, { recursive: true });
    assert.equal((await reopened.generate({ ...body, retry: true })).ok, true);
    assert.equal(calls, beforeReopen + 1, "Only an explicit retry after the filesystem is repaired generates again");
    reopened.dispose();
  }
  const fullDirectory = join(directory, "clip-write-full");
  await mkdir(fullDirectory);
  let fullCalls = 0,
    faultRemaining = true;
  const fullOptions = {
    dataDir: fullDirectory,
    readBanner: async () => banner,
    runtime: {
      logger: { warn() {} },
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            fullCalls++;
            return { mimeType: "video/mp4", base64: clip.toString("base64") };
          },
        },
      },
    },
  };
  const originalWrite = fsPromises.writeFile;
  fsPromises.writeFile = async (path, ...args) => {
    if (faultRemaining && String(path).endsWith(".tmp") && !String(path).endsWith(".status.tmp")) {
      faultRemaining = false;
      throw Object.assign(new Error("Synthetic ENOSPC after a valid provider result"), { code: "ENOSPC" });
    }
    return originalWrite(path, ...args);
  };
  syncBuiltinESMExports();
  const fullService = createForgeBannerAnimations(fullOptions);
  try {
    assert.deepEqual(await fullService.generate(body), storageFailure);
  } finally {
    fsPromises.writeFile = originalWrite;
    syncBuiltinESMExports();
    fullService.dispose();
  }
  assert.equal(faultRemaining, false, "The fault must reach the temporary MP4 write, after the provider result");
  const fullFolder = join(
    fullDirectory,
    "capability-package-data",
    "gacha-forge",
    "banner-animations",
    digest(body.runId),
  );
  const fullMarker = (await readdir(fullFolder)).find((name) => name.endsWith(".json"));
  assert.equal(JSON.parse(await readFile(join(fullFolder, fullMarker), "utf8")).reason, "storage");
  const fullReopened = createForgeBannerAnimations(fullOptions);
  assert.deepEqual(await fullReopened.generate(body), storageFailure);
  assert.equal(fullCalls, 1, "A disk-full failure and reopen use only the original paid attempt");
  assert.equal((await fullReopened.generate({ ...body, retry: true })).ok, true);
  assert.equal(fullCalls, 2);
  fullReopened.dispose();
  // Invalid statuses are never interpolated; the player still learns that the provider failed the clip.
  for (const providerStatus of ["400", 0, 399, 600, null, { toString: () => "SECRET" }])
    assert.equal(
      forgeAnimationFailureMessage({ reason: "provider", providerStatus, detail: "SECRET" }),
      forgeAnimationEnglish.providerRejected,
    );
  // An Engine restart or package update aborts the paid request without writing a failed marker.
  const interruptedDirectory = join(directory, "interrupted");
  await mkdir(interruptedDirectory);
  let interruptedCalls = 0;
  const interruptedStarted = Promise.withResolvers();
  const interruptedOptions = {
    dataDir: interruptedDirectory,
    readBanner: async () => banner,
    runtime: {
      logger: { warn() {} },
      integrations: {
        videos: {
          animateGalleryImage: async ({ signal }) => {
            if (++interruptedCalls > 1) throw new Error("Video generation timed out after 1800 seconds");
            interruptedStarted.resolve();
            return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
          },
        },
      },
    },
  };
  const restarting = createForgeBannerAnimations(interruptedOptions);
  const abandoned = restarting.generate(body);
  await interruptedStarted.promise;
  restarting.dispose();
  assert.equal((await abandoned).error, "not-found");
  const interrupted = { ok: false, error: "animation-failed", reason: "interrupted", retry: true };
  const restarted = createForgeBannerAnimations(interruptedOptions);
  assert.deepEqual(await restarted.generate(body), interrupted, "A pending marker without a job explains itself");
  assert.equal(interruptedCalls, 1, "An interrupted paid attempt is never resubmitted automatically");
  assert.equal(forgeAnimationFailureMessage(interrupted), forgeAnimationEnglish.interruptedFailed);
  assert.equal((await restarted.generate({ ...body, retry: true })).reason, "timeout");
  assert.equal(interruptedCalls, 2, "Only an explicit retry submits the interrupted attempt again");
  restarted.dispose();
  // A failed status that cannot be written leaves the pending marker behind: that is a storage failure, not a restart.
  const unwritableDirectory = join(directory, "unwritable-status");
  await mkdir(unwritableDirectory);
  let lockedFolder = "";
  const unwritable = createForgeBannerAnimations({
    dataDir: unwritableDirectory,
    readBanner: async () => banner,
    runtime: {
      logger: { warn() {} },
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            const marker = (await readdir(unwritableDirectory, { recursive: true })).find((name) =>
              name.endsWith(".json"),
            );
            lockedFolder = dirname(join(unwritableDirectory, marker));
            await chmod(lockedFolder, 0o500);
            throw new Error("Video generation timed out after 1800 seconds");
          },
        },
      },
    },
  });
  try {
    assert.equal((await unwritable.generate(body)).reason, "storage");
    assert.equal((await unwritable.generate(body)).reason, "storage", "the leftover pending marker is not a restart");
  } finally {
    if (lockedFolder) await chmod(lockedFolder, 0o700);
    unwritable.dispose();
  }
  assert.equal(forgeAnimationFailureMessage({ reason: "SECRET", detail: "SECRET" }), forgeAnimationEnglish.failed);
  assert.equal(forgeAnimationFailureMessage(null), forgeAnimationEnglish.failed);
} finally {
  globalThis.forgeAnimationEnglish = originalEnglish;
  await rm(directory, { recursive: true, force: true });
}
console.info("Gacha banner animation diagnostics regression passed");
