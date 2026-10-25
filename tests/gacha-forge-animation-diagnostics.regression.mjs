import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  ["Invalid URL SECRET", { reason: "invalid-response" }, "responseFailed", "ERR_INVALID_URL"],
  ["Unknown failure with SECRET raw provider details", {}, "failed"],
];
try {
  for (const [index, [message, failure, englishKey, code]] of cases.entries()) {
    const dataDir = join(directory, String(index));
    await mkdir(dataDir);
    let calls = 0;
    const runtime = {
      logger: { warn() {} },
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            calls++;
            throw Object.assign(new Error(message), code ? { code } : {});
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
  for (const providerStatus of ["400", 0, 399, 600, null, { toString: () => "SECRET" }])
    assert.equal(
      forgeAnimationFailureMessage({ reason: "provider", providerStatus, detail: "SECRET" }),
      forgeAnimationEnglish.failed,
    );
  assert.equal(forgeAnimationFailureMessage({ reason: "SECRET", detail: "SECRET" }), forgeAnimationEnglish.failed);
  assert.equal(forgeAnimationFailureMessage(null), forgeAnimationEnglish.failed);
} finally {
  globalThis.forgeAnimationEnglish = originalEnglish;
  await rm(directory, { recursive: true, force: true });
}
console.info("Gacha banner animation diagnostics regression passed");
