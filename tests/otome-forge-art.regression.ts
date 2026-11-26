// Otome Forge M2b: painted places and story CGs (S/art/{places,cg}.ts, S/routes/art.ts). Paints run against a fake
// image client that counts paid calls; the CG's loopback request is checked against the real client.
import assert from "node:assert/strict";
import { FACES } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/faces.ts";
import test from "node:test";
import { queueScenePaints } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cg.ts";
import { createCutoutClient } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import { createOtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import {
  NOVELAI_NEGATIVE,
  NOVELAI_QUALITY,
  createImageClient,
  paintsWithNovelAi,
  worldStyle,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import {
  cgPrompt,
  placePrompt,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  paintSettled,
  paintSlot,
  startPaint,
  withDeadline,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { placeKey } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/places.ts";
import {
  beatId,
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerArtRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/art.ts";
import { registerSetupRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/setup.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeBeat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  KEY,
  PNG,
  artWorld,
  beat,
  readStoredBeat,
  routesOf,
  saveBeat,
  seedChapter,
  setImages,
  until,
  type PaidCall,
} from "./fixtures/otome-forge-art.ts";
import { normalizeBeatBody } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import { KAI, MIR, SOL, beatReply, bible, json, storyRoutes } from "./fixtures/otome-forge-story.ts";

const CG = { at: 1, brief: "Rain on the lamp room glass; she catches his sleeve.", cast: ["Kai", "Ines"] };

async function sceneWorld(runKey: string, options: Parameters<typeof artWorld>[0] = { runKey }) {
  const t = await artWorld({ ...options, runKey });
  await seedChapter(t.store, t.runId);
  const call = routesOf(registerArtRoutes, t.deps, runKey);
  const world = async () => (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  const state = async () => (await t.store.readDoc(stateId(t.runId), normalizeState))!;
  /** Writes beat `i` and queues its scene paints, as the beat writer does; resolves when they have ended. */
  const write = async (i: number, changes: Parameters<typeof beat>[1] = {}, review = false) => {
    const written = await saveBeat(t.store, t.runId, beat(i, changes));
    await queueScenePaints(t.deps, t.runId, written, { debugMode: true, review });
    return written;
  };
  return { ...t, call, world, state, write };
}

test("a place is painted once, from its English tags with no people, and a known place costs nothing", async () => {
  const t = await sceneWorld("r-m2bart01-aaaaaa");
  await t.write(0);
  const place = (await t.world()).places[placeKey("The Lamp Room")]!;
  assert.equal(place.art?.state, "ready");
  assert.equal(place.art?.ref, "global-gallery:img1");
  assert.equal(t.paid.length, 1);
  const [{ request }] = t.paid;
  assert.equal(request.connectionId, "conn-image");
  assert.deepEqual([request.width, request.height], [768, 1344]);
  assert.match(request.prompt, /lighthouse interior, great lens, no humans/);
  assert.match(request.prompt, /scenery/);
  assert.match(request.prompt, /safe for work/);
  assert.match(request.negativePrompt, /people, person, humans/);
  assert.match(request.negativePrompt, /child, childlike/);
  assert.equal(request.referenceImages, undefined, "a place has no references");
  assert.equal(request.debugMode, true);

  // The same place in the next beat, under another spelling of the same name: nothing more is paid.
  await t.write(1, { places: [{ name: "the lamp  room", tags: "lighthouse" }], cg: undefined });
  assert.equal(t.paid.length, 1);
  assert.equal(Object.keys((await t.world()).places).length, 1);
  // A place name in another script keeps its own key.
  assert.equal(placeKey("灯台の部屋"), "灯台の部屋");
  assert.notEqual(placeKey("灯台の部屋"), placeKey("港の灯"));
});

test(
  "a fresh beat waits for background registration, not its paid image, before answering",
  { timeout: 5000 },
  async (context) => {
    let allowRegistration = () => {};
    const registration = new Promise<void>((resolve) => (allowRegistration = resolve));
    let allowImage = () => {};
    const image = new Promise<void>((resolve) => (allowImage = resolve));
    const t = await artWorld({
      runKey: "r-bgregister-aaaaaa",
      replies: [json(beatReply())],
      images: { expressions: false },
      before: async (call) => {
        if (call.method === "generateImage") await image;
      },
    });
    await seedChapter(t.store, t.runId, 1);
    let registering = false;
    const store = {
      ...t.store,
      async updateDoc(...args: Parameters<typeof t.store.updateDoc>) {
        if (args[0].id === worldId(t.runId) && !registering) {
          registering = true;
          await registration;
        }
        return t.store.updateDoc(...args);
      },
    } as typeof t.store;
    const deps = { ...t.deps, store, art: createOtomeArt({ ...t.deps, store }) };
    let answered = false;
    const serving = storyRoutes(deps, "r-bgregister-aaaaaa")(
      "POST",
      "/runs/:run/chapters/:key/beats/:i",
      {},
      { key: KEY, i: "0" },
    ).then((result) => {
      answered = true;
      return result;
    });
    context.after(async () => {
      allowRegistration();
      allowImage();
      deps.art.dispose();
      await serving;
    });
    await until(() => registering, "background registration started");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(answered, false, "the beat cannot answer before its background record exists");
    allowRegistration();
    assert.equal((await serving).status, 200);
    const scene = await routesOf(registerArtRoutes, deps, "r-bgregister-aaaaaa")("GET", "/runs/:run/art/scene", {
      key: KEY,
      i: "0",
    });
    assert.equal(scene.body.places[0].art.state, "pending", "the first art response has settled registration");
    assert.equal(t.uploads.length, 0, "answering never waits for the paid image");
    allowImage();
    await until(
      async () =>
        (await t.store.readDoc(worldId(t.runId), normalizeWorld))!.places[placeKey("The Lamp Room")]?.art?.state ===
        "ready",
      "background ready",
    );
    assert.equal(t.paid.length, 1);
  },
);

test(
  "stored registered places bypass a held foreground task, while missing, consent and retag writes still wait",
  { timeout: 10000 },
  async (context) => {
    for (const mode of ["ready", "pending", "missing", "consent", "retag"] as const) {
      const t = await artWorld({ runKey: `r-bgf${mode}-aaaaaa`, images: { expressions: false } });
      await seedChapter(t.store, t.runId, 1);
      await saveBeat(t.store, t.runId, beat(0));
      const key = placeKey("The Lamp Room");
      if (mode !== "missing")
        await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
          ...world,
          places: {
            [key]: {
              ...beat(0).places[0]!,
              ...(mode === "retag" ? { tags: "" } : {}),
              ...(mode === "ready"
                ? { art: { state: "ready" as const, at: "old", url: "/saved-background.png" } }
                : {}),
              ...(mode === "pending" ? { art: { state: "pending" as const, at: "old" } } : {}),
              ...(mode === "consent" ? { art: { state: "waiting-consent" as const, at: "old" } } : {}),
            },
          },
        }));
      const releasePending = mode === "pending" ? startPaint(t.runId, `place:${key}`) : null;
      let free = () => {};
      const held = new Promise<void>((resolve) => (free = resolve));
      let entered = false;
      let ended = false;
      const foreground = runForeground(t.runId, async () => {
        entered = true;
        await held;
        ended = true;
      });
      await until(() => entered, "foreground task held");
      const art = createOtomeArt(t.deps);
      let answered = false;
      const serving = storyRoutes({ ...t.deps, art }, `r-bgf${mode}-aaaaaa`)(
        "POST",
        "/runs/:run/chapters/:key/beats/:i",
        {},
        { key: KEY, i: "0" },
      ).then((response) => {
        answered = true;
        return response;
      });
      context.after(async () => {
        free();
        releasePending?.();
        art.dispose();
        await foreground;
        await serving;
      });
      if (mode === "ready" || mode === "pending") {
        await until(() => answered, `registered ${mode} scene answers before foreground finishes`, 1000);
        assert.equal(ended, false);
        assert.equal(t.paid.length, 0);
      } else {
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(answered, false, `${mode} still needs queued registration`);
      }
      free();
      assert.equal((await serving).status, 200);
      const place = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!.places[key]!;
      assert.ok(place, "even a stored beat acknowledges its missing place before responding");
      assert.ok(place.tags.trim(), "the first description is saved before responding");
      if (mode !== "ready" && mode !== "pending") {
        await until(
          async () => (await t.store.readDoc(worldId(t.runId), normalizeWorld))!.places[key]?.art?.state === "ready",
          "new background ready",
        );
        assert.equal(t.paid.length, 1);
      }
      assert.equal(t.calls.length, 0, "a stored scene never rewrites its text");
      releasePending?.();
      art.dispose();
      await foreground;
    }
  },
);

test("the writer reuses an explicitly selected saved background without another model lookup or paid image", async (context) => {
  const canonical = "Dottore’s wing4";
  const key = placeKey(canonical);
  const t = await artWorld({
    runKey: "r-bgreuse-aaaaaa",
    images: { expressions: false },
    replies: [
      json(
        beatReply({
          places: [{ name: "dottore’s wing5", tags: "unused replacement tags", reuse: `  ${key}\t ` }],
          segments: [{ speaker: "", text: "The same lab.", place: "dottore’s wing5" }],
        }),
      ),
    ],
  });
  await seedChapter(t.store, t.runId, 1);
  const original = {
    name: canonical,
    tags: "laboratory, green glass, no humans",
    art: { state: "ready" as const, at: "old", url: "/api/global-gallery/file/lab.png", ref: "global-gallery:lab" },
  };
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    places: { [key]: original },
  }));
  const before = await t.state();
  const art = createOtomeArt(t.deps);
  context.after(() => art.dispose());
  const served = await storyRoutes({ ...t.deps, art }, "r-bgreuse-aaaaaa")(
    "POST",
    "/runs/:run/chapters/:key/beats/:i",
    {},
    { key: KEY, i: "0" },
  );
  assert.equal(served.status, 200, JSON.stringify(served.body));
  assert.equal(served.body.beat.segments[0].place, canonical);
  assert.deepEqual((await readStoredBeat(t.store, t.runId, 0))!.places, [{ name: canonical, tags: original.tags }]);
  assert.deepEqual((await t.store.readDoc(worldId(t.runId), normalizeWorld))!.places, { [key]: original });
  assert.deepEqual(await t.state(), before, "art lookup never progresses the story");
  assert.equal(t.calls.length, 1, "only the already-required writer call");
  const prompt = t.calls[0]!.messages.map((message) => message.content).join("\n");
  assert.match(prompt, /SAVED BACKGROUNDS/);
  assert.ok(prompt.includes(JSON.stringify({ key, name: canonical, tags: original.tags })));
  assert.match(prompt, /numbered rooms, wings and floors are distinct/);
  assert.equal(t.paid.length, 0);
  assert.deepEqual(t.deleted, []);
});

