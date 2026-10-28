// Otome Forge's run routes (M1): the 18+ gate is stored with a timestamp and enforced by the server (raising a gated
// setting needs it, lowering never does, revoking drops every world), bibles stay behind the spoiler gate and are
// validated on edit, and deleting a run removes every one of its documents and gallery images and nothing else.
import assert from "node:assert/strict";
import test from "node:test";
import type { Bible } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import type { ImageClient } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import { ARCHETYPE_IDS } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/archetypes.ts";
import {
  LIMIT_DEFAULTS,
  defaultContent,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  INDEX_ID,
  INDEX_TARGET,
  playerId,
  runDocTarget,
  runIdOf,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizeIndex } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/index.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBible,
  normalizeUnit,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { forgeSettled } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/forge.ts";
import { createOtomeStore } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { createFakeDocuments, createFakeRuntime } from "./fixtures/otome-forge-fakes.ts";

const RUN_KEY = "r-runs-abcdef";
const OTHER_KEY = "r-other-ghijkl";
const KAI = "li-kai-ab12";
const MIR = "li-mireille-cd34";
const at = "2026-10-28T10:00:00.000Z";

const bible = (changes: Partial<Bible> = {}): Bible => ({
  ...normalizeBible({})!,
  age: 29,
  pronouns: { subject: "he", object: "him", possessive: "his" },
  role: "Court physician",
  mask: { presents: "Polite, unreadable", tells: ["adjusts his cuffs", "too-even voice", "never sits"] },
  secrets: [
    { id: "poison", truth: "He poisoned the old king.", tells: ["his hands shake near wine"], revealAt: { stage: 4 } },
  ],
  ...changes,
});

async function setup({ galleryWorks = true } = {}) {
  const fake = createFakeDocuments();
  fake.seedGachaForgeIndex();
  const store = createOtomeStore(fake.documents);
  const { runtime, logs } = createFakeRuntime({
    documents: fake.documents,
    characters: [
      { id: "card-kai", data: { name: "Kai", description: "A duelist." } },
      { id: "card-vale", data: JSON.stringify({ name: "Vale", description: "A spymaster." }) },
      { id: "card-nameless", data: { description: "No name." } },
    ],
    personas: [{ id: "persona-ava", data: { name: "Ava", description: "A cartographer." } }],
  });
  const deleted: string[] = [];
  const deps: RouteDeps = {
    runtime,
    store,
    handle: createHandle(runtime.logger),
    // Only the gallery delete is used here; the forge's paints are agent B's tests.
    images: { deleteGalleryImage: async (id: string) => (deleted.push(id), galleryWorks) } as unknown as ImageClient,
  };
  const routes = new Map<string, RouteHandler>();
  registerRunRoutes(
    {
      get: (path, handler) => routes.set(`GET ${path}`, handler),
      post: (path, handler) => routes.set(`POST ${path}`, handler),
    },
    deps,
  );

  for (const runKey of [RUN_KEY, OTHER_KEY]) {
    const runId = runIdOf(runKey);
    await store.mutateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (world) => ({
      ...world,
      title: runKey === RUN_KEY ? "Moonlit Court" : "Other",
      mystery: {
        question: "Who opened the gate?",
        truth: "The Duke is alive.",
        pieces: { [KAI]: { piece: "a key", reasonToHide: "guilt" } },
      },
      web: [{ a: KAI, b: MIR, history: "duel", stance: "rivals", debt: "a life", secret: "They share a father." }],
      images: { ...world.images, connectionId: "conn-image" },
      connections: { narration: "conn-text" },
    }));
    await store.mutateDoc(runDocTarget("player", playerId(runId)), normalizePlayer, (player) => ({
      ...player,
      name: "Ava",
      portraitRef: "global-gallery:player-1",
    }));
    await store.mutateDoc(runDocTarget("unit", unitId(runId, KAI)), normalizeUnit, (unit) => ({
      ...unit,
      id: KAI,
      name: "Kai",
      bible: bible(),
      art: { state: "ready", at, url: "/api/global-gallery/file/kai-1.png", ref: "global-gallery:kai-1" },
      portraitRef: "global-gallery:kai-1",
    }));
    await store.mutateDoc(runDocTarget("unit", unitId(runId, MIR)), normalizeUnit, (unit) => ({
      ...unit,
      id: MIR,
      name: "Mireille",
    }));
    await store.mutateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) => ({
      ...state,
      lis: { [KAI]: { points: 0, stage: 1 }, [MIR]: { points: 0, stage: 1 } },
    }));
  }
  await store.mutateDoc(INDEX_TARGET, normalizeIndex, (index) => ({
    ...index,
    runs: [
      { runKey: RUN_KEY, title: "Moonlit Court", createdAt: at, lastPlayedAt: null },
      { runKey: OTHER_KEY, title: "Other", createdAt: at, lastPlayedAt: null },
      // A run still being created: in the index, no world yet. No route may create its world.
      { runKey: "r-empty-mnopqr", title: "Empty", createdAt: at, lastPlayedAt: null },
    ],
    activeRun: RUN_KEY,
  }));

  const call = async (
    method: "GET" | "POST",
    path: string,
    {
      params = {},
      body,
      query = {},
    }: { params?: Record<string, string>; body?: unknown; query?: Record<string, string> } = {},
  ) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const result = await handler({ method, url: path, params, query, body: body ?? {} }, reply);
    return { status, body: (result === reply ? payload : result) as any };
  };
  const world = (runKey = RUN_KEY) => store.readDoc(worldId(runIdOf(runKey)), normalizeWorld);
  const run = { run: RUN_KEY };
  return { fake, store, call, world, run, deleted, logs };
}

