// Otome Forge's setup (M1): the forge job writes the world plan and one bible per love interest from the cards and
// archetypes; a bible must be an adult's with no school role (one repair turn, then the step fails and waits for
// Retry); paint steps wait for consent, paint once, and are never repainted after a failure; a step left running by a
// restart is stored as failed; and every document the setup writes keeps the `otome-forge:` prefix.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type {
  Bible,
  ForgeStatus,
  Paint,
  RunView,
  SetupInput,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { ARCHETYPE_IDS } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/archetypes.ts";
import { bibleProblem } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/bible.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import { forgeIsWorking } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/forge.ts";
import {
  dropMissingPicks,
  emptyDraft,
  type DraftLi,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/screens/setup/draft.ts";
import type {
  ImageClient,
  PortraitRequest,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import { createImageClient } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import { paintView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { lookPrompt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/prompts.ts";
import {
  createHandle,
  type OtomeReply,
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
import { registerSetupRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/setup.ts";
import { normalizeIndex } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/index.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  BibleSchema,
  normalizeBible,
  normalizeUnit,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { checkBible } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/bible.ts";
import { WorldPlanSchema } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/prompts.ts";
import {
  forgeSettled,
  initialForge,
  settleForge,
  startForge,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/forge.ts";
import { createOtomeStore } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { createFakeDocuments, createFakeRuntime, type FakeReply } from "./fixtures/otome-forge-fakes.ts";

const at = "2026-10-28T10:00:00.000Z";
const HE = { subject: "he", object: "him", possessive: "his" };
const SHE = { subject: "she", object: "her", possessive: "her" };
const THEY = { subject: "they", object: "them", possessive: "their" };
const KAI = "li-kai-ab12";
const MIR = "li-mireille-cd34";
const SOL = "li-sol-ef56";

const KAI_CARD = {
  name: "Kai",
  description: "CARD-DESCRIPTION: Kai keeps the harbour's last lighthouse.",
  personality: "CARD-PERSONALITY: patient, proud, hates being thanked.",
  extensions: {
    backstory: "CARD-BACKSTORY: raised by smugglers.",
    appearance: "CARD-APPEARANCE: grey eyes, salt-white hair.",
  },
};

function bible(changes: Partial<Bible> = {}): Bible {
  const base = normalizeBible({})!;
  return {
    ...base,
    age: 29,
    pronouns: HE,
    birthday: "03-14",
    role: "Lighthouse keeper",
    mask: { presents: "Unbothered", tells: ["polishes clean glass", "counts the bells", "won't sit"] },
    secrets: [
      {
        id: "north-light",
        truth: "He let the north light go dark.",
        tells: ["flinches at the bell"],
        revealAt: { stage: 4 },
      },
    ],
    look: {
      identityLine: "grey eyes, salt-white hair, tall, lean",
      outfitLine: "oilskin coat, wool sweater",
      presentation: "man",
    },
    ...changes,
  };
}

const plan = {
  title: "The Lantern Court",
  setting: "A harbour city lit by lanterns that must never go out.",
  mystery: { question: "Who is putting out the lanterns?", truth: "The harbour master drowns the lights." },
  pieces: [
    { li: KAI, piece: "He saw the boat with no lights.", reasonToHide: "It carried his brother." },
    { li: "Mireille", piece: "She forged the harbour ledgers.", reasonToHide: "She owes the master her title." },
    { li: SOL, piece: "They heard the bells ring wrong.", reasonToHide: "Nobody believes a drunk." },
  ],
  web: [
    {
      a: KAI,
      b: MIR,
      history: "Rival heirs.",
      stance: "rivals",
      debt: "She saved his ship.",
      secret: "They were engaged.",
    },
    { a: MIR, b: KAI, history: "A duplicate pair.", stance: "allies", debt: "", secret: null },
    { a: SOL, b: "nobody", history: "Unknown.", stance: "uneasy", debt: "" },
  ],
  openingSituation: "The lanterns along the quay go dark one by one.",
};

type Seeded = Pick<Unit, "id" | "name" | "pronouns" | "source"> & Partial<Unit> & { notes?: string };

const CAST: Seeded[] = [
  { id: KAI, name: "Kai", pronouns: HE, source: "card", cardId: "card-kai" },
  { id: MIR, name: "Mireille", pronouns: SHE, source: "card", cardId: "card-mireille" },
  {
    id: SOL,
    name: "Sol",
    pronouns: THEY,
    source: "archetype",
    archetype: "laughing-stranger",
    notes: "Plays the accordion.",
  },
];

/** A fake image client counting paid paints; the first `failures` paints fail. */
function fakeImages(failures = 0) {
  const paid: PortraitRequest[] = [];
  const deleted: string[] = [];
  let failing = failures;
  const images: ImageClient = {
    async generatePortrait(request) {
      paid.push(request);
      if (failing > 0) {
        failing -= 1;
        throw new Error("engine /api/characters/avatar-generation -> 500: provider down");
      }
      return { url: `/api/global-gallery/file/look-${paid.length}.png`, id: `img${paid.length}` };
    },
    styleProfile: async () => ({ styleText: "", positiveTags: "", negativeTags: "" }),
    deleteGalleryImage: async (id) => (deleted.push(id), true),
    characterCard: async () => null,
    personaAvatar: async () => "",
    cardAvatarImage: async () => null,
  };
  return { images, paid, deleted };
}

/** What POST /runs writes: the index entry, world (with its forge steps), player, units and state. */
async function setup({
  runKey,
  cast = CAST,
  replies = [],
  imageConnection = null,
  failures = 0,
  persona = { name: "Ines", description: "A cartographer.", appearance: "" },
}: {
  runKey: string;
  cast?: Seeded[];
  replies?: FakeReply[];
  imageConnection?: string | null;
  failures?: number;
  persona?: { name: string; description: string; appearance: string };
}) {
  const fake = createFakeDocuments();
  fake.seedGachaForgeIndex();
  const store = createOtomeStore(fake.documents);
  const { runtime, logs, calls } = createFakeRuntime({
    documents: fake.documents,
    replies,
    characters: [
      { id: "card-kai", data: JSON.stringify(KAI_CARD) },
      { id: "card-mireille", data: JSON.stringify({ data: { name: "Mireille", description: "A duchess." } }) },
    ],
    personas: [{ id: "persona-ines", data: { id: "persona-ines", ...persona, imageAppearanceEnabled: "false" } }],
  });
  const { images, paid, deleted } = fakeImages(failures);
  const runId = runIdOf(runKey);
  await store.mutateDoc(INDEX_TARGET, normalizeIndex, (index) => ({
    ...index,
    runs: [{ runKey, title: "", createdAt: at, lastPlayedAt: null }],
    activeRun: runKey,
  }));
  await store.mutateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (world) => ({
    ...world,
    premise: "Someone is putting out the harbour's lanterns.",
    createdAt: at,
    images: { ...world.images, connectionId: imageConnection },
    connections: { narration: "conn-text" },
    forge: initialForge(
      cast.map((li) => li.id),
      imageConnection !== null,
    ),
  }));
  await store.mutateDoc(runDocTarget("player", playerId(runId)), normalizePlayer, (player) => ({
    ...player,
    personaId: "persona-ines",
    name: "Ines",
    pronouns: SHE,
    traits: ["stubborn"],
    goal: "Find out why the lights die.",
  }));
  for (const li of cast) {
    await store.mutateDoc(runDocTarget("unit", unitId(runId, li.id)), normalizeUnit, (unit) => ({
      ...unit,
      ...li,
      createdAt: at,
    }));
  }
  await store.mutateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) => ({
    ...state,
    lis: Object.fromEntries(cast.map((li) => [li.id, { points: 0, stage: 1 }])),
  }));

  const deps = { runtime, store, handle: createHandle(runtime.logger), images };
  const call = routeHarness(deps);
  const post = (path: string, body: unknown) => call("POST", path, body, runKey);
  const get = (path: string) => call("GET", path, {}, runKey);
  const world = async () => (await store.readDoc(worldId(runId), normalizeWorld))!;
  const unit = async (li: string) => (await store.readDoc(unitId(runId, li), normalizeUnit))!;
  const player = async () => (await store.readDoc(playerId(runId), normalizePlayer))!;
  const step = async (id: string) => (await world()).forge.steps.find((candidate) => candidate.id === id);
  return { fake, store, runtime, logs, calls, deps, runId, post, get, world, unit, player, step, paid, deleted };
}

/** Both M1 route sets on one fake router; `call` answers like Fastify ({status, body}). */
function routeHarness(deps: Parameters<typeof registerSetupRoutes>[1]) {
  const routes = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
  };
  registerRunRoutes(router, deps);
  registerSetupRoutes(router, deps);
  return async (method: "GET" | "POST", path: string, body: unknown = {}, runKey?: string) => {
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
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...(body as object) } : undefined,
        params: runKey ? { run: runKey } : {},
        query: method === "GET" ? { ...fields, ...(body as object) } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, unknown> };
  };
}

const text = (messages: CapabilityLanguageModelMessage[]) => messages.map((message) => message.content).join("\n");

test("bible checks: adults only, no school or student role, a stage-4 secret; web keys and pronouns follow the cast", () => {
  const others = [{ id: MIR, name: "Mireille" }];
  assert.match(String(checkBible({ ...bible(), age: 17 })), /18 or older/);
  for (const role of [
    "Student of the tide academy",
    "high school teacher",
    "Schoolgirl spy",
    "a teen prodigy",
    "Pupil",
  ]) {
    assert.match(String(checkBible(bible({ role }))), /school or student role/, role);
  }
  assert.equal(typeof checkBible(bible({ role: "Harbour master's clerk" })), "object");
  // Mask tells count as the editor saves them: blank ones are not tells.
  assert.match(String(checkBible(bible({ mask: { presents: "", tells: ["", "  ", "\t"] } }))), /mask\.tells/);
  assert.match(String(checkBible(bible({ mask: { presents: "", tells: ["a", "", "b"] } }))), /mask\.tells/);
  assert.deepEqual(
    (checkBible(bible({ mask: { presents: "p", tells: [" a ", "", "b", "c"] } })) as Bible).mask,
    { presents: "p", tells: ["a", "b", "c"] },
    "a bible that passes keeps its tells trimmed and without blanks",
  );
  assert.match(
    String(checkBible(bible({ secrets: [{ id: "a", truth: "t", tells: [], revealAt: { stage: 2 } }] }))),
    /revealAt\.stage 4/,
  );
  const fixed = checkBible(
    bible({
      pronouns: THEY,
      web: {
        mireille: { history: "rivals", stance: "uneasy", debt: "" },
        [SOL]: { history: "not in this run", stance: "", debt: "" },
      },
      secrets: [
        { id: "same", truth: "a", tells: [], revealAt: { stage: 4 } },
        { id: "same", truth: "b", tells: [], revealAt: { stage: 5 } },
      ],
    }),
    { pronouns: HE, others },
  ) as Bible;
  assert.deepEqual(fixed.pronouns, HE);
  assert.deepEqual(Object.keys(fixed.web), [MIR]);
  assert.deepEqual(
    fixed.secrets.map((secret) => secret.id),
    ["same", "same-2"],
  );
});

test("the forge writes the world plan and every bible from the cards and archetypes, then the world is ready", async () => {
  const t = await setup({
    runKey: "r-forge-aaaaaa",
    replies: [
      `Here you go:\n${JSON.stringify(plan)}`,
      JSON.stringify(bible()),
      JSON.stringify(
        bible({ pronouns: SHE, look: { identityLine: "red hair", outfitLine: "gown", presentation: "woman" } }),
      ),
      JSON.stringify(
        bible({
          pronouns: THEY,
          look: { identityLine: "freckles", outfitLine: "patched coat", presentation: "person" },
        }),
      ),
    ],
  });
  startForge(t.deps, t.runId, { debugMode: true });
  await forgeSettled(t.runId);

  const world = await t.world();
  assert.equal(world.forge.phase, "ready");
  assert.deepEqual(
    world.forge.steps.map((step) => `${step.id}:${step.state}`),
    ["world-plan:done", `bible:${KAI}:done`, `bible:${MIR}:done`, `bible:${SOL}:done`],
  );
  assert.equal(world.title, "The Lantern Court");
  assert.deepEqual(Object.keys(world.mystery.pieces).sort(), [KAI, MIR, SOL].sort(), "a piece named by name is kept");
  assert.deepEqual(
    world.web.map((row) => [row.a, row.b, row.secret ?? null]),
    [[KAI, MIR, "They were engaged."]],
    "duplicate pairs and unknown love interests are dropped",
  );
  const index = await t.store.readDoc(INDEX_ID, normalizeIndex);
  assert.equal(index?.runs[0].title, "The Lantern Court", "an untitled run takes the plan's title");

  const kai = await t.unit(KAI);
  assert.equal(kai.bible?.role, "Lighthouse keeper");
  assert.equal(kai.identityLine, "grey eyes, salt-white hair, tall, lean");
  assert.equal(kai.voiceGender, "male");
  assert.equal((await t.unit(MIR)).voiceGender, "female");
  assert.equal((await t.unit(SOL)).voiceGender, "");
  assert.deepEqual((await t.unit(SOL)).bible?.pronouns, THEY, "each bible carries the pronouns the player picked");

  // P2 and P3: the planner contract, the cards' canon (read fresh from the card), the archetype seed; no boundary.
  const [planCall, kaiCall, mirCall, solCall] = t.calls;
  assert.equal(t.calls.length, 4);
  for (const call of t.calls) {
    assert.equal(call.connectionId, "conn-text");
    assert.equal(call.options?.temperature, 0.8);
    assert.match(text(call.messages), /CONTENT CONTRACT/);
    assert.ok(!text(call.messages).includes(forgeKnowledgeBoundary), "planners author the hidden truth");
  }
  for (const field of ["CARD-DESCRIPTION", "CARD-PERSONALITY", "CARD-BACKSTORY", "CARD-APPEARANCE"]) {
    assert.match(text(planCall.messages), new RegExp(field));
    assert.match(text(kaiCall.messages), new RegExp(field));
  }
  assert.match(text(planCall.messages), /CANONICAL CHARACTER CARD — current player-authored reference for Kai/);
  assert.match(text(planCall.messages), /A duchess\./, "a V2 card's nested fields are read");
  assert.match(text(planCall.messages), /Archetype: Laughing Stranger\. A charming drifter/);
  assert.match(text(kaiCall.messages), /never contradict it/);
  assert.match(text(kaiCall.messages), /Their piece of the mystery: He saw the boat with no lights\./);
  assert.match(text(mirCall.messages), /pronouns: exactly \{"subject":"she","object":"her","possessive":"her"\}/);
  assert.match(text(solCall.messages), /never a school or student role/);
  assert.match(text(solCall.messages), /WRITING RULES/);
  // The world plan writes prose the player reads: the banned phrases, but not the love interests' writing rules.
  assert.match(text(planCall.messages), /Never use these overused phrases or patterns: .*something shifted/);
  assert.ok(!text(planCall.messages).includes("WRITING RULES"));

  // Prompt logging goes through debugOverride, labelled per step.
  const labels = t.logs.filter((entry) => entry.level === "debugOverride").map((entry) => entry.args[0]);
  assert.deepEqual(labels, ["world-plan", `bible/${KAI}`, `bible/${MIR}`, `bible/${SOL}`]);

  // Every document the setup wrote is Otome's; Gacha Forge's `index` is untouched.
  for (const [id, row] of t.fake.rows) {
    if (row.packageId === "gacha-forge") assert.equal(id, "index");
    else assert.ok(id.startsWith("otome-forge:"), id);
  }
});

test("a bible under 18 or in a school role gets one repair turn, then fails its step until Retry", async () => {
  const t = await setup({
    runKey: "r-repair-bbbbbb",
    replies: [
      JSON.stringify(plan),
      JSON.stringify(bible({ role: "Student at the tide academy" })),
      JSON.stringify(bible()),
      JSON.stringify(bible({ age: 16 })),
      JSON.stringify(bible({ role: "Pupil of the old keeper" })),
      JSON.stringify(bible({ pronouns: THEY })),
    ],
  });
  startForge(t.deps, t.runId, { debugMode: true });
  await forgeSettled(t.runId);

  assert.equal((await t.step(`bible:${KAI}`))?.state, "done", "the repair turn fixed the school role");
  const repair = t.calls[2].messages;
  assert.equal(repair.at(-2)?.role, "assistant");
  assert.match(repair.at(-1)?.content ?? "", /did not match the required format: role must be an adult role/);
  assert.deepEqual(await t.step(`bible:${MIR}`), { id: `bible:${MIR}`, state: "failed", error: "bad-format" });
  assert.equal((await t.unit(MIR)).bible, null);
  assert.equal((await t.step(`bible:${SOL}`))?.state, "done", "one failed bible does not hold the others back");
  assert.equal((await t.world()).forge.phase, "forging");
  assert.equal(t.calls.length, 6, "never retried by itself");

  // A step that has not failed cannot be retried; a failed one runs again from its tap.
  const notFailed = await t.post("/runs/:run/forge/retry", { step: `bible:${KAI}` });
  assert.equal(notFailed.status, 409);
  assert.equal(notFailed.body.code, "conflict");
  assert.equal((await t.post("/runs/:run/forge/retry", { step: "bible:li-nobody-zz99" })).status, 404);
  t.calls.length = 0;
  const retried = await t.post("/runs/:run/forge/retry", { step: `bible:${MIR}` });
  assert.equal((retried.body.forge as ForgeStatus).steps.find((step) => step.id === `bible:${MIR}`)?.state, "pending");
  // The model call for the retry needs one more reply.
  await forgeSettled(t.runId).catch(() => undefined);
  assert.equal((await t.step(`bible:${MIR}`))?.state, "failed", "the fake model had no reply left");
  assert.equal((await t.step(`bible:${MIR}`))?.error, "failed");
});

test("a retried bible runs once more and the world becomes ready", async () => {
  const t = await setup({
    runKey: "r-retry-cccccc",
    cast: CAST.slice(0, 2),
    replies: [
      JSON.stringify(plan),
      JSON.stringify(bible()),
      "not json",
      "still not json",
      JSON.stringify(bible({ pronouns: SHE })),
    ],
  });
  startForge(t.deps, t.runId, { debugMode: false });
  await forgeSettled(t.runId);
  assert.equal((await t.step(`bible:${MIR}`))?.error, "bad-format");
  await t.post("/runs/:run/forge/retry", { step: `bible:${MIR}` });
  await forgeSettled(t.runId);
  assert.equal((await t.step(`bible:${MIR}`))?.state, "done");
  assert.equal((await t.world()).forge.phase, "ready");
  assert.equal(t.calls.length, 5);
});

test("paint steps wait for consent, paint once, and a failed paint is repainted only by its Retry", async () => {
  const t = await setup({
    runKey: "r-paint-dddddd",
    cast: CAST.slice(0, 2),
    imageConnection: "conn-image",
    failures: 1,
    replies: [
      JSON.stringify(plan),
      JSON.stringify(bible()),
      JSON.stringify(
        bible({ pronouns: SHE, look: { identityLine: "red hair", outfitLine: "gown", presentation: "woman" } }),
      ),
      JSON.stringify({ identityLine: "dark curls, brown skin, ink-stained fingers", outfitLine: "travel coat" }),
    ],
  });
  startForge(t.deps, t.runId, { debugMode: false });
  await forgeSettled(t.runId);
  const world = await t.world();
  assert.equal(world.forge.phase, "ready", "painting is not part of the text steps");
  assert.deepEqual(
    world.forge.steps.filter((step) => step.id.startsWith("paint:")).map((step) => [step.id, step.state, step.paid]),
    [
      [`paint:${KAI}`, "waiting-consent", true],
      [`paint:${MIR}`, "waiting-consent", true],
      ["paint:player", "waiting-consent", true],
    ],
  );
  assert.equal(t.paid.length, 0, "nothing is painted without a tap");

  const consent = await t.post("/runs/:run/forge/consent", { steps: [`paint:${KAI}`, "paint:player"] });
  assert.equal(consent.status, 200);
  await forgeSettled(t.runId);
  assert.equal(t.paid.length, 2);
  assert.deepEqual(await t.step(`paint:${KAI}`), { id: `paint:${KAI}`, state: "failed", paid: true, error: "failed" });
  const kaiArt = (await t.unit(KAI)).art as Paint;
  assert.equal(kaiArt.state, "failed");
  assert.match(kaiArt.error ?? "", /provider down/);
  assert.equal((await t.step("paint:player"))?.state, "done");
  const player = await t.player();
  assert.equal(player.look.identityLine, "", "an empty current Appearance invents no description");
  assert.equal(t.calls.length, 3, "painting the persona adds no P4 model call");
  assert.equal(player.portrait, "/api/global-gallery/file/look-2.png");
  assert.equal(player.portraitRef, "global-gallery:img2");
  assert.deepEqual(t.paid[1].unit, { kind: "character", personaId: "persona-ines" });
  assert.match(
    t.paid[1].prompt,
    /full body, standing, neutral pose, plain flat solid chroma green #00FF00 background.*safe for work/,
  );
  assert.doesNotMatch(t.paid[1].prompt, /dark curls|brown skin|ink-stained fingers|travel coat/);
  assert.match(t.paid[1].prompt, /adult person/);

  // The look prompt: identity, outfit, framing, the SFW rating and "adult man"; negatives keep the adult guard.
  const kaiPaint = t.paid[0];
  assert.equal(kaiPaint.connectionId, "conn-image");
  assert.deepEqual([kaiPaint.width, kaiPaint.height], [832, 1216]);
  assert.match(kaiPaint.prompt, /^grey eyes, salt-white hair, tall, lean, oilskin coat, wool sweater, full body/);
  assert.match(kaiPaint.prompt, /safe for work, fully clothed, adult man/);
  assert.doesNotMatch(kaiPaint.prompt, /\bno\b|nudity/, "what the rating forbids is only in the negative prompt");
  assert.match(kaiPaint.negativePrompt, /child, childlike, minor, underage/);
  assert.match(kaiPaint.negativePrompt, /nudity/);
  assert.deepEqual(kaiPaint.unit, { kind: "character", cardId: "card-kai", outfits: [] });

  // Another tap on consent, or settling, never repaints the failed look.
  await t.post("/runs/:run/forge/consent", { steps: [`paint:${KAI}`] });
  await forgeSettled(t.runId);
  await settleForge(t.deps, t.runId);
  assert.equal(t.paid.length, 2);
  assert.equal((await t.step(`paint:${KAI}`))?.state, "failed");

  // Retry is the tap that paints it again.
  await t.post("/runs/:run/forge/retry", { step: `paint:${KAI}` });
  await forgeSettled(t.runId);
  assert.equal(t.paid.length, 3);
  assert.equal((await t.step(`paint:${KAI}`))?.state, "done");
  assert.equal((await t.unit(KAI)).portraitRef, "global-gallery:img3");

  // The review dialog's route: an edited prompt keeps the rating and adult tags, and its step follows.
  const prompt = await t.post("/runs/:run/art/prompt", { target: { kind: "look", owner: `li:${MIR}` } });
  assert.match(String(prompt.body.prompt), /^red hair, gown, full body/);
  assert.match(String(prompt.body.prompt), /adult woman/);
  const edited = await t.post("/runs/:run/art/paint", {
    target: { kind: "look", owner: `li:${MIR}` },
    prompt: "oil painting, red hair, ball gown",
    negativePrompt: "blurry",
  });
  assert.equal((edited.body.paint as Paint).state, "ready");
  assert.equal(t.paid[3].prompt, "oil painting, red hair, ball gown, safe for work, fully clothed, adult woman");
  assert.equal(
    t.paid[3].negativePrompt,
    "blurry, child, childlike, minor, underage, school uniform, nudity, nsfw, sexual content, lingerie",
  );
  assert.equal((await t.step(`paint:${MIR}`))?.state, "done");

  // A repaint keeps the old look until the new one is saved, then deletes the old gallery image.
  const repaint = await t.post("/runs/:run/art/paint", { target: { kind: "look", owner: `li:${KAI}` } });
  assert.equal((repaint.body.paint as Paint).ref, "global-gallery:img5");
  assert.deepEqual(t.deleted, ["img3"]);
  assert.equal((await t.post("/runs/:run/art/paint", { target: { kind: "look", owner: "li:bad id" } })).status, 400);
});

test("without an image connection there are no paint steps, and consent is refused", async () => {
  const t = await setup({ runKey: "r-noimg-eeeeee", cast: CAST.slice(0, 2), replies: [JSON.stringify(plan)] });
  assert.ok(!(await t.world()).forge.steps.some((step) => step.id.startsWith("paint:")));
  const refused = await t.post("/runs/:run/forge/consent", { steps: ["paint:player"] });
  assert.equal(refused.status, 503);
  assert.equal(refused.body.code, "no-connection");
  assert.equal((await t.post("/runs/:run/forge/consent", { steps: ["world-plan"] })).status, 400);
  assert.equal(t.paid.length, 0);
});

test("after a restart, a step left running (or queued with no job) is stored as failed and offers Retry", async () => {
  const t = await setup({ runKey: "r-stale-ffffff", cast: CAST.slice(0, 2), imageConnection: "conn-image" });
  const runId = t.runId;
  await t.store.mutateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (world) => ({
    ...world,
    forge: {
      phase: "forging",
      steps: [
        { id: "world-plan", state: "done" },
        { id: `bible:${KAI}`, state: "running" },
        { id: `bible:${MIR}`, state: "pending" },
        { id: `paint:${KAI}`, state: "running", paid: true },
        { id: `paint:${MIR}`, state: "pending", paid: true },
        { id: "paint:player", state: "waiting-consent", paid: true },
      ],
    },
  }));
  await t.store.mutateDoc(runDocTarget("unit", unitId(runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: bible(),
    art: { state: "pending", at },
  }));

  const settled = await settleForge(t.deps, runId);
  assert.deepEqual(
    settled?.forge.steps.map((step) => [step.id, step.state, step.error ?? null]),
    [
      ["world-plan", "done", null],
      [`bible:${KAI}`, "failed", "stopped"],
      [`bible:${MIR}`, "failed", "stopped"],
      [`paint:${KAI}`, "failed", "stopped"],
      [`paint:${MIR}`, "pending", null],
      ["paint:player", "waiting-consent", null],
    ],
    "a consented paint whose bible is not written yet keeps waiting for it",
  );
  assert.deepEqual(
    (await t.world()).forge.steps.map((step) => step.state),
    settled?.forge.steps.map((step) => step.state),
    "stored, not only shown",
  );
  assert.equal(paintView(runId, `li:${KAI}`, (await t.unit(KAI)).art)?.state, "stopped");
  // The run view applies it: the protagonist's paint left pending reads as stopped, and stays pending in storage.
  await t.store.mutateDoc(runDocTarget("player", playerId(runId)), normalizePlayer, (player) => ({
    ...player,
    art: { state: "pending", at },
  }));
  const view = (await t.get("/runs/:run")).body.view as RunView;
  assert.equal(view.player.art?.state, "stopped");
  assert.equal((await t.player()).art?.state, "pending");
  assert.equal(t.paid.length, 0);
});