test("unknown background references use only the existing content repair and save or paint nothing", async (context) => {
  const invalid = json(beatReply({ places: [{ name: "Lab", tags: "laboratory", reuse: "missing-place" }] }));
  const t = await artWorld({
    runKey: "r-bgbadref-aaaaaa",
    images: { expressions: false },
    replies: [invalid, invalid],
  });
  await seedChapter(t.store, t.runId, 1);
  const art = createOtomeArt(t.deps);
  context.after(() => art.dispose());
  const before = await t.state();
  const response = await storyRoutes({ ...t.deps, art }, "r-bgbadref-aaaaaa")(
    "POST",
    "/runs/:run/chapters/:key/beats/:i",
    {},
    { key: KEY, i: "0" },
  );
  assert.deepEqual([response.status, response.body.code], [502, "bad-format"]);
  assert.equal(t.calls.length, 2);
  assert.match(t.calls[1]!.messages.at(-1)!.content, /reuse.*existing saved place key/);
  assert.equal(await readStoredBeat(t.store, t.runId, 0), null);
  assert.deepEqual(await t.state(), before);
  assert.deepEqual((await t.store.readDoc(worldId(t.runId), normalizeWorld))!.places, {});
  assert.equal(t.paid.length, 0);
});

test("a scene written ahead paints its CG as soon as it is written, so it is ready when the reader gets there", async (context) => {
  // The maintainer's, 2026-11-03: the key image should be waiting when its moment comes, as before 0.6.27. An Ease off
  // that drops the scene written ahead lets its CG go, and the scene written again paints its own.
  for (const easeOff of [false, true]) {
    const runKey = easeOff ? "r-cgahead-bbbbbb" : "r-cgahead-aaaaaa";
    const t = await artWorld({
      runKey,
      images: { expressions: false },
      // Its CG opens on the first segment, so a readThrough of 0 alone would count as shown.
      replies: Array.from({ length: 4 }, () => json(beatReply({ cg: { ...CG, at: 0 } }))),
    });
    await seedChapter(t.store, t.runId);
    const art = createOtomeArt(t.deps);
    context.after(() => art.dispose());
    const call = storyRoutes({ ...t.deps, art }, runKey);
    const beatPath = "/runs/:run/chapters/:key/beats/:i";
    const cgs = () => t.paid.filter((paid) => paid.method === "generateBannerArt").length;
    assert.equal((await call("POST", beatPath, {}, { key: KEY, i: "0" })).status, 200);
    await t.settle();
    assert.ok(await readStoredBeat(t.store, t.runId, 1), "the lookahead wrote the scene with the CG");
    await until(
      async () => (await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state === "ready",
      "the CG painted as its scene was written, before it is served",
    );
    assert.equal(cgs(), 1);
    // Ready on its first segment, it is still not the scene being read: it cannot reach the album yet.
    const early = await routesOf(registerArtRoutes, t.deps, runKey)("POST", "/runs/:run/art/cg/seen", {
      key: KEY,
      i: 1,
    });
    assert.equal(early.status, 409, "a CG written ahead is not seen before its scene is read");
    if (easeOff) {
      const eased = await call("POST", `${beatPath}/ease-off`, { segment: 1 }, { key: KEY, i: "0" });
      assert.equal(eased.status, 200, JSON.stringify(eased.body));
      await until(() => t.deleted.length === 1, "the dropped scene's CG let go");
    }
    const served = await call("POST", beatPath, {}, { key: KEY, i: "1" });
    assert.equal(served.status, 200);
    // The reader reads the scene's art once as it opens and polls again only while something is pending, so the CG's
    // record is there before the scene answers: without it the reader offers Paint while the paint runs unseen.
    const scene = await routesOf(registerArtRoutes, t.deps, runKey)("GET", "/runs/:run/art/scene", {
      key: KEY,
      i: "1",
    });
    assert.ok(scene.body.cg?.art, "the reader's first art read already finds the CG's record");
    assert.ok(served.body.beat.cg?.art, "and so does the scene served");
    if (!easeOff) assert.equal(served.body.beat.cg.art.state, "ready", "ready when the reader gets there");
    await until(
      async () => (await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state === "ready",
      "the scene's CG painted",
    );
    // Served, it is not painted again; the scene an Ease off wrote again paints its own, once.
    assert.equal(cgs(), easeOff ? 2 : 1);
    assert.equal(t.deleted.length, easeOff ? 1 : 0);
  }
});

test("genuinely different numbered rooms keep separate backgrounds even with identical tags", async () => {
  const t = await sceneWorld("r-bgrooms-aaaaaa");
  for (const [i, name] of ["Room 4", "Room 5"].entries()) {
    await t.write(i, { places: [{ name, tags: "laboratory, green glass, no humans" }], cg: undefined });
  }
  assert.equal(t.paid.length, 2);
  assert.deepEqual(Object.keys((await t.world()).places), ["room-4", "room-5"]);
});

test("registration-only preparation preserves consent and failed records; disposal stops queued payment", async () => {
  for (const mode of ["ask", "review", "failed"] as const) {
    const t = await artWorld({ runKey: `r-bg${mode}-aaaaaa`, images: { ask: mode === "ask", expressions: false } });
    const failed = { state: "failed" as const, at: "old", error: "provider declined" };
    if (mode === "failed")
      await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
        ...world,
        places: { [placeKey("The Lamp Room")]: { ...beat(0).places[0]!, art: failed } },
      }));
    const art = createOtomeArt(t.deps);
    try {
      await art.prepareScenePlaces!(t.runId, beat(0), { debugMode: false, review: mode === "review" });
      const place = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!.places[placeKey("The Lamp Room")]!;
      assert.equal(place.art?.state, mode === "failed" ? "failed" : "waiting-consent");
      if (mode === "failed") assert.deepEqual(place.art, failed);
      assert.equal(t.paid.length, 0);
    } finally {
      art.dispose();
    }
  }
  const t = await artWorld({ runKey: "r-bgdispose-aaaaaa" });
  let free = () => {};
  const lane = paintSlot("conn-image", () => new Promise<void>((resolve) => (free = resolve)));
  const art = createOtomeArt(t.deps);
  try {
    await art.prepareScenePlaces!(t.runId, beat(0), { debugMode: false });
    art.dispose();
  } finally {
    free();
  }
  await lane;
  await until(
    async () =>
      (await t.store.readDoc(worldId(t.runId), normalizeWorld))!.places[placeKey("The Lamp Room")]?.art?.state ===
      "stopped",
    "queued paint stops on teardown",
  );
  assert.equal(t.paid.length, 0);
});