const HE = { subject: "he", object: "him", possessive: "his" };
const SHE = { subject: "she", object: "her", possessive: "her" };
const THEY = { subject: "they", object: "them", possessive: "their" };

const setupInput = (changes: Record<string, unknown> = {}) => ({
  title: "",
  premise: "A masked court where every vow binds.",
  language: "English",
  protagonist: { personaId: "persona-ava", pronouns: SHE, traits: [" curious ", ""], goal: "Find her brother." },
  lis: [
    { source: "card", cardId: "card-kai", pronouns: HE },
    { source: "card", cardId: "card-vale", pronouns: THEY },
    { source: "archetype", archetype: ARCHETYPE_IDS[0], name: " Kai ", pronouns: SHE, notes: " Speaks in riddles. " },
  ],
  content: { ...defaultContent(), limits: { ...LIMIT_DEFAULTS.angst, "non-consent": "allow" } },
  images: { connectionId: "conn-image", rating: "sfw", ask: false, expressions: true },
  connections: { narration: "conn-text", structured: "" },
  ...changes,
});

test("POST /runs checks the setup and the 18+ gate, then writes the run and starts the forge", async () => {
  const { call, fake, store } = await setup();
  const rows = () => [...fake.rows.keys()].sort();
  const before = rows();
  const base = setupInput();
  for (const [why, input] of [
    ["one love interest", setupInput({ lis: base.lis.slice(0, 1) })],
    [
      "six love interests",
      setupInput({ lis: [...base.lis, ...base.lis.slice(2), ...base.lis.slice(2), ...base.lis.slice(2)] }),
    ],
    ["the same card twice", setupInput({ lis: [base.lis[0], base.lis[0]] })],
    ["no premise", setupInput({ premise: "   " })],
    ["a missing persona", setupInput({ protagonist: { ...base.protagonist, personaId: "persona-gone" } })],
    ["a missing card", setupInput({ lis: [base.lis[0], { source: "card", cardId: "card-gone", pronouns: HE }] })],
    [
      "a card without a name",
      setupInput({ lis: [base.lis[0], { source: "card", cardId: "card-nameless", pronouns: HE }] }),
    ],
    ["an unknown archetype", setupInput({ lis: [base.lis[0], { ...base.lis[2], archetype: "pirate" }] })],
    ["six traits", setupInput({ protagonist: { ...base.protagonist, traits: ["a", "b", "c", "d", "e", "f"] } })],
  ] as const) {
    const refused = await call("POST", "/runs", { body: { setup: input } });
    assert.equal(refused.status, 400, why);
    assert.equal(refused.body.code, "bad-request", why);
  }
  for (const input of [
    setupInput({ content: { ...base.content, heat: "fade" } }),
    setupInput({ content: { ...base.content, darkness: "dark" } }),
    setupInput({ images: { ...base.images, rating: "suggestive" } }),
  ]) {
    const refused = await call("POST", "/runs", { body: { setup: input } });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.code, "age-gate");
  }
  assert.deepEqual(rows(), before, "a refused setup writes nothing");

  const created = await call("POST", "/runs", { body: { setup: base, debugMode: false } });
  assert.equal(created.status, 200);
  const { run, view } = created.body;
  assert.equal(view.runKey, run);
  const runId = runIdOf(run);
  const written = rows().filter((id) => !before.includes(id));
  assert.equal(written.length, 6, "world, player, state and three units");
  assert.ok(written.every((id) => id.startsWith(`${runId}:`) && id.startsWith("otome-forge:")));

  assert.deepEqual(
    view.lis.map((li: { name: string; pronouns: unknown; source: string }) => [li.name, li.pronouns, li.source]),
    [
      ["Kai", HE, "card"],
      ["Vale", THEY, "card"],
      ["Kai", SHE, "archetype"],
    ],
    "the view says which LIs come from a card (only those show Card canon wins)",
  );
  const ids: string[] = view.lis.map((li: { id: string }) => li.id);
  assert.equal(new Set(ids).size, 3, "two LIs named Kai still get different ids");
  assert.equal(view.player.name, "Ava");
  assert.deepEqual(view.player.traits, ["curious"]);
  assert.equal(view.starlight, 2000);
  assert.equal(view.world.content.limits["non-consent"], "line", "the server enforces the content again");
  assert.deepEqual(view.world.connections, { narration: "conn-text" });
  assert.deepEqual(
    view.forge.steps.map((step: { id: string; state: string }) => [step.id, step.state]),
    [
      ["world-plan", "pending"],
      ...ids.map((id) => [`bible:${id}`, "pending"]),
      ...ids.map((id) => [`paint:${id}`, "waiting-consent"]),
      ["paint:player", "waiting-consent"],
    ],
  );
  const archetype = (await store.readDoc(unitId(runId, ids[2]!), normalizeUnit))!;
  assert.equal(archetype.archetype, ARCHETYPE_IDS[0]);
  assert.equal(archetype.notes, "Speaks in riddles.", "the player's notes reach the bible prompt");
  assert.equal((await store.readDoc(unitId(runId, ids[0]!), normalizeUnit))?.cardId, "card-kai");
  const index = (await store.readDoc(INDEX_ID, normalizeIndex))!;
  assert.equal(index.activeRun, run);
  assert.deepEqual(index.runs.at(-1), {
    runKey: run,
    title: "",
    createdAt: index.runs.at(-1)!.createdAt,
    lastPlayedAt: index.runs.at(-1)!.createdAt,
  });
  // The forge started: with no model reply scripted, its first step fails and waits for Retry.
  await forgeSettled(runId);
  const after = await call("GET", "/runs/:run", { params: { run } });
  assert.equal(after.body.view.forge.steps[0].state, "failed");

  // No image connection, no paint steps; with the gate, NSFW Heat is allowed.
  await call("POST", "/age-gate", { body: { confirm: true } });
  const plain = await call("POST", "/runs", {
    body: {
      setup: setupInput({
        images: { ...base.images, connectionId: null },
        content: { ...base.content, heat: "explicit" },
      }),
    },
  });
  assert.equal(plain.status, 200);
  assert.ok(plain.body.view.forge.steps.every((step: { id: string }) => !step.id.startsWith("paint:")));
  assert.equal(plain.body.view.world.content.heat, "explicit");
  await forgeSettled(runIdOf(plain.body.run));
});