test("premise suggestions use the connection the player picked, in their language", async () => {
  const t = await setup({
    runKey: "r-premis-gggggg",
    replies: [JSON.stringify({ premise: "  Latarnie gasną jedna po drugiej.  " })],
  });
  const suggested = await t.post("/premise/suggest", { language: "Polski", connectionId: "conn-picked" });
  assert.deepEqual(suggested.body, { premise: "Latarnie gasną jedna po drugiej." });
  assert.equal(t.calls[0].connectionId, "conn-picked");
  assert.equal(t.calls[0].options?.temperature, 0.9);
  assert.equal(t.calls[0].options?.maxTokens, 4096, "GF's floor and headroom, within the connection's cap");
  assert.match(text(t.calls[0].messages), /written in Polski/);
  assert.match(text(t.calls[0].messages), /No real people/);
  assert.match(text(t.calls[0].messages), /Never use these overused phrases or patterns: .*something shifted/);
  assert.ok(!text(t.calls[0].messages).includes(forgeKnowledgeBoundary), "a premise writes no story");
  assert.equal((await t.post("/premise/suggest", { language: "Polski" })).status, 400);
});

test("the loopback image client sends debugMode, the prompt override and the card's avatar, then keeps the image", async () => {
  const requests: Array<{ url: string; method: string; body: unknown }> = [];
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("http://127.0.0.1:7860", "");
    requests.push({ url: path, method: init?.method ?? "GET", body: init?.body });
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
    if (path === "/api/characters/card-kai") return json({ id: "card-kai", avatarPath: "/api/avatars/file/kai.png" });
    if (path === "/api/avatars/file/kai.png") return new Response(png, { headers: { "content-type": "image/png" } });
    if (path === "/api/characters/avatar-generation") {
      return json({ image: `data:image/webp;base64,${Buffer.from("look").toString("base64")}`, prompt: "sent" });
    }
    if (path === "/api/global-gallery/upload") return json({ id: "g1", url: "/api/global-gallery/file/g1.webp" });
    return new Response(JSON.stringify({ error: "no" }), { status: 404 });
  }) as typeof globalThis.fetch;
  const client = createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch });
  const painted = await client.generatePortrait({
    connectionId: "conn-image",
    name: "Kai",
    unit: { kind: "character", cardId: "card-kai" },
    prompt: "grey eyes, full body",
    negativePrompt: "child",
    width: 832,
    height: 1216,
    debugMode: true,
  });
  assert.deepEqual(painted, { id: "g1", url: "/api/global-gallery/file/g1.webp" });
  const generation = requests.find((request) => request.url === "/api/characters/avatar-generation");
  const body = JSON.parse(String(generation?.body));
  assert.equal(body.debugMode, true, "the Engine logs the avatar prompt in debug mode");
  assert.deepEqual(body.promptOverrides, [
    { id: "avatar:kai", prompt: "grey eyes, full body", negativePrompt: "child" },
  ]);
  assert.deepEqual(body.referenceImages, [`data:image/png;base64,${png.toString("base64")}`]);
  assert.deepEqual([body.width, body.height, body.connectionId], [832, 1216, "conn-image"]);
  const upload = requests.find((request) => request.url === "/api/global-gallery/upload");
  assert.ok(upload?.body instanceof FormData);
  assert.equal((upload.body as FormData).get("prompt"), "grey eyes, full body");
  assert.equal(((upload.body as FormData).get("file") as File).name, "kai.webp");

  const noImage = (async () =>
    new Response(JSON.stringify({ image: "not an image" }), {
      headers: { "content-type": "application/json" },
    })) as typeof globalThis.fetch;
  await assert.rejects(
    createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch: noImage }).generatePortrait({
      connectionId: "conn-image",
      name: "Nobody",
      unit: { kind: "character" },
      prompt: "p",
      negativePrompt: "",
      width: 832,
      height: 1216,
      debugMode: false,
    }),
    /engine returned no usable image/,
  );
});

