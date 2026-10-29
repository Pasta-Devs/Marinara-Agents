// Existing love interests acquire only a validated Engine card ID: their story, provenance and retained artwork
// survive linking and unlinking, and two requests cannot give one card to two love interests in the same run.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  OtomeRequest,
  RouteDeps,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  beatId,
  runDocTarget,
  stateId,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizeBeat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import {
  bibleMessages,
  castOf,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/prompts.ts";
import { createOtomeStore } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { artWorld, routesOf } from "./fixtures/otome-forge-art.ts";
import { at, KAI, MIR } from "./fixtures/otome-forge-story.ts";

const RUN_KEY = "r-cardlink-abcdef";
const PATH = "/runs/:run/lis/:li/card";
const CARD = "card-maukie";
const PORTRAIT = "/api/global-gallery/file/retained-maukie.png";

function runRoutes(deps: RouteDeps, runKey = RUN_KEY, li = KAI) {
  return routesOf(
    (router, shared) => {
      const selected = (request: OtomeRequest) => ({
        ...request,
        params: { ...(request.params as Record<string, string>), li },
      });
      registerRunRoutes(
        {
          get: (path, handler) => router.get(path, (request, reply) => handler(selected(request), reply)),
          post: (path, handler) => router.post(path, (request, reply) => handler(selected(request), reply)),
        },
        shared,
      );
    },
    deps,
    runKey,
  );
}

async function fixture() {
  const t = await artWorld({ runKey: RUN_KEY });
  const cards = [
    {
      id: CARD,
      data: JSON.stringify({
        name: "Maukie Escher",
        description: "AUTHORED-DESCRIPTION: the player's current character.",
        personality: "AUTHORED-PERSONALITY: relentlessly curious.",
        extensions: {
          backstory: "AUTHORED-BACKSTORY: a former physician.",
          appearance: "AUTHORED-APPEARANCE: silver eyes.",
        },
        scenario: "UNUSED-SCENARIO",
        first_mes: "UNUSED-GREETING",
        mes_example: "UNUSED-EXAMPLE-DIALOGUE",
      }),
    },
    { id: "card-nameless", data: JSON.stringify({ name: "" }) },
  ];
  t.runtime.resources.listCharacters = async (ids) => cards.filter((card) => !ids || ids.includes(card.id));
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    name: "Maukie Escher",
    archetype: "brilliant-monster",
    notes: "The original setup notes.",
    portrait: PORTRAIT,
    portraitRef: "global-gallery:retained-maukie",
    art: { state: "ready", at, url: PORTRAIT, ref: "global-gallery:retained-maukie" },
    // An already-attempted cleanup retains its original image without starting another free cleanup on GET /run.
    cutouts: { [PORTRAIT]: { state: "failed", at, error: "This original stays uncut." } },
  }));
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, "main-1", 0)), normalizeBeat, (beat) => ({
    ...beat!,
    key: "main-1",
    i: 0,
    segments: [{ speaker: "Maukie Escher", text: "An existing scene and its choice remain canon." }],
    choiceCanon: { "choice-kept": "option-kept" },
    readThrough: 0,
    written: { at, connectionId: "conn-text", model: "fixture" },
  }));
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    wallet: { ...state.wallet, starlight: 4_321 },
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, points: 450, stage: 3 } },
  }));
  const deps: RouteDeps = {
    ...t.deps,
    cutouts: {
      cutOut: async () => assert.fail("linking must not refresh retained artwork"),
      deleteGalleryImage: async () => assert.fail("linking must not delete retained artwork"),
    },
  };
  const call = runRoutes(deps);
  // Settle the existing legacy-persona migration before taking the preservation snapshot.
  assert.equal((await call("GET", "/runs/:run")).status, 200);
  const snapshot = () => Object.fromEntries([...t.fake.rows].map(([id, row]) => [id, structuredClone(row.data)]));
  const unit = () => t.store.readDoc(unitId(t.runId, KAI), normalizeUnit);
  return { ...t, deps, call, snapshot, unit, cards };
}