test("Ask before painting holds every scene paint until its tap, and a tap never pays twice", async () => {
  const t = await sceneWorld("r-m2bart02-bbbbbb");
  await setImages(t.store, t.runId, { ask: true });
  await t.write(1, { cg: CG });
  assert.equal(t.paid.length, 0, "nothing is painted by itself");
  assert.equal((await t.world()).places[placeKey("The Lamp Room")]?.art?.state, "waiting-consent");
  assert.equal((await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state, "waiting-consent");

  const scene = await t.call("GET", "/runs/:run/art/scene", { key: KEY, i: "1" });
  assert.equal(scene.status, 200);
  assert.equal(scene.body.places[0].art.state, "waiting-consent");
  assert.equal(scene.body.cg.art.state, "waiting-consent");

  // Two taps at once: one paid image, and both answer with it.
  const [first, second] = await Promise.all([
    t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 }),
    t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 }),
  ]);
  assert.equal(first.body.art.state, "ready");
  assert.deepEqual(second.body.art, first.body.art);
  assert.equal(t.paid.length, 1);
  assert.equal(t.paid[0]!.method, "generateBannerArt");
  // 0.24.0: tapping a ready CG again repaints it (one more image), and the picture it painted over is deleted.
  const repainted = await t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  assert.equal(repainted.body.art.state, "ready");
  assert.notEqual(repainted.body.art.ref, first.body.art.ref);
  assert.equal(t.paid.length, 2);
  assert.deepEqual(t.deleted, ["img1"]);

  const placed = await t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  assert.equal(placed.body.place.art.state, "ready");
  assert.equal(placed.body.world.places[placeKey("The Lamp Room")].art.state, "ready");
  assert.equal(t.paid.length, 3);

  // A painted place is repainted by its tap too; the picture it painted over leaves the gallery.
  const placeAgain = await t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  assert.notEqual(placeAgain.body.place.art.ref, placed.body.place.art.ref);
  assert.equal(t.paid.length, 4);
  assert.deepEqual(t.deleted, ["img1", "img3"]);

  // The review dialog gets the prompt; an edited one keeps its rating and adult tags.
  const prompt = await t.call("POST", "/runs/:run/art/cg/prompt", { key: KEY, i: 1 });
  assert.match(prompt.body.prompt, /Rain on the lamp room glass/);
  await t
    .call("POST", "/runs/:run/art/place", { place: "Unknown Pier" })
    .then(({ status }) => assert.equal(status, 404));
});

test("reviewing image prompts holds automatic paints too; without an image connection nothing is painted", async () => {
  const t = await sceneWorld("r-m2bart03-cccccc");
  await t.write(1, { cg: CG }, true);
  assert.equal(t.paid.length, 0);
  assert.equal((await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state, "waiting-consent");

  const u = await sceneWorld("r-m2bart04-dddddd", { runKey: "r-m2bart04-dddddd", images: { connectionId: null } });
  await u.write(1, { cg: CG });
  assert.equal(u.paid.length, 0);
  const place = (await u.world()).places[placeKey("The Lamp Room")];
  assert.deepEqual(place, { name: "The Lamp Room", tags: "lighthouse interior, great lens, no humans" });
  assert.equal((await readStoredBeat(u.store, u.runId, 1))?.cg?.art, undefined, "the reader shows its quiet card");
  const tap = await u.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  assert.deepEqual([tap.status, tap.body.code], [503, "no-connection"]);
});

test("a CG unlocks only once it is ready and shown, exactly once", async () => {
  const t = await sceneWorld("r-m2bart05-eeeeee");
  await t.write(1, { cg: CG });
  assert.equal((await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state, "ready");
  const notShown = await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 });
  assert.deepEqual([notShown.status, notShown.body.code], [409, "conflict"], "read through its segment first");
  assert.equal((await t.state()).album.cgs.length, 0);

  const stored = (await readStoredBeat(t.store, t.runId, 1))!;
  await saveBeat(t.store, t.runId, { ...stored, readThrough: CG.at });
  // Read through its segment, but not the scene being read yet (written ahead, #2095): still not seen.
  assert.equal((await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 })).status, 409);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    chapters: { ...current.chapters, [KEY]: { ...current.chapters[KEY], beatsRead: 1 } },
  }));
  const seen = await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 });
  assert.equal(seen.status, 200);
  assert.equal(seen.body.unlocked, true);
  assert.deepEqual(
    seen.body.album.map(({ key, li, ref }: { key: string; li: string; ref: string }) => ({ key, li, ref })),
    [{ key: `${KEY}/1`, li: KAI, ref: stored.cg!.art!.ref }],
  );
  const again = await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 });
  assert.equal(again.body.unlocked, false);
  assert.equal((await t.state()).album.cgs.length, 1);

  // A CG that is not painted yet never unlocks.
  const u = await sceneWorld("r-m2bart06-ffffff");
  await setImages(u.store, u.runId, { ask: true });
  const waiting = await u.write(1, { cg: CG });
  await saveBeat(u.store, u.runId, { ...(await readStoredBeat(u.store, u.runId, 1))!, readThrough: 2 });
  assert.equal((await u.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 })).status, 409);
  assert.equal(waiting.cg?.art, undefined);
  assert.equal((await u.state()).album.cgs.length, 0);
});

test("a picture kept through a failed repaint is the one unlocked: the Album takes what was on screen", async () => {
  // 0.24.0 (Dottore, #2255): a repaint keeps the old picture on screen while it paints, and keeps it if it fails, so the
  // picture the reader saw is the one that enters the Album — not a 409 because the record's state moved on.
  const t = await sceneWorld("r-m2bart09-iiiiii");
  await t.write(1, { cg: CG });
  const stored = (await readStoredBeat(t.store, t.runId, 1))!;
  const kept = stored.cg!.art!;
  await saveBeat(t.store, t.runId, {
    ...stored,
    readThrough: CG.at,
    cg: { ...stored.cg!, art: { ...kept, state: "failed", error: "provider down" } },
  });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    chapters: { ...current.chapters, [KEY]: { ...current.chapters[KEY], beatsRead: 1 } },
  }));
  const seen = await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 });
  assert.equal(seen.status, 200, "the picture was seen, whatever its repaint did");
  assert.equal(seen.body.unlocked, true);
  assert.equal(seen.body.album[0].ref, kept.ref, "the Album takes the picture that stayed on screen");

  // A record with no picture at all still refuses: nothing was shown, so nothing is unlocked.
  const bare = await sceneWorld("r-m2bart10-jjjjjj");
  await setImages(bare.store, bare.runId, { ask: true });
  await bare.write(1, { cg: CG });
  await saveBeat(bare.store, bare.runId, { ...(await readStoredBeat(bare.store, bare.runId, 1))!, readThrough: 2 });
  await bare.store.updateDoc(runDocTarget("state", stateId(bare.runId)), normalizeState, (current) => ({
    ...current,
    chapters: { ...current.chapters, [KEY]: { ...current.chapters[KEY], beatsRead: 1 } },
  }));
  assert.equal((await bare.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 })).status, 409);
});

test("a repaint that saves while its key image unlocks leaves the Album on the picture the record shows", async () => {
  // 0.24.0 (Dottore, #2255): the unlock reads the beat, then writes the Album some awaits later. A repaint saving in
  // that gap moves an entry that does not exist yet and releases the picture the unlock is about to file, so the entry
  // is read back and followed to the record's picture.
  const t = await sceneWorld("r-m2bart11-kkkkkk");
  await t.write(1, { cg: CG });
  const stored = (await readStoredBeat(t.store, t.runId, 1))!;
  const kept = stored.cg!.art!;
  await saveBeat(t.store, t.runId, { ...stored, readThrough: CG.at });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    chapters: { ...current.chapters, [KEY]: { ...current.chapters[KEY], beatsRead: 1 } },
  }));
  const repainted = {
    state: "ready" as const,
    at: "2026-10-28T12:00:00.000Z",
    url: "/api/global-gallery/file/img9.png",
    ref: "global-gallery:img9",
  };
  let saved = false;
  const store = {
    ...t.store,
    async updateDoc(...args: Parameters<typeof t.store.updateDoc>) {
      // The repaint's save lands just before the unlock's own Album write.
      if (!saved && args[0].id === stateId(t.runId)) {
        saved = true;
        await saveBeat(t.store, t.runId, {
          ...(await readStoredBeat(t.store, t.runId, 1))!,
          cg: { ...stored.cg!, art: repainted },
        });
      }
      return t.store.updateDoc(...args);
    },
  } as typeof t.store;
  const call = routesOf(
    registerArtRoutes,
    { ...t.deps, store, art: createOtomeArt({ ...t.deps, store }) },
    "r-m2bart11-kkkkkk",
  );
  const seen = await call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 });
  assert.equal(seen.status, 200);
  assert.equal(seen.body.unlocked, true);
  assert.equal(saved, true, "the repaint saved in the gap");
  const entry = (await t.state()).album.cgs.find((cg) => cg.key === `${KEY}/1`)!;
  assert.equal(entry.ref, repainted.ref, "the Album ends on the picture the record shows");
  assert.equal(entry.url, repainted.url);
  assert.equal(seen.body.album.find((cg: { key: string }) => cg.key === `${KEY}/1`).ref, repainted.ref);
  assert.notEqual(entry.ref, kept.ref, "never the picture the repaint replaced");
});