test("an archetype's look painted with no reference keeps xAI's JPEG, which the Engine wraps again as a PNG", async () => {
  // xAI's generations endpoint answers b64_json as a whole data URL; the Engine passes it on as image/png.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
  const requests: Array<{ url: string; body: unknown }> = [];
  const fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("http://127.0.0.1:7860", "");
    requests.push({ url: path, body: init?.body });
    const json = (value: unknown) =>
      new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
    if (path === "/api/characters/avatar-generation") {
      return json({ image: `data:image/png;base64,data:image/jpeg;base64,${jpeg.toString("base64")}`, prompt: "p" });
    }
    if (path === "/api/global-gallery/upload") return json({ id: "g2", url: "/api/global-gallery/file/g2.jpg" });
    return new Response(JSON.stringify({ error: "no" }), { status: 404 });
  }) as typeof globalThis.fetch;
  const painted = await createImageClient({ baseUrl: "http://127.0.0.1:7860", fetch }).generatePortrait({
    connectionId: "conn-grok",
    name: "Maukie Escher",
    unit: { kind: "character", outfits: [] },
    prompt: "p",
    negativePrompt: "",
    width: 832,
    height: 1216,
    debugMode: false,
  });
  assert.deepEqual(painted, { id: "g2", url: "/api/global-gallery/file/g2.jpg" });
  const generation = JSON.parse(String(requests.find((request) => request.url.endsWith("avatar-generation"))?.body));
  assert.equal(generation.referenceImages, undefined, "an archetype has no likeness to send");
  const file = (requests.find((request) => request.url === "/api/global-gallery/upload")?.body as FormData).get(
    "file",
  ) as File;
  assert.equal(file.name, "maukie-escher.jpg");
  assert.equal(file.type, "image/jpeg");
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), jpeg, "the gallery keeps the real image bytes");
});

