import assert from "node:assert/strict";
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
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
  const racingFirst = racing.generate(racingBody);
  await racingReady.promise;
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
    const racingSecond = racing.generate(racingBody);
    await missCaptured.promise;
    racingProvider.resolve(video);
    await racingFirst;
    resumeMiss.resolve();
    assert.equal((await racingSecond).cached, true);
    assert.equal(racingCalls, 1, "a stale outer cache miss cannot repurchase a clip after the previous job settles");
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
  assert.equal((await route("/run/sources", { runId: "shipped", sources: { animationConnectionId: "" } })).ok, true);
  assert.equal(
    (await route("/banner-animation", { runId: "shipped", banner: "char-standard" })).error,
    "animations-off",
  );
  assert.equal(forgeAnimationFields()[0].settings, "sources");
  cleanup();

  // A minimal DOM tests async identity and pause/navigation without imitating a video decoder.
  const originals = Object.fromEntries(
    ["document", "matchMedia", "IntersectionObserver", "forgeAnimationEnglish"].map((key) => [key, globalThis[key]]),
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
      if (Element.rejectNextPlay) {
        Element.rejectNextPlay = false;
        return Promise.reject(new Error("NotAllowedError"));
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
    const chips = new Element("chips"),
      target = new Element("art");
    target.parentElement = { querySelector: () => chips };
    const requests = [],
      host = {
        _run: { runId: "ui-world", animationConnectionId: "video" },
        _hudView: "summon",
        _summonPhase: "banner",
        _summonBannerState: "ready",
        _summonBanner: { banner: { id: "char-featured", art: "same-art", music: { cue: "banner-char-featured-f1" } } },
        _root: { querySelector: () => target },
        _postJson: () => {
          const request = deferred();
          requests.push(request);
          return request.promise;
        },
      };
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