test("a failed paint waits for a tap; a rewrite while a CG paints gets nothing, and its image is deleted", async () => {
  const t = await sceneWorld("r-m2bart07-gggggg", {
    runKey: "r-m2bart07-gggggg",
    before: (call) => {
      if (call.method === "generateImage") throw new Error("provider down");
    },
  });
  await t.write(0);
  const failed = (await t.world()).places[placeKey("The Lamp Room")]!.art!;
  assert.equal(failed.state, "failed");
  assert.match(failed.error ?? "", /provider down/);
  await t.write(1, { cg: undefined });
  assert.equal(t.paid.length, 1, "never retried by itself");

  let rewrite: Promise<unknown> | null = null;
  const u = await sceneWorld("r-m2bart08-hhhhhh", {
    runKey: "r-m2bart08-hhhhhh",
    before: (call: PaidCall) => {
      // The beat is rewritten while its CG is painted.
      if (call.method === "generateBannerArt") {
        rewrite = saveBeat(
          u.store,
          u.runId,
          beat(1, { cg: CG, written: { at: "2026-10-28T11:00:00.000Z", connectionId: "c", model: "m" }, rewrites: 1 }),
        );
        return rewrite.then(() => undefined);
      }
    },
  });
  await u.write(1, { cg: CG, places: [] });
  assert.equal(u.paid.length, 1);
  const current = (await readStoredBeat(u.store, u.runId, 1))!;
  assert.equal(current.rewrites, 1);
  assert.equal(current.cg?.art, undefined, "the rewritten beat never receives the old beat's image");
  assert.deepEqual(u.deleted, ["img1"]);
});

test("a run deleted while a place paints keeps nothing: the image leaves the gallery", async () => {
  const t = await sceneWorld("r-m2bart09-iiiiii", {
    runKey: "r-m2bart09-iiiiii",
    before: async () => {
      await t.store.removeDoc(worldId(t.runId));
    },
  });
  await t.write(0, { cg: undefined });
  assert.equal(t.paid.length, 1);
  assert.deepEqual(t.deleted, ["img1"]);
  assert.equal(await t.store.readDoc(worldId(t.runId), normalizeWorld), null, "the world is not brought back");
});

test("a paint a restart left pending reads as stopped and waits for a tap", async () => {
  const t = await sceneWorld("r-m2bart10-jjjjjj");
  await saveBeat(
    t.store,
    t.runId,
    beat(1, { cg: { ...CG, art: { state: "pending", at: "2026-10-28T09:00:00.000Z" } } }),
  );
  const scene = await t.call("GET", "/runs/:run/art/scene", { key: KEY, i: "1" });
  assert.equal(scene.body.cg.art.state, "stopped");
  await queueScenePaints(t.deps, t.runId, (await readStoredBeat(t.store, t.runId, 1))!, { debugMode: false });
  assert.equal(t.paid.filter((call) => call.method === "generateBannerArt").length, 0);
  const tap = await t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  assert.equal(tap.body.art.state, "ready");
});

test("a CG's loopback request carries the override and at most four references, without the Engine's extra-people ban", async () => {
  const t = await sceneWorld("r-m2bart11-kkkkkk");
  // Kai and Mireille have cards with avatars, Sol a painted look, and the protagonist her persona's avatar.
  for (const [li, changes] of [
    [KAI, { cardId: "card-kai", identityLine: "tall man, grey eyes", outfitLine: "keeper's coat" }],
    [MIR, { cardId: "card-mireille" }],
    [SOL, { portrait: "/api/global-gallery/file/sol.png" }],
  ] as const) {
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({
      ...unit,
      ...changes,
      bible: bible({ look: { identityLine: "", outfitLine: "", presentation: li === MIR ? "woman" : "man" } }),
    }));
  }
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    look: { identityLine: "short dark hair", outfitLine: "oilskin" },
  }));
  const requests: Array<{ path: string; body: unknown }> = [];
  const json = (value: unknown) =>
    new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  const png = (name: string) => new Response(Buffer.from(name), { headers: { "content-type": "image/png" } });
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("http://127.0.0.1:7860", "");
    requests.push({ path, body: init?.body });
    if (path === "/api/characters/card-kai") return json({ avatarPath: "/api/avatars/file/kai.png" });
    if (path === "/api/characters/card-mireille") return json({ avatarPath: "/api/avatars/file/mireille.png" });
    if (path === "/api/characters/personas/persona-ines") return json({ avatarPath: "/api/avatars/file/ines.png" });
    if (path.startsWith("/api/avatars/file/") || path.startsWith("/api/global-gallery/file/")) return png(path);
    if (path === "/api/app-settings/ui") return json({ value: {} });
    if (path === "/api/characters/avatar-generation") {
      return json({
        image: `data:image/png;base64,${PNG}`,
        prompt: JSON.parse(String(init?.body)).promptOverrides[0].prompt,
      });
    }
    if (path === "/api/global-gallery/upload") return json({ id: "cg1", url: "/api/global-gallery/file/cg1.png" });
    return new Response(JSON.stringify({ error: "no" }), { status: 404 });
  }) as typeof globalThis.fetch;
  const deps = { ...t.deps, images: createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch }) };
  const crowd = {
    at: 0,
    brief: "All of them at the lamp.",
    cast: ["Kai", "Mireille", "Sol", "Ines", "The Harbour Master"],
  };
  const written = await saveBeat(t.store, t.runId, beat(1, { cg: crowd, places: [] }));
  await queueScenePaints(deps, t.runId, written, { debugMode: true });
  assert.equal((await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state, "ready");
  const generation = requests.find((request) => request.path === "/api/characters/avatar-generation");
  const body = JSON.parse(String(generation?.body));
  assert.equal(body.referenceImages.length, 3, "one reference per person, three people at most");
  assert.equal(body.promptOverrides.length, 1);
  assert.equal(body.promptOverrides[0].id, "avatar:kai", "the override is matched by the first person's first name");
  assert.equal(body.name, "Kai");
  assert.equal(body.debugMode, true);
  assert.deepEqual([body.width, body.height], [768, 1344]);
  const { prompt, negativePrompt } = body.promptOverrides[0];
  assert.match(prompt, /^All of them at the lamp\. Kai: tall man, grey eyes; keeper's coat\./);
  assert.doesNotMatch(prompt, /Ines|Harbour Master/, "three people at most");
  // Which picture is whose, and how many people to draw, so nobody is drawn twice or merged (2026-11-03). Kai and
  // Mireille have no outfit picture, so their card avatars give their faces; Sol's painted look dresses him (0.36.5).
  assert.match(
    prompt,
    /Reference images, in order: Kai; Mireille; Sol\. Use them only for each person's face, hair and build, and for the clothing of Sol, never for the pose, framing or background\./,
  );
  // 0.36.5: the count, with no limbs or fingers counted (they pulled legs into waist-up shots); the negative names them.
  assert.match(prompt, /Draw exactly three people, each appearing once\./);
  assert.doesNotMatch(prompt, /two arms|five fingers/);
  assert.match(negativePrompt, /bad anatomy, deformed body, merged bodies, fused limbs, extra limbs/);
  assert.doesNotMatch(negativePrompt, /extra people/);
  assert.match(negativePrompt, /child, childlike/);
});

test("a paint waiting in the lane is built when its turn comes: a rating changed meanwhile is the one it uses", async () => {
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => (open = resolve));
  const t = await sceneWorld("r-m2bart12-llllll", {
    runKey: "r-m2bart12-llllll",
    // The CG (asked for first) holds the connection's one paid slot until the gate opens.
    before: (call) => (call.method === "generateBannerArt" ? gate : undefined),
  });
  await setImages(t.store, t.runId, { ask: true });
  const written = await saveBeat(t.store, t.runId, beat(1, { cg: CG }));
  await queueScenePaints(t.deps, t.runId, written, { debugMode: false });
  const cgTap = t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const placeTap = t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(t.paid.length, 1, "the place waits for the CG's paid call");
  await setImages(t.store, t.runId, { rating: "suggestive" });
  open();
  await Promise.all([cgTap, placeTap]);
  const place = t.paid.find((call) => call.method === "generateImage")!;
  // The place was built at its turn, under Suggestive: above SFW a place is scenery only, with no rating or person
  // tags, and keeps the people, adult, nudity and explicit-act exclusions. (The CG was built at SFW, before the change.)
  assert.match(place.request.prompt, /no humans/);
  assert.doesNotMatch(place.request.prompt, /safe for work|suggestive|adults only/);
  assert.match(
    place.request.negativePrompt,
    /people, person, humans.*child, childlike.*nudity, explicit sexual activity/,
  );
});

test("a tap that lands while another pass holds the place but paints nothing still paints it, once", async () => {
  const t = await sceneWorld("r-m2bart13-mmmmmm");
  await setImages(t.store, t.runId, { ask: true });
  await t.write(0);
  // Another pass (the next beat's) is looking at the same place right now.
  const release = startPaint(t.runId, `place:${placeKey("The Lamp Room")}`)!;
  const tap = t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(t.paid.length, 0, "the tap waits for the claim");
  release();
  const { body } = await tap;
  assert.equal(body.place.art.state, "ready");
  assert.equal(t.paid.length, 1);
});