test("POST /runs takes 2–5 love interests, enforces the 18+ gate, and its forge reaches ready", async () => {
  const fake = createFakeDocuments();
  fake.seedGachaForgeIndex();
  const store = createOtomeStore(fake.documents);
  const { runtime, calls } = createFakeRuntime({
    documents: fake.documents,
    replies: [
      JSON.stringify({
        ...plan,
        pieces: plan.pieces.map((piece, index) => ({ ...piece, li: ["Kai", "Mireille", "Sol"][index] })),
        web: [],
      }),
      JSON.stringify(bible()),
      JSON.stringify(bible({ pronouns: SHE })),
      JSON.stringify(bible({ pronouns: THEY })),
    ],
    characters: [
      { id: "card-kai", data: JSON.stringify(KAI_CARD) },
      { id: "card-mireille", data: JSON.stringify({ name: "Mireille", description: "A duchess." }) },
    ],
    personas: [{ id: "persona-ines", data: { id: "persona-ines", name: "Ines", appearance: "short black hair" } }],
  });
  const deps = { runtime, store, handle: createHandle(runtime.logger), images: fakeImages().images };
  const call = routeHarness(deps);
  const lis: SetupInput["lis"] = [
    { source: "card", cardId: "card-kai", pronouns: HE },
    { source: "card", cardId: "card-mireille", pronouns: SHE },
    { source: "archetype", archetype: "laughing-stranger", name: "Sol", pronouns: THEY, notes: "Plays the accordion." },
  ];
  const setupInput = (changes: Partial<SetupInput> = {}): { setup: SetupInput } => ({
    setup: {
      premise: "Someone is putting out the harbour's lanterns.",
      language: "English",
      protagonist: { personaId: "persona-ines", pronouns: SHE, traits: ["stubborn"], goal: "Find out why." },
      lis,
      content: defaultContent(),
      images: { connectionId: null, rating: "sfw", ask: false, expressions: true },
      connections: { narration: "conn-text" },
      ...changes,
    },
  });

  for (const count of [1, 6]) {
    const many = Array.from({ length: count }, (_, index) => ({
      source: "archetype" as const,
      archetype: "gentle-liar",
      name: `Liar ${index}`,
      pronouns: HE,
    }));
    const refused = await call("POST", "/runs", setupInput({ lis: many }));
    assert.equal(refused.status, 400, `${count} love interests`);
  }
  for (const changes of [
    { content: { ...defaultContent(), heat: "explicit" as const } },
    { content: { ...defaultContent(), darkness: "dark" as const } },
    { images: { connectionId: null, rating: "suggestive" as const, ask: false, expressions: true } },
  ]) {
    const refused = await call("POST", "/runs", setupInput(changes));
    assert.equal(refused.status, 403);
    assert.equal(refused.body.code, "age-gate");
  }
  assert.equal(calls.length, 0, "a refused setup never reaches the model");

  const created = await call("POST", "/runs", setupInput());
  assert.equal(created.status, 200);
  const runKey = String(created.body.run);
  const view = created.body.view as RunView;
  assert.deepEqual(
    view.lis.map((li) => [li.name, li.pronouns.subject]),
    [
      ["Kai", "he"],
      ["Mireille", "she"],
      ["Sol", "they"],
    ],
  );
  await forgeSettled(runIdOf(runKey));
  const ready = (await call("GET", "/runs/:run", {}, runKey)).body.view as RunView;
  assert.equal(ready.forge.phase, "ready");
  assert.equal(ready.world.title, "The Lantern Court");
  assert.ok(!("truth" in ready.world.mystery), "the run view never carries the hidden truth");
  assert.match(text(calls[0].messages), /The player's notes: Plays the accordion\./);
  assert.match(text(calls[0].messages), /CARD-DESCRIPTION/);

  // With the gate confirmed, the same NSFW setup is accepted.
  assert.equal((await call("POST", "/age-gate", { confirm: true })).status, 200);
  const nsfw = await call(
    "POST",
    "/runs",
    setupInput({ content: { ...defaultContent(), heat: "explicit" }, lis: lis.slice(2).concat(lis.slice(0, 1)) }),
  );
  assert.equal(nsfw.status, 200);
  assert.equal((nsfw.body.view as RunView).world.content.heat, "explicit");
  await forgeSettled(runIdOf(String(nsfw.body.run))).catch(() => undefined);
});

test("the world plan keeps the world document's limits, so an over-long field gets the repair turn", () => {
  const long = "x".repeat(4001);
  assert.equal(WorldPlanSchema.safeParse(plan).success, true);
  for (const changed of [
    { pieces: [{ ...plan.pieces[0], piece: long }] },
    { pieces: [{ ...plan.pieces[0], reasonToHide: long }] },
    { web: [{ ...plan.web[0], history: long }] },
    { web: [{ ...plan.web[0], debt: long }] },
    { web: [{ ...plan.web[0], secret: long }] },
  ]) {
    assert.equal(
      WorldPlanSchema.safeParse({ ...plan, ...changed }).success,
      false,
      JSON.stringify(Object.keys(changed)),
    );
  }
  // What the plan accepts, the world keeps when it is read back.
  const edge = "y".repeat(4000);
  const stored = normalizeWorld({
    mystery: { question: "q", truth: "t", pieces: { [KAI]: { piece: edge, reasonToHide: edge } } },
    web: [{ a: KAI, b: MIR, history: edge, stance: "rivals", debt: edge, secret: edge }],
  });
  assert.equal(stored.mystery.pieces[KAI]?.piece, edge);
  assert.equal(stored.web.length, 1);
});

test("an edited look prompt gets back each safety tag it lacks, compared tag by tag", () => {
  const world = normalizeWorld(undefined);
  const style = { styleText: "", positiveTags: "", negativeTags: "" };
  const input = { name: "Kai", identityLine: "x", outfitLine: "y", presentation: "man" as const, world, style };
  const edited = lookPrompt(input, {
    prompt: "adult manga style, black hair, not fully clothed,",
    negativePrompt: "minor details, blurry",
  });
  assert.equal(
    edited.prompt,
    "adult manga style, black hair, not fully clothed, safe for work, fully clothed, adult man",
  );
  assert.equal(
    edited.negativePrompt,
    "minor details, blurry, child, childlike, minor, underage, school uniform, nudity, nsfw, sexual content, lingerie",
  );
  const kept = lookPrompt(input, { prompt: "Adult Man, Safe for work, fully clothed, red coat", negativePrompt: "" });
  assert.equal(kept.prompt, "Adult Man, Safe for work, fully clothed, red coat", "present tags are not repeated");
});

test("a world made without images gets its paint steps, waiting for the tap, once Settings adds an image connection", async () => {
  const t = await setup({
    runKey: "r-later-hhhhhh",
    cast: CAST.slice(0, 2),
    replies: [
      JSON.stringify(plan),
      JSON.stringify(bible()),
      JSON.stringify(bible({ pronouns: SHE })),
      JSON.stringify({ identityLine: "dark curls, brown skin", outfitLine: "travel coat" }),
    ],
  });
  startForge(t.deps, t.runId, { debugMode: false });
  await forgeSettled(t.runId);
  assert.ok(!(await t.world()).forge.steps.some((step) => step.id.startsWith("paint:")));

  const saved = await t.post("/runs/:run/settings", { images: { connectionId: "conn-image" } });
  assert.equal(saved.status, 200);
  const paintSteps = [`paint:${KAI}`, `paint:${MIR}`, "paint:player"];
  const waiting = (forge: ForgeStatus) =>
    forge.steps.filter((step) => step.id.startsWith("paint:")).map((step) => [step.id, step.state, step.paid]);
  assert.deepEqual(
    waiting((saved.body.world as { forge: ForgeStatus }).forge),
    paintSteps.map((id) => [id, "waiting-consent", true]),
  );
  assert.equal((await t.world()).forge.phase, "ready", "paint steps are not text steps");

  // Saving again adds nothing, and a step already painted or failed is kept as it is.
  await t.post("/runs/:run/settings", { images: { connectionId: "conn-image", ask: true } });
  assert.deepEqual(
    waiting((await t.world()).forge),
    paintSteps.map((id) => [id, "waiting-consent", true]),
  );
  assert.equal(t.paid.length, 0, "nothing is painted without a tap");
  const consent = await t.post("/runs/:run/forge/consent", { steps: ["paint:player"] });
  assert.equal(consent.status, 200);
  await forgeSettled(t.runId);
  assert.equal(t.paid.length, 1);
});

test("polling runs while a step can still move by itself, and stops while the world waits on a Retry", () => {
  const forge = (...steps: Array<[string, ForgeStatus["steps"][number]["state"]]>): ForgeStatus => ({
    phase: "forging",
    steps: steps.map(([id, state]) => ({ id, state })),
  });
  assert.equal(forgeIsWorking(forge(["world-plan", "running"], [`bible:${KAI}`, "pending"])), true);
  assert.equal(forgeIsWorking(forge(["world-plan", "done"], [`bible:${KAI}`, "pending"])), true);
  assert.equal(forgeIsWorking(forge(["world-plan", "failed"], [`bible:${KAI}`, "pending"])), false, "held back");
  assert.equal(
    forgeIsWorking(forge(["world-plan", "done"], [`bible:${KAI}`, "failed"], [`bible:${MIR}`, "done"])),
    false,
    "a failed bible with nothing else to do",
  );
  assert.equal(
    forgeIsWorking(forge(["world-plan", "done"], [`bible:${KAI}`, "failed"], [`paint:${KAI}`, "pending"])),
    false,
    "a consented paint whose bible failed waits for that Retry",
  );
  assert.equal(
    forgeIsWorking(forge(["world-plan", "done"], [`bible:${KAI}`, "done"], [`paint:${KAI}`, "pending"])),
    true,
  );
  assert.equal(forgeIsWorking(forge(["world-plan", "done"], ["paint:player", "waiting-consent"])), false);
});

test("the bible editor checks the server's rules before it saves, and each one it names the server refuses too", () => {
  assert.equal(bibleProblem(bible()), null);
  const wound = bible().secrets[0]!;
  const cases: Array<[Partial<Bible>, string]> = [
    [{ age: 17 }, "age"],
    [{ age: 18.5 }, "age"],
    [{ pronouns: { ...HE, subject: "" } }, "pronouns"],
    [{ birthday: "March 3" }, "birthday"],
    [{ role: "former student council president" }, "role"],
    [{ mask: { presents: "", tells: ["a", "b"] } }, "maskTells"],
    [{ mask: { presents: "", tells: ["a", "b", "c", "d", "e", "f"] } }, "maskTells"],
    [{ secrets: [] }, "secrets"],
    [{ secrets: Array.from({ length: 9 }, (_, index) => ({ ...wound, id: `s${index}` })) }, "secrets"],
    [{ secrets: [{ ...wound, tells: ["1", "2", "3", "4", "5", "6", "7"] }] }, "secretTells"],
    [{ secrets: [{ ...wound, revealAt: { stage: 3 } }] }, "woundSecret"],
  ];
  for (const [changes, problem] of cases) {
    const candidate = bible(changes);
    assert.equal(bibleProblem(candidate), problem, JSON.stringify(changes));
    const parsed = BibleSchema.safeParse(candidate);
    assert.ok(!parsed.success || typeof checkBible(parsed.data) === "string", `the server refuses ${problem} too`);
  }
});

test("a kept draft drops a persona or card the Engine no longer has, and keeps everything while a list is unknown", () => {
  const pronouns = { preset: "he" as const, custom: { subject: "", object: "", possessive: "" } };
  const li = (source: DraftLi["source"], id: string): DraftLi => ({
    key: `k-${id}`,
    source,
    cardId: source === "card" ? id : "",
    archetype: source === "archetype" ? ARCHETYPE_IDS[0] : "",
    name: id,
    avatarUrl: null,
    notes: "",
    pronouns,
  });
  const draft = {
    ...emptyDraft(),
    protagonist: { ...emptyDraft().protagonist, personaId: "persona-gone", name: "Ava" },
    lis: [li("card", "card-kai"), li("card", "card-gone"), li("archetype", "Sol")],
  };
  const repaired = dropMissingPicks(draft, [{ id: "persona-ava" }], [{ id: "card-kai" }]);
  assert.equal(repaired.protagonist.personaId, "", "the protagonist step asks for a persona again");
  assert.equal(repaired.protagonist.name, "");
  assert.deepEqual(
    repaired.lis.map((item) => item.key),
    ["k-card-kai", "k-Sol"],
    "only the deleted card goes; archetypes stay",
  );
  assert.equal(dropMissingPicks(draft, null, null), draft, "lists still loading, failed or cut off change nothing");
  const kept = dropMissingPicks(draft, [{ id: "persona-gone" }], [{ id: "card-kai" }, { id: "card-gone" }]);
  assert.equal(kept, draft, "nothing missing returns the same draft, so the wizard does not re-render");
});