test("GET /runs/:run shows a forge step a restart left running as failed", async () => {
  const { call, store, run } = await setup();
  await store.mutateDoc(runDocTarget("world", worldId(runIdOf(RUN_KEY))), normalizeWorld, (world) => ({
    ...world,
    forge: { phase: "forging", steps: [{ id: "world-plan", state: "running" }] },
  }));
  const { body } = await call("GET", "/runs/:run", { params: run });
  assert.deepEqual(body.view.forge.steps, [{ id: "world-plan", state: "failed", error: "stopped" }]);
  assert.equal((await call("GET", "/runs/:run", { params: { run: "r-gone-stuvwx" } })).status, 404);
});

test("the 18+ gate is stored once with a timestamp", async () => {
  const { call, store } = await setup();
  assert.equal((await call("POST", "/age-gate", { body: { confirm: false } })).status, 400);
  assert.equal((await call("POST", "/age-gate")).status, 400, "it takes an explicit confirm");
  const first = await call("POST", "/age-gate", { body: { confirm: true, timeZone: "UTC", debugMode: false } });
  assert.equal(first.status, 200);
  assert.match(first.body.ageGate.confirmedAt, /^\d{4}-\d\d-\d\dT/);
  const again = await call("POST", "/age-gate", { body: { confirm: true } });
  assert.deepEqual(again.body, first.body, "confirming again keeps the first timestamp");
  assert.deepEqual((await store.readDoc(INDEX_ID, normalizeIndex))?.ageGate, first.body.ageGate);
});

