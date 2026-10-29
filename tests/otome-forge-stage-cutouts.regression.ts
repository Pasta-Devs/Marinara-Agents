// Stage expression reads must never replace a cleaned sprite with its chroma-matte original. Exercise the actual
// run/scene route handlers with free cleanup held in flight, without a model or image provider.
import assert from "node:assert/strict";
import test from "node:test";
import type { Cutout } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  cutoutsSettled,
  type CutoutClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import { placeKey } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/places.ts";
import {
  beatId,
  playerId,
  runDocTarget,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerArtRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/art.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeBeat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { artWorld, beat, KEY, routesOf, saveBeat, seedChapter, until } from "./fixtures/otome-forge-art.ts";
import { at, KAI } from "./fixtures/otome-forge-story.ts";

const BASE = "/api/global-gallery/file/kai-neutral.png";
const WORN = "/api/global-gallery/file/kai-outfit.png";
const FACE = "/api/global-gallery/file/kai-cold-green.png";
const STALE_FACE = "/api/global-gallery/file/kai-old-cold-green.png";
const PLAYER = "/api/global-gallery/file/ines-neutral.png";
const clean = (url: string) => `${url}.cut.png`;
const ready = (url: string): Cutout => ({ state: "ready", at, url: clean(url), ref: `global-gallery:cut-${url}` });

function controlledCutouts(fail = false) {
  const calls: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const client: CutoutClient = {
    async cutOut(url) {
      calls.push(url);
      await gate;
      if (fail) throw new Error("The free cleanup failed.");
      return { url: clean(url) };
    },
    deleteGalleryImage: async () => assert.fail("stage reads must not delete retained artwork"),
  };
  return { client, calls, release };
}

async function stageWorld(runKey: string, cutouts: CutoutClient, faceReady = true) {
  const t = await artWorld({ runKey, images: { expressions: true } });
  await seedChapter(t.store, t.runId);
  await saveBeat(t.store, t.runId, beat(0, { readThrough: 1, choiceCanon: { kept: "accepted" } }));
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: BASE,
    portraitRef: "global-gallery:neutral-original",
    outfits: [{ id: "outfit-kept", name: "Harbour coat", outfitLine: "navy coat", url: WORN, at }],
    wornOutfit: "outfit-kept",
    expressions: {
      [WORN]: { state: "ready", at, images: { cold: { url: FACE, ref: "global-gallery:cold-original" } } },
      [BASE]: { state: "ready", at, images: { cold: { url: STALE_FACE } } },
    },
    cutouts: { [BASE]: ready(BASE), [WORN]: ready(WORN), ...(faceReady ? { [FACE]: ready(FACE) } : {}) },
  }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    about: "",
    portrait: PLAYER,
    cutouts: { [PLAYER]: ready(PLAYER) },
  }));
  const deps = { ...t.deps, cutouts };
  const art = routesOf(registerArtRoutes, deps, runKey);
  const runs = routesOf(registerRunRoutes, deps, runKey);
  const scene = async () => {
    const result = await art("GET", "/runs/:run/art/scene", { key: KEY, i: "0" });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const run = async () => {
    const result = await runs("GET", "/runs/:run");
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.view;
  };
  const unit = () => t.store.readDoc(unitId(t.runId, KAI), normalizeUnit);
  const retained = () =>
    Object.fromEntries(
      [...t.fake.rows].map(([id, row]) => {
        const { cutouts: _cutouts, ...data } = row.data as Record<string, unknown>;
        return [id, structuredClone(data)];
      }),
    );
  const noPaidWork = () => {
    assert.deepEqual(t.calls, [], "serving stage cutouts makes no model call");
    assert.deepEqual(t.paid, [], "serving stage cutouts makes no paid image call");
    assert.deepEqual(t.deleted, [], "retained images are not deleted");
  };
  return { ...t, scene, run, unit, retained, noPaidWork };
}

test("scene refresh preserves the run's cleaned expression instead of returning its opaque original", async () => {
  const cuts = controlledCutouts();
  const t = await stageWorld("r-stagecached-aaaaaa", cuts.client);
  const before = t.retained();
  const view = await t.run();
  const li = view.lis.find((entry: { id: string }) => entry.id === KAI);
  assert.deepEqual(li.expressions, { cold: clean(FACE) });
  assert.ok(li.cut.includes(clean(FACE)), "the face URL and its cutout framing arrive together");
  assert.deepEqual((await t.scene()).faces[KAI], li.expressions, "scene polling must preserve the cleaned URL");
  assert.deepEqual(cuts.calls, [], "cached derivatives do not start another cleanup");
  assert.deepEqual(t.retained(), before, "original images, bible, story and progress remain unchanged");
  t.noPaidWork();
});