test("a place named with no description is never painted until a beat describes it; the planned place counts only once used", async () => {
  const t = await sceneWorld("r-m2bart14-nnnnnn");
  const key = placeKey("The Rooftop");
  await t.write(0, { places: [{ name: "The Rooftop", tags: "" }], cg: undefined });
  assert.equal(t.paid.length, 0, "nothing is paid for an image of nothing in particular");
  assert.equal((await t.world()).places[key]!.art, undefined);
  // Nor on a tap: the route holds to the same rule, and the place still takes a later beat's description.
  const tapped = await t.call("POST", "/runs/:run/art/place", { place: "The Rooftop" });
  assert.equal(tapped.status, 409, JSON.stringify(tapped.body));
  assert.equal(tapped.body.code, "conflict");
  assert.equal(t.paid.length, 0);
  assert.equal((await t.world()).places[key]!.art, undefined);
  await t.write(1, { places: [{ name: "The Rooftop", tags: "rooftop garden, lanterns, no humans" }], cg: undefined });
  const place = (await t.world()).places[key]!;
  assert.equal(place.tags, "rooftop garden, lanterns, no humans", "the first description is kept");
  assert.equal(place.art?.state, "ready");
  assert.equal(t.paid.length, 1);
  assert.match(t.paid[0]!.request.prompt, /rooftop garden, lanterns/);

  // The node opens "here", but the narrator names the place its own way: only the place the lines use is listed.
  const context = {
    node: { i: 0, kind: "beat", guide: "", cast: [], place: "The Rooftop Garden" },
    units: [],
    state: { lis: {} },
    last: false,
  } as never;
  const body = normalizeBeatBody(
    {
      places: [{ name: "Rooftop garden of the Academy", tags: "rooftop garden, night, no humans" }],
      segments: [
        { speaker: "", text: "Wind.", place: "Rooftop garden of the Academy" },
        { speaker: "", text: "Lanterns." },
      ],
    },
    { start: "The Rooftop Garden", context },
  )!;
  assert.deepEqual(body.places, [{ name: "Rooftop garden of the Academy", tags: "rooftop garden, night, no humans" }]);
  assert.deepEqual(
    body.segments.map((segment) => segment.place),
    ["Rooftop garden of the Academy", "Rooftop garden of the Academy"],
  );
});

test("a Retry on a failed place paints at once while a beat's automatic pass looks at that place", async () => {
  const t = await sceneWorld("r-m2bart15-oooooo", {
    runKey: "r-m2bart15-oooooo",
    before: (_call, n) => {
      if (n === 1) throw new Error("provider down");
    },
  });
  await t.write(0, { cg: undefined });
  assert.equal((await t.world()).places[placeKey("The Lamp Room")]!.art?.state, "failed");
  // The next beat's pass reads the world slowly; the player taps Retry meanwhile.
  let open = () => {};
  const held = new Promise<void>((resolve) => (open = resolve));
  let first = true;
  const store = {
    ...t.store,
    readDoc: async (...args: Parameters<typeof t.store.readDoc>) => {
      if (first && args[0] === worldId(t.runId)) {
        first = false;
        await held;
      }
      return t.store.readDoc(...args);
    },
  } as typeof t.store;
  const pass = queueScenePaints({ ...t.deps, store }, t.runId, beat(1, { cg: undefined }), { debugMode: false });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const tap = t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  open();
  await pass;
  assert.equal((await tap).body.place.art.state, "ready", "the tap is not swallowed");
  assert.equal(t.paid.length, 2);
});

test("a CG eased off before its line is never paid for, even one already waiting for the lane", async () => {
  const t = await sceneWorld("r-m2bart16-pppppp");
  let free = () => {};
  const lane = paintSlot("conn-image", () => new Promise<void>((resolve) => (free = resolve)));
  const written = await saveBeat(t.store, t.runId, beat(1, { places: [], cg: { ...CG, at: 2 } }));
  const painting = queueScenePaints(t.deps, t.runId, written, { debugMode: false });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await t.store.updateDoc(runDocTarget("beat", beatId(t.runId, KEY, 1)), normalizeBeat, (current) => ({
    ...current,
    easedOff: { at: 0 },
  }));
  free();
  await lane;
  await painting;
  assert.equal(t.paid.length, 0);
  assert.equal((await readStoredBeat(t.store, t.runId, 1))!.cg?.art?.state, "stopped");
});

test("a paint a restart left pending reads as stopped in the run view and the beat as well", async () => {
  const t = await sceneWorld("r-m2bart17-qqqqqq");
  const pending = { state: "pending" as const, at: "2026-10-28T09:00:00.000Z" };
  const key = placeKey("The Lamp Room");
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (current) => ({
    ...current,
    places: { [key]: { name: "The Lamp Room", tags: "lighthouse interior, no humans", art: pending } },
  }));
  await saveBeat(t.store, t.runId, beat(2, { cg: { ...CG, art: pending } }));
  const run = await routesOf(registerRunRoutes, t.deps, "r-m2bart17-qqqqqq")("GET", "/runs/:run");
  assert.equal(run.body.view.world.places[key].art.state, "stopped");
  const served = await storyRoutes(t.deps, "r-m2bart17-qqqqqq")(
    "POST",
    "/runs/:run/chapters/:key/beats/:i",
    {},
    {
      key: KEY,
      i: "2",
    },
  );
  assert.equal(served.body.beat.cg.art.state, "stopped");
  assert.equal((await readStoredBeat(t.store, t.runId, 2))!.cg?.art?.state, "pending", "only the view changes");
});

test("Settings → Images lists the Engine's image style profiles, and the one picked is the one pictures follow (2026-11-03)", async () => {
  const profiles = {
    defaultProfileId: "anime",
    profiles: [
      {
        id: "anime",
        name: "Anime",
        baseStyle: "anime",
        promptMode: "tagged",
        styleText: "anime art",
        positiveTags: "anime",
        negativeTags: "",
      },
      {
        id: "auto",
        name: "Auto",
        baseStyle: "auto",
        promptMode: "natural",
        styleText: "",
        positiveTags: "",
        negativeTags: "",
      },
    ],
  };
  const fetch = (async (url: string | URL) => {
    const path = String(url).replace("http://127.0.0.1:7860", "");
    if (path === "/api/app-settings/ui")
      return Response.json({ value: JSON.stringify({ imageStyleProfiles: profiles }) });
    return new Response("{}", { status: 404 });
  }) as typeof globalThis.fetch;
  const images = createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch });
  const t = await sceneWorld("r-profiles-aaaaaa");
  const listed = await routesOf(
    registerSetupRoutes,
    { ...t.deps, images },
    "r-profiles-aaaaaa",
  )("GET", "/image-style-profiles");
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body, {
    defaultProfileId: "anime",
    profiles: [
      { id: "anime", name: "Anime", promptMode: "tagged" },
      { id: "auto", name: "Auto", promptMode: "natural" },
    ],
  });
  // Unpicked, the Engine's default writes tags; picking Auto makes the story's prompts sentences.
  assert.equal((await images.styleProfile(undefined)).tagged, true);
  assert.equal((await images.styleProfile("auto")).tagged, false);
  // #2467: a tag profile's style text describes it, so only its tags reach the prompts; a sentence profile keeps it.
  assert.equal((await images.styleProfile("anime")).styleText, "");
  assert.equal((await images.styleProfile("anime")).positiveTags, "anime");
  const prose = createImageClient({
    baseUrl: "http://127.0.0.1:7860",
    fetch: (async () =>
      Response.json({
        value: JSON.stringify({
          imageStyleProfiles: {
            defaultProfileId: "paint",
            profiles: [{ id: "paint", baseStyle: "painterly", promptMode: "hybrid", styleText: "Soft brushwork." }],
          },
        }),
      })) as typeof globalThis.fetch,
  });
  assert.equal((await prose.styleProfile("paint")).styleText, "Soft brushwork.");
  // A list the Engine cannot give reads as empty, never as an error.
  const broken = createImageClient({
    baseUrl: "http://127.0.0.1:7860",
    fetch: (async () => new Response("{}", { status: 500 })) as typeof globalThis.fetch,
  });
  assert.deepEqual(await broken.styleProfiles!(), { defaultProfileId: "", profiles: [] });
});