test("settings: raising a gated setting needs the gate, lowering never does, and content is always enforced", async () => {
  const { call, world, run } = await setup();
  const content = (await world())!.content;
  const asked = (changes: object) => ({ params: run, body: { content: { ...content, ...changes } } });

  for (const raise of [
    asked({ heat: "fade" }),
    asked({ darkness: "dark", limits: LIMIT_DEFAULTS.dark }),
    { params: run, body: { images: { rating: "suggestive" } } },
  ]) {
    const refused = await call("POST", "/runs/:run/settings", raise);
    assert.equal(refused.status, 403);
    assert.equal(refused.body.code, "age-gate");
  }
  assert.deepEqual((await world())!.content, content, "a refused raise writes nothing");

  // Lowering, or changing what the gate does not guard, never asks.
  const gentle = await call("POST", "/runs/:run/settings", {
    params: run,
    body: {
      content: { ...content, darkness: "gentle", limits: { ...LIMIT_DEFAULTS.gentle, "non-consent": "allow" } },
      language: " Polski ",
      connections: { narration: "conn-b", chat: "" },
      images: { connectionId: null, ask: true },
    },
  });
  assert.equal(gentle.status, 200);
  assert.equal(gentle.body.world.content.darkness, "gentle");
  assert.equal(gentle.body.world.content.limits["non-consent"], "line", "a limit that cannot apply stays a Line");
  assert.equal(gentle.body.world.language, "Polski");
  assert.deepEqual(gentle.body.world.connections, { narration: "conn-b" });
  assert.equal(gentle.body.world.images.connectionId, null);
  assert.equal(gentle.body.world.images.ask, true);
  assert.deepEqual(
    gentle.body.world.mystery,
    { question: "Who opened the gate?" },
    "the hidden story stays on the server",
  );
  assert.equal(gentle.body.world.web[0].secret, undefined);

  // With the gate: Dark romance and NSFW Heat are allowed, and non-consent may move only then.
  await call("POST", "/age-gate", { body: { confirm: true } });
  const dark = await call("POST", "/runs/:run/settings", {
    params: run,
    body: {
      content: {
        ...content,
        heat: "explicit",
        darkness: "dark",
        limits: { ...LIMIT_DEFAULTS.dark, "non-consent": "veil" },
      },
      images: { rating: "explicit" },
    },
  });
  assert.equal(dark.status, 200);
  assert.equal(dark.body.world.content.heat, "explicit");
  assert.equal(dark.body.world.content.limits["non-consent"], "veil");
  assert.equal(dark.body.world.images.rating, "explicit");
  const sfwDark = await call(
    "POST",
    "/runs/:run/settings",
    asked({ heat: "sfw", darkness: "dark", limits: { ...LIMIT_DEFAULTS.dark, "non-consent": "veil" } }),
  );
  assert.equal(sfwDark.body.world.content.limits["non-consent"], "line", "SFW Heat keeps non-consent a Line");
  assert.equal(sfwDark.body.world.content.limits["dubious-consent"], "line");

  // Bad input is a 400; an unknown run a 404 that creates nothing.
  assert.equal((await call("POST", "/runs/:run/settings", asked({ heat: "spicy" }))).status, 400);
  assert.equal(
    (await call("POST", "/runs/:run/settings", { params: run, body: { connections: { narration: "" } } })).status,
    400,
  );
  assert.equal(
    (await call("POST", "/runs/:run/settings", { params: { run: "r-empty-mnopqr" }, body: {} })).status,
    404,
  );
  assert.equal(await world("r-empty-mnopqr"), null);
  assert.equal((await call("POST", "/runs/:run/settings", { params: { run: "../index" }, body: {} })).status, 404);
});

