// Image-only appearance edits stay outside the hidden Bible and never paint by themselves.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  OtomeRequest,
  RouteDeps,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { registerSetupRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/setup.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { artWorld, routesOf } from "./fixtures/otome-forge-art.ts";
import { at, KAI } from "./fixtures/otome-forge-story.ts";

const RUN_KEY = "r-appearance-abcdef";
const PATH = "/runs/:run/lis/:li/appearance";
const BIBLE_PATH = "/runs/:run/lis/:li/bible";
const PORTRAIT = "/api/global-gallery/file/appearance-kept.png";
const FACE = "/api/global-gallery/file/appearance-face-kept.png";

function runRoutes(deps: RouteDeps, runKey = RUN_KEY, li = KAI) {
  return routesOf(
    (router, shared) => {
      const selected = (request: OtomeRequest) => ({
        ...request,
        params: { ...(request.params as Record<string, string>), li },
      });
      const bound = {
        get: (path: string, handler: Parameters<typeof router.get>[1]) =>
          router.get(path, (request, reply) => handler(selected(request), reply)),
        post: (path: string, handler: Parameters<typeof router.get>[1]) =>
          router.post(path, (request, reply) => handler(selected(request), reply)),
      };
      registerRunRoutes(bound, shared);
      registerSetupRoutes(bound, shared);
    },
    deps,
    runKey,
  );
}

async function fixture() {
  const t = await artWorld({ runKey: RUN_KEY, images: { expressions: true } });
  const cuts: string[] = [];
  const deps: RouteDeps = {
    ...t.deps,
    cutouts: {
      cutOut: async (url) => (cuts.push(url), assert.fail("appearance saves must not clean existing art")),
      deleteGalleryImage: async () => assert.fail("appearance saves must not delete a cutout"),
    },
  };
  const call = runRoutes(deps);
  // Settle the existing legacy-persona migration before measuring this endpoint's writes.
  assert.equal((await call("GET", "/runs/:run")).status, 200);
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    identityLine: "",
    portrait: PORTRAIT,
    portraitRef: "global-gallery:appearance-kept",
    art: { state: "ready", at, url: PORTRAIT, ref: "global-gallery:appearance-kept" },
    expressions: { [PORTRAIT]: { state: "ready", at, images: { cold: { url: FACE } } } },
    cutouts: Object.fromEntries(
      [PORTRAIT, FACE].map((url) => [url, { state: "failed" as const, at, error: "Kept original" }]),
    ),
    bible: {
      ...unit.bible!,
      wound: "PRIVATE-BIBLE-WOUND",
      look: { ...unit.bible!.look, identityLine: "BIBLE-DEFAULT: adult with dark eyes." },
    },
  }));
  const unit = async () => (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  const snapshot = () => Object.fromEntries([...t.fake.rows].map(([id, row]) => [id, structuredClone(row.data)]));
  const noWork = () => {
    assert.equal(t.calls.length, 0, "no text generation");
    assert.equal(t.paid.length, 0, "no paid image generation");
    assert.deepEqual(t.deleted, [], "no gallery deletion");
    assert.deepEqual(cuts, [], "no free cleanup");
  };
  return { ...t, deps, call, unit, snapshot, noWork };
}

test("appearance save keeps long authored prose and reloads it without touching the private Bible, art or progress", async () => {
  const t = await fixture();
  // An older unit may not have the image-only line yet.
  const row = t.fake.rows.get(unitId(t.runId, KAI))!;
  delete (row.data as Record<string, unknown>).identityLine;
  const before = t.snapshot();
  const original = await t.unit();
  const identityLine = `  Adult man with silver hair.\n${"A distinct scar beside the left brow.\n".repeat(160)}FINAL DETAIL\n  `;
  assert.ok(identityLine.length > 5000);
  const saved = await t.call("POST", PATH, { identityLine, bible: { wound: "UNTRUSTED" }, art: null });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body, { identityLine });
  assert.deepEqual(await t.unit(), { ...original, identityLine });
  for (const [id, data] of Object.entries(before)) {
    if (id !== unitId(t.runId, KAI)) assert.deepEqual(t.snapshot()[id], data, id);
  }
  const reloaded = await runRoutes(t.deps)("GET", "/runs/:run");
  assert.equal(reloaded.body.view.lis.find((li: { id: string }) => li.id === KAI).look.identityLine, identityLine);
  assert.ok(!JSON.stringify(saved.body).includes("PRIVATE-BIBLE"));
  t.noWork();
});

