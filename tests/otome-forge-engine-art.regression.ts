// Otome Hearth's "Use Engine art first" (#2147, S/art/engine-art.ts): a card love interest stands in his Engine sprites
// (else his card avatar) and the protagonist in her persona avatar before anything is painted; his sprites bring the
// faces they have, and the kit pays only for the missing ones, never under Ask before painting; a painted look is never
// replaced; an adopted avatar follows a new one; their paint steps are done, also for a connection added later;
// avatars are never cut out; Photo Shoot keeps their likeness; and a place can show a background from the Engine's
// library, painting nothing and keeping a painting it replaces. A fake image client counts every paid call.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type {
  Unit,
  WardrobeView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { ARCHETYPE_IDS } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/archetypes.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import { FACES } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/faces.ts";
import {
  cutoutView,
  cutoutsSettled,
  queueCutouts,
  type CutoutClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import {
  engineArtPath,
  engineLook,
  forgetEngineLook,
  personaAvatarPath,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/engine-art.ts";
import { createOtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import {
  createImageClient,
  galleryRefIds,
  type ImageClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import { startPaint } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { paintBeatPlaces } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/places.ts";
import {
  createHandle,
  type RouteDeps,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  playerId,
  runDocTarget,
  runIdOf,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerArtRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/art.ts";
import {
  backdropOf,
  registerHomeRoutes,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { registerSetupRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/setup.ts";
import { wardrobeView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/wardrobe.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  normalizeState,
  readyFaces,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { forgeSettled } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/forge.ts";
import { createOtomeStore } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { artWorld, beat, fakeImages, routesOf, setImages, until } from "./fixtures/otome-forge-art.ts";
import { createFakeDocuments, createFakeRuntime } from "./fixtures/otome-forge-fakes.ts";
import { KAI, MIR, SOL, at } from "./fixtures/otome-forge-story.ts";

const HE = { subject: "he", object: "him", possessive: "his" };
const SHE = { subject: "she", object: "her", possessive: "her" };
const GALLERY = "/api/global-gallery/file";
const sprite = (owner: string, stem: string) => ({ expression: stem, url: `/api/sprites/${owner}/file/${stem}.png` });
const spritesOf = (owner: string, ...stems: string[]) => stems.map((stem) => sprite(owner, stem));
/** All five faces in a card's full-body family (cold from smirk). */
const FULL_FIVE = ["full_neutral", "full_love", "full_blushing", "full_smirk", "full_sad", "full_angry"];
const AVA = "/api/avatars/file/ava.png";
const BG_HARBOUR = "/api/backgrounds/file/harbour.png";
const BG_GLADE = "/api/game-assets/file/backgrounds/forest/glade.webp";

type Personas = { listPersonas(ids?: string[]): Promise<Array<{ id: string; data: unknown }>> };

/**
 * The Engine art the fake client reads (a persona's avatar from the runtime's records, as the Engine keeps it), and how
 * often it read each card's sprites.
 */
function engineArt(
  { images, runtime }: { images: ImageClient; runtime: { resources: Personas } },
  {
    sprites = {} as Record<string, Array<{ expression: string; url: string }>>,
    avatars = {} as Record<string, string>,
    persona = "",
    backgrounds = [] as string[],
  } = {},
) {
  const reads: string[] = [];
  const art = { sprites, avatars, persona };
  images.sprites = async (owner) => (reads.push(owner), art.sprites[owner] ?? []);
  images.characterCard = async (cardId) => (cardId in art.avatars ? { avatarPath: art.avatars[cardId]! } : null);
  const listPersonas = runtime.resources.listPersonas;
  runtime.resources.listPersonas = async (ids) => {
    const rows = await listPersonas(ids);
    const found = rows.length ? rows : (ids ?? []).map((id) => ({ id, data: {} }));
    return found.map((row) => ({ ...row, data: { ...(row.data as object), avatarPath: art.persona } }));
  };
  images.backgrounds = async () => backgrounds.map((url) => ({ url, filename: url.split("/").pop()!, tags: [] }));
  return { reads, art };
}

/** A free cut-out client that records what it was asked to cut. */
function fakeCutouts() {
  const cut: string[] = [];
  const client: CutoutClient = {
    cutOut: async (url) => {
      cut.push(url);
      return { id: `cut${cut.length}`, url: `${GALLERY}/cut-${cut.length}.png` };
    },
    deleteGalleryImage: async () => true,
  };
  return { cut, client };
}

const readUnit = async (t: { store: ReturnType<typeof createOtomeStore>; runId: string }, li: string) =>
  (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
const readPlayer = async (t: { store: ReturnType<typeof createOtomeStore>; runId: string }) =>
  (await t.store.readDoc(playerId(t.runId), normalizePlayer))!;
const stepsOf = (forge: { steps: Array<{ id: string; state: string }> }) =>
  Object.fromEntries(forge.steps.map((step) => [step.id, step.state]));

test("engineLook: a card's full body with its faces, else its neutral bust, else its avatar; a persona's avatar only", async () => {
  const client = (sprites: Array<{ expression: string; url: string }>, card?: string | Error) => ({
    sprites: async () => sprites,
    characterCard: async () => {
      if (card instanceof Error) throw card;
      return card === undefined ? null : { avatarPath: card };
    },
  });
  const full = (stem: string) => `/api/sprites/card-kai/file/${stem}.png`;
  assert.deepEqual(
    await engineLook(
      client(spritesOf("card-kai", "full_neutral", "full_love", "full_blushing", "full_sad", "full_angry", "happy")),
      "card-kai",
    ),
    {
      url: full("full_neutral"),
      faces: {
        tender: full("full_love"),
        flustered: full("full_blushing"),
        hurt: full("full_sad"),
        angry: full("full_angry"),
      },
    },
    "the full-body family only, and no cold face without a cold sprite",
  );
  assert.deepEqual(
    await engineLook(client(spritesOf("card-kai", "neutral", "happy", "smirk", "full_angry")), "card-kai"),
    { url: full("neutral"), faces: { tender: full("happy"), cold: full("smirk") } },
    "without full_neutral the neutral bust is the base, with the bust faces",
  );
  assert.deepEqual(
    await engineLook(client(spritesOf("card-kai", "full_happy"), "/api/avatars/file/kai.png"), "card-kai"),
    { url: "/api/avatars/file/kai.png", faces: {}, avatar: true },
    "no neutral sprite: the card avatar, with no faces",
  );
  assert.equal(await engineLook(client([], ""), "card-kai"), null);
  assert.equal(await engineLook(client([]), "card-gone"), null);
  for (const avatarPath of ["https://x.example/y.png", "/api/avatars/file/../a.png", "data:image/png;base64,AAAA"]) {
    assert.equal(await engineLook(client([], avatarPath), "card-kai"), null, avatarPath);
  }
  // Only a card that is gone has no avatar: any other failed read throws, so the owner is tried again later.
  const gone = Object.assign(new Error("engine /api/characters/card-gone -> 404"), { status: 404 });
  assert.equal(await engineLook(client([], gone), "card-gone"), null);
  const busy = Object.assign(new Error("engine /api/characters/card-kai -> 503"), { status: 503 });
  await assert.rejects(engineLook(client([], busy), "card-kai"), /503/u);

  const personas = (data: unknown, fail = false) => ({
    resources: {
      listPersonas: async (ids?: string[]) => {
        if (fail) throw new Error("the Engine is busy");
        return (ids ?? []).map((id) => ({ id, data }));
      },
    },
  });
  assert.equal(await personaAvatarPath(personas({ avatarPath: AVA }), "persona-ava"), AVA);
  assert.equal(await personaAvatarPath(personas(JSON.stringify({ avatarPath: AVA })), "persona-ava"), AVA);
  assert.equal(await personaAvatarPath(personas({ avatarPath: "https://x.example/ava.png" }), "persona-ava"), "");
  assert.equal(await personaAvatarPath(personas({}), "persona-ava"), "");
  assert.equal(await personaAvatarPath(personas({ avatarPath: AVA }), ""), "");
  await assert.rejects(personaAvatarPath(personas({}, true), "persona-ava"), /busy/u);
});

test("the loopback client builds sprite and background paths itself and keeps only safe raster files", async () => {
  const asked: string[] = [];
  const client = createImageClient({
    baseUrl: "http://engine.test",
    fetch: (async (input: string) => {
      const path = new URL(input).pathname;
      asked.push(path);
      if (path === "/api/sprites/card-kai")
        return Response.json([
          { expression: "full_neutral", filename: "full_neutral.png", url: "/api/sprites/card-kai/file/x?v=99" },
          { expression: "Happy", filename: "Happy.webp" },
          { expression: "logo", filename: "logo.svg" },
          { expression: "../evil", filename: "../evil.png" },
          { expression: "a b", filename: "a b.png" },
          { expression: "sad", filename: "other.png" },
        ]);
      if (path === "/api/backgrounds")
        return Response.json([
          { url: BG_HARBOUR, filename: "harbour.png", tags: ["night", 3], favorite: true },
          { url: BG_GLADE, filename: "glade.webp", tags: ["forest"] },
          { url: "/api/game-assets/file/backgrounds/icon.svg", filename: "icon.svg" },
          { url: "https://evil.example/x.png", filename: "x.png" },
          { url: "/api/backgrounds/file/../secret.png", filename: "secret.png" },
        ]);
      return new Response("{}", { status: 404 });
    }) as typeof fetch,
  });
  assert.deepEqual(await client.sprites!("card-kai"), [
    { expression: "full_neutral", url: "/api/sprites/card-kai/file/full_neutral.png" },
    { expression: "happy", url: "/api/sprites/card-kai/file/Happy.webp" },
  ]);
  assert.deepEqual(await client.sprites!("../card-kai"), []);
  assert.deepEqual(await client.sprites!("a/b"), []);
  assert.deepEqual(await client.backgrounds!(), [
    { url: BG_HARBOUR, filename: "harbour.png", tags: ["night"] },
    { url: BG_GLADE, filename: "glade.webp", tags: ["forest"] },
  ]);
  assert.deepEqual(asked, ["/api/sprites/card-kai", "/api/backgrounds"], "unsafe owner ids are never asked for");

  for (const path of ["/api/sprites/card-kai/file/full_neutral.png", `${GALLERY}/x.png`, AVA])
    assert.equal(engineArtPath(path), path, path);
  for (const path of [
    "/api/sprites/card-kai/file/full_neutral.png?v=1",
    "/api/sprites/..%2Fx/file/a.png",
    "/api/sprites/a/file/%2e%2e",
    "/api/sprites/a/file/b/c.png",
    BG_HARBOUR,
    "https://x.example/a.png",
  ])
    assert.equal(engineArtPath(path), "", path);
});

test("POST /runs: card love interests and the protagonist start in their Engine art, their paint steps done, unpaid", async () => {
  const fake = createFakeDocuments();
  const store = createOtomeStore(fake.documents);
  const { runtime } = createFakeRuntime({
    documents: fake.documents,
    characters: [
      { id: "card-kai", data: { name: "Kai" } },
      { id: "card-vale", data: { name: "Vale" } },
    ],
    personas: [{ id: "persona-ava", data: { name: "Ava" } }],
  });
  const paints = fakeImages();
  engineArt(
    { images: paints.images, runtime },
    {
      sprites: {
        "card-kai": spritesOf("card-kai", ...FULL_FIVE),
        "card-vale": spritesOf("card-vale", "full_neutral", "full_love"),
      },
      persona: AVA,
    },
  );
  const deps: RouteDeps = { runtime, store, handle: createHandle(runtime.logger), images: paints.images };
  const call = routesOf(registerRunRoutes, deps, "");
  const created = await call("POST", "/runs", {
    setup: {
      title: "",
      premise: "A masked court where every vow binds.",
      language: "English",
      protagonist: { personaId: "persona-ava", pronouns: SHE, traits: [], goal: "" },
      lis: [
        { source: "card", cardId: "card-kai", pronouns: HE },
        { source: "card", cardId: "card-vale", pronouns: HE },
        { source: "archetype", archetype: ARCHETYPE_IDS[0], name: "Sol", pronouns: HE },
      ],
      content: defaultContent(),
      images: { connectionId: "conn-image", rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
    },
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const runId = runIdOf(created.body.run);
  const t = { store, runId };
  const [kai, vale, sol] = created.body.view.lis as Array<{ id: string; portrait?: string }>;
  const kaiBase = "/api/sprites/card-kai/file/full_neutral.png";
  assert.equal(kai!.portrait, kaiBase);
  assert.equal(sol!.portrait, undefined, "an archetype has no Engine art");
  const kaiUnit = await readUnit(t, kai!.id);
  assert.deepEqual(kaiUnit.art, { state: "ready", at: kaiUnit.art!.at, url: kaiBase });
  assert.equal(kaiUnit.portraitRef, undefined, "no gallery ref: nothing of the Engine's is ever deleted");
  assert.deepEqual(galleryRefIds(kaiUnit), []);
  const kaiSet = kaiUnit.expressions[kaiBase] as { state: string; images: Record<string, { url: string }> };
  assert.equal(kaiSet.state, "ready", "all five faces found");
  assert.deepEqual(Object.keys(kaiSet.images).sort(), [...FACES].sort());
  assert.equal(kaiSet.images.cold!.url, "/api/sprites/card-kai/file/full_smirk.png");
  const valeBase = "/api/sprites/card-vale/file/full_neutral.png";
  assert.deepEqual((await readUnit(t, vale!.id)).expressions[valeBase], {
    state: "stopped",
    at: (await readUnit(t, vale!.id)).art!.at,
    images: { tender: { url: "/api/sprites/card-vale/file/full_love.png" } },
  });
  const player = await readPlayer(t);
  assert.equal(player.portrait, AVA);
  assert.equal(player.art?.url, AVA);
  assert.ok(!("expressions" in player), "the protagonist gets no faces");
  assert.deepEqual(stepsOf(created.body.view.forge), {
    "world-plan": "pending",
    [`bible:${kai!.id}`]: "pending",
    [`bible:${vale!.id}`]: "pending",
    [`bible:${sol!.id}`]: "pending",
    [`paint:${kai!.id}`]: "done",
    [`paint:${vale!.id}`]: "done",
    [`paint:${sol!.id}`]: "waiting-consent",
    "paint:player": "done",
  });
  assert.equal(paints.paid.length, 0);
  await forgeSettled(runId);
});

test("GET /runs/:run: a story in progress adopts Engine art for owners with no look, once, and never over a painting", async () => {
  const t = await artWorld({ runKey: "r-engineget-aaaaaa", images: { expressions: true } });
  const cutouts = fakeCutouts();
  const call = routesOf(registerRunRoutes, { ...t.deps, cutouts: cutouts.client }, "r-engineget-aaaaaa");
  const engine = engineArt(t, {
    sprites: {
      "card-kai": spritesOf("card-kai", "full_neutral"),
      "card-mir": spritesOf("card-mir", "full_neutral", "full_sad"),
      "card-sol": spritesOf("card-sol", "neutral"),
    },
    persona: AVA,
  });
  const painted = `${GALLERY}/kai-look.png`;
  const edit = <T>(li: string, change: (unit: Unit) => Unit) =>
    t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, change) as Promise<T>;
  await edit(KAI, (unit) => ({
    ...unit,
    cardId: "card-kai",
    portrait: painted,
    portraitRef: "global-gallery:kai-look",
    art: { state: "ready", at, url: painted, ref: "global-gallery:kai-look" },
  }));
  await edit(MIR, (unit) => ({ ...unit, cardId: "card-mir", art: { state: "failed", at, error: "down" } }));
  await edit(SOL, (unit) => ({ ...unit, cardId: "card-sol" }));
  // A paint left pending by a restart: nobody holds it, so it reads as stopped and adopts.
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    art: { state: "pending", at },
  }));
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    forge: {
      phase: "ready",
      steps: [
        { id: `paint:${KAI}`, state: "done", paid: true },
        { id: `paint:${MIR}`, state: "failed", paid: true, error: "failed" },
        { id: `paint:${SOL}`, state: "waiting-consent", paid: true },
        { id: "paint:player", state: "waiting-consent", paid: true },
      ],
    },
  }));
  // Sol's paint is live in this process: his look is the paint's, never raced.
  const release = startPaint(t.runId, `li:${SOL}`)!;
  const first = await call("GET", "/runs/:run");
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal((await readUnit(t, KAI)).portrait, painted, "a painted look is never replaced");
  assert.equal((await readUnit(t, MIR)).portrait, "/api/sprites/card-mir/file/full_neutral.png");
  assert.equal((await readUnit(t, SOL)).portrait, undefined, "a live paint is skipped");
  assert.equal((await readPlayer(t)).portrait, AVA);
  assert.deepEqual(stepsOf(first.body.view.forge), {
    [`paint:${KAI}`]: "done",
    [`paint:${MIR}`]: "done",
    [`paint:${SOL}`]: "waiting-consent",
    "paint:player": "done",
  });
  release();
  const second = await call("GET", "/runs/:run");
  assert.equal((await readUnit(t, SOL)).portrait, "/api/sprites/card-sol/file/neutral.png");
  assert.equal(stepsOf(second.body.view.forge)[`paint:${SOL}`], "done");
  // Read once per owner in this process, and never resolved again, even when his sprites change.
  engine.art.sprites["card-mir"] = spritesOf("card-mir", "neutral");
  await call("GET", "/runs/:run");
  assert.deepEqual(engine.reads.sort(), ["card-mir", "card-sol"]);
  assert.equal((await readUnit(t, MIR)).portrait, "/api/sprites/card-mir/file/full_neutral.png");
  // His sprite base and its faces are cut out by the free cleanup; the persona avatar is never sent to it.
  await cutoutsSettled();
  assert.ok(cutouts.cut.includes("/api/sprites/card-mir/file/full_neutral.png"));
  assert.ok(cutouts.cut.includes("/api/sprites/card-mir/file/full_sad.png"), "a stopped set's Engine faces stand");
  assert.ok(!cutouts.cut.includes(AVA));
  assert.equal(t.paid.length, 0);
});

test("a card linked to a love interest with no look is resolved again on the next read", async () => {
  const t = await artWorld({ runKey: "r-enginelink-aaaaaa" });
  const deps = { ...t.deps, cutouts: fakeCutouts().client };
  const call = routesOf(registerRunRoutes, deps, "r-enginelink-aaaaaa");
  const link = (cardId: string) =>
    routesOf(
      (router, routeDeps) =>
        // The card route reads its love interest from the path: name him there.
        registerRunRoutes(
          {
            get: router.get,
            post: (path, handler) =>
              router.post(path, (request, reply) =>
                handler({ ...request, params: { ...request.params, li: KAI } }, reply),
              ),
          },
          routeDeps,
        ),
      deps,
      "r-enginelink-aaaaaa",
    )("POST", "/runs/:run/lis/:li/card", { cardId });
  engineArt(t, { sprites: { "card-new": spritesOf("card-new", "full_neutral") } });
  t.runtime.resources.listCharacters = async (ids) =>
    [
      { id: "card-empty", data: { name: "Kai" }, comment: "" },
      { id: "card-new", data: { name: "Kai" }, comment: "" },
    ].filter((card) => !ids || ids.includes(card.id));
  assert.equal((await link("card-empty")).status, 200);
  await call("GET", "/runs/:run");
  assert.equal((await readUnit(t, KAI)).portrait, undefined, "a card with no art leaves him as he is");
  const linked = await link("card-new");
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  await call("GET", "/runs/:run");
  assert.equal((await readUnit(t, KAI)).portrait, "/api/sprites/card-new/file/full_neutral.png");
  assert.equal(t.paid.length, 0);
});

test("Settings adding a connection later: Engine-art owners' steps are done in its answer, a stale consent paints nothing; Repaint still pays", async () => {
  let failNext = false;
  const t = await artWorld({
    runKey: "r-enginelater-aaaaaa",
    images: { connectionId: null },
    before: () => {
      if (failNext) {
        failNext = false;
        throw new Error("the image service is down");
      }
    },
  });
  const deps = { ...t.deps, cutouts: fakeCutouts().client };
  const runs = routesOf(registerRunRoutes, deps, "r-enginelater-aaaaaa");
  const setup = routesOf(registerSetupRoutes, deps, "r-enginelater-aaaaaa");
  engineArt(t, { sprites: { "card-kai": spritesOf("card-kai", "full_neutral") }, persona: AVA });
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-kai",
  }));
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    forge: {
      phase: "ready",
      steps: [
        { id: "world-plan", state: "done" },
        ...[KAI, MIR, SOL].map((li) => ({ id: `bible:${li}`, state: "done" as const })),
      ],
    },
  }));
  // Without images: the look is adopted, and there is no paint step to settle.
  await runs("GET", "/runs/:run");
  assert.equal((await readUnit(t, KAI)).portrait, "/api/sprites/card-kai/file/full_neutral.png");
  const saved = await runs("POST", "/runs/:run/settings", { images: { connectionId: "conn-image" } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  // The answer the client keeps (no read follows it) never offers to paint them: Your cast shows no cost for them.
  assert.deepEqual(
    [`paint:${KAI}`, `paint:${MIR}`, "paint:player"].map((id) => stepsOf(saved.body.world.forge)[id]),
    ["done", "waiting-consent", "done"],
  );
  // A consent from a stale page (its steps still waiting): the paint queue finds Engine art and pays nothing.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    forge: {
      ...world.forge,
      steps: world.forge.steps.map((step) =>
        step.id === `paint:${KAI}` || step.id === "paint:player"
          ? { ...step, state: "waiting-consent" as const }
          : step,
      ),
    },
  }));
  const consent = await setup("POST", "/runs/:run/forge/consent", { steps: [`paint:${KAI}`, "paint:player"] });
  assert.equal(consent.status, 200, JSON.stringify(consent.body));
  await forgeSettled(t.runId);
  const read = await runs("GET", "/runs/:run");
  assert.equal(stepsOf(read.body.view.forge)[`paint:${KAI}`], "done");
  assert.equal(stepsOf(read.body.view.forge)["paint:player"], "done");
  assert.equal(t.paid.length, 0, "Engine art is never painted untapped");

  // Repaint is the player's choice: it pays once and replaces the Engine look.
  const repaint = await setup("POST", "/runs/:run/art/paint", { target: { kind: "look", owner: `li:${KAI}` } });
  assert.equal(repaint.status, 200, JSON.stringify(repaint.body));
  assert.equal(t.paid.length, 1);
  assert.equal((await readUnit(t, KAI)).portrait, repaint.body.paint.url);
  // A failed Repaint keeps her persona avatar, and its step says failed, with Retry, after every read.
  failNext = true;
  const failed = await setup("POST", "/runs/:run/art/paint", { target: { kind: "look", owner: "player" } });
  assert.equal(failed.body.paint.state, "failed");
  assert.equal((await readPlayer(t)).portrait, AVA);
  assert.equal(stepsOf((await runs("GET", "/runs/:run")).body.view.forge)["paint:player"], "failed");
  assert.deepEqual(t.deleted, [], "no Engine file is ever deleted");
});

