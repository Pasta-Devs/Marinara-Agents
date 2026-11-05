// Stage expression reads must never replace a cleaned sprite with its chroma-matte original, and a look's first-wear
// scene stands him in that look. Exercise the actual run/scene route handlers with free cleanup held in flight,
// without a model or image provider.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  Cutout,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import type { Item } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import {
  cutoutsSettled,
  type CutoutClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import {
  addOutfit,
  itemArtOwner,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/outfits.ts";
import { startPaint } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { placeKey } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/places.ts";
import {
  beatId,
  itemId,
  itemStoryKey,
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
import { normalizeItem } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
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
  return { ...t, art, scene, run, unit, retained, noPaidWork };
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

test("a look's first-wear scene stands him in that look, while it paints, on a replay too, while other scenes keep his worn look", async (context) => {
  const cuts = controlledCutouts();
  context.after(async () => {
    cuts.release();
    await cutoutsSettled();
  });
  const t = await stageWorld("r-stagewear-ffffff", cuts.client);
  const LOOK = "his-wardrobe-0-f";
  const LOOK_URL = "/api/global-gallery/file/kai-look5.png";
  const LOOK_FACE = "/api/global-gallery/file/kai-look5-cold.png";
  const lookKey = itemStoryKey(LOOK);
  const setKai = (change: (unit: Unit) => Unit) =>
    t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => change(unit));
  const setItem = (art: Item["art"]) =>
    t.store.mutateDoc(runDocTarget("item", itemId(t.runId, LOOK)), normalizeItem, () => ({
      id: LOOK,
      kind: "his-look5",
      banner: "his-wardrobe-0",
      li: KAI,
      title: "Midnight suit",
      look: { name: "Midnight suit", outfitLine: "black three-piece suit" },
      art,
      story: { key: lookKey },
      createdAt: at,
    }));
  // Just won and opened: the look paints in the background, while its one-node scene is there to read at once.
  await setItem({ state: "pending", at });
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, lookKey, 0)), normalizeBeat, () =>
    beat(0, { key: lookKey, readThrough: 1 }),
  );
  const firstWear = async () => {
    const result = await t.art("GET", "/runs/:run/art/scene", { key: lookKey, i: "0" });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };

  const release = startPaint(t.runId, itemArtOwner(LOOK))!;
  const painting = await firstWear();
  assert.equal(painting.looks, undefined, "no picture of the new look exists yet: his worn look stands in");
  assert.equal(painting.lookComing, true, "the reader keeps polling while the new look paints");
  assert.deepEqual(painting.faces[KAI], { cold: clean(FACE) });
  release();
  assert.equal((await firstWear()).lookComing, undefined, "a stopped paint is not waited for");
  await setItem({ state: "waiting-consent", at });
  assert.equal((await firstWear()).lookComing, undefined, "a look waiting for Paint is not waited for");
  await setItem({ state: "failed", at, error: "The image provider failed." });
  assert.equal((await firstWear()).lookComing, undefined, "a failed look is not waited for");

  // Its paint is saved on the item: the next poll stands him in it, before it is even added to his outfits.
  await setItem({ state: "ready", at, url: LOOK_URL, ref: "global-gallery:look5" });
  assert.equal((await t.unit())!.outfits.length, 1, "the look is not on his outfits yet");
  const uncut = await firstWear();
  assert.deepEqual(
    uncut.looks?.[KAI],
    { worn: { id: LOOK, url: LOOK_URL }, expressions: {}, cut: [] },
    "the first-wear scene stands him in the new look, not the coat he wears on Home",
  );
  assert.equal(uncut.faces[KAI], undefined, "the coat's faces are not this look's faces");
  assert.ok(uncut.facesComing.includes(KAI), "the reader polls while the new look is cut out");
  assert.equal(uncut.lookComing, true, "whatever the expression setting, the reader waits for the cut-out");
  cuts.release();
  await cutoutsSettled();
  assert.deepEqual(cuts.calls, [LOOK_URL], "only the new look is cut out, for free");
  const cut = await firstWear();
  assert.deepEqual(cut.looks[KAI], {
    worn: { id: LOOK, url: clean(LOOK_URL) },
    expressions: {},
    cut: [clean(LOOK_URL)],
  });
  assert.ok(!cut.facesComing.includes(KAI), "no face set is painted for a look he has not worn");
  assert.equal(cut.lookComing, undefined, "the look is in place: polling stops");
  assert.equal((await t.unit())!.expressions[LOOK_URL], undefined, "reading the scene starts no expression set");
  const item = normalizeItem(t.fake.rows.get(itemId(t.runId, LOOK))!.data);
  await addOutfit(t.deps, t.runId, item);
  assert.deepEqual((await firstWear()).looks[KAI], cut.looks[KAI], "added to his outfits, it is the same look");

  // Every other scene keeps the look he wears now.
  const main = await t.scene();
  assert.equal(main.looks, undefined);
  assert.equal(main.lookComing, undefined);
  assert.deepEqual(main.faces[KAI], { cold: clean(FACE) });

  // Her 5★ look's first-wear scene pins nothing: she is never on stage, and he keeps the look he wears now, also while
  // hers paints.
  const HERS = "my-wardrobe-0-f";
  const hersKey = itemStoryKey(HERS);
  await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, HERS)), normalizeItem, () => ({
    id: HERS,
    kind: "her-look5",
    banner: "my-wardrobe-0",
    li: KAI,
    title: "Midnight gown",
    look: { name: "Midnight gown", outfitLine: "black silk gown" },
    coupleWith: LOOK,
    art: { state: "pending", at },
    story: { key: hersKey },
    createdAt: at,
  }));
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, hersKey, 0)), normalizeBeat, () =>
    beat(0, { key: hersKey, readThrough: 1 }),
  );
  const releaseHers = startPaint(t.runId, itemArtOwner(HERS))!;
  const hers = await t.art("GET", "/runs/:run/art/scene", { key: hersKey, i: "0" });
  releaseHers();
  assert.equal(hers.status, 200, JSON.stringify(hers.body));
  assert.equal(hers.body.looks, undefined, "her look's scene stands him in the coat he wears on Home");
  assert.equal(hers.body.lookComing, undefined, "and waits for no paint of hers");
  assert.deepEqual(hers.body.faces[KAI], { cold: clean(FACE) });

  // He wore the new look (its faces were painted then) and went back to his base look: the replay keeps the new look.
  await setKai((unit) => {
    const { wornOutfit: _worn, ...rest } = unit;
    return {
      ...rest,
      expressions: {
        ...unit.expressions,
        [LOOK_URL]: { state: "ready", at, images: { cold: { url: LOOK_FACE, ref: "global-gallery:look5-cold" } } },
      },
      cutouts: { ...unit.cutouts, [LOOK_FACE]: ready(LOOK_FACE) },
    };
  });
  const replay = await firstWear();
  assert.deepEqual(replay.looks[KAI], {
    worn: { id: LOOK, url: clean(LOOK_URL) },
    expressions: { cold: clean(LOOK_FACE) },
    cut: [clean(LOOK_URL), clean(LOOK_FACE)],
  });
  assert.deepEqual(replay.faces[KAI], { cold: clean(LOOK_FACE) });

  // Worn now, the new look is his stage look already: the run's own worn look and faces show it.
  await setKai((unit) => ({ ...unit, wornOutfit: LOOK }));
  const worn = await firstWear();
  assert.equal(worn.looks, undefined);
  assert.deepEqual(worn.faces[KAI], { cold: clean(LOOK_FACE) });
  t.noPaidWork();
});