test("blank appearance restores the existing Bible fallback and an unfinished Bible is not required to save", async () => {
  const t = await fixture();
  const original = await t.unit();
  for (const identityLine of ["", " \n\t "]) {
    assert.equal((await t.call("POST", PATH, { identityLine: "An image-only override." })).status, 200);
    const reset = await t.call("POST", PATH, { identityLine });
    assert.deepEqual(reset.body, { identityLine: original.bible!.look.identityLine });
    assert.equal((await t.unit()).identityLine, "");
    assert.deepEqual((await t.unit()).bible, original.bible);
  }
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: null,
  }));
  assert.deepEqual((await t.call("POST", PATH, { identityLine: "Adult, blue eyes." })).body, {
    identityLine: "Adult, blue eyes.",
  });
  assert.equal((await t.unit()).bible, null);
  t.noWork();
});

test("bad appearance bodies and missing or unsafe run/LI paths cannot change or create documents", async () => {
  const t = await fixture();
  const before = t.snapshot();
  for (const value of [undefined, null, 3, [], {}]) {
    const result = await t.call("POST", PATH, value === undefined ? {} : { identityLine: value });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "bad-request");
  }
  for (const [runKey, li] of [
    ["r-missing-abcdef", KAI],
    ["../run", KAI],
    [RUN_KEY, "li-missing-zz99"],
    [RUN_KEY, "../li"],
  ]) {
    const result = await runRoutes(t.deps, runKey, li)("POST", PATH, { identityLine: "Rejected." });
    assert.equal(result.status, 404);
  }
  assert.deepEqual(t.snapshot(), before);
  t.noWork();
});

test("non-look Bible edits preserve an image override; an actual Bible appearance edit replaces it", async () => {
  const t = await fixture();
  for (const identityLine of ["Image override with\nits own text.", ""]) {
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
      ...unit,
      identityLine,
    }));
    const original = await t.unit();
    const bible = { ...original.bible!, wound: "A newly edited private wound." };
    assert.equal((await t.call("POST", BIBLE_PATH, { bible })).status, 200);
    assert.equal((await t.unit()).identityLine, identityLine, "only non-look Bible fields changed");
    assert.deepEqual((await t.unit()).art, original.art);
    assert.deepEqual((await t.unit()).expressions, original.expressions);
  }
  const unit = await t.unit();
  const bible = { ...unit.bible!, look: { ...unit.bible!.look, identityLine: "New canonical drawing description." } };
  assert.equal((await t.call("POST", BIBLE_PATH, { bible })).status, 200);
  assert.equal((await t.unit()).identityLine, bible.look.identityLine);
  t.noWork();
});

test("an appearance update preserves a concurrent Bible write and only the next explicit repaint uses the new line", async () => {
  const t = await fixture();
  t.fake.interfere(unitId(t.runId, KAI), (data) => ({
    ...data,
    bible: { ...data.bible, wound: "CONCURRENT-PRIVATE-WOUND" },
  }));
  const identityLine = `Adult man, copper hair.\n${"Green eyes and a hooked nose.\n".repeat(160)}FINAL REPAINT DETAIL`;
  assert.ok(identityLine.length > 4000);
  assert.equal((await t.call("POST", PATH, { identityLine })).status, 200);
  assert.equal((await t.unit()).bible!.wound, "CONCURRENT-PRIVATE-WOUND");
  t.noWork();
  const target = { kind: "look", owner: `li:${KAI}` };
  const preview = await t.call("POST", "/runs/:run/art/prompt", { target });
  assert.equal(preview.status, 200);
  assert.ok(preview.body.prompt.includes(identityLine));
  t.noWork();
  const painted = await t.call("POST", "/runs/:run/art/paint", { target });
  assert.equal(painted.status, 200);
  assert.equal(painted.body.paint.state, "ready");
  assert.equal(t.paid.length, 1, "only the explicit repaint makes an image call");
  assert.ok(t.paid[0]!.request.prompt.includes(identityLine));
  assert.equal(t.calls.length, 0);
  assert.equal((await t.unit()).bible!.wound, "CONCURRENT-PRIVATE-WOUND");
});