test("Engine faces show without painting; the kit pays only for the missing ones, and never on an avatar", async (context) => {
  const t = await artWorld({ runKey: "r-enginefaces-aaaaaa", images: { expressions: true } });
  const art = createOtomeArt({ runtime: t.runtime, store: t.store, images: t.images });
  context.after(() => art.dispose());
  const base = "/api/sprites/card-kai/file/full_neutral.png";
  const love = "/api/sprites/card-kai/file/full_love.png";
  const sad = "/api/sprites/card-kai/file/full_sad.png";
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-kai",
    portrait: base,
    art: { state: "ready", at, url: base },
    expressions: {
      [base]: {
        state: "stopped",
        at,
        images: {
          tender: { url: love },
          hurt: { url: sad },
          cold: { url: `${GALLERY}/kai-cold.png`, ref: "global-gallery:c" },
        },
      },
    },
  }));
  const kai = await readUnit(t, KAI);
  const engineFaces = { tender: love, hurt: sad };
  for (const images of [
    { connectionId: null, expressions: true },
    { connectionId: "conn-image", expressions: false },
    { connectionId: "conn-image", expressions: true },
  ])
    assert.deepEqual(
      readyFaces({ images: { ...(await t.store.readDoc(worldId(t.runId), normalizeWorld))!.images, ...images } }, kai),
      engineFaces,
      `${JSON.stringify(images)}: a stopped set shows its Engine faces, never its painted one`,
    );
  const wardrobe: WardrobeView = await wardrobeView(t.deps, t.runId);
  assert.deepEqual(wardrobe.him[KAI]![0]!.faces, engineFaces, "the Wardrobe shows them too");

  // He speaks: the kit resumes the set and paints only the faces it lacks.
  art.queueExpressions(t.runId, beat(0), { debugMode: false });
  await until(async () => (await readUnit(t, KAI)).expressions[base]?.state === "ready", "the set to be ready");
  const set = (await readUnit(t, KAI)).expressions[base] as { images: Record<string, { url: string }> };
  assert.equal(t.paid.length, FACES.length - 3, "five faces less the three filed");
  assert.equal(set.images.tender!.url, love);
  assert.equal(set.images.hurt!.url, sad);
  assert.deepEqual(t.deleted, []);

  // A card avatar's empty set is ready: no face is painted on it by itself.
  const avatar = "/api/avatars/file/mireille.png";
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, MIR)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-mir",
    portrait: avatar,
    art: { state: "ready", at, url: avatar },
    expressions: { [avatar]: { state: "ready", at, images: {} } },
  }));
  const paidBefore = t.paid.length;
  art.queueExpressions(t.runId, beat(0, { segments: [{ speaker: "Mireille", text: "Again?" }] }), {
    debugMode: false,
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(t.paid.length, paidBefore, "an avatar base never queues a face");

  // Repaint expressions on a sprite base is the player's choice: five faces, and no Engine file deleted.
  const repainted = await art.repaintExpressions(t.runId, KAI, { debugMode: false });
  assert.equal(repainted.state, "ready");
  assert.equal(t.paid.length, paidBefore + FACES.length);
  assert.ok(t.deleted.every((id) => !id.includes("sprites")));
});