test("on an Android app install every loopback request to the Engine carries its local secret (#2357)", async () => {
  // The Engine there refuses the device's own requests without it, so style profiles and portraits failed with 401.
  const secret = "c3".repeat(32);
  const saved = process.env.MARINARA_ANDROID_SECRET;
  process.env.MARINARA_ANDROID_SECRET = secret;
  try {
    const seen: Array<{ path: string; headers: Record<string, string>; body: unknown }> = [];
    const fetch = (async (url: string | URL, init?: RequestInit) => {
      const path = String(url).replace("http://127.0.0.1:7860", "");
      seen.push({ path, headers: { ...(init?.headers as Record<string, string>) }, body: init?.body });
      if (path === "/api/app-settings/ui") return Response.json({ value: {} });
      if (path === "/api/characters/avatar-generation")
        return Response.json({ image: `data:image/png;base64,${PNG}`, prompt: "portrait" });
      if (path === "/api/global-gallery/upload") return Response.json({ id: "g1", url: "/api/global-gallery/file/g1" });
      if (path === "/api/sprites/cleanup/status") return Response.json({ cleanupRevision: 2 });
      if (path === "/original.png")
        return new Response(Buffer.from(PNG, "base64"), { headers: { "content-type": "image/png" } });
      if (path === "/api/sprites/cleanup") return Response.json({ cells: [{ base64: PNG }] });
      return Response.json({}, { status: path.startsWith("/api/global-gallery/") ? 200 : 404 });
    }) as typeof globalThis.fetch;
    const images = createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch });
    await images.styleProfiles!();
    await images.generatePortrait({ connectionId: "c1", name: "Kai", prompt: "portrait", width: 832, height: 1216 });
    await images.deleteGalleryImage("g1");
    const cutouts = createCutoutClient({ baseUrl: "http://127.0.0.1:7860", fetch });
    await cutouts.cutOut("/original.png");
    await cutouts.deleteGalleryImage("g2");
    assert.deepEqual(
      seen.map(({ path }) => path),
      [
        "/api/app-settings/ui",
        "/api/characters/avatar-generation",
        "/api/global-gallery/upload",
        "/api/global-gallery/g1",
        "/api/sprites/cleanup/status",
        "/original.png",
        "/api/sprites/cleanup",
        "/api/global-gallery/upload",
        "/api/global-gallery/g2",
      ],
    );
    for (const { path, headers } of seen) assert.equal(headers["x-marinara-android-secret"], secret, path);
    // The caller's own headers stay, and an upload sets no content type, so fetch still writes the multipart boundary.
    assert.equal(seen[1]!.headers["Content-Type"], "application/json");
    for (const upload of seen.filter(({ path }) => path === "/api/global-gallery/upload")) {
      assert.ok(upload.body instanceof FormData);
      assert.deepEqual(Object.keys(upload.headers), ["x-marinara-android-secret"]);
    }
    // Another address never gets it.
    const elsewhere: unknown[] = [];
    await createImageClient({
      baseUrl: "http://192.168.1.20:7860",
      fetch: (async (_url: string | URL, init?: RequestInit) => {
        elsewhere.push(init?.headers);
        return Response.json({ value: {} });
      }) as typeof globalThis.fetch,
    }).styleProfiles!();
    assert.deepEqual(elsewhere, [undefined]);
  } finally {
    if (saved === undefined) delete process.env.MARINARA_ANDROID_SECRET;
    else process.env.MARINARA_ANDROID_SECRET = saved;
  }
});

test("a paid image that never answers ends at its deadline, frees its connection's queue, and its late image is deleted", async () => {
  // The maintainer's, 2026-11-05: a key image said "Painting this moment" for 30 minutes. One call that never answers
  // held the connection's queue, so every paint behind it waited too.
  let answer: (value: { id: string }) => void = () => undefined;
  const hung = new Promise<{ id: string }>((resolve) => (answer = resolve));
  const late: string[] = [];
  const first = paintSlot("conn-deadline", () =>
    withDeadline(
      () => hung,
      30,
      "The image service",
      (image) => late.push(image.id),
    ),
  );
  const second = paintSlot("conn-deadline", async () => "painted");
  await assert.rejects(first, /The image service took longer than/);
  assert.equal(await second, "painted", "the next paint on the connection runs");
  answer({ id: "g-late" });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(late, ["g-late"], "the image that came after the deadline goes to onLate, to be deleted");
  // An answer in time is returned as is, and nothing is called late.
  assert.equal(
    await withDeadline(
      async () => "ok",
      1_000,
      "x",
      () => assert.fail("not late"),
    ),
    "ok",
  );
});

test("a repaint keeps the picture it paints over on screen, keeps it again if it fails, and moves the Album with it", async () => {
  let fail = false;
  let held: Promise<void> = Promise.resolve();
  const t = await sceneWorld("r-m2bart10-jjjjjj", {
    runKey: "r-m2bart10-jjjjjj",
    before: async (call) => {
      if (fail && call.method === "generateBannerArt") throw new Error("provider down");
      if (call.method === "generateBannerArt") await held;
    },
    // Deleting answers as the Engine does: a picture a stored document still holds is refused (409), as on a real run.
    engineDeletes: true,
  });
  await t.write(1, { cg: CG });
  const painted = (await readStoredBeat(t.store, t.runId, 1))!;
  const first = painted.cg!.art!;
  assert.equal(first.state, "ready");
  // Shown and read through, so the Album keeps it: a repaint must move the entry, not orphan it.
  await saveBeat(t.store, t.runId, { ...painted, readThrough: CG.at });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    chapters: { ...current.chapters, [KEY]: { ...current.chapters[KEY], beatsRead: 1 } },
  }));
  assert.equal((await t.call("POST", "/runs/:run/art/cg/seen", { key: KEY, i: 1 })).status, 200);
  assert.deepEqual(
    (await t.state()).album.cgs.map(({ url, ref }) => ({ url, ref })),
    [{ url: first.url, ref: first.ref }],
  );

  // While the repaint runs, the record still shows the picture it painted over, so nothing goes blank.
  let release: () => void = () => undefined;
  held = new Promise<void>((resolve) => (release = resolve));
  const repaint = t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  await until(
    async () => (await readStoredBeat(t.store, t.runId, 1))?.cg?.art?.state === "pending",
    "the repaint marks its record pending",
  );
  const during = (await readStoredBeat(t.store, t.runId, 1))!.cg!.art!;
  assert.deepEqual([during.state, during.url, during.ref], ["pending", first.url, first.ref], "the old picture stays");
  release();
  const done = await repaint;
  held = Promise.resolve();
  assert.equal(done.body.art.state, "ready");
  assert.notEqual(done.body.art.ref, first.ref);
  assert.deepEqual(t.deleted, [first.ref!.slice("global-gallery:".length)], "the replaced image leaves the gallery");
  // The Album follows the beat to the new picture rather than holding the one it replaced.
  assert.deepEqual(
    (await t.state()).album.cgs.map(({ url, ref }) => ({ url, ref })),
    [{ url: done.body.art.url, ref: done.body.art.ref }],
  );

  // A repaint that fails keeps the picture it painted over, beside its error; the record reads failed, never blank.
  fail = true;
  const failed = await t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  assert.equal(failed.body.art.state, "failed");
  assert.match(failed.body.art.error ?? "", /provider down/);
  assert.deepEqual([failed.body.art.url, failed.body.art.ref], [done.body.art.url, done.body.art.ref]);
  assert.equal(t.paid.length, 4, "the failed repaint was paid for once and is not retried by itself");
});