test("revoking the gate drops every world to SFW, Angst at most and SFW images; changes after it lower without asking", async () => {
  const { call, world, run, store } = await setup();
  await call("POST", "/age-gate", { body: { confirm: true } });
  const content = (await world())!.content;
  for (const runKey of [RUN_KEY, OTHER_KEY]) {
    await call("POST", "/runs/:run/settings", {
      params: { run: runKey },
      body: {
        content: {
          ...content,
          heat: "explicit",
          darkness: "dark",
          limits: { ...LIMIT_DEFAULTS.dark, "non-consent": "allow" },
        },
        images: { rating: "suggestive" },
      },
    });
  }
  const revoked = await call("POST", "/age-gate/revoke");
  assert.deepEqual(revoked.body, { ageGate: null });
  assert.equal((await store.readDoc(INDEX_ID, normalizeIndex))?.ageGate, null);
  for (const runKey of [RUN_KEY, OTHER_KEY]) {
    const lowered = (await world(runKey))!;
    assert.equal(lowered.content.heat, "sfw");
    assert.equal(lowered.content.darkness, "angst");
    assert.equal(lowered.images.rating, "sfw");
    for (const id of ["non-consent", "dubious-consent", "violence-to-protagonist"] as const) {
      assert.equal(lowered.content.limits[id], "line", id);
    }
  }
  assert.equal(await world("r-empty-mnopqr"), null, "a run without a world gets none");

  // A world that is somehow still NSFW without the gate is lowered by any change, and the change never asks.
  await store.mutateDoc(runDocTarget("world", worldId(runIdOf(RUN_KEY))), normalizeWorld, (current) => ({
    ...current,
    content: { ...current.content, heat: "explicit" },
    images: { ...current.images, rating: "explicit" },
  }));
  const language = await call("POST", "/runs/:run/settings", { params: run, body: { language: "Deutsch" } });
  assert.equal(language.status, 200);
  assert.equal(language.body.world.content.heat, "sfw");
  assert.equal(language.body.world.images.rating, "sfw");
});

test("a world that cannot be lowered on revoke never stops the rest; the revoke fails and lowers it when repeated", async () => {
  const { call, world, fake, logs } = await setup();
  await call("POST", "/age-gate", { body: { confirm: true } });
  const content = (await world())!.content;
  for (const runKey of [RUN_KEY, OTHER_KEY]) {
    await call("POST", "/runs/:run/settings", {
      params: { run: runKey },
      body: { content: { ...content, heat: "explicit" }, images: { rating: "suggestive" } },
    });
  }
  // The first world in the index loses every write attempt.
  for (let attempt = 0; attempt < 4; attempt += 1) fake.interfere(worldId(runIdOf(RUN_KEY)));
  const failed = await call("POST", "/age-gate/revoke");
  assert.equal(failed.status, 500, "the player is told, so they can revoke again");
  assert.equal((await world(OTHER_KEY))!.content.heat, "sfw", "the world after the failed one is still lowered");
  assert.equal((await world(OTHER_KEY))!.images.rating, "sfw");
  assert.equal((await world(RUN_KEY))!.content.heat, "explicit");
  assert.ok(
    logs.some((entry) => entry.level === "error" && entry.args.includes(RUN_KEY)),
    "the failed run is logged",
  );

  const again = await call("POST", "/age-gate/revoke");
  assert.equal(again.status, 200);
  assert.equal((await world(RUN_KEY))!.content.heat, "sfw");
  assert.equal((await world(RUN_KEY))!.images.rating, "sfw");
});