test("Ask before painting: an adopted sprite base keeps only the faces it has, and nothing is painted untapped", async (context) => {
  const t = await artWorld({ runKey: "r-engineask-aaaaaa", images: { ask: true, expressions: true } });
  const art = createOtomeArt({ runtime: t.runtime, store: t.store, images: t.images });
  context.after(() => art.dispose());
  const call = routesOf(registerRunRoutes, { ...t.deps, cutouts: fakeCutouts().client }, "r-engineask-aaaaaa");
  // Mireille's full body has no faces, though her busts do: the full-body family is hers, with none.
  engineArt(t, {
    sprites: {
      "card-kai": spritesOf("card-kai", "full_neutral", "full_love"),
      "card-mir": spritesOf("card-mir", "full_neutral", "happy", "sad", "angry", "blushing", "smirk"),
    },
  });
  for (const [li, cardId] of [
    [KAI, "card-kai"],
    [MIR, "card-mir"],
  ] as const)
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({ ...unit, cardId }));
  await call("GET", "/runs/:run");
  const kaiBase = "/api/sprites/card-kai/file/full_neutral.png";
  const mirBase = "/api/sprites/card-mir/file/full_neutral.png";
  assert.deepEqual((await readUnit(t, KAI)).expressions[kaiBase], {
    state: "ready",
    at: (await readUnit(t, KAI)).art!.at,
    images: { tender: { url: "/api/sprites/card-kai/file/full_love.png" } },
  });
  assert.deepEqual((await readUnit(t, MIR)).expressions[mirBase], {
    state: "ready",
    at: (await readUnit(t, MIR)).art!.at,
    images: {},
  });
  // Both speak: no face is painted for either until Repaint expressions.
  art.queueExpressions(
    t.runId,
    beat(0, {
      segments: [
        { speaker: "Kai", text: "Again." },
        { speaker: "Mireille", text: "Yes." },
      ],
    }),
    {
      debugMode: false,
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(t.paid.length, 0);
});

test("an adopted avatar follows a new one once per process; a sprite base, or an avatar with painted faces, never moves", async () => {
  const t = await artWorld({ runKey: "r-enginenew-aaaaaa" });
  const cutouts = fakeCutouts();
  const call = routesOf(registerRunRoutes, { ...t.deps, cutouts: cutouts.client }, "r-enginenew-aaaaaa");
  const home = routesOf(
    (router, deps) => registerHomeRoutes(forgeTimeZoneRoutes(router), deps),
    { ...t.deps, cutouts: cutouts.client },
    "r-enginenew-aaaaaa",
  );
  const engine = engineArt(t, {
    sprites: { "card-mir": spritesOf("card-mir", "full_neutral") },
    avatars: { "card-kai": "/api/avatars/file/kai.png" },
    persona: AVA,
  });
  for (const [li, cardId] of [
    [KAI, "card-kai"],
    [MIR, "card-mir"],
  ] as const)
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({ ...unit, cardId }));
  await call("GET", "/runs/:run");
  assert.equal((await readPlayer(t)).portrait, AVA);
  assert.equal((await readUnit(t, KAI)).portrait, "/api/avatars/file/kai.png");

  // She picks a new persona avatar and his card gains sprites; Mireille's are redrawn.
  const AVA2 = "/api/avatars/file/ava-2.png";
  engine.art.persona = AVA2;
  engine.art.sprites["card-kai"] = spritesOf("card-kai", "full_neutral", "full_love");
  engine.art.sprites["card-mir"] = spritesOf("card-mir", "neutral");
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    home: { li: KAI, show: "me" },
  }));
  const me = await home("GET", "/runs/:run/home");
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.deepEqual(me.body.look, { url: AVA2, source: "avatar", cutoutState: "uncut" }, "Home's Me reads it live");
  await call("GET", "/runs/:run");
  assert.equal((await readPlayer(t)).portrait, AVA, "read once per process");

  // The next process reads each again: her new avatar, his sprites instead of his avatar; Mireille keeps her base.
  for (const owner of ["player", `li:${KAI}`, `li:${MIR}`] as const) forgetEngineLook(t.runId, owner);
  await call("GET", "/runs/:run");
  const kaiBase = "/api/sprites/card-kai/file/full_neutral.png";
  assert.equal((await readPlayer(t)).portrait, AVA2);
  assert.deepEqual((await readPlayer(t)).art, { state: "ready", at: (await readPlayer(t)).art!.at, url: AVA2 });
  assert.equal((await readUnit(t, KAI)).portrait, kaiBase);
  assert.equal(
    ((await readUnit(t, KAI)).expressions[kaiBase] as { images: Record<string, { url: string }> }).images.tender!.url,
    "/api/sprites/card-kai/file/full_love.png",
  );
  assert.equal((await readUnit(t, MIR)).portrait, "/api/sprites/card-mir/file/full_neutral.png");

  // An avatar with painted faces (Repaint expressions) stays, so they are never pruned.
  const AVA3 = "/api/avatars/file/ava-3.png";
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, SOL)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-sol",
    portrait: "/api/avatars/file/sol.png",
    art: { state: "ready", at, url: "/api/avatars/file/sol.png" },
    expressions: {
      "/api/avatars/file/sol.png": {
        state: "ready",
        at,
        images: { tender: { url: `${GALLERY}/sol-tender.png`, ref: "global-gallery:sol-tender" } },
      },
    },
  }));
  engine.art.avatars["card-sol"] = AVA3;
  forgetEngineLook(t.runId, `li:${SOL}`);
  await call("GET", "/runs/:run");
  assert.equal((await readUnit(t, SOL)).portrait, "/api/avatars/file/sol.png");
  assert.equal(t.paid.length, 0);
  assert.deepEqual(t.deleted, []);
});

