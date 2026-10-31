// Explicit expression repainting uses the existing paid-image lifecycle, keeps a usable set while replacing it,
// and passes the configured image style through both prose and tagged provider prompts.
import assert from "node:assert/strict";
import test from "node:test";
import {
  FACE_LOOKS,
  FACES,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/faces.ts";
import { createOtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import { galleryRefIds } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import {
  playerId,
  runDocTarget,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerSetupRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/setup.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { readyFaces } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  artWorld,
  beat,
  routesOf,
  saveBeat,
  seedChapter,
  setImages,
  until,
  type PaidCall,
} from "./fixtures/otome-forge-art.ts";
import { at, bible, KAI, MIR } from "./fixtures/otome-forge-story.ts";

const BASE = "/api/global-gallery/file/kai-neutral.png";
const WORN = "/api/global-gallery/file/kai-harbour-coat.png";
const PROMPT = "/runs/:run/art/expressions/prompt";
const REPAINT = "/runs/:run/art/expressions";
const STYLE = `CUSTOM STYLE: ${"copper etching; ".repeat(16)}KEEP THE FINAL STYLE WORDS`;
const POSITIVE = "PROFILE POSITIVE: finely engraved shading";
const NEGATIVE = "PROFILE NEGATIVE: low quality, blurry";
const oldImages = () =>
  Object.fromEntries(
    FACES.map((face) => [
      face,
      { url: `/api/global-gallery/file/prior-${face}.png`, ref: `global-gallery:prior-${face}` },
    ]),
  );

async function repaintWorld(
  runKey: string,
  {
    tagged = true,
    worn = true,
    prior = true,
    before,
  }: {
    tagged?: boolean;
    worn?: boolean;
    prior?: boolean;
    before?: (call: PaidCall, n: number) => void | Promise<void>;
  } = {},
) {
  const t = await artWorld({ runKey, images: { expressions: true, style: STYLE }, before });
  t.images.styleProfile = async () => ({
    styleText: "PROFILE STYLE REPLACED BY SETTINGS",
    positiveTags: POSITIVE,
    negativeTags: NEGATIVE,
    tagged,
  });
  const references: string[] = [];
  const readImage = t.images.cardAvatarImage;
  t.images.cardAvatarImage = async (path) => {
    references.push(path);
    return readImage(path);
  };
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: BASE,
    portraitRef: "global-gallery:neutral-original",
    identityLine: "tall man, grey eyes, salt-white hair",
    outfitLine: "keeper's coat",
    bible: bible({ look: { identityLine: "tall man", outfitLine: "keeper's coat", presentation: "man" } }),
    outfits: [{ id: "harbour-coat", name: "Harbour coat", outfitLine: "navy wool coat", url: WORN, at }],
    ...(worn ? { wornOutfit: "harbour-coat" } : {}),
    expressions: prior ? { [worn ? WORN : BASE]: { state: "ready", at, images: oldImages() } } : {},
    cutouts: { [BASE]: { state: "ready", at, url: `${BASE}.cut.png` } },
  }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    about: "",
  }));
  await seedChapter(t.store, t.runId);
  await saveBeat(t.store, t.runId, beat(0, { readThrough: 1, choiceCanon: { kept: "accepted" } }));
  const art = createOtomeArt(t.deps);
  const submitted: Array<Parameters<typeof art.repaintExpressions>[2]> = [];
  const call = routesOf(
    registerSetupRoutes,
    {
      ...t.deps,
      art: {
        ...art,
        repaintExpressions(...args: Parameters<typeof art.repaintExpressions>) {
          submitted.push(structuredClone(args[2]));
          return art.repaintExpressions(...args);
        },
      },
    },
    runKey,
  );
  const unit = async (li = KAI) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  const world = async () => (await t.store.readDoc(`${t.runId}:world`, normalizeWorld))!;
  const shown = async () => readyFaces(await world(), await unit());
  const retained = () =>
    Object.fromEntries(
      [...t.fake.rows].map(([id, row]) => {
        const { expressions: _expressions, ...data } = row.data as Record<string, unknown>;
        return [id, structuredClone(data)];
      }),
    );
  const accounted = async (ids: string[]) => {
    const refs = galleryRefIds(await unit());
    for (const id of ids)
      assert.ok(refs.includes(id) || t.deleted.includes(id), `gallery image ${id} remains tracked or is deleted`);
  };
  return { ...t, art, call, unit, world, shown, retained, accounted, references, submitted };
}

async function flush() {
  for (let turn = 0; turn < 6; turn += 1) await new Promise((resolve) => setImmediate(resolve));
}