test("activate marks the run played and active; an unknown run is a 404", async () => {
  const { call, store } = await setup();
  const activated = await call("POST", "/runs/:run/activate", { params: { run: OTHER_KEY } });
  assert.equal(activated.body.index.activeRun, OTHER_KEY);
  assert.match(activated.body.index.runs[1].lastPlayedAt, /^\d{4}-/);
  assert.equal(activated.body.index.runs[0].lastPlayedAt, null);
  assert.equal((await call("POST", "/runs/:run/activate", { params: { run: "r-gone-stuvwx" } })).status, 404);
  assert.equal((await store.readDoc(INDEX_ID, normalizeIndex))?.activeRun, OTHER_KEY);
});

test("bibles: only behind the spoiler gate, validated on edit, and an edit is marked", async () => {
  const { call, store, run } = await setup();
  const kai = { ...run, li: KAI };
  assert.equal((await call("GET", "/runs/:run/lis/:li/bible", { params: kai })).status, 400, "no spoilers=1, no bible");
  const read = await call("GET", "/runs/:run/lis/:li/bible", {
    params: kai,
    query: { spoilers: "1", debugMode: "false" },
  });
  assert.deepEqual(read.body, { bible: bible() });
  assert.deepEqual(
    (await call("GET", "/runs/:run/lis/:li/bible", { params: { ...run, li: MIR }, query: { spoilers: "1" } })).body,
    { bible: null },
  );
  assert.equal(
    (
      await call("GET", "/runs/:run/lis/:li/bible", {
        params: { ...run, li: "li-nobody-zz99" },
        query: { spoilers: "1" },
      })
    ).status,
    404,
  );
  assert.equal(
    (await call("GET", "/runs/:run/lis/:li/bible", { params: { ...run, li: "kai" }, query: { spoilers: "1" } })).status,
    404,
  );

  for (const invalid of [
    bible({ age: 17 }),
    bible({ role: "Transfer student at the academy" }),
    bible({ role: "High school fencing champion" }),
    bible({ secrets: [{ id: "s", truth: "t", tells: [], revealAt: { stage: 2 } }] }),
    { ...bible(), mask: { presents: "x", tells: ["only one"] } },
  ]) {
    const refused = await call("POST", "/runs/:run/lis/:li/bible", { params: kai, body: { bible: invalid } });
    assert.equal(refused.status, 400, JSON.stringify(invalid).slice(0, 80));
    assert.equal(refused.body.code, "bad-request");
  }
  const row = { history: "a duel", stance: "rivals", debt: "a life" };
  const edited = bible({
    pronouns: { subject: "they", object: "them", possessive: "their" },
    want: "To be forgiven.",
    look: { identityLine: "scarred brow, grey eyes", outfitLine: "harbour-master's coat", presentation: "person" },
  });
  const saved = await call("POST", "/runs/:run/lis/:li/bible", {
    params: kai,
    body: { bible: { ...edited, web: { mireille: row } } },
  });
  assert.deepEqual(
    saved.body,
    { bible: { ...edited, web: { [MIR]: row } } },
    "a web row named for another LI moves to his id",
  );
  const unit = (await store.readDoc(unitId(runIdOf(RUN_KEY), KAI), normalizeUnit))!;
  assert.equal(unit.bibleEdited, true);
  assert.deepEqual(unit.pronouns, edited.pronouns, "his pronouns follow the bible");
  assert.deepEqual(
    [unit.identityLine, unit.outfitLine],
    [edited.look.identityLine, edited.look.outfitLine],
    "the next paint draws the edited look",
  );

  const unwritten = await call("POST", "/runs/:run/lis/:li/bible", {
    params: { ...run, li: MIR },
    body: { bible: edited },
  });
  assert.equal(unwritten.status, 409, "a bible still being written cannot be edited");
  assert.equal(
    (
      await call("POST", "/runs/:run/lis/:li/bible", {
        params: { ...run, li: "li-nobody-zz99" },
        body: { bible: edited },
      })
    ).status,
    404,
  );
  assert.equal(await store.readDoc(unitId(runIdOf(RUN_KEY), "li-nobody-zz99"), normalizeUnit), null, "nothing created");
});