test("a card or persona that could not be read is tried again on the next read; a card that is gone is not", async () => {
  const t = await artWorld({ runKey: "r-engineretry-aaaaaa" });
  const call = routesOf(registerRunRoutes, { ...t.deps, cutouts: fakeCutouts().client }, "r-engineretry-aaaaaa");
  const engine = engineArt(t, { avatars: { "card-kai": "/api/avatars/file/kai.png" }, persona: AVA });
  const cardReads: string[] = [];
  const characterCard = t.images.characterCard;
  let fail = true;
  t.images.characterCard = async (cardId) => {
    cardReads.push(cardId);
    if (cardId === "card-gone") throw Object.assign(new Error("engine -> 404"), { status: 404 });
    if (fail) throw Object.assign(new Error("engine -> 503"), { status: 503 });
    return characterCard(cardId);
  };
  const listPersonas = t.runtime.resources.listPersonas;
  t.runtime.resources.listPersonas = async (ids) => {
    if (fail) throw new Error("the Engine is busy");
    return listPersonas(ids);
  };
  for (const [li, cardId] of [
    [KAI, "card-kai"],
    [MIR, "card-gone"],
  ] as const)
    await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({ ...unit, cardId }));
  const first = await call("GET", "/runs/:run");
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal((await readUnit(t, KAI)).portrait, undefined);
  assert.equal((await readPlayer(t)).portrait, undefined);
  fail = false;
  await call("GET", "/runs/:run");
  assert.equal((await readUnit(t, KAI)).portrait, "/api/avatars/file/kai.png");
  assert.equal((await readPlayer(t)).portrait, AVA);
  await call("GET", "/runs/:run");
  assert.deepEqual(
    cardReads.filter((id) => id === "card-gone"),
    ["card-gone"],
    "a card that is gone is read once",
  );
  assert.deepEqual(
    engine.reads.filter((id) => id === "card-kai"),
    ["card-kai", "card-kai"],
    "read until it worked",
  );
  assert.equal(t.paid.length, 0);
});