test("backgrounds and scene art paint on their own connections when chosen; Settings sets and clears them", async () => {
  const runKey = "r-imgkinds-aaaaaa";
  const t = await sceneWorld(runKey, {
    runKey,
    images: { backgroundConnectionId: "conn-bg", sceneConnectionId: "conn-scene" },
  });
  await t.write(1, { cg: CG });
  await until(() => t.paid.length === 2, "the place and the CG painted");
  const cg = t.paid.find((paid) => paid.method === "generateBannerArt");
  const place = t.paid.find((paid) => paid.method !== "generateBannerArt");
  assert.equal(place?.request.connectionId, "conn-bg");
  assert.equal(cg?.request.connectionId, "conn-scene");

  // A repaint tap follows the choice made now; "" goes back to the image connection.
  const settings = routesOf(registerRunRoutes, t.deps, runKey);
  const saved = await settings("POST", "/runs/:run/settings", { images: { sceneConnectionId: "" } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const images = (await t.world()).images;
  assert.equal(images.sceneConnectionId, undefined);
  assert.equal(images.backgroundConnectionId, "conn-bg", "the other choice stays");
  const repaint = await t.call("POST", "/runs/:run/art/cg", { key: KEY, i: 1 });
  assert.equal(repaint.status, 200, JSON.stringify(repaint.body));
  assert.equal(t.paid.at(-1)?.request.connectionId, "conn-image");
  // Without the image connection nothing is painted, whatever the other two say.
  await setImages(t.store, t.runId, { connectionId: null });
  const none = await t.call("POST", "/runs/:run/art/place", { place: "The Lamp Room" });
  assert.equal(none.status, 503, JSON.stringify(none.body));
});

test("a NovelAI connection paints in NovelAI's style, with one reference that the prompt dresses (#2465)", async () => {
  // The Engine's rule: a named service decides, else a NovelAI model or address.
  assert.equal(paintsWithNovelAi({ imageService: "novelai", model: "nai-diffusion-5-full" }), true);
  assert.equal(paintsWithNovelAi({ model: "nai-diffusion-5", baseUrl: "" }), true);
  assert.equal(paintsWithNovelAi({ model: "custom", baseUrl: "https://image.novelai.net" }), true);
  assert.equal(paintsWithNovelAi({ imageService: "openai", model: "nai-diffusion-5" }), false);
  assert.equal(paintsWithNovelAi({ model: "gpt-image-1", baseUrl: "https://api.openai.com/v1" }), false);

  const connections = [
    { id: "conn-gpt", provider: "image_generation", model: "gpt-image-1", baseUrl: "https://api.openai.com/v1" },
    { id: "conn-nai", provider: "image_generation", model: "nai-diffusion-5-full", imageService: "novelai" },
  ];
  const bodies: Array<Record<string, unknown>> = [];
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("http://127.0.0.1:7860", "");
    if (path === "/api/connections") return Response.json(connections);
    if (path === "/api/app-settings/ui") return Response.json({ value: {} });
    if (path === "/api/characters/avatar-generation") {
      bodies.push(JSON.parse(String(init?.body)));
      return Response.json({ image: "data:image/png;base64,iVBORw0KGgo=", prompt: "p" });
    }
    return new Response("{}", { status: 404 });
  }) as typeof globalThis.fetch;
  const images = createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch });
  const settings = { connectionId: "conn-gpt", sceneConnectionId: "conn-nai" };

  const background = await worldStyle(images, settings, "background");
  assert.equal(background.novelai, undefined, "GPT paints the places as the profile says");
  const scene = await worldStyle(images, settings, "scene");
  assert.equal(scene.tagged, true);
  assert.equal(scene.novelai, true);
  assert.match(scene.positiveTags, new RegExp(`${NOVELAI_QUALITY}$`, "u"));
  assert.ok(scene.negativeTags.startsWith(NOVELAI_NEGATIVE) && scene.negativeTags.includes("mismatched pupils"));

  const world = normalizeWorld({ images: { connectionId: "conn-gpt", rating: "sfw" } });
  const people = [
    { name: "Kai", identityLine: "tall", outfitLine: "coat", presentation: "man" as const },
    { name: "Ines", identityLine: "short", outfitLine: "oilskin", presentation: "woman" as const },
  ];
  const cg = cgPrompt({ brief: "They share an umbrella.", people, world, style: scene, use: "cg" });
  assert.ok(cg.prompt.startsWith("1girl, 1boy, "), cg.prompt);
  assert.ok(cg.prompt.endsWith(NOVELAI_QUALITY), cg.prompt);
  // An explicit key image is drawn uncensored.
  const adult = normalizeWorld({
    content: { heat: "explicit" },
    images: { connectionId: "conn-gpt", rating: "explicit" },
  });
  const sex = cgPrompt({
    brief: "Naked in the lamp room.",
    people,
    world: adult,
    style: scene,
    use: "cg",
    explicit: true,
  });
  assert.match(sex.prompt, /nsfw, explicit, uncensored/u, sex.prompt);
  assert.match(sex.negativePrompt, /mosaic censoring, bar censor/u);
  const place = placePrompt({ name: "Pier", tags: "harbour pier, night", world, style: scene });
  // #2467: no "background dataset", which would replace the player's Image style with NovelAI's scenery style.
  assert.ok(!place.prompt.includes("background dataset"), place.prompt);

  const request = { name: "Kai", prompt: "p", negativePrompt: "n", width: 1216, height: 832, debugMode: false };
  const refs = ["/a.png", "/b.png", "/c.png"];
  await images.generateImage({ ...request, connectionId: "conn-nai", referenceImages: refs });
  await images.generateImage({ ...request, connectionId: "conn-gpt", referenceImages: refs });
  assert.deepEqual(bodies[0]!.referenceImages, ["/a.png"], "NovelAI gets the focus alone");
  assert.equal(bodies[0]!.preferReferenceOutfit, false, "and the prompt dresses them");
  assert.deepEqual(bodies[1]!.referenceImages, refs);
  assert.equal("preferReferenceOutfit" in bodies[1]!, false);
});

test("0.47.2: on NovelAI a key image of two people sends both their references, and a clothed one names nudity as tags", async () => {
  const t = await sceneWorld("r-naitwins-aaaaaa");
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-kai",
    identityLine: "tall man, grey hair",
    outfitLine: "keeper's coat",
    bible: bible({ look: { identityLine: "", outfitLine: "", presentation: "man" } }),
  }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    look: { identityLine: "short dark hair", outfitLine: "oilskin", presentation: "woman" },
  }));
  // Explicit Heat and the Explicit rating: a key image may be explicit, but this supper's brief is not.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    content: { ...world.content, heat: "explicit" },
    images: { ...world.images, rating: "explicit" },
  }));
  const bodies: Array<Record<string, any>> = [];
  const json = (value: unknown) =>
    new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("http://127.0.0.1:7860", "");
    if (path === "/api/connections") {
      return json([{ id: "conn-image", provider: "image_generation", model: "nai-diffusion-5-full" }]);
    }
    if (path === "/api/characters/card-kai") return json({ avatarPath: "/api/avatars/file/kai.png" });
    if (path === "/api/characters/personas/persona-ines") return json({ avatarPath: "/api/avatars/file/ines.png" });
    if (path.startsWith("/api/avatars/file/") || path.startsWith("/api/global-gallery/file/")) {
      return new Response(Buffer.from(path), { headers: { "content-type": "image/png" } });
    }
    if (path === "/api/app-settings/ui") return json({ value: {} });
    if (path === "/api/characters/avatar-generation") {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      return json({ image: `data:image/png;base64,${PNG}`, prompt: body.promptOverrides[0].prompt });
    }
    if (path === "/api/global-gallery/upload") return json({ id: "cg1", url: "/api/global-gallery/file/cg1.png" });
    return new Response(JSON.stringify({ error: "no" }), { status: 404 });
  }) as typeof globalThis.fetch;
  const deps = { ...t.deps, images: createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch }) };
  const paint = async (i: number, cast: string[]) => {
    const written = await saveBeat(
      t.store,
      t.runId,
      beat(i, { cg: { at: 0, brief: "Supper at his table.", cast }, places: [] }),
    );
    await queueScenePaints(deps, t.runId, written, { debugMode: false });
    assert.equal((await readStoredBeat(t.store, t.runId, i))?.cg?.art?.state, "ready");
    return bodies.at(-1)!;
  };

  // With his reference alone, NovelAI drew both with his face and hair (2026-11-26); V5 tells several apart.
  const both = await paint(1, ["Kai", "Ines"]);
  assert.equal(both.referenceImages.length, 2, "two people: a reference each");
  assert.deepEqual(
    both.referenceImages.map((image: string) => Buffer.from(image.split(",")[1]!, "base64").toString()),
    ["/api/avatars/file/kai.png", "/api/avatars/file/ines.png"],
  );
  assert.equal(both.preferReferenceOutfit, false, "the prompt dresses them");
  const { prompt, negativePrompt } = both.promptOverrides[0];
  assert.ok(prompt.startsWith("1girl, 1boy, "), prompt);
  assert.match(prompt, /Kai: tall man, grey hair; keeper's coat\./);
  assert.match(prompt, /Ines: short dark hair; oilskin\./);
  assert.doesNotMatch(prompt, /nsfw|explicit|uncensored/u, "a clothed brief asks for nothing explicit");
  // Tag models skip "nudity"; the tags reach them (a NovelAI supper came out topless, 2026-11-26).
  assert.match(negativePrompt, /nudity, explicit sexual activity, nude, topless, nipples, sex/u);

  // One person: their reference alone, which the prompt dresses.
  const alone = await paint(2, ["Kai"]);
  assert.equal(alone.referenceImages.length, 1);
  assert.equal(alone.preferReferenceOutfit, false);

  // Only the people's pictures go: a worn outfit or a place after them would be read as someone else.
  const request = { name: "Kai", prompt: "p", negativePrompt: "n", width: 1216, height: 832, debugMode: false };
  await deps.images.generateImage({
    ...request,
    connectionId: "conn-image",
    referenceImages: ["/kai.png", "/ines.png", "/place.png"],
    characters: 2,
  });
  assert.deepEqual(bodies.at(-1)!.referenceImages, ["/kai.png", "/ines.png"]);
  // Nobody pictured (a photo of two with no picture of either): the place is never sent as a person.
  await deps.images.generateImage({
    ...request,
    connectionId: "conn-image",
    referenceImages: ["/place.png"],
    characters: 0,
  });
  assert.equal(bodies.at(-1)!.referenceImages, undefined);
  assert.equal("preferReferenceOutfit" in bodies.at(-1)!, false);

  // Someone with no picture at all counts as nobody, so the worn outfit added after Kai's face never takes their slot.
  await deps.images.generateBannerArt({
    ...request,
    connectionId: "conn-image",
    units: [
      {
        kind: "character",
        cardId: "card-kai",
        outfits: [{ id: "coat", url: "/api/global-gallery/file/kai-coat.png" }],
        wornOutfit: "coat",
        who: "Kai",
      },
      { kind: "character", personaId: "persona-nobody", who: "Ines" },
    ] as never,
  });
  const sent = bodies
    .at(-1)!
    .referenceImages.map((image: string) => Buffer.from(image.split(",")[1]!, "base64").toString());
  assert.deepEqual(sent, ["/api/avatars/file/kai.png"]);
});