test("expression preview and paid edits retain the complete configured style, profile tags, safety and debug setting", async (context) => {
  for (const tagged of [false, true]) {
    const t = await repaintWorld(`r-restyle${tagged ? "tag" : "prose"}-aaaaaa`, { tagged, worn: tagged });
    const expectedBase = tagged ? WORN : BASE;
    context.after(() => t.art.dispose());
    const before = t.retained();
    const preview = await t.call("POST", PROMPT, { li: KAI });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.base, expectedBase);
    assert.deepEqual(Object.keys(preview.body.prompts).sort(), [...FACES].sort());
    assert.deepEqual(t.paid, [], "reviewing five prompts never pays for a picture");
    for (const face of FACES) {
      const prompt = preview.body.prompts[face];
      assert.ok(prompt.prompt.includes(STYLE), "the full configured style reaches the preview");
      assert.ok(prompt.prompt.includes(POSITIVE));
      assert.ok(!prompt.prompt.includes("PROFILE STYLE REPLACED BY SETTINGS"));
      assert.match(prompt.prompt, /adult man/);
      assert.match(prompt.prompt, /clothing coverage/);
      assert.match(prompt.negativePrompt, /child, childlike, minor, underage/);
      assert.ok(prompt.negativePrompt.includes(NEGATIVE));
      assert.ok(prompt.prompt.includes(FACE_LOOKS[face][tagged ? 1 : 0]));
    }
    const reviewedPositive = ` \t${preview.body.prompts.tender.prompt} USER REVIEWED THE TENDER FACE.\n `;
    const reviewedNegative = ` \n${preview.body.prompts.tender.negativePrompt}, USER REVIEW NEGATIVE\t `;
    preview.body.prompts.tender.prompt = reviewedPositive;
    preview.body.prompts.tender.negativePrompt = reviewedNegative;
    preview.body.prompts.flustered.negativePrompt = "";
    preview.body.prompts.cold.negativePrompt = " \t\n ";
    const painted = await t.call("POST", REPAINT, { li: KAI, ...preview.body });
    assert.equal(painted.status, 200, JSON.stringify(painted.body));
    assert.equal(painted.body.paint.state, "ready");
    assert.equal(
      t.submitted[0]!.prompts!.tender!.prompt,
      reviewedPositive,
      "route validation does not trim reviewed positives",
    );
    assert.equal(
      t.submitted[0]!.prompts!.tender!.negativePrompt,
      reviewedNegative,
      "route validation does not trim reviewed negatives",
    );
    assert.equal(t.submitted[0]!.prompts!.flustered!.negativePrompt, "", "an empty reviewed negative remains allowed");
    assert.equal(
      t.submitted[0]!.prompts!.cold!.negativePrompt,
      " \t\n ",
      "a whitespace-only reviewed negative remains allowed",
    );
    assert.equal(t.paid.length, FACES.length);
    for (const { request } of t.paid) {
      assert.equal(request.connectionId, "conn-image");
      assert.ok(request.prompt.includes(STYLE));
      assert.ok(request.prompt.includes(POSITIVE));
      assert.ok(request.negativePrompt.includes(NEGATIVE));
      assert.match(request.negativePrompt, /nudity, sexual content/);
      assert.equal(request.debugMode, true);
      assert.deepEqual(request.referenceImages, ["data:image/png;base64,iVBORw0KGgo="]);
    }
    assert.match(t.paid[0]!.request.prompt, /USER REVIEWED THE TENDER FACE/);
    assert.match(t.paid[0]!.request.negativePrompt, /USER REVIEW NEGATIVE/);
    assert.ok(t.references.length > 0);
    assert.ok(
      t.references.every((url) => url === expectedBase),
      "the current worn or neutral look is the only image reference",
    );
    assert.deepEqual(t.retained(), before, "neutral art, clothes, bible, story and progress are unchanged");
    assert.deepEqual(t.calls, [], "expressions do not call a text model");
  }
});