test("avatars are never cut out and stand on Home as avatars, for him and for her", async () => {
  const t = await artWorld({ runKey: "r-engineavatar-aaaaaa" });
  const cutouts = fakeCutouts();
  const avatar = "/api/avatars/file/kai.png";
  const base = "/api/sprites/card-mir/file/full_neutral.png";
  const unit = { id: KAI, cutouts: {} };
  assert.deepEqual(cutoutView(t.runId, unit, avatar), { state: "uncut" }, "never pending, so Home never polls it");
  await queueCutouts({ ...t.deps, cutouts: cutouts.client }, t.runId, unit, [avatar, base]);
  await cutoutsSettled();
  assert.deepEqual(cutouts.cut, [base]);

  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (current) => ({
    ...current,
    cardId: "card-kai",
    portrait: avatar,
    art: { state: "ready", at, url: avatar },
    expressions: { [avatar]: { state: "ready", at, images: {} } },
  }));
  await t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
    ...player,
    portrait: AVA,
    art: { state: "ready", at, url: AVA },
  }));
  const home = routesOf(
    (router, deps) => registerHomeRoutes(forgeTimeZoneRoutes(router), deps),
    { ...t.deps, cutouts: cutouts.client },
    "r-engineavatar-aaaaaa",
  );
  for (const show of ["him", "me"] as const) {
    await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      home: { li: KAI, show },
    }));
    const view = await home("GET", "/runs/:run/home");
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.deepEqual(view.body.look, { url: show === "him" ? avatar : AVA, source: "avatar", cutoutState: "uncut" });
  }
  await cutoutsSettled();
  assert.deepEqual(cutouts.cut, [base], "Home queued no cut-out of an avatar");
});