test("link, reload and unlink preserve an existing love interest's story, provenance and artwork without generation", async () => {
  const t = await fixture();
  const before = t.snapshot();
  const original = (await t.unit())!;
  assert.equal(original.source, "archetype");
  assert.equal(original.cardId, undefined, "an identical Engine card name never creates an implicit association");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const linked = await t.call("POST", PATH, { cardId: CARD });
    assert.equal(linked.status, 200, JSON.stringify(linked.body));
    assert.equal(linked.body.cardId, CARD);
    assert.deepEqual(await t.unit(), { ...original, cardId: CARD }, "only the existing cardId field changes");
  }
  // Recreate the store and route registrations: the link comes from persisted documents, not a client cache.
  const reloaded = runRoutes({ ...t.deps, store: createOtomeStore(t.fake.documents) });
  const view = (await reloaded("GET", "/runs/:run")).body.view;
  assert.equal(view.lis.find((li: { id: string }) => li.id === KAI).cardId, CARD);
  assert.equal(view.lis.find((li: { id: string }) => li.id === KAI).source, "archetype");
  assert.equal(view.lis.find((li: { id: string }) => li.id === KAI).portrait, PORTRAIT);

  const unlinked = await t.call("POST", PATH, { cardId: null });
  assert.equal(unlinked.status, 200, JSON.stringify(unlinked.body));
  assert.equal(unlinked.body.cardId, null);
  assert.deepEqual(await t.unit(), original);
  assert.deepEqual(t.snapshot(), before, "all story, bible, progress, original art and provenance data survive");
  const unlinkedView = (await reloaded("GET", "/runs/:run")).body.view;
  assert.equal(unlinkedView.lis.find((li: { id: string }) => li.id === KAI).cardId, undefined);
  assert.deepEqual(t.calls, [], "linking and unlinking make no model call");
  assert.deepEqual(t.paid, [], "linking and unlinking make no paid image call");
  assert.deepEqual(t.deleted, [], "retained gallery artwork is never deleted");
});

test("malformed, unavailable and duplicate card IDs are rejected without changing the run", async () => {
  const t = await fixture();
  const before = t.snapshot();
  for (const cardId of [
    "",
    "   ",
    "x".repeat(201),
    "../card",
    "card/other",
    "card\\other",
    "card\u0000other",
    "card\nother",
    "card\u007fother",
    true,
    [],
    {},
    "gone",
    "card-nameless",
  ]) {
    const refused = await t.call("POST", PATH, { cardId });
    assert.equal(refused.status, 400, JSON.stringify({ cardId, body: refused.body }));
    assert.equal(refused.body.code, "bad-request");
    assert.deepEqual(t.snapshot(), before, "a refused association changes no document");
  }
  for (const call of [runRoutes(t.deps, "r-gone-cccccc"), runRoutes(t.deps, RUN_KEY, "li-gone-ffee")]) {
    const refused = await call("POST", PATH, { cardId: CARD });
    assert.equal(refused.status, 404);
    assert.deepEqual(t.snapshot(), before, "an absent run or love interest is never created by linking");
  }
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, MIR)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: CARD,
  }));
  const owned = t.snapshot();
  const duplicate = await t.call("POST", PATH, { cardId: CARD });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "conflict");
  assert.deepEqual(t.snapshot(), owned);
  assert.deepEqual(t.calls, []);
  assert.deepEqual(t.paid, []);
});

test("simultaneous claims give one Engine card to exactly one love interest in the run", async () => {
  const t = await fixture();
  const responses = await Promise.all([
    t.call("POST", PATH, { cardId: CARD }),
    runRoutes(t.deps, RUN_KEY, MIR)("POST", PATH, { cardId: CARD }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const owners = (await t.store.listRun("unit", t.runId))
    .map((record) => normalizeUnit(record.data))
    .filter((unit) => unit.cardId === CARD);
  assert.equal(owners.length, 1);
  assert.ok([KAI, MIR].includes(owners[0]!.id));
  assert.deepEqual(t.calls, []);
  assert.deepEqual(t.paid, []);
});

test("a linked generated love interest reads current authored canon only, and unlink restores its archetype input", async () => {
  const t = await fixture();
  const prompt = async () => {
    const run = (await readRun(t.store, t.runId))!;
    const [member] = await castOf(t.runtime, [(await t.unit())!]);
    return bibleMessages({ world: run.world, player: run.player, member: member!, others: [] })
      .map((message) => message.content)
      .join("\n");
  };
  assert.equal((await t.call("POST", PATH, { cardId: CARD })).status, 200);
  const linked = await prompt();
  for (const marker of ["AUTHORED-DESCRIPTION", "AUTHORED-PERSONALITY", "AUTHORED-BACKSTORY", "AUTHORED-APPEARANCE"])
    assert.ok(linked.includes(marker), marker);
  for (const marker of ["UNUSED-SCENARIO", "UNUSED-GREETING", "UNUSED-EXAMPLE-DIALOGUE"])
    assert.ok(!linked.includes(marker), marker);
  assert.ok(linked.includes("Derive everything from the CANONICAL CHARACTER CARD"));
  t.cards[0]!.data = JSON.stringify({ ...JSON.parse(t.cards[0]!.data), description: "UPDATED-AUTHORED-DESCRIPTION" });
  assert.ok((await prompt()).includes("UPDATED-AUTHORED-DESCRIPTION"), "canon is read fresh from the selected card");

  assert.equal((await t.call("POST", PATH, { cardId: null })).status, 200);
  const unlinked = await prompt();
  assert.ok(unlinked.includes("Build the character from the archetype and the player's notes"));
  assert.ok(unlinked.includes("The original setup notes."));
  assert.ok(!unlinked.includes("AUTHORED-DESCRIPTION"));
  assert.deepEqual(t.calls, []);
  assert.deepEqual(t.paid, []);
});