test("reviewed prose prompts keep one final safety sentence and preserve long quoted wording", async (context) => {
  const t = await repaintWorld("r-retail-aaaaaa", { tagged: false });
  context.after(() => t.art.dispose());
  const preview = await t.call("POST", PROMPT, { li: KAI });
  assert.equal(preview.status, 200);
  const tail = preview.body.prompts.tender.prompt.match(/A nonsexual facial-expression edit[^.]+\.$/)?.[0];
  assert.ok(tail);
  assert.match(tail, /adult man.*clothing coverage.*art style/);
  const unchanged = await t.call("POST", REPAINT, { li: KAI, ...preview.body });
  assert.equal(unchanged.body.paint.state, "ready");
  for (const [index, face] of FACES.entries()) {
    assert.equal(
      t.paid[index]!.request.prompt,
      preview.body.prompts[face].prompt,
      "reviewing unchanged prose is idempotent",
    );
    assert.equal(t.paid[index]!.request.prompt.split(tail).length - 1, 1);
  }
  const longQuoted = `Quoted reference: "${tail}" Keep the reference pose. ${"Full custom prose detail. ".repeat(200)}FINAL DETAIL.`;
  assert.ok(longQuoted.length > 4000);
  preview.body.prompts.tender.prompt = longQuoted;
  const longNegative = `${"Full custom negative. ".repeat(220)}KEEP FINAL NEGATIVE WORDS`;
  assert.ok(longNegative.length > 4000);
  preview.body.prompts.tender.negativePrompt = longNegative;
  const edited = await t.call("POST", REPAINT, { li: KAI, ...preview.body });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.paint.state, "ready");
  const sent = t.paid[FACES.length]!.request;
  assert.equal(
    sent.prompt,
    `${longQuoted} ${tail}`,
    "a quoted earlier sentence never replaces the required final tail",
  );
  assert.ok(sent.negativePrompt.includes(longNegative), "reviewed negatives are not capped or truncated");
  assert.ok(sent.prompt.includes("FINAL DETAIL."), "reviewed prose is not capped or truncated");
});

test("concurrent explicit repaint requests share five edits and keep the previous usable set until success", async (context) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const t = await repaintWorld("r-reshared-bbbbbb", {
    before: async (_call, n) => {
      if (n === 1) await gate;
    },
  });
  context.after(() => {
    release();
    t.art.dispose();
  });
  const before = t.retained();
  const previous = await t.shown();
  const first = t.call("POST", REPAINT, { li: KAI, base: WORN });
  await until(() => t.paid.length === 1, "the first replacement face");
  assert.deepEqual(await t.shown(), previous, "a paid call in flight does not hide usable faces");
  const second = t.call("POST", REPAINT, { li: KAI, base: WORN });
  release();
  const responses = await Promise.all([first, second]);
  for (const response of responses) {
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.paint.state, "ready");
  }
  assert.equal(t.paid.length, FACES.length, "both taps share one five-face repaint");
  const completed = await t.shown();
  assert.deepEqual(Object.keys(completed ?? {}).sort(), [...FACES].sort());
  for (const face of FACES) assert.notEqual(completed?.[face], previous?.[face]);
  await t.accounted(FACES.map((face) => `prior-${face}`));
  assert.deepEqual((await t.unit(MIR)).expressions, {}, "another love interest is never repainted");
  t.art.queueExpressions(t.runId, beat(0), { debugMode: true });
  t.art.queueExpressions(t.runId, beat(0), { debugMode: true });
  await flush();
  assert.equal(t.paid.length, FACES.length, "serving and replaying the beat does not repaint a completed set");
  assert.deepEqual(t.retained(), before);
  assert.deepEqual(t.calls, []);
});

