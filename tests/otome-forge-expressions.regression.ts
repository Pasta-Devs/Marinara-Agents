// Otome Forge M2b: the five expression faces, through the forge kit's createForgeStoryExpressions with Otome's options
// (S/art/expressions.ts). A fake image client counts every paid call.
import assert from "node:assert/strict";
import test from "node:test";
import type { Unit } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { FACES } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/faces.ts";
import { createOtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import {
  runDocTarget,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  facesComing,
  readyFaces,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { artWorld, beat, setImages, until, type PaidCall } from "./fixtures/otome-forge-art.ts";
import { KAI, MIR, bible } from "./fixtures/otome-forge-story.ts";

const PORTRAIT = "/api/global-gallery/file/kai-look.png";

type SetRecord = { state: string; at: string; error?: string; images?: Record<string, { url: string; ref: string }> };

/** The story world with Kai's look painted (his portrait is the faces' base), and the art service. */
async function facesWorld(runKey: string, before?: (call: PaidCall, n: number) => void | Promise<void>) {
  const world = await artWorld({ runKey, before });
  const { store, runId } = world;
  await store.updateDoc(runDocTarget("unit", unitId(runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: PORTRAIT,
    portraitRef: "global-gallery:kai-look",
    identityLine: "tall man, grey eyes, salt-white hair",
    outfitLine: "keeper's coat",
    bible: bible({ look: { identityLine: "tall man", outfitLine: "keeper's coat", presentation: "man" } }),
  }));
  // Mireille has a look too, but says nothing in the beat.
  await store.updateDoc(runDocTarget("unit", unitId(runId, MIR)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: "/api/global-gallery/file/mireille-look.png",
  }));
  const art = createOtomeArt({ runtime: world.runtime, store, images: world.images });
  const unit = async (li = KAI) => (await store.readDoc(unitId(runId, li), normalizeUnit))!;
  const set = async () => (await unit()).expressions[PORTRAIT] as SetRecord | undefined;
  return { ...world, art, unit, set };
}

const settled = (record: SetRecord | undefined) => !!record && record.state !== "pending";

test("a speaking love interest gets his five faces once, edits of his look carrying the rating and an adult tag", async () => {
  const t = await facesWorld("r-m2bexpr1-aaaaaa");
  t.art.queueExpressions(t.runId, beat(0), { debugMode: true });
  await until(async () => settled(await t.set()), "Kai's faces");
  const record = (await t.set())!;
  assert.equal(record.state, "ready");
  assert.deepEqual(Object.keys(record.images ?? {}).sort(), [...FACES].sort());
  assert.equal(t.paid.length, 5, "one paid image per face");
  for (const call of t.paid) {
    assert.equal(call.method, "generateImage");
    assert.equal(call.request.connectionId, "conn-image");
    assert.deepEqual(
      call.request.referenceImages,
      ["data:image/png;base64,iVBORw0KGgo="],
      "his look is the only reference",
    );
    assert.equal(call.request.debugMode, true, "the Engine logs each face's prompt in debug mode");
    assert.match(call.request.prompt, /change ONLY the facial expression/);
    assert.match(call.request.prompt, /safe for work, fully clothed, adult man/);
    assert.match(call.request.negativePrompt, /child, childlike, minor, underage/);
    assert.match(call.request.negativePrompt, /nudity, nsfw/);
  }
  assert.ok(
    t.paid.some((call) => call.request.prompt.includes("a hurt expression: drawn brows, glassy eyes")),
    "Otome's own looks, not the kit's four",
  );
  // Mireille spoke no line: nothing is painted for her.
  assert.equal(Object.keys((await t.unit(MIR)).expressions).length, 0);
  const world = (await t.store.readDoc(`${t.runId}:world`, normalizeWorld))!;
  assert.deepEqual(Object.keys(readyFaces(world, await t.unit()) ?? {}).sort(), [...FACES].sort());

  // Serving the beat again pays for nothing.
  t.art.queueExpressions(t.runId, beat(0), { debugMode: true });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(t.paid.length, 5);
  const warnings = t.logs.filter((entry) => entry.level === "warn").map((entry) => entry.message);
  assert.ok(!warnings.some((message) => /ReferenceError|is not defined/.test(message)), warnings.join("\n"));
  t.art.dispose();
});

test("a failed set is never repainted by itself; turning expressions on again paints only its missing faces", async () => {
  const t = await facesWorld("r-m2bexpr2-bbbbbb", (_call, n) => {
    if (n === 2) throw new Error("provider down");
  });
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(async () => settled(await t.set()), "the failed set");
  const failed = (await t.set())!;
  assert.equal(failed.state, "failed");
  assert.equal(Object.keys(failed.images ?? {}).length, 1, "the face that landed is filed");
  assert.equal(t.paid.length, 2);

  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(t.paid.length, 2, "never retried automatically");

  // Off and on again after the failure (the settings route stamps expressionsSince): one more attempt.
  await setImages(t.store, t.runId, { expressions: true, expressionsSince: new Date(Date.now() + 1000).toISOString() });
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(async () => (await t.set())?.state === "ready", "the resumed set");
  assert.equal(t.paid.length, 6, "only the four missing faces are painted");
  t.art.dispose();
});

test("the reader waits only for faces still being painted, never for a failed, stopped or missing set", async () => {
  const t = await facesWorld("r-m2bexpr9-ffffff");
  const world = (await t.store.readDoc(`${t.runId}:world`, normalizeWorld))!;
  const on = { images: { ...world.images, expressions: true } };
  const kai = await t.unit();
  const withSet = (state?: string): Unit => ({
    ...kai,
    expressions: state ? { [PORTRAIT]: { state, at: "2026-10-28T00:00:00.000Z" } } : {},
  });
  assert.equal(facesComing(on, withSet()), true, "a set not started yet may still come");
  assert.equal(facesComing(on, withSet("pending")), true);
  for (const state of ["ready", "failed", "stopped"]) assert.equal(facesComing(on, withSet(state)), false, state);
  assert.equal(facesComing(on, { ...withSet(), portrait: undefined }), false, "no look, no faces");
  assert.equal(
    facesComing({ images: { ...world.images, expressions: false } }, withSet("pending")),
    false,
    "faces off",
  );
});

test("turning expressions off parks the set before its next paid call, and it resumes without repainting", async () => {
  let world: Awaited<ReturnType<typeof facesWorld>> | null = null;
  const t = await facesWorld("r-m2bexpr3-cccccc", async (_call, n) => {
    if (n === 1) await setImages(world!.store, world!.runId, { expressions: false });
  });
  world = t;
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(async () => settled(await t.set()), "the parked set");
  const parked = (await t.set())!;
  assert.equal(parked.state, "stopped");
  assert.equal(t.paid.length, 1, "no paid call once the toggle is off");

  // While off, serving beats queues nothing.
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(t.paid.length, 1);

  await setImages(t.store, t.runId, { expressions: true });
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(async () => (await t.set())?.state === "ready", "the resumed set");
  assert.equal(t.paid.length, 5, "the filed face is kept");
  t.art.dispose();
});

test("no image connection, or a torn-down service, pays for nothing", async () => {
  const t = await facesWorld("r-m2bexpr4-dddddd");
  await setImages(t.store, t.runId, { connectionId: null });
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(t.paid.length, 0);

  await setImages(t.store, t.runId, { connectionId: "conn-image" });
  t.art.dispose();
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(t.paid.length, 0);
  assert.equal(Object.keys((await t.unit()).expressions).length, 0);
});

test("a repainted look leaves its old faces unused: the next scene prunes them and deletes their images", async () => {
  const t = await facesWorld("r-m2bexpr5-eeeeee");
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(async () => (await t.set())?.state === "ready", "Kai's faces");
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit: Unit) => ({
    ...unit,
    portrait: "/api/global-gallery/file/kai-look-2.png",
  }));
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(async () => {
    const record = (await t.unit()).expressions["/api/global-gallery/file/kai-look-2.png"] as SetRecord | undefined;
    return record?.state === "ready";
  }, "the new look's faces");
  const unit = await t.unit();
  assert.deepEqual(Object.keys(unit.expressions), ["/api/global-gallery/file/kai-look-2.png"]);
  assert.equal(t.deleted.length, 5, "the old look's five faces leave the gallery");
  assert.equal(t.paid.length, 10);
  t.art.dispose();
});