test("accent: a hex colour, saved upper-case on the unit and shown in the run view", async () => {
  const { call, run } = await setup();
  const kai = { ...run, li: KAI };
  assert.equal(
    (await call("POST", "/runs/:run/lis/:li/accent", { params: kai, body: { accent: "rose" } })).status,
    400,
  );
  assert.deepEqual(
    (await call("POST", "/runs/:run/lis/:li/accent", { params: kai, body: { accent: "#a1b2c3" } })).body,
    { accent: "#A1B2C3" },
  );
  const view = await call("GET", "/runs/:run", { params: run });
  assert.equal(view.body.view.lis.find((li: { id: string }) => li.id === KAI).accent, "#A1B2C3");
  assert.equal(
    (
      await call("POST", "/runs/:run/lis/:li/accent", {
        params: { ...run, li: "li-nobody-zz99" },
        body: { accent: "#a1b2c3" },
      })
    ).status,
    404,
  );
});

test("delete: the typed title must match; then every document of the run and its gallery images go, and nothing else", async () => {
  const { call, fake, run, deleted, store } = await setup();
  const mine = (id: string) => id.startsWith(`${runIdOf(RUN_KEY)}:`);
  const before = [...fake.rows.keys()];
  assert.equal(before.filter(mine).length, 5);

  const wrong = await call("POST", "/runs/:run/delete", { params: run, body: { confirmTitle: "Moonlit" } });
  assert.equal(wrong.status, 400);
  assert.deepEqual([...fake.rows.keys()], before, "a wrong title removes nothing");

  const removed = await call("POST", "/runs/:run/delete", { params: run, body: { confirmTitle: " Moonlit Court " } });
  assert.equal(removed.status, 200);
  assert.deepEqual(
    removed.body.index.runs.map((entry: { runKey: string }) => entry.runKey),
    [OTHER_KEY, "r-empty-mnopqr"],
  );
  assert.equal(removed.body.index.activeRun, null, "the active run is cleared");
  assert.deepEqual([...fake.rows.keys()].filter(mine), []);
  assert.deepEqual(deleted.sort(), ["kai-1", "player-1"], "each gallery image once");
  assert.ok(fake.rows.has(worldId(runIdOf(OTHER_KEY))), "another run is untouched");
  assert.equal(fake.rows.get("index")?.packageId, "gacha-forge", "so is Gacha Forge's index");
  // A forge step that ends after the delete writes through updateDoc and cannot bring the run back.
  const late = await store.updateDoc(
    runDocTarget("unit", unitId(runIdOf(RUN_KEY), KAI)),
    normalizeUnit,
    (unit) => unit,
  );
  assert.equal(late, null);
  assert.deepEqual([...fake.rows.keys()].filter(mine), []);
  assert.equal(
    (await call("POST", "/runs/:run/delete", { params: run, body: { confirmTitle: "Moonlit Court" } })).status,
    404,
  );

  // When the gallery delete fails the documents still go, and the kept images are logged.
  const bare = await setup({ galleryWorks: false });
  assert.equal(
    (await bare.call("POST", "/runs/:run/delete", { params: bare.run, body: { confirmTitle: "Moonlit Court" } }))
      .status,
    200,
  );
  assert.deepEqual(
    bare.logs.filter((entry) => entry.level === "warn").map((entry) => entry.args),
    [[RUN_KEY, 2]],
  );
});
