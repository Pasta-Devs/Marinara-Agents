import assert from "node:assert/strict";
import { resolveObjectURL } from "node:buffer";
import { createHash } from "node:crypto";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, lstat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createForgeBannerAnimations } from "../packages/gacha-forge/src/animation-server.mjs";
import {
  wireForgeBannerAnimation,
  disposeForgeBannerAnimation,
} from "../packages/gacha-forge/src/animation-client.mjs";
import { forgeAnimationEnglish, forgeAnimationFields } from "../packages/gacha-forge/src/animation-en.mjs";

const directory = await mkdtemp(join(tmpdir(), "forge-animation-"));
const bytes = await readFile(new URL("./fixtures/gacha-banner-loop.mp4", import.meta.url));
const video = { base64: bytes.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
const digest = (text) => createHash("sha256").update(text).digest("hex");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const wait = () => new Promise((resolve) => setImmediate(resolve));
const log = Object.fromEntries(["debug", "info", "warn", "error"].map((level) => [level, () => {}]));
const meta = {
  connectionId: "video-source",
  galleryImageId: "image-owned",
  identity: "banner:f1",
  art: "/api/global-gallery/file/art.png",
};
const body = { runId: "world", banner: "char-featured" };
const reply = () => ({
  status: 200,
  headers: {},
  code(value) {
    this.status = value;
    return this;
  },
  header(key, value) {
    this.headers[key] = value;
    return this;
  },
  send(value) {
    this.body = value;
    return this;
  },
});
const collect = async (response) => {
  if (!response.body) return Buffer.alloc(0);
  const chunks = [];
  for await (const chunk of response.body) chunks.push(chunk);
  return Buffer.concat(chunks);
};
try {
  const dataDir = join(directory, "normal");
  await mkdir(dataDir);
  const pending = deferred(),
    started = deferred(),
    calls = [];
  const runtime = {
    logger: log,
    integrations: {
      videos: {
        animateGalleryImage: async (request) => {
          calls.push(request);
          started.resolve();
          return pending.promise;
        },
      },
    },
  };
  const service = createForgeBannerAnimations({ dataDir, runtime, readBanner: async () => meta });
  for (const invalid of [
    { ...body, banner: "portrait" },
    { ...body, galleryImageId: "not-owned" },
    { ...body, image: "/tmp/private" },
  ])
    assert.equal((await service.generate(invalid)).error, "bad-request");
  assert.equal(calls.length, 0);
  const first = service.generate(body);
  await started.promise;
  const second = service.generate(body);
  await wait();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].galleryImageId, "image-owned");
  assert.equal(calls[0].connectionId, "video-source");
  assert.equal(calls[0].loop, true);
  assert.equal(calls[0].aspectRatio, "16:9");
  assert.equal(calls[0].durationSeconds, 5);
  assert.match(calls[0].prompt, /last frame/);
  let restartedCalls = 0;
  const restarted = createForgeBannerAnimations({
    dataDir,
    runtime: {
      ...runtime,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            restartedCalls++;
            return video;
          },
        },
      },
    },
    readBanner: async () => meta,
  });
  assert.equal(
    (await restarted.generate(body)).retry,
    true,
    "restart preserves a pending paid request instead of submitting again",
  );
  assert.equal(restartedCalls, 0);
  const racingReady = deferred(),
    racingProvider = deferred(),
    missCaptured = deferred(),
    resumeMiss = deferred();
  let racingCalls = 0;
  const racing = createForgeBannerAnimations({
    dataDir,
    readBanner: async () => meta,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            racingCalls++;
            racingReady.resolve();
            return racingCalls === 1 ? racingProvider.promise : video;
          },
        },
      },
    },
  });
  const racingBody = { runId: "racing-world", banner: "char-standard" };
  const originalLstat = fsPromises.lstat;
  let heldMiss = false;
  fsPromises.lstat = async (path, ...options) => {
    try {
      return await originalLstat(path, ...options);
    } catch (error) {
      if (!heldMiss && String(path).includes(digest("racing-world")) && String(path).endsWith(".mp4")) {
        heldMiss = true;
        missCaptured.resolve();
        await resumeMiss.promise;
      }
      throw error;
    }
  };
  syncBuiltinESMExports();
  try {
    const racingFirst = racing.generate(racingBody);
    await missCaptured.promise;
    const racingSecond = racing.generate(racingBody);
    resumeMiss.resolve();
    await racingReady.promise;
    racingProvider.resolve(video);
    assert.deepEqual(await racingSecond, await racingFirst);
    assert.equal((await racing.generate(racingBody)).cached, true);
    assert.equal(racingCalls, 1, "concurrent cache preparation and completed-job reuse cannot repurchase a clip");
  } finally {
    fsPromises.lstat = originalLstat;
    syncBuiltinESMExports();
  }
  pending.resolve(video);
  const result = await first;
  assert.deepEqual(await second, result);
  assert.equal(result.ok, true);
  assert.equal((await restarted.generate(body)).cached, true);
  assert.equal(restartedCalls, 0);
  // Explicit recovery replaces a cached clip only after a successful provider result.
  const recoveryBody = { runId: "cached-recovery", banner: "char-featured" };
  let recoveryCalls = 0;
  let recoveryProvider = async () => video;
  const recoveryOptions = {
    dataDir,
    readBanner: async () => meta,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            recoveryCalls++;
            return recoveryProvider();
          },
        },
      },
    },
  };
  const recovery = createForgeBannerAnimations(recoveryOptions);
  const originalClip = await recovery.generate(recoveryBody);
  recoveryProvider = async () => {
    throw new Error("replacement provider rejected");
  };
  assert.equal(
    (await recovery.generate({ ...recoveryBody, retry: true })).ok,
    false,
    "an explicit retry must reach the provider instead of returning the broken cached clip",
  );
  assert.equal(recoveryCalls, 2);
  const originalParams = originalClip.animation.url.split("/").slice(-2);
  const originalResponse = await recovery.serve(
    { params: { world: originalParams[0], filename: originalParams[1] }, headers: {} },
    reply(),
  );
  assert.deepEqual(await collect(originalResponse), bytes, "failed replacement preserves the previous media bytes");
  assert.equal(
    (await createForgeBannerAnimations(recoveryOptions).generate(recoveryBody)).animation.url,
    originalClip.animation.url,
    "offline/reopened cache remains the old clip after a failed explicit replacement",
  );
  assert.equal(recoveryCalls, 2, "normal reopen never retries a failed provider automatically");
  const replacement = Buffer.concat([bytes, Buffer.from("replacement")]);
  const recoveryPending = deferred();
  recoveryProvider = () => recoveryPending.promise;
  const replacing = recovery.generate({ ...recoveryBody, retry: true });
  while (recoveryCalls < 3) await wait();
  const duplicateReplacing = recovery.generate({ ...recoveryBody, retry: true });
  await wait();
  assert.equal(recoveryCalls, 3, "concurrent explicit retry clicks share one paid attempt");
  recoveryPending.resolve({ ...video, base64: replacement.toString("base64") });
  const replaced = await replacing;
  assert.deepEqual(await duplicateReplacing, replaced);
  assert.notEqual(
    replaced.animation.url,
    originalClip.animation.url,
    "new bytes receive a new immutable URL instead of replaying the old browser cache",
  );
  const replacementParams = replaced.animation.url.split("/").slice(-2);
  assert.deepEqual(
    await collect(
      await recovery.serve(
        { params: { world: replacementParams[0], filename: replacementParams[1] }, headers: {} },
        reply(),
      ),
    ),
    replacement,
  );
  assert.equal(
    (await createForgeBannerAnimations(recoveryOptions).generate(recoveryBody)).animation.url,
    replaced.animation.url,
    "restart reuses the successfully published replacement",
  );
  assert.equal(recoveryCalls, 3);
  const recoveryFolder = join(
    dataDir,
    "capability-package-data",
    "gacha-forge",
    "banner-animations",
    digest(recoveryBody.runId),
  );
  await assert.rejects(
    readFile(join(recoveryFolder, originalParams[1])),
    { code: "ENOENT" },
    "a committed replacement retires its unreferenced previous clip",
  );
  recoveryProvider = async () => ({ ...video, base64: replacement.toString("base64") });
  const identical = await recovery.generate({ ...recoveryBody, retry: true });
  assert.equal(identical.animation.url, replaced.animation.url, "identical bytes keep the current immutable clip");
  assert.deepEqual(await readFile(join(recoveryFolder, replacementParams[1])), replacement);
  const legacyBody = { ...recoveryBody, runId: "legacy-clip-world" };
  recoveryProvider = async () => video;
  const legacy = await recovery.generate(legacyBody);
  const legacyFolder = join(
    dataDir,
    "capability-package-data",
    "gacha-forge",
    "banner-animations",
    digest(legacyBody.runId),
  );
  const legacyFilename = `${legacy.animation.key}.mp4`;
  await fsPromises.rename(
    join(legacyFolder, legacy.animation.url.split("/").at(-1)),
    join(legacyFolder, legacyFilename),
  );
  await rm(join(legacyFolder, `${legacy.animation.key}.json`));
  const legacyCalls = recoveryCalls;
  assert.equal(
    (await recovery.generate(legacyBody)).animation.url.split("/").at(-1),
    legacyFilename,
    "pre-upgrade input-key clips remain cached without a new provider call",
  );
  assert.equal(recoveryCalls, legacyCalls);
  assert.equal((await recovery.generate({ ...legacyBody, retry: true })).cached, false);
  assert.equal(recoveryCalls, legacyCalls + 1, "legacy clips also support deliberate replacement");
  await assert.rejects(
    readFile(join(legacyFolder, legacyFilename)),
    { code: "ENOENT" },
    "legacy media is retired only after its replacement is committed",
  );
  for (const state of ["ready", "pending", "failed"]) {
    const request = { ...body, runId: `shared-media-${state}` };
    recoveryProvider = async () => video;
    const shared = createForgeBannerAnimations(recoveryOptions);
    const first = await shared.generate(request);
    const other = await shared.generate({ ...request, banner: "wpn-featured" });
    const folder = join(dataDir, "capability-package-data", "gacha-forge", "banner-animations", digest(request.runId));
    const previous = join(folder, first.animation.url.split("/").at(-1));
    const mediaKey = first.animation.url.split("/").at(-1).slice(0, -4);
    await writeFile(join(folder, `${other.animation.key}.json`), JSON.stringify({ state, mediaKey }));
    recoveryProvider = async () => ({ ...video, base64: replacement.toString("base64") });
    assert.equal((await shared.generate({ ...request, retry: true })).ok, true);
    assert.deepEqual(await readFile(previous), bytes, `${state} markers retain a shared previous clip`);
    assert.equal((await shared.generate({ ...request, banner: "wpn-featured", retry: true })).ok, true);
    await assert.rejects(readFile(previous), { code: "ENOENT" }, "the last reference retires the old shared clip");
  }
  for (const failure of ["different", "identical", "shared"]) {
    const request = { ...body, runId: `failed-ready-marker-${failure}` };
    recoveryProvider = async () => video;
    const old = await recovery.generate(request);
    const nextBytes = failure === "identical" ? bytes : replacement;
    if (failure === "shared") {
      recoveryProvider = async () => ({ ...video, base64: nextBytes.toString("base64") });
      await recovery.generate({ ...request, banner: "wpn-featured" });
    }
    const folder = join(dataDir, "capability-package-data", "gacha-forge", "banner-animations", digest(request.runId));
    const originalRename = fsPromises.rename;
    fsPromises.rename = async (from, ...args) => {
      if (
        String(from).includes(digest(request.runId)) &&
        String(from).endsWith(".status.tmp") &&
        JSON.parse(await readFile(from, "utf8")).state === "ready"
      )
        throw new Error("fixture ready-marker commit refused");
      return originalRename(from, ...args);
    };
    syncBuiltinESMExports();
    recoveryProvider = async () => ({ ...video, base64: nextBytes.toString("base64") });
    try {
      assert.equal((await recovery.generate({ ...request, retry: true })).ok, false);
      assert.deepEqual(
        await readFile(join(folder, old.animation.url.split("/").at(-1))),
        bytes,
        "failed marker commit retains previous media",
      );
      assert.equal((await recovery.generate(request)).animation.url, old.animation.url);
      const newFile = join(folder, `${digest(nextBytes)}.mp4`);
      if (failure === "different")
        await assert.rejects(
          readFile(newFile),
          { code: "ENOENT" },
          "a rejected ready marker retires only its new unreferenced clip",
        );
      else
        assert.deepEqual(
          await readFile(newFile),
          nextBytes,
          `${failure} media remains referenced after a failed marker commit`,
        );
    } finally {
      fsPromises.rename = originalRename;
      syncBuiltinESMExports();
    }
  }
  {
    const request = { ...body, runId: "retire-unlink-is-best-effort" };
    recoveryProvider = async () => video;
    const old = await recovery.generate(request);
    const previous = join(
      dataDir,
      "capability-package-data",
      "gacha-forge",
      "banner-animations",
      digest(request.runId),
      old.animation.url.split("/").at(-1),
    );
    const originalUnlink = fsPromises.unlink;
    fsPromises.unlink = async (path, ...args) => {
      if (String(path).includes(digest(request.runId)) && String(path).endsWith(old.animation.url.split("/").at(-1)))
        throw new Error("fixture unlink refused");
      return originalUnlink(path, ...args);
    };
    syncBuiltinESMExports();
    recoveryProvider = async () => ({ ...video, base64: replacement.toString("base64") });
    try {
      const published = await recovery.generate({ ...request, retry: true });
      assert.equal(
        published.ok,
        true,
        "cleanup failure cannot turn a committed replacement into a retryable provider failure",
      );
      assert.deepEqual(await readFile(previous), bytes);
      const callsBefore = recoveryCalls;
      assert.equal((await recovery.generate(request)).animation.url, published.animation.url);
      assert.equal(recoveryCalls, callsBefore, "cleanup failure cannot purchase another generation");
    } finally {
      fsPromises.unlink = originalUnlink;
      syncBuiltinESMExports();
    }
  }
  for (const format of [
    "empty",
    "broken",
    "null",
    "array",
    "primitive",
    "invalid-key",
    "missing-file",
    "empty-file",
    "existing-file",
    "symlink-file",
    "directory-file",
    "array-key",
  ]) {
    for (const legacyReference of [false, true]) {
      const request = { ...body, runId: `legacy-reference-${format}-${legacyReference}` };
      recoveryProvider = async () => video;
      const old = await recovery.generate(request);
      const folder = join(
        dataDir,
        "capability-package-data",
        "gacha-forge",
        "banner-animations",
        digest(request.runId),
      );
      const previousKey = old.animation.url.split("/").at(-1).slice(0, -4);
      const stem = legacyReference ? previousKey : digest("unrelated-legacy-marker");
      const alternate = digest("alternate-clip");
      const named = format === "array-key" ? [previousKey] : alternate;
      const contents = {
        empty: "",
        broken: "{broken",
        null: "null",
        array: "[]",
        primitive: "7",
        "invalid-key": '{"mediaKey":"not-a-key"}',
      };
      if (format === "existing-file") await writeFile(join(folder, `${alternate}.mp4`), bytes);
      if (format === "empty-file") await writeFile(join(folder, `${alternate}.mp4`), "");
      if (format === "symlink-file")
        await symlink(join(folder, `${previousKey}.mp4`), join(folder, `${alternate}.mp4`));
      if (format === "directory-file") await mkdir(join(folder, `${alternate}.mp4`));
      await writeFile(join(folder, `${stem}.json`), contents[format] ?? JSON.stringify({ mediaKey: named }));
      recoveryProvider = async () => ({ ...video, base64: replacement.toString("base64") });
      const fresh = await recovery.generate({ ...request, retry: true });
      assert.equal(fresh.ok, true);
      const retained = format === "array-key" || (legacyReference && format !== "existing-file");
      const previousFile = join(folder, `${previousKey}.mp4`);
      if (retained)
        assert.deepEqual(await readFile(previousFile), bytes, `${format} retains the effective legacy/media reference`);
      else
        await assert.rejects(readFile(previousFile), { code: "ENOENT" }, `${format} does not retain an unrelated clip`);
      const [world, filename] = fresh.animation.url.split("/").slice(-2);
      assert.deepEqual(
        await collect(await recovery.serve({ params: { world, filename }, headers: {} }, reply())),
        replacement,
      );
    }
  }
  {
    const request = { ...body, runId: "coercible-current-marker" };
    recoveryProvider = async () => video;
    const old = await recovery.generate(request);
    const folder = join(dataDir, "capability-package-data", "gacha-forge", "banner-animations", digest(request.runId));
    await writeFile(join(folder, `${old.animation.key}.json`), JSON.stringify({ mediaKey: [digest(bytes)] }));
    assert.equal((await recovery.generate(request)).animation.url, old.animation.url);
    const identical = await recovery.generate({ ...request, retry: true });
    assert.equal(identical.animation.url, old.animation.url);
    assert.deepEqual(
      await readFile(join(folder, `${digest(bytes)}.mp4`)),
      bytes,
      "coercible legacy metadata cannot cause identical replacement to unlink its current clip",
    );
  }
  for (const guard of ["oversized-marker", "scan-ceiling", "directory-marker", "symlink-marker"]) {
    const request = { ...body, runId: `retirement-${guard}` };
    recoveryProvider = async () => video;
    const old = await recovery.generate(request);
    const folder = join(dataDir, "capability-package-data", "gacha-forge", "banner-animations", digest(request.runId));
    if (guard === "scan-ceiling") {
      for (let index = 0; index < 513; index += 1) await writeFile(join(folder, `unrelated-${index}`), "");
    } else if (guard === "directory-marker") await mkdir(join(folder, `${digest(guard)}.json`));
    else if (guard === "symlink-marker") {
      const outside = join(directory, "retirement-marker-sentinel.json");
      await writeFile(outside, "outside sentinel");
      await symlink(outside, join(folder, `${digest(guard)}.json`));
    } else await writeFile(join(folder, `${digest(guard)}.json`), " ".repeat(4097));
    recoveryProvider = async () => ({ ...video, base64: replacement.toString("base64") });
    assert.equal((await recovery.generate({ ...request, retry: true })).ok, true);
    assert.deepEqual(
      await readFile(join(folder, old.animation.url.split("/").at(-1))),
      bytes,
      `${guard} conservatively retains previous media without failing publication`,
    );
  }
  const [world, filename] = result.animation.url.split("/").slice(-2);
  for (const [range, expected] of [
    ["bytes=0-1", bytes.subarray(0, 2)],
    ["bytes=-5", bytes.subarray(-5)],
    ["bytes=5-", bytes.subarray(5)],
  ]) {
    const response = await service.serve({ params: { world, filename }, headers: { range }, method: "GET" }, reply());
    assert.equal(response.status, 206);
    assert.deepEqual(await collect(response), expected);
    assert.equal(response.headers["Content-Type"], "video/mp4");
    assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
  }
  for (const range of ["bytes=999999-", "bytes=2-1", "bytes=0-1,3-4", "bytes=-0", "bytes=-"]) {
    const response = await service.serve({ params: { world, filename }, headers: { range }, method: "GET" }, reply());
    assert.equal(response.status, 416);
    assert.equal(response.headers["Content-Range"], `bytes */${bytes.length}`);
  }
  const head = await service.serve({ params: { world, filename }, headers: {}, method: "HEAD" }, reply());
  assert.equal(head.body, undefined);
  assert.equal(head.headers["Content-Length"], bytes.length);
  assert.equal((await service.serve({ params: { world: "..", filename }, headers: {} }, reply())).status, 404);
  meta.identity = "banner:f2";
  const rotated = await restarted.generate(body);
  assert.equal(rotated.ok, true);
  assert.notEqual(rotated.animation.key, result.animation.key);
  meta.galleryImageId = "redrawn";
  assert.notEqual((await restarted.generate(body)).animation.key, rotated.animation.key);
  let failures = 0;
  const failedBody = { runId: "failure-world", banner: "char-standard" };
  const failService = createForgeBannerAnimations({
    dataDir,
    readBanner: async () => meta,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            failures++;
            if (failures === 1) throw new Error("fixture provider failure");
            return video;
          },
        },
      },
    },
  });
  assert.equal((await failService.generate(failedBody)).retry, true);
  assert.equal((await failService.generate(failedBody)).retry, true);
  assert.equal(failures, 1);
  assert.equal((await failService.generate({ ...failedBody, retry: true })).ok, true);
  assert.equal(failures, 2);
  let setupCalls = 0,
    setupCorrected = false;
  const setupOptions = {
    dataDir,
    readBanner: async () => meta,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            setupCalls++;
            if (!setupCorrected)
              throw new Error(
                "Seedance image-to-video references require a publicly reachable HTTPS image URL for the first frame. SECRET_PROVIDER_DETAIL",
              );
            return video;
          },
        },
      },
    },
  };
  const setupService = createForgeBannerAnimations(setupOptions);
  const setupBody = { runId: "setup-world", banner: "char-standard" };
  assert.deepEqual(await setupService.generate(setupBody), {
    ok: false,
    error: "animation-failed",
    reason: "seedance-reference-setup",
    retry: true,
  });
  assert.equal((await setupService.generate(setupBody)).retry, true);
  assert.equal(setupCalls, 1, "a setup failure never automatically purchases another attempt");
  const setupReopened = createForgeBannerAnimations(setupOptions);
  assert.deepEqual(await setupReopened.generate(setupBody), {
    ok: false,
    error: "animation-failed",
    reason: "seedance-reference-setup",
    retry: true,
  });
  assert.equal(setupCalls, 1, "reopening replays the safe setup reason without contacting the provider");
  const setupFolder = join(
      dataDir,
      "capability-package-data",
      "gacha-forge",
      "banner-animations",
      digest(setupBody.runId),
    ),
    setupStatus = join(
      setupFolder,
      (await readdir(setupFolder)).find((name) => name.endsWith(".json")),
    ),
    savedFailure = await readFile(setupStatus, "utf8");
  assert.deepEqual(JSON.parse(savedFailure), { state: "failed", reason: "seedance-reference-setup" });
  assert.equal(savedFailure.includes("SECRET_PROVIDER_DETAIL"), false);
  for (const [marker, reason] of [
    ['{"state":"pending"}', "interrupted"],
    ['{"state":"pending","reason":"seedance-reference-setup"}', "interrupted"],
    ['{"state":"failed","reason":"SECRET_PROVIDER_DETAIL"}', "unknown"],
    ["{broken"],
    [""],
  ]) {
    await writeFile(setupStatus, marker);
    assert.deepEqual(await setupReopened.generate(setupBody), {
      ok: false,
      error: "animation-failed",
      ...(reason ? { reason } : {}),
      retry: true,
    });
    assert.equal(setupCalls, 1, "legacy or corrupt markers never authorize an automatic purchase");
  }
  assert.equal((await setupReopened.generate({ ...setupBody, retry: true })).reason, "seedance-reference-setup");
  assert.equal(setupCalls, 2, "an explicit retry can atomically replace an empty marker and reach the provider");
  await writeFile(setupStatus, savedFailure);
  setupCorrected = true;
  assert.equal((await setupReopened.generate({ ...setupBody, retry: true })).ok, true);
  assert.equal(setupCalls, 3);

  const statusReady = deferred(),
    statusFailure = deferred(),
    statusBody = { runId: "status-link-world", banner: "char-standard" };
  const statusService = createForgeBannerAnimations({
    ...setupOptions,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: () => {
            statusReady.resolve();
            return statusFailure.promise;
          },
        },
      },
    },
  });
  const statusJob = statusService.generate(statusBody);
  await statusReady.promise;
  const statusFolder = join(
      dataDir,
      "capability-package-data",
      "gacha-forge",
      "banner-animations",
      digest(statusBody.runId),
    ),
    statusPath = join(
      statusFolder,
      (await readdir(statusFolder)).find((name) => name.endsWith(".json")),
    ),
    outsideStatus = join(directory, "outside-status-sentinel");
  await writeFile(outsideStatus, "keep outside bytes");
  await rm(statusPath);
  await symlink(outsideStatus, statusPath);
  statusFailure.reject(new Error("Seedance first frame reference URL must be public HTTPS. SECRET_PROVIDER_DETAIL"));
  assert.equal((await statusJob).reason, "seedance-reference-setup");
  assert.equal(
    await readFile(outsideStatus, "utf8"),
    "keep outside bytes",
    "atomic marker replacement never follows a symlink",
  );
  assert.equal((await lstat(statusPath)).isSymbolicLink(), false);
  assert.deepEqual(JSON.parse(await readFile(statusPath, "utf8")), {
    state: "failed",
    reason: "seedance-reference-setup",
  });

  const statusWriteHeld = deferred(),
    releaseStatusWrite = deferred(),
    statusOriginalWrite = fsPromises.writeFile,
    deletedStatusBody = { runId: "deleted-status-world", banner: "char-standard" };
  const deletedStatus = createForgeBannerAnimations({
    ...setupOptions,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            throw new Error("Seedance first frame reference URL must be public HTTPS.");
          },
        },
      },
    },
  });
  fsPromises.writeFile = async (path, ...options) => {
    if (String(path).includes(digest(deletedStatusBody.runId)) && String(path).endsWith(".status.tmp")) {
      statusWriteHeld.resolve();
      await releaseStatusWrite.promise;
    }
    return statusOriginalWrite(path, ...options);
  };
  syncBuiltinESMExports();
  try {
    const failingStatusJob = deletedStatus.generate(deletedStatusBody);
    await statusWriteHeld.promise;
    const removal = deletedStatus.removeWorld(deletedStatusBody.runId);
    releaseStatusWrite.resolve();
    await removal;
    assert.equal((await failingStatusJob).error, "not-found");
    await assert.rejects(
      lstat(
        join(dataDir, "capability-package-data", "gacha-forge", "banner-animations", digest(deletedStatusBody.runId)),
      ),
      { code: "ENOENT" },
    );
  } finally {
    fsPromises.writeFile = statusOriginalWrite;
    syncBuiltinESMExports();
  }
  const late = deferred(),
    lateStarted = deferred();
  const deleting = createForgeBannerAnimations({
    dataDir,
    readBanner: async () => meta,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            lateStarted.resolve();
            return late.promise;
          },
        },
      },
    },
  });
  const lateJob = deleting.generate({ runId: "deleted-world", banner: "char-standard" });
  await lateStarted.promise;
  await deleting.removeWorld("deleted-world");
  late.resolve(video);
  assert.equal((await lateJob).ok, false);
  await assert.rejects(
    lstat(join(dataDir, "capability-package-data", "gacha-forge", "banner-animations", digest("deleted-world"))),
    { code: "ENOENT" },
  );

  // A restored document may legitimately reuse its old world ID without restarting the package.
  for (const oldFinishesFirst of [true, false]) {
    const runId = `restored-${oldFinishesFirst}`,
      oldReady = deferred(),
      restoredReady = deferred(),
      oldVideo = deferred(),
      restoredVideo = deferred(),
      requests = [];
    let authoritativeBanner = meta;
    const restored = createForgeBannerAnimations({
      dataDir,
      readBanner: async () => authoritativeBanner,
      runtime: {
        logger: log,
        integrations: {
          videos: {
            animateGalleryImage: async (request) => {
              requests.push(request);
              assert.ok(requests.length <= 2, "each world lifetime can submit only one clip");
              (requests.length === 1 ? oldReady : restoredReady).resolve();
              return requests.length === 1 ? oldVideo.promise : restoredVideo.promise;
            },
          },
        },
      },
    });
    const request = { runId, banner: "char-standard" },
      oldJob = restored.generate(request);
    await oldReady.promise;
    authoritativeBanner = null;
    await restored.removeWorld(runId);
    assert.equal(requests[0].signal.aborted, true);
    authoritativeBanner = { ...meta };
    const freshJob = restored.generate(request);
    await Promise.race([
      restoredReady.promise,
      freshJob.then((result) => assert.equal(result.ok, true, "restored documents must not remain tombstoned")),
    ]);
    const concurrent = restored.generate(request);
    if (oldFinishesFirst) {
      oldVideo.resolve(video);
      assert.equal((await oldJob).error, "not-found");
    }
    const afterOldFinally = restored.generate(request);
    await wait();
    assert.equal(requests.length, 2, "an old finally cannot evict the restored in-flight job");
    restoredVideo.resolve(video);
    const result = await freshJob;
    assert.equal(result.ok, true);
    assert.deepEqual(await concurrent, result);
    assert.deepEqual(await afterOldFinally, result);
    if (!oldFinishesFirst) {
      oldVideo.resolve(video);
      assert.equal((await oldJob).error, "not-found");
    }
    assert.equal((await restored.generate(request)).cached, true, "late cleanup cannot erase restored files");
    const [world, filename] = result.animation.url.split("/").slice(-2);
    assert.deepEqual(await collect(await restored.serve({ params: { world, filename }, headers: {} }, reply())), bytes);
    restored.dispose();
  }

  const readHeld = deferred(),
    releaseRead = deferred();
  let reads = 0,
    readProviderCalls = 0;
  const reading = createForgeBannerAnimations({
    dataDir,
    readBanner: async () => {
      if (++reads === 1) {
        readHeld.resolve();
        return releaseRead.promise;
      }
      return meta;
    },
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            readProviderCalls++;
            return video;
          },
        },
      },
    },
  });
  const readBody = { runId: "deleted-during-read", banner: "char-standard" },
    oldRead = reading.generate(readBody);
  await readHeld.promise;
  await reading.removeWorld(readBody.runId);
  releaseRead.resolve(meta);
  assert.equal((await oldRead).error, "not-found", "a read started before deletion cannot become a restored job");
  assert.equal(readProviderCalls, 0);
  assert.equal((await reading.generate(readBody)).ok, true);
  assert.equal(readProviderCalls, 1);

  const prepareHeld = deferred(),
    releasePrepare = deferred(),
    originalWrite = fsPromises.writeFile,
    prepareBody = { runId: "deleted-during-preparation", banner: "char-standard" };
  let prepareCalls = 0,
    heldPreparation = false;
  const preparing = createForgeBannerAnimations({
    dataDir,
    readBanner: async () => meta,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            prepareCalls++;
            return video;
          },
        },
      },
    },
  });
  fsPromises.writeFile = async (path, ...options) => {
    if (!heldPreparation && String(path).includes(digest(prepareBody.runId)) && String(path).endsWith(".json")) {
      heldPreparation = true;
      prepareHeld.resolve();
      await releasePrepare.promise;
    }
    return originalWrite(path, ...options);
  };
  syncBuiltinESMExports();
  try {
    const oldPreparation = preparing.generate(prepareBody);
    await prepareHeld.promise;
    const deletion = preparing.removeWorld(prepareBody.runId);
    releasePrepare.resolve();
    await deletion;
    assert.equal((await oldPreparation).error, "not-found");
    assert.equal(prepareCalls, 0, "a superseded preparation must never dispatch a provider request");
    await assert.rejects(
      lstat(join(dataDir, "capability-package-data", "gacha-forge", "banner-animations", digest(prepareBody.runId))),
      { code: "ENOENT" },
    );
    assert.equal((await preparing.generate(prepareBody)).ok, true);
    assert.equal(prepareCalls, 1);
  } finally {
    fsPromises.writeFile = originalWrite;
    syncBuiltinESMExports();
  }

  const cleanupHeld = deferred(),
    releaseCleanup = deferred(),
    originalRm = fsPromises.rm,
    cleanupBody = { runId: "restored-during-cleanup", banner: "char-standard" },
    cleanupFolder = join(
      dataDir,
      "capability-package-data",
      "gacha-forge",
      "banner-animations",
      digest(cleanupBody.runId),
    );
  let cleanupCalls = 0;
  const cleaning = createForgeBannerAnimations({
    dataDir,
    readBanner: async () => meta,
    runtime: {
      logger: log,
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            cleanupCalls++;
            return video;
          },
        },
      },
    },
  });
  assert.equal((await cleaning.generate(cleanupBody)).ok, true);
  const canonicalCleanupFolder = await fsPromises.realpath(cleanupFolder);
  fsPromises.rm = async (path, ...options) => {
    if (String(path) === canonicalCleanupFolder) {
      cleanupHeld.resolve();
      await releaseCleanup.promise;
    }
    return originalRm(path, ...options);
  };
  syncBuiltinESMExports();
  try {
    const deletion = cleaning.removeWorld(cleanupBody.runId);
    await cleanupHeld.promise;
    const restoredDuringCleanup = cleaning.generate(cleanupBody);
    await wait();
    assert.equal(cleanupCalls, 1, "restored preparation waits for filesystem cleanup, not a paid provider");
    releaseCleanup.resolve();
    await deletion;
    assert.equal((await restoredDuringCleanup).ok, true);
    assert.equal(cleanupCalls, 2);
    assert.equal((await cleaning.generate(cleanupBody)).cached, true);
  } finally {
    fsPromises.rm = originalRm;
    syncBuiltinESMExports();
  }

  // Every internal ancestor is refused before creating anything through it, reading cached media or deleting.
  for (let depth = 0; depth < 4; depth++) {
    const base = join(directory, `symlink-${depth}`),
      outside = join(directory, `outside-${depth}`);
    await mkdir(base);
    await mkdir(outside);
    await writeFile(join(outside, "sentinel"), "keep");
    const segments = ["capability-package-data", "gacha-forge", "banner-animations", digest("world")];
    let parent = base;
    for (const segment of segments.slice(0, depth)) {
      parent = join(parent, segment);
      await mkdir(parent);
    }
    await symlink(outside, join(parent, segments[depth]));
    let unsafeCalls = 0;
    const unsafe = createForgeBannerAnimations({
      dataDir: base,
      readBanner: async () => meta,
      runtime: {
        logger: log,
        integrations: {
          videos: {
            animateGalleryImage: async () => {
              unsafeCalls++;
              return video;
            },
          },
        },
      },
    });
    assert.equal((await unsafe.generate(body)).ok, false);
    assert.equal(unsafeCalls, 0);
    assert.equal(
      (await unsafe.serve({ params: { world: digest("world"), filename }, headers: {} }, reply())).status,
      404,
    );
    await assert.rejects(unsafe.removeWorld("world"), /Invalid animation directory/);
    assert.equal(await readFile(join(outside, "sentinel"), "utf8"), "keep");
    assert.deepEqual(await readdir(outside), ["sentinel"]);
  }
  const alias = join(directory, "configured-data-symlink");
  await symlink(dataDir, alias);
  const aliased = createForgeBannerAnimations({
    dataDir: alias,
    runtime: { logger: log, integrations: { videos: { animateGalleryImage: async () => video } } },
    readBanner: async () => meta,
  });
  assert.equal((await aliased.generate({ runId: "alias-world", banner: "char-standard" })).ok, true);

  // Exercise the actual injected routes and source persistence, with synthetic documents and a host wrapper.
  const docs = new Map(),
    routes = new Map(),
    clone = structuredClone;
  const seed = (id, kind, data) => docs.set(id, { id, kind, data: clone(data), revision: 1 });
  seed("index", "index", {
    runs: [{ runId: "shipped", scenario: "A synthetic world", animationConnectionId: "saved-video" }],
  });
  seed("shipped:session", "session", {
    account: { level: 100 },
    progress: {},
    featured: { seq: 1, startedAt: Date.now(), endsAt: Date.now() + 86400000 },
  });
  seed("shipped:banner:standard", "banner", {
    art: { "char-standard": meta.art },
    artRef: { "char-standard": "global-gallery:owned-gallery-id" },
  });
  const shippedCalls = [];
  const moduleFile = join(directory, "server.mjs");
  await writeFile(moduleFile, await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url)));
  const { activate } = await import(pathToFileURL(moduleFile).href);
  const cleanup = await activate({
    dataDir,
    package: { id: "gacha-forge" },
    api: {
      runtime: {
        logger: log,
        integrations: {
          videos: {
            animateGalleryImage: async (request) => {
              shippedCalls.push(request);
              return video;
            },
          },
        },
        persistence: {
          documents: {
            getById: async (_package, id) => clone(docs.get(id) || null),
            list: async (_package, kind) => clone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
            create: async (doc) => {
              seed(doc.id, doc.kind, doc.data);
              return clone(docs.get(doc.id));
            },
            update: async (doc) => {
              const old = docs.get(doc.id);
              if (old?.revision !== doc.expectedRevision) return null;
              const saved = { ...old, ...clone(doc), revision: old.revision + 1 };
              docs.set(doc.id, saved);
              return clone(saved);
            },
          },
        },
      },
      registerPrivilegedRoutes: async (register) =>
        register({
          post: (name, handler) => routes.set(name, handler),
          get: (name, handler) => routes.set(name, handler),
        }),
    },
  });
  const route = (name, data) => routes.get(name)({ body: data });
  assert.equal((await route("/banner-animation", { runId: "shipped", banner: "portrait" })).error, "bad-request");
  assert.equal(
    (await route("/banner-animation", { runId: "shipped", banner: "char-standard", galleryImageId: "arbitrary" }))
      .error,
    "bad-request",
  );
  const shipped = await route("/banner-animation", { runId: "shipped", banner: "char-standard" });
  assert.equal(shipped.ok, true);
  assert.equal(shippedCalls[0].galleryImageId, "owned-gallery-id");
  assert.equal((await route("/banner-animation", { runId: "shipped", banner: "char-standard" })).cached, true);
  assert.equal(shippedCalls.length, 1);
  assert.equal(
    (await route("/banner-animation", { runId: "shipped", banner: "char-standard", retry: true })).cached,
    false,
  );
  assert.equal(shippedCalls.length, 2, "the shipped route passes an explicit cached-media retry to the provider");
  assert.equal((await route("/run/sources", { runId: "shipped", sources: { animationConnectionId: "" } })).ok, true);
  assert.equal(
    (await route("/banner-animation", { runId: "shipped", banner: "char-standard" })).error,
    "animations-off",
  );
  assert.equal(forgeAnimationFields()[0].settings, "sources");
  cleanup();

  // A minimal DOM tests async identity and pause/navigation without imitating a video decoder.
  const originals = Object.fromEntries(
    ["document", "matchMedia", "IntersectionObserver", "forgeAnimationEnglish", "Ze"].map((key) => [
      key,
      globalThis[key],
    ]),
  );
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.dataset = {};
      this.style = {};
      this.children = [];
      this.isConnected = true;
      this.events = {};
    }
    append(child) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
    prepend(child) {
      child.remove();
      child.parentElement = this;
      this.children.unshift(child);
    }
    remove() {
      if (this.parentElement)
        this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      this.parentElement = null;
    }
    setAttribute(key, value) {
      (this.attributes ??= {})[key] = value;
    }
    querySelector(selector) {
      return this.children.find((child) =>
        selector.includes("retry")
          ? Object.hasOwn(child.dataset, "animationRetry")
          : selector.includes("pause")
            ? Object.hasOwn(child.dataset, "animationPause")
            : false,
      );
    }
    addEventListener(name, handler) {
      this.events[name] = handler;
    }
    pause() {
      this.paused = true;
    }
    play() {
      if (Element.pendingNextPlay) {
        const pending = Element.pendingNextPlay;
        Element.pendingNextPlay = null;
        this.paused = false;
        return pending.promise;
      }
      if (Element.rejectNextPlay) {
        Element.rejectNextPlay = false;
        return Promise.reject(new DOMException("A user gesture is required.", "NotAllowedError"));
      }
      this.paused = false;
      return Promise.resolve();
    }
  }
  try {
    globalThis.forgeAnimationEnglish = forgeAnimationEnglish;
    globalThis.document = {
      visibilityState: "visible",
      addEventListener() {},
      removeEventListener() {},
      createElement: (tag) => new Element(tag),
    };
    globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    globalThis.IntersectionObserver = undefined;
    // The host's authenticated fetch; <video> itself cannot send the X-Admin-Secret header.
    const clipFetches = [],
      savedClip = () => ({ ok: true, blob: async () => new Blob([bytes], { type: "video/mp4" }) });
    let clipResponse = savedClip;
    globalThis.Ze = async (url) => {
      clipFetches.push(url);
      return clipResponse(url);
    };
    const shown = (view, text) => view.chips.children.some((node) => node.textContent === text);
    const client = () => {
      const chips = new Element("chips"),
        target = new Element("art"),
        requests = [];
      target.parentElement = { querySelector: () => chips };
      const host = {
        _run: { runId: "ui-world", animationConnectionId: "video" },
        _hudView: "summon",
        _summonPhase: "banner",
        _summonBannerState: "ready",
        _summonBanner: { banner: { id: "char-featured", art: "same-art", music: { cue: "banner-char-featured-f1" } } },
        _root: { querySelector: () => target },
        _postJson: (_path, body) => {
          const request = deferred();
          request.body = body;
          requests.push(request);
          return request.promise;
        },
      };
      return { chips, target, requests, host };
    };
    const { chips, target, requests, host } = client();
    const response = {
      ok: true,
      animation: {
        poster: "same-art",
        url: `/api/gacha-forge/banner-animation/file/${"a".repeat(64)}/${"b".repeat(64)}.mp4`,
      },
    };
    wireForgeBannerAnimation(host);
    assert.equal(requests.length, 1);
    host._summonBanner.banner.music.cue = "banner-char-featured-f2";
    wireForgeBannerAnimation(host);
    assert.equal(requests.length, 2);
    requests[0].resolve(response);
    await wait();
    assert.equal(target.children.length, 0, "same image/id from an old rotation cannot attach");
    Element.rejectNextPlay = true;
    requests[1].resolve(response);
    await wait();
    assert.equal(target.children[0].tagName, "video");
    assert.equal(host._forgeBannerAnimation.paused, true, "autoplay denial offers a user gesture on the same clip");
    assert.equal(chips.querySelector("pause").textContent, forgeAnimationEnglish.play);
    chips.querySelector("pause").onclick();
    assert.equal(requests.length, 2, "resuming denied autoplay never regenerates a video");
    assert.equal(host._forgeBannerAnimation.paused, false);
    chips.querySelector("pause").onclick();
    assert.equal(host._forgeBannerAnimation.paused, true);
    host._hudView = "settings";
    wireForgeBannerAnimation(host);
    const restoredBanner = host._summonBanner;
    host._summonBanner = null;
    host._summonBannerState = "loading";
    host._hudView = "summon";
    wireForgeBannerAnimation(host);
    host._summonBanner = restoredBanner;
    host._summonBannerState = "ready";
    wireForgeBannerAnimation(host);
    await wait();
    assert.ok(chips.querySelector("pause"), "paused banner still has its resume control after navigation");
    chips.querySelector("pause").onclick();
    assert.equal(host._forgeBannerAnimation.paused, false);
    const departedVideo = target.children[0];
    host._summonBanner.banner.id = "wpn-standard";
    wireForgeBannerAnimation(host);
    assert.equal(requests.length, 3);
    departedVideo.events.error();
    assert.equal(
      chips.children.some((node) => node.textContent === forgeAnimationEnglish.playbackFailed),
      false,
      "an error from a detached old clip cannot replace the active banner's status",
    );
    host._run = { runId: "another-world", animationConnectionId: "video" };
    wireForgeBannerAnimation(host);
    requests[2].resolve(response);
    await wait();
    assert.equal(target.children.length, 0, "late completion cannot attach to another world");
    disposeForgeBannerAnimation(host);

    const playback = client();
    wireForgeBannerAnimation(playback.host);
    playback.requests[0].resolve(response);
    await wait();
    const failedClip = playback.target.children[0];
    assert.equal(clipFetches.at(-1), response.animation.url, "the saved clip is read with the host's fetch");
    assert.deepEqual(
      Buffer.from(await resolveObjectURL(failedClip.src).arrayBuffer()),
      bytes,
      "the element plays a local copy instead of the privileged route",
    );
    const failedSource = failedClip.src;
    failedClip.events.playing();
    failedClip.events.error();
    assert.equal(resolveObjectURL(failedSource), undefined, "a failed clip releases its in-memory copy");
    assert.ok(shown(playback, `${forgeAnimationEnglish.playbackFailed} ${forgeAnimationEnglish.retryCost}`));
    assert.ok(
      playback.chips.querySelector("[data-animation-retry]"),
      "a downloaded clip this browser cannot decode offers an explicit, priced replacement",
    );
    playback.host._forgeBannerAnimation.onVisibility();
    wireForgeBannerAnimation(playback.host);
    await wait();
    assert.equal(playback.requests.length, 1, "playback errors never trigger automatic paid regeneration");
    playback.host._summonBanner.banner.music.cue = "banner-char-featured-f2";
    wireForgeBannerAnimation(playback.host);
    assert.equal(playback.requests[1].body.retry, false, "a new rotation requests its own clip");
    playback.requests[1].resolve({
      ...response,
      animation: { ...response.animation, url: response.animation.url.replace(/b{64}/u, "c".repeat(64)) },
    });
    await wait();
    const recoveredClip = playback.target.children[0];
    recoveredClip.events.playing();
    failedClip.events.error();
    failedClip.events.playing();
    assert.equal(
      playback.target.children[0],
      recoveredClip,
      "late events from a removed clip cannot tear down its successful replacement",
    );
    assert.equal(recoveredClip.style.opacity, "1");
    assert.equal(playback.chips.querySelector("[data-animation-retry]"), undefined);
    assert.equal(playback.requests.length, 2);
    const recoveredSource = recoveredClip.src;
    disposeForgeBannerAnimation(playback.host);
    assert.equal(resolveObjectURL(recoveredSource), undefined, "cleanup releases the in-memory clip");

    const refused = client();
    clipResponse = () => ({ ok: false, status: 403 });
    wireForgeBannerAnimation(refused.host);
    refused.requests[0].resolve(response);
    await wait();
    clipResponse = savedClip;
    assert.equal(refused.target.children.length, 0);
    assert.ok(shown(refused, forgeAnimationEnglish.playbackFailed));
    assert.equal(
      refused.chips.querySelector("[data-animation-retry]"),
      undefined,
      "a refused clip download never offers a paid regeneration",
    );
    refused.host._forgeBannerAnimation.onVisibility();
    await wait();
    assert.equal(refused.requests.length, 1);
    disposeForgeBannerAnimation(refused.host);

    const busy = client();
    clipResponse = () => ({ ok: false, status: 503 });
    wireForgeBannerAnimation(busy.host);
    busy.requests[0].resolve(response);
    await wait();
    clipResponse = savedClip;
    assert.equal(busy.target.children.length, 0);
    assert.equal(busy.chips.querySelector("[data-animation-retry]"), undefined, "a busy proxy is not a paid retry");
    busy.host._forgeBannerAnimation.onVisibility();
    assert.equal(busy.requests[1]?.body.retry, false, "a temporary download error asks again for the saved clip");
    busy.requests[1].resolve(response);
    await wait();
    assert.equal(busy.target.children[0]?.tagName, "video");
    disposeForgeBannerAnimation(busy.host);

    const lost = client();
    wireForgeBannerAnimation(lost.host);
    lost.requests[0].resolve({ ok: false, error: "animation-failed", reason: "unknown", retry: true });
    await wait();
    assert.ok(shown(lost, `${forgeAnimationEnglish.unknownFailed} ${forgeAnimationEnglish.retryCost}`));
    lost.chips.querySelector("[data-animation-retry]").onclick();
    assert.equal(lost.requests[1].body.retry, true);
    lost.requests[1].resolve(null);
    await wait();
    assert.ok(shown(lost, forgeAnimationEnglish.connectionLost));
    assert.equal(
      lost.chips.querySelector("[data-animation-retry]"),
      undefined,
      "a dropped connection does not prompt an immediate paid retry",
    );
    lost.host._forgeBannerAnimation.onVisibility();
    assert.equal(lost.requests.length, 3, "returning to the banner asks Engine again");
    assert.equal(lost.requests[2].body.retry, false, "asking again joins the running job instead of paying again");
    clipResponse = () => Promise.reject(new TypeError("Load failed"));
    lost.requests[2].resolve(response);
    await wait();
    clipResponse = savedClip;
    assert.ok(shown(lost, forgeAnimationEnglish.connectionLost), "a dropped clip download is not a paid failure");
    assert.equal(lost.target.children.length, 0);
    lost.host._forgeBannerAnimation.onVisibility();
    assert.equal(lost.requests[3].body.retry, false);
    lost.requests[3].resolve(response);
    await wait();
    assert.equal(lost.target.children[0]?.tagName, "video");
    disposeForgeBannerAnimation(lost.host);

    const unsupported = client(),
      unsupportedPlay = deferred();
    wireForgeBannerAnimation(unsupported.host);
    Element.pendingNextPlay = unsupportedPlay;
    unsupported.requests[0].resolve(response);
    await wait();
    unsupportedPlay.reject(new DOMException("No supported media source.", "NotSupportedError"));
    await wait();
    assert.ok(
      unsupported.chips.querySelector("[data-animation-retry]"),
      "a promise-only decoder rejection offers an explicit, priced replacement",
    );
    assert.ok(shown(unsupported, `${forgeAnimationEnglish.playbackFailed} ${forgeAnimationEnglish.retryCost}`));
    assert.equal(unsupported.target.children.length, 0, "the unsupported clip is removed");
    assert.equal(unsupported.requests.length, 1, "promise-only failures never repurchase automatically");
    disposeForgeBannerAnimation(unsupported.host);

    const stale = client();
    wireForgeBannerAnimation(stale.host);
    const staleIdentity = stale.host._forgeBannerAnimation.identity;
    stale.requests[0].resolve({ ...response, animation: { ...response.animation, poster: "outdated-art" } });
    await wait();
    assert.equal(stale.target.children.length, 0, "a mismatched poster never mounts a video");
    assert.equal(
      stale.host._forgeBannerAnimation.requests.has(staleIdentity),
      false,
      "a mismatched poster evicts the stale resolved request",
    );
    assert.ok(
      stale.chips.children.some(
        (node) => node.textContent === `${forgeAnimationEnglish.failed} ${forgeAnimationEnglish.retryCost}`,
      ),
    );
    assert.ok(stale.chips.querySelector("[data-animation-retry]"), "stale poster metadata offers explicit recovery");
    assert.equal(
      stale.chips.children.some((node) => node.textContent === forgeAnimationEnglish.generating),
      false,
      "a mismatched poster settles the generating indicator into the still-image notice",
    );
    document.visibilityState = "hidden";
    stale.host._forgeBannerAnimation.onVisibility();
    document.visibilityState = "visible";
    stale.host._forgeBannerAnimation.onVisibility();
    wireForgeBannerAnimation(stale.host);
    const remounted = new Element("art");
    remounted.parentElement = stale.target.parentElement;
    stale.host._root.querySelector = () => remounted;
    wireForgeBannerAnimation(stale.host);
    await wait();
    assert.equal(stale.requests.length, 1, "visibility and DOM remounts cannot repurchase a stale poster clip");
    assert.ok(
      stale.chips.children.some(
        (node) => node.textContent === `${forgeAnimationEnglish.failed} ${forgeAnimationEnglish.retryCost}`,
      ),
    );
    stale.host._summonBanner = { banner: structuredClone(stale.host._summonBanner.banner) };
    wireForgeBannerAnimation(stale.host);
    assert.equal(stale.requests.length, 2, "fresh banner metadata can retry the same textual identity");
    stale.requests[1].resolve(response);
    await wait();
    assert.equal(remounted.children[0]?.tagName, "video", "fresh banner metadata recovers normally");
    disposeForgeBannerAnimation(stale.host);

    const retrying = client(),
      setupFailure = { ok: false, error: "animation-failed", reason: "seedance-reference-setup", retry: true };
    wireForgeBannerAnimation(retrying.host);
    retrying.requests[0].resolve({ ...setupFailure, detail: "SECRET_PROVIDER_DETAIL" });
    await wait();
    assert.ok(
      retrying.chips.children.some(
        (node) => node.textContent === `${forgeAnimationEnglish.seedanceSetup} ${forgeAnimationEnglish.retryCost}`,
      ),
    );
    const retryButton = retrying.chips.querySelector("[data-animation-retry]");
    retryButton.onclick();
    assert.equal(retrying.requests.length, 2);
    assert.equal(retrying.requests[1].body.retry, true);
    assert.equal(retryButton.disabled, true);
    assert.equal(retryButton.attributes["aria-busy"], "true");
    assert.equal(retryButton.textContent, forgeAnimationEnglish.retrying);
    assert.ok(retrying.chips.children.some((node) => node.textContent === forgeAnimationEnglish.generating));
    retryButton.onclick();
    retrying.host._forgeBannerAnimation.onVisibility();
    assert.equal(retrying.requests.length, 2, "pending retries cannot submit or purchase duplicate attempts");
    retrying.requests[1].resolve(setupFailure);
    await wait();
    assert.equal(retryButton.disabled, false);
    assert.equal(retryButton.textContent, forgeAnimationEnglish.retry);
    assert.ok(
      retrying.chips.children.some(
        (node) => node.textContent === `${forgeAnimationEnglish.seedanceSetup} ${forgeAnimationEnglish.retryCost}`,
      ),
    );
    assert.equal(retrying.requests.length, 2, "a setup failure waits for another explicit retry");
    retryButton.onclick();
    retrying.requests[2].resolve(response);
    await wait();
    retrying.target.children[0].events.playing();
    assert.equal(retrying.chips.querySelector("[data-animation-retry]"), undefined);
    assert.equal(
      retrying.chips.children.some((node) => /SECRET_PROVIDER_DETAIL/u.test(node.textContent || "")),
      false,
    );
    disposeForgeBannerAnimation(retrying.host);

    for (const interruption of ["hidden", "offscreen", "manual"]) {
      let intersect;
      globalThis.IntersectionObserver =
        interruption === "offscreen"
          ? class {
              constructor(callback) {
                intersect = (isIntersecting) => callback([{ isIntersecting }]);
              }
              observe() {
                intersect(true);
              }
              disconnect() {}
            }
          : undefined;
      const interrupted = client(),
        pendingPlay = deferred();
      wireForgeBannerAnimation(interrupted.host);
      Element.pendingNextPlay = pendingPlay;
      interrupted.requests[0].resolve(response);
      await wait();
      const clip = interrupted.target.children[0];
      if (interruption === "hidden") {
        document.visibilityState = "hidden";
        interrupted.host._forgeBannerAnimation.onVisibility();
      } else if (interruption === "offscreen") intersect(false);
      else interrupted.chips.querySelector("pause").onclick();
      assert.equal(clip.paused, true, `${interruption}: the controller interrupts its pending play request`);
      const paused = interrupted.host._forgeBannerAnimation.paused,
        opacity = clip.style.opacity,
        notices = interrupted.chips.children.map((node) => node.textContent);
      pendingPlay.reject(new DOMException("The play request was interrupted by pause().", "AbortError"));
      await wait();
      assert.equal(
        interrupted.host._forgeBannerAnimation.paused,
        paused,
        `${interruption}: expected play interruption must not latch a manual pause`,
      );
      assert.equal(clip.style.opacity, opacity, `${interruption}: expected interruption preserves opacity`);
      assert.deepEqual(
        interrupted.chips.children.map((node) => node.textContent),
        notices,
        `${interruption}: expected interruption does not report a playback failure`,
      );
      if (interruption === "hidden") {
        document.visibilityState = "visible";
        interrupted.host._forgeBannerAnimation.onVisibility();
      } else if (interruption === "offscreen") intersect(true);
      else interrupted.chips.querySelector("pause").onclick();
      await wait();
      clip.events.playing();
      assert.equal(clip.paused, false, `${interruption}: returning to an active banner resumes playback`);
      assert.notEqual(interrupted.host._forgeBannerAnimation.paused, true);
      assert.equal(clip.style.opacity, "1");
      assert.equal(interrupted.requests.length, 1, `${interruption}: resuming never regenerates the clip`);
      disposeForgeBannerAnimation(interrupted.host);
    }
    globalThis.IntersectionObserver = undefined;
    const denied = client(),
      deniedPlay = deferred();
    wireForgeBannerAnimation(denied.host);
    Element.pendingNextPlay = deniedPlay;
    denied.requests[0].resolve(response);
    await wait();
    deniedPlay.reject(new DOMException("A user gesture is required.", "NotAllowedError"));
    await wait();
    assert.equal(denied.host._forgeBannerAnimation.paused, true, "genuine autoplay denial still offers Play");
    assert.equal(denied.chips.querySelector("pause").textContent, forgeAnimationEnglish.play);
    denied.chips.querySelector("pause").onclick();
    assert.equal(denied.requests.length, 1, "a user gesture after denial reuses the same generated clip");
    disposeForgeBannerAnimation(denied.host);
  } finally {
    for (const [key, value] of Object.entries(originals))
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
  }
  console.info(
    "Banner animation regression passed: shipped banner/source routes, cached/pending/retry costs, Range media, directory containment, deletion and stale client guards.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