test("only identical reviewed prompts join an in-flight repaint, independent of object key order", async (context) => {
  for (const difference of ["positive", "negative", "implicit"] as const) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = await repaintWorld(`r-re${difference}-hhhhhh`, {
      before: async (_call, n) => {
        if (n === 1) await gate;
      },
    });
    context.after(() => {
      release();
      t.art.dispose();
    });
    const before = t.retained();
    const previous = await t.shown();
    const preview = await t.call("POST", PROMPT, { li: KAI });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    const prompts = preview.body.prompts;
    const longPositive = `${"Reviewed A positive detail. ".repeat(180)}KEEP A FINAL POSITIVE WORDS`;
    const longNegative = `${"Reviewed A negative detail. ".repeat(180)}KEEP A FINAL NEGATIVE WORDS`;
    assert.ok(longPositive.length > 4000 && longNegative.length > 4000);
    prompts.tender.prompt += ` ${longPositive}`;
    prompts.tender.negativePrompt += `, ${longNegative}`;
    const conflicting = structuredClone(prompts);
    if (difference === "negative") conflicting.cold.negativePrompt += ", CONFLICTING B NEGATIVE";
    else conflicting.cold.prompt += " CONFLICTING B POSITIVE";
    const reordered = Object.fromEntries(
      [...FACES]
        .reverse()
        .map((face) => [face, { negativePrompt: prompts[face].negativePrompt, prompt: prompts[face].prompt }]),
    );
    const explicit = difference !== "implicit";
    const first = t.call("POST", REPAINT, { li: KAI, base: WORN, ...(explicit ? { prompts } : {}) });
    await until(() => t.paid.length === 1, "the first gated reviewed repaint");
    assert.deepEqual(await t.shown(), previous, "a conflicting request never replaces the visible old set");
    const second = t.call("POST", REPAINT, { li: KAI, base: WORN, prompts: conflicting });
    const duplicate = t.call("POST", REPAINT, {
      li: KAI,
      base: WORN,
      ...(explicit ? { prompts: reordered } : {}),
    });
    await flush();
    release();
    const [accepted, rejected, shared] = await Promise.all([first, second, duplicate]);
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.paint.state, "ready");
    assert.equal(rejected.status, 409, `${difference} prompt changes must not join an existing paid job`);
    assert.equal(shared.status, 200, JSON.stringify(shared.body));
    assert.deepEqual(shared.body, accepted.body, "an identical request shares the same final result");
    assert.equal(t.paid.length, FACES.length, "only the accepted five-face set is paid for");
    for (const { request } of t.paid) {
      assert.ok(!request.prompt.includes("CONFLICTING B POSITIVE"));
      assert.ok(!request.negativePrompt.includes("CONFLICTING B NEGATIVE"));
    }
    if (explicit) {
      assert.ok(t.paid[0]!.request.prompt.includes(longPositive), "long reviewed positives remain complete");
      assert.ok(t.paid[0]!.request.negativePrompt.includes(longNegative), "long reviewed negatives remain complete");
    }
    assert.deepEqual(t.retained(), before, "concurrent requests preserve neutral art, story and progress");
    assert.deepEqual(t.calls, []);
  }
});

test("a failed replacement keeps the old ready faces and accounts for every paid upload without automatic retry", async (context) => {
  const t = await repaintWorld("r-refailed-cccccc", {
    before: (_call, n) => {
      if (n === 2) throw new Error("The image provider failed.");
    },
  });
  context.after(() => t.art.dispose());
  const before = t.retained();
  const previous = await t.shown();
  const result = await t.call("POST", REPAINT, { li: KAI, base: WORN });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.paint.state, "failed");
  assert.deepEqual(await t.shown(), previous);
  assert.equal(t.paid.length, 2);
  await t.accounted([...FACES.map((face) => `prior-${face}`), ...t.uploads.map((_upload, i) => `img${i + 1}`)]);
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await flush();
  assert.equal(t.paid.length, 2, "a read or replay never retries a failed replacement");
  assert.deepEqual(t.retained(), before);
  assert.deepEqual(t.calls, []);
});

test("stale reviewed references and unavailable targets are rejected before any paid expression call", async (context) => {
  const t = await repaintWorld("r-reguards-dddddd");
  context.after(() => t.art.dispose());
  const reviewed = await t.call("POST", PROMPT, { li: KAI });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
  const before = t.retained();
  const originalArt = await t.unit();
  const blank = structuredClone(reviewed.body.prompts);
  blank.hurt.prompt = " \t\n ";
  blank.hurt.negativePrompt = "";
  const rejected = await t.call("POST", REPAINT, { li: KAI, base: reviewed.body.base, prompts: blank });
  assert.equal(rejected.status, 400, "a whitespace-only reviewed positive is rejected before paid work");
  assert.deepEqual(t.paid, []);
  assert.deepEqual(await t.unit(), originalArt, "invalid reviewed text cannot change retained artwork");
  assert.deepEqual(t.retained(), before, "invalid reviewed text cannot change story or progress");
  const unbound = await t.call("POST", REPAINT, { li: KAI, prompts: reviewed.body.prompts });
  assert.equal(unbound.status, 400, "reviewed prompts require the look they were reviewed against");
  assert.deepEqual(t.paid, [], "missing reference binding is rejected before paid work");
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    wornOutfit: undefined,
  }));
  const stale = await t.call("POST", REPAINT, { li: KAI, ...reviewed.body });
  assert.equal(stale.status, 409);
  for (const li of ["li-absent-ab12", "../../outside"]) {
    const result = await t.call("POST", REPAINT, { li });
    assert.ok(result.status >= 400 && result.status < 500, JSON.stringify(result.body));
  }
  await setImages(t.store, t.runId, { expressions: false });
  assert.ok((await t.call("POST", REPAINT, { li: KAI })).status >= 400);
  await setImages(t.store, t.runId, { expressions: true, connectionId: null });
  assert.ok((await t.call("POST", REPAINT, { li: KAI })).status >= 400);
  await setImages(t.store, t.runId, { connectionId: "conn-image" });
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    portrait: undefined,
    outfits: [],
  }));
  assert.ok((await t.call("POST", REPAINT, { li: KAI })).status >= 400);
  assert.deepEqual(t.paid, []);
  assert.deepEqual(t.calls, []);
});