test("a place takes a background from the Engine's library: nothing painted, and a painting it replaces is kept", async () => {
  const t = await artWorld({ runKey: "r-enginebg-aaaaaa" });
  engineArt(t, { backgrounds: [BG_HARBOUR, BG_GLADE] });
  const call = routesOf(registerArtRoutes, t.deps, "r-enginebg-aaaaaa");
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    places: {
      "the-lamp-room": {
        name: "The Lamp Room",
        tags: "lighthouse interior, great lens, no humans",
        art: { state: "ready", at, url: `${GALLERY}/lamp.png`, ref: "global-gallery:lamp" },
      },
      "the-quay": { name: "The Quay", tags: "" },
    },
  }));
  const quay = await call("POST", "/runs/:run/art/place/background", { place: "The Quay", url: BG_GLADE });
  assert.equal(quay.status, 200, JSON.stringify(quay.body));
  assert.deepEqual(quay.body.place.art, { state: "ready", at: quay.body.place.art.at, url: BG_GLADE });
  assert.equal(quay.body.world.places["the-quay"].art.url, BG_GLADE, "a place with no description too");
  const painting = { state: "ready", at, url: `${GALLERY}/lamp.png`, ref: "global-gallery:lamp" };
  const lamp = await call("POST", "/runs/:run/art/place/background", { place: "The Lamp Room", url: BG_HARBOUR });
  assert.equal(lamp.body.place.art.url, BG_HARBOUR);
  assert.deepEqual(lamp.body.place.painted, painting, "a stray tap never loses a paid painting");
  // Another background keeps it too, and the story's deletion finds its ref.
  await call("POST", "/runs/:run/art/place/background", { place: "The Lamp Room", url: BG_GLADE });
  await call("POST", "/runs/:run/art/place/background", { place: "The Lamp Room", url: BG_HARBOUR });
  const kept = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  assert.deepEqual(kept.places["the-lamp-room"]!.painted, painting);
  assert.ok(galleryRefIds(kept).includes("lamp"));
  assert.deepEqual(t.deleted, []);
  const refused: Array<[object, number, string]> = [
    [{ place: "The Lamp Room", url: "/api/backgrounds/file/elsewhere.png" }, 400, "bad-request"],
    [{ place: "The Lamp Room", url: `${GALLERY}/lamp.png` }, 400, "bad-request"],
    [{ place: "Nowhere", url: BG_HARBOUR }, 404, "not-found"],
  ];
  for (const [body, status, code] of refused) {
    const answer = await call("POST", "/runs/:run/art/place/background", body);
    assert.equal(answer.status, status, JSON.stringify(answer.body));
    assert.equal(answer.body.code, code);
  }
  const release = startPaint(t.runId, "place:the-quay")!;
  const busy = await call("POST", "/runs/:run/art/place/background", { place: "The Quay", url: BG_HARBOUR });
  release();
  assert.equal(busy.status, 409);
  assert.equal(busy.body.code, "busy");
  // A later beat keeps it, and it is Home's backdrop.
  await setImages(t.store, t.runId, { connectionId: "conn-image", ask: false });
  await paintBeatPlaces(t.deps, t.runId, [{ name: "The Lamp Room", tags: "lighthouse interior" }], {
    debugMode: false,
  });
  const world = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  assert.equal(world.places["the-lamp-room"]!.art?.url, BG_HARBOUR);
  assert.deepEqual(backdropOf([], world, KAI), { url: BG_HARBOUR, kind: "place" });
  assert.equal(t.paid.length, 0);
  assert.deepEqual(t.deleted, []);
});