test("a newly cached expression is queued once and enters the stage map only after free cleanup", async (context) => {
  const cuts = controlledCutouts();
  context.after(async () => {
    cuts.release();
    await cutoutsSettled();
  });
  const t = await stageWorld("r-stagepending-bbbbbb", cuts.client, false);
  const before = t.retained();
  const pending = await t.scene();
  assert.equal(pending.faces[KAI]?.cold, undefined, "the green original is never an expression fallback");
  assert.ok(pending.facesComing.includes(KAI), "the scene polls while free cleanup is in flight");
  await until(() => cuts.calls.length === 1, "the expression's free cleanup");
  await t.scene();
  assert.deepEqual(cuts.calls, [FACE], "repeated scene polls share the same cleanup");
  const pendingRun = await t.run();
  const li = pendingRun.lis.find((entry: { id: string }) => entry.id === KAI);
  assert.equal(li.expressions?.cold, FACE, "phone stickers retain the painted face while free cleanup is pending");
  assert.ok(!li.cut.includes(FACE), "an opaque original is never authorized as a stage cutout");
  assert.equal(li.worn.url, clean(WORN), "the clean neutral look remains the fallback");
  cuts.release();
  await cutoutsSettled();
  const completed = await t.scene();
  assert.deepEqual(completed.faces[KAI], { cold: clean(FACE) });
  assert.ok(!completed.facesComing.includes(KAI), "polling stops after cleanup lands");
  const completedLi = (await t.run()).lis.find((entry: { id: string }) => entry.id === KAI);
  assert.deepEqual(completedLi.expressions, { cold: clean(FACE) });
  assert.ok(completedLi.cut.includes(clean(FACE)));
  assert.deepEqual(cuts.calls, [FACE]);
  assert.deepEqual(t.retained(), before, "original images, bible, story and progress remain unchanged");
  t.noPaidWork();
});

test("failed free cleanup keeps the clean neutral fallback and stops expression polling without a retry", async (context) => {
  const cuts = controlledCutouts(true);
  context.after(async () => {
    cuts.release();
    await cutoutsSettled();
  });
  const t = await stageWorld("r-stagefailed-cccccc", cuts.client, false);
  const before = t.retained();
  const pending = await t.scene();
  assert.equal(pending.faces[KAI]?.cold, undefined);
  assert.ok(pending.facesComing.includes(KAI));
  cuts.release();
  await cutoutsSettled();
  assert.equal((await t.unit())!.cutouts[FACE]!.state, "failed");
  for (let read = 0; read < 2; read += 1) {
    const scene = await t.scene();
    assert.equal(scene.faces[KAI]?.cold, undefined, "failed cleanup never exposes the green face");
    assert.ok(!scene.facesComing.includes(KAI), "a failed cleanup is terminal for this revision");
    const view = await t.run();
    const li = view.lis.find((entry: { id: string }) => entry.id === KAI);
    assert.equal(li.expressions?.cold, FACE, "phone stickers retain the painted face after cleanup fails");
    assert.ok(!li.cut.includes(FACE), "failed cleanup never authorizes the original as a stage cutout");
    assert.equal(li.worn.url, clean(WORN));
    assert.equal(view.cutoutsPending, undefined);
  }
  await cutoutsSettled();
  assert.deepEqual(cuts.calls, [FACE], "a read never retries failed free cleanup or regenerates a face");
  assert.deepEqual(t.retained(), before);
  t.noPaidWork();
});

test("painting faces wait for their set, while failed or stopped sets neither poll nor queue partial originals", async () => {
  const cuts = controlledCutouts();
  const t = await stageWorld("r-stagesets-dddddd", cuts.client, false);
  for (const state of ["pending", "failed", "stopped"]) {
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
      ...unit,
      expressions: { [WORN]: { state, at, images: { cold: { url: FACE } } } },
    }));
    const scene = await t.scene();
    assert.equal(scene.faces[KAI]?.cold, undefined, state);
    assert.equal(scene.facesComing.includes(KAI), state === "pending", state);
  }
  await cutoutsSettled();
  assert.deepEqual(cuts.calls, [], "partial expression sets are not cleanup inputs");
  t.noPaidWork();
});

test("scene and run reads retain base, worn and player cleanup without cutting backgrounds or obsolete faces", async (context) => {
  const cuts = controlledCutouts();
  context.after(async () => {
    cuts.release();
    await cutoutsSettled();
  });
  const t = await stageWorld("r-stagesources-eeeeee", cuts.client, false);
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cutouts: {},
  }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    cutouts: {},
  }));
  const background = "/api/global-gallery/file/lamp-room.png";
  const cg = "/api/global-gallery/file/scene-cg.png";
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    places: {
      [placeKey("The Lamp Room")]: {
        name: "The Lamp Room",
        tags: "no humans",
        art: { state: "ready", at, url: background },
      },
    },
  }));
  await t.store.updateDoc(runDocTarget("beat", beatId(t.runId, KEY, 0)), normalizeBeat, (beat) => ({
    ...beat,
    cg: { at: 1, brief: "A scene remains intact.", cast: ["Kai"], art: { state: "ready", at, url: cg } },
  }));
  const before = t.retained();
  await t.scene();
  await t.run();
  cuts.release();
  await cutoutsSettled();
  assert.deepEqual([...cuts.calls].sort(), [BASE, WORN, FACE, PLAYER].sort());
  assert.equal(new Set(cuts.calls).size, cuts.calls.length, "run and scene reads share cleanup ownership");
  const scene = await t.scene();
  assert.equal(scene.places[0].art.url, background, "the painted scenery stays opaque");
  assert.equal(scene.cg.art.url, cg, "a CG is not a sprite");
  assert.deepEqual(scene.faces[KAI], { cold: clean(FACE) });
  const view = await t.run();
  const li = view.lis.find((entry: { id: string }) => entry.id === KAI);
  assert.equal(li.portrait, clean(BASE));
  assert.equal(li.worn.url, clean(WORN));
  assert.equal(view.player.cutouts[PLAYER].url, clean(PLAYER));
  assert.deepEqual(t.retained(), before, "cleanup only adds derivatives; original art and all story state survive");
  t.noPaidWork();
});