test("an automatic expression set already painting rejects an explicit repaint without starting another set", async (context) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const t = await repaintWorld("r-repaintbusy-eeeeee", {
    prior: false,
    before: async (_call, n) => {
      if (n === 1) await gate;
    },
  });
  context.after(() => {
    release();
    t.art.dispose();
  });
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(() => t.paid.length === 1, "the automatic expression set");
  const result = await t.call("POST", REPAINT, { li: KAI, base: WORN });
  assert.equal(result.status, 409);
  release();
  await until(async () => (await t.unit()).expressions[WORN]?.state === "ready", "the original automatic set");
  assert.equal(t.paid.length, FACES.length);
});

test("a current look changed during a paid repaint discards that face and stops before another paid call", async (context) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const t = await repaintWorld("r-restale-ffffff", {
    before: async (_call, n) => {
      if (n === 1) await gate;
    },
  });
  context.after(() => {
    release();
    t.art.dispose();
  });
  const previous = (await t.unit()).expressions[WORN];
  const before = t.retained();
  const painting = t.call("POST", REPAINT, { li: KAI, base: WORN });
  await until(() => t.paid.length === 1, "the paid face before changing clothes");
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    wornOutfit: undefined,
  }));
  release();
  const result = await painting;
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.paint.state, "stopped");
  assert.equal(t.paid.length, 1, "no second face is paid for after the current look changes");
  const unit = await t.unit();
  assert.deepEqual((unit.expressions[WORN] as { images: unknown }).images, (previous as { images: unknown }).images);
  assert.equal(unit.expressions[BASE], undefined, "the new current look is not overwritten by the old request");
  assert.deepEqual(t.deleted, ["img1"], "a face uploaded after its target changed is not left untracked");
  const id = unitId(t.runId, KAI);
  const { wornOutfit: _worn, ...expectedUnit } = before[id];
  assert.deepEqual(
    t.retained(),
    { ...before, [id]: expectedUnit },
    "only the intentional outfit change affects retained story data",
  );
});

test("a failed explicit first set keeps partial uploads tracked across replay, reload and re-enabled retries", async (context) => {
  const t = await repaintWorld("r-renoprior-gggggg", {
    prior: false,
    before: (_call, n) => {
      if (n === 2 || n === 4) throw new Error("The image provider failed.");
    },
  });
  context.after(() => t.art.dispose());
  const before = t.retained();
  const result = await t.call("POST", REPAINT, { li: KAI, base: WORN });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.paint.state, "failed");
  assert.equal((await t.unit()).expressions[WORN]?.state, "failed");
  assert.equal(await t.shown(), undefined, "a partial failed first set is not a usable display set");
  await t.accounted(t.uploads.map((_upload, i) => `img${i + 1}`));
  t.art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await flush();
  t.art.dispose();
  const reloaded = createOtomeArt(t.deps);
  context.after(() => reloaded.dispose());
  reloaded.queueExpressions(t.runId, beat(0), { debugMode: false });
  await flush();
  assert.equal(t.paid.length, 2, "neither replay nor reload retries the failed paid request");
  assert.deepEqual(t.retained(), before);
  assert.deepEqual(t.calls, []);

  // The first authorized automatic retry fails too, leaving a retired partial upload and its own active partial.
  await setImages(t.store, t.runId, { expressions: false });
  await setImages(t.store, t.runId, { expressions: true, expressionsSince: new Date(Date.now() + 1000).toISOString() });
  reloaded.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(
    async () => t.paid.length === 4 && (await t.unit()).expressions[WORN]?.state === "failed",
    "the re-enabled partial set",
  );
  await t.accounted(t.uploads.map((_upload, i) => `img${i + 1}`));

  await setImages(t.store, t.runId, { expressions: false });
  await setImages(t.store, t.runId, { expressions: true, expressionsSince: new Date(Date.now() + 2000).toISOString() });
  const beforeRetry = t.retained();
  reloaded.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(async () => (await t.unit()).expressions[WORN]?.state === "ready", "the completed re-enabled set");
  assert.equal(t.paid.length, 8, "the final retry paints only four missing faces");
  await t.accounted(t.uploads.map((_upload, i) => `img${i + 1}`));
  assert.deepEqual(t.retained(), beforeRetry, "only expression bookkeeping changes during a retry");
});