// ── 0.47.1: Your cast's paints go on in the background ──

/** A cast whose looks wait for the tap, with Kai painted on a gallery look and Expressions on; `n` gates paid call n. */
async function castWorld(runKey: string, gated: number) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let failNext = false;
  const t = await artWorld({
    runKey,
    // Ask before painting: a read of the run paints nothing by itself.
    images: { ask: true, expressions: true },
    before: async (_call, n) => {
      if (n === gated) await gate;
      if (failNext) throw new Error("the image service refused it");
    },
  });
  const art = createOtomeArt(t.deps);
  const deps = { ...t.deps, art };
  const look = "/api/global-gallery/file/kai-look.png";
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: look,
    portraitRef: "global-gallery:kai-look",
    art: { state: "ready", at: "2026-10-28T09:00:00.000Z", url: look, ref: "global-gallery:kai-look" },
  }));
  const kai = async () => (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  const viewOf = async () =>
    (await routesOf(registerRunRoutes, deps, runKey)("GET", "/runs/:run")).body.view.lis.find(
      (li: { id: string }) => li.id === KAI,
    );
  return {
    ...t,
    art,
    deps,
    look,
    kai,
    viewOf,
    setup: routesOf(registerSetupRoutes, deps, runKey),
    release: () => release(),
    failNext: () => (failNext = true),
  };
}

test("Repaint answers with its pending record and paints on without the request; a second tap never pays twice", async (context) => {
  const t = await castWorld("r-bgpaint1-aaaaaa", 1);
  context.after(() => (t.release(), t.art.dispose()));
  const target = { kind: "look", owner: `li:${KAI}` };
  const started = await t.setup("POST", "/runs/:run/art/paint", { target });
  assert.deepEqual([started.status, started.body.paint.state], [200, "pending"], JSON.stringify(started.body));
  await until(() => t.paid.length === 1, "the paid portrait");
  // The request has answered; the run view shows the paint going on, and his old look stays meanwhile.
  const painting = await t.viewOf();
  assert.deepEqual([painting.art.state, painting.portrait], ["pending", t.look]);
  const again = await t.setup("POST", "/runs/:run/art/paint", { target });
  assert.deepEqual([again.status, again.body.code], [409, "busy"]);
  assert.equal(t.paid.length, 1, "a second tap while it paints never pays");
  t.release();
  await paintSettled(t.runId, `li:${KAI}`);
  const unit = await t.kai();
  assert.equal(unit.art?.state, "ready");
  assert.equal(unit.portrait, unit.art?.url, "the new picture is in");
  const landed = await t.viewOf();
  assert.deepEqual([landed.art.state, landed.portrait], ["ready", unit.portrait]);
  assert.equal(t.paid.length, 1);
});

test("Repaint expressions answers pending and its faces paint on; the run view says painting, then failed or nothing", async (context) => {
  const t = await castWorld("r-bgpaint2-aaaaaa", 1);
  context.after(() => (t.release(), t.art.dispose()));
  const started = await t.setup("POST", "/runs/:run/art/expressions", { li: KAI });
  assert.deepEqual([started.status, started.body.paint.state], [200, "pending"], JSON.stringify(started.body));
  assert.deepEqual((await t.viewOf()).facesPaint?.state, "pending", "painting, from before the first face");
  await until(() => t.paid.length === 1, "the first paid face");
  // The same set asked for again joins the one painting: nothing more is paid for.
  const again = await t.setup("POST", "/runs/:run/art/expressions", { li: KAI, base: t.look });
  assert.deepEqual([again.status, again.body.paint.state], [200, "pending"]);
  t.release();
  await paintSettled(t.runId, `faces:${KAI}`);
  assert.equal(t.paid.length, FACES.length, "five faces, once");
  const landed = await t.viewOf();
  assert.equal(landed.facesPaint, undefined, "landed: nothing more to say");
  assert.deepEqual(Object.keys(landed.expressions ?? {}).sort(), [...FACES].sort());

  // A set that fails says so with its reason, and Repaint expressions paints it again.
  t.failNext();
  assert.equal((await t.setup("POST", "/runs/:run/art/expressions", { li: KAI })).status, 200);
  await paintSettled(t.runId, `faces:${KAI}`);
  const failed = await t.viewOf();
  assert.equal(failed.facesPaint?.state, "failed");
  assert.match(failed.facesPaint?.error ?? "", /refused/);
  assert.deepEqual(Object.keys(failed.expressions ?? {}).sort(), [...FACES].sort(), "the old faces stay");

  // A set a restart left pending reads as stopped.
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => {
    const record = unit.expressions[t.look] as Record<string, unknown>;
    const replacement = { state: "pending", at: "2026-10-28T09:00:00.000Z", images: {} };
    return { ...unit, expressions: { ...unit.expressions, [t.look]: { ...record, replacement } } };
  });
  assert.equal((await t.viewOf()).facesPaint?.state, "stopped");
});

test("a Repaint expressions that lands while the run is read reads pending beside the faces from before it, never stopped", async (context) => {
  const t = await castWorld("r-bgpaint4-aaaaaa", 1);
  context.after(() => (t.release(), t.art.dispose()));
  assert.equal((await t.setup("POST", "/runs/:run/art/expressions", { li: KAI })).status, 200);
  await until(() => t.paid.length === 1, "the first paid face");
  // The read's cut-out check (after its documents were read) waits until the set has landed.
  const cutouts = t.deps.cutouts!;
  let landDuringRead = true;
  cutouts.cleanupRevision = async () => {
    if (landDuringRead) {
      landDuringRead = false;
      t.release();
      await paintSettled(t.runId, `faces:${KAI}`);
    }
    return undefined;
  };
  const read = await t.viewOf();
  assert.equal(landDuringRead, false, "the set landed during the read");
  assert.deepEqual([read.facesPaint?.state, read.expressions ?? {}], ["pending", {}], "so the client reads again");
  const next = await t.viewOf();
  assert.equal(next.facesPaint, undefined);
  assert.deepEqual(Object.keys(next.expressions ?? {}).sort(), [...FACES].sort());
});

test("a Repaint expressions that lands while the run's units are read reads pending, never stopped", async (context) => {
  const t = await castWorld("r-bgpaint5-aaaaaa", 1);
  const readDoc = t.store.readDoc;
  context.after(() => ((t.store.readDoc = readDoc), t.release(), t.art.dispose()));
  assert.equal((await t.setup("POST", "/runs/:run/art/expressions", { li: KAI })).status, 200);
  await until(() => t.paid.length === 1, "the first paid face");
  // Kai's unit is read with his replacement still pending; the set lands before Mireille's read (beside it) returns.
  let kaiRead: Promise<unknown> | null = null;
  let landDuringRead = true;
  t.store.readDoc = (async (id: string, normalize: Parameters<typeof readDoc>[1]) => {
    const read = readDoc(id, normalize);
    if (id === unitId(t.runId, KAI)) kaiRead ??= read;
    if (id === unitId(t.runId, MIR) && kaiRead && landDuringRead) {
      landDuringRead = false;
      await kaiRead;
      t.release();
      await paintSettled(t.runId, `faces:${KAI}`);
    }
    return read;
  }) as typeof readDoc;
  const read = await t.viewOf();
  t.store.readDoc = readDoc;
  assert.equal(landDuringRead, false, "the set landed during the read");
  assert.deepEqual([read.facesPaint?.state, read.expressions ?? {}], ["pending", {}], "so the client reads again");
  const next = await t.viewOf();
  assert.equal(next.facesPaint, undefined);
  assert.deepEqual(Object.keys(next.expressions ?? {}).sort(), [...FACES].sort());
});

test("Repaint expressions the kit ends before it starts (the look cannot be read) reads stopped, and the next one paints", async (context) => {
  const t = await castWorld("r-bgpaint3-aaaaaa", 0);
  context.after(() => t.art.dispose());
  const read = t.images.cardAvatarImage;
  t.images.cardAvatarImage = async () => null;
  const started = await t.setup("POST", "/runs/:run/art/expressions", { li: KAI });
  assert.deepEqual([started.status, started.body.paint.state], [200, "pending"], JSON.stringify(started.body));
  await paintSettled(t.runId, `faces:${KAI}`);
  const ended = await t.viewOf();
  assert.equal(ended.facesPaint?.state, "stopped", "Your cast says it did not finish, with Repaint expressions");
  assert.deepEqual([t.paid.length, ended.expressions ?? {}], [0, {}], "nothing was paid for or filed");

  // Repaint expressions again paints the set, and the run view has nothing more to say once it lands.
  t.images.cardAvatarImage = read;
  assert.equal((await t.setup("POST", "/runs/:run/art/expressions", { li: KAI })).status, 200);
  await paintSettled(t.runId, `faces:${KAI}`);
  const landed = await t.viewOf();
  assert.deepEqual([landed.facesPaint, t.paid.length], [undefined, FACES.length]);
});
