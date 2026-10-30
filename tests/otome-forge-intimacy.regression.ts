// Otome Forge 0.3.0 (#1936): love interests' optional intimacy preferences and the protagonist's own role.
// - Only an adult NSFW story (Heat Fade or Explicit, kept only behind the 18+ confirmation) writes or reads either; an
//   SFW story's prompts never carry them, even when a bible kept its block from before Heat was lowered.
// - A new NSFW bible is asked for the block; an older one gains it only through the Cast's explicit action, which writes
//   that block alone (1 call), keeps everything else, and is never repeated. The run view says only that it exists.
// - Scenes and banner stories get the block beside the scene card, told to draw on it only now and then.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import {
  defaultContent,
  enforceContent,
  normalizeContent,
  type ContentSettings,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import { otomeContentContract } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/content-contract.ts";
import { createHandle } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import {
  BibleSchema,
  INTIMACY_ITEMS_MAX,
  normalizeUnit,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { readRun } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { checkBible } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/bible.ts";
import { bibleMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/prompts.ts";
import { bannerPlanMessages } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/prompts.ts";
import { KAI, MIR, bible, beatReply, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";

const text = (messages: CapabilityLanguageModelMessage[]) => messages.map((message) => message.content).join("\n");
const nsfw = (changes: Partial<ContentSettings> = {}): ContentSettings => ({
  ...defaultContent(),
  heat: "fade",
  ...changes,
});
const INTIMACY = {
  preferences: ["PREF-MARK: being praised", "slow teasing"],
  attractions: ["ATTR-MARK: strong hands"],
};
/** More than the handful: a reply or edit that overshoots is trimmed to INTIMACY_ITEMS_MAX, never refused. */
const OVERSHOOT = Array.from({ length: 6 }, (_, index) => `extra taste ${index + 1}`);
const isIntimacy = (messages: CapabilityLanguageModelMessage[]) =>
  text(messages).includes("their own tastes in sex and intimacy");

/** The run routes on a fake router (GET and POST), answering like Fastify. */
function runRoutes(t: Awaited<ReturnType<typeof storyWorld>>, runKey: string) {
  const routes = new Map<string, (request: unknown, reply: unknown) => unknown>();
  registerRunRoutes(
    {
      get: (path: string, handler: never) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: never) => routes.set(`POST ${path}`, handler),
    } as never,
    { ...t.deps, handle: createHandle(t.runtime.logger) },
  );
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    let status = 200;
    let payload: unknown;
    const reply = {
      status(code: number) {
        status = code;
        return reply;
      },
      send(value: unknown) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await routes.get(`${method} ${path}`)!(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

test("the protagonist's role is an NSFW-only, optional preference, never the love interests'", () => {
  assert.equal(normalizeContent({ ...nsfw(), mcRole: "dom" }).mcRole, "dom");
  assert.equal(normalizeContent({ ...nsfw(), mcRole: "brat" }).mcRole, undefined, "only Sub, Dom or Switch");
  assert.equal(normalizeContent(nsfw()).mcRole, undefined, "unspecified by default");
  assert.equal(enforceContent(nsfw({ mcRole: "sub" }), true).mcRole, "sub");
  assert.equal(enforceContent(nsfw({ mcRole: "sub" }), false).mcRole, undefined, "withdrawing 18+ drops it");
  assert.equal(enforceContent({ ...defaultContent(), mcRole: "sub" }, true).mcRole, undefined, "SFW Heat drops it");

  const world = { content: nsfw({ mcRole: "switch" }) } as never;
  const scene = otomeContentContract({ world, lis: [{ name: "Kai" }], kind: "scene" });
  assert.match(scene, /the protagonist is a switch, leading or yielding as the moment asks/);
  assert.match(scene, /never a rule for every scene, and never what a love interest must be/);
  // Dark romance alone is NSFW but no Heat: no role, and an SFW contract never carries one.
  const dark = { content: { ...defaultContent(), darkness: "dark", mcRole: "switch" } } as never;
  assert.doesNotMatch(otomeContentContract({ world: dark, lis: [], kind: "scene" }), /switch/);
  assert.doesNotMatch(otomeContentContract({ world, lis: [], kind: "home" }), /switch/);
});

test("a new bible is asked for intimacy only in an NSFW story, and checkBible keeps or drops it", async () => {
  const t = await storyWorld({ runKey: "r-intim-aaaaaa", content: nsfw() });
  const world = (await t.store.readDoc(worldId(t.runId), normalizeWorld))!;
  const unit = (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  const player = { personaId: "", name: "Ines", pronouns: unit.pronouns, traits: [], goal: "" } as never;
  const ask = (content: ContentSettings) =>
    text(bibleMessages({ world: { ...world, content }, player, member: { unit }, others: [] }));
  assert.match(ask(nsfw()), /"intimacy": \{"preferences": \[""\], "attractions": \[""\]\}\n\}/);
  assert.match(ask(nsfw()), /kinks and tastes, named plainly\)\. attractions: 2 to 4/);
  assert.doesNotMatch(ask(nsfw()), /non-graphic|never described|with consent/, "it sets no limits of its own");
  assert.doesNotMatch(ask(defaultContent()), /intimacy/i, "an SFW story never asks");

  const written = bible({ intimacy: { preferences: ["  being praised  ", ""], attractions: [] } });
  const kept = checkBible(written, { intimacy: true });
  assert.ok(typeof kept !== "string");
  assert.deepEqual(kept.intimacy, { preferences: ["being praised"], attractions: [] });
  const dropped = checkBible(written, { intimacy: false });
  assert.ok(typeof dropped !== "string");
  assert.equal(dropped.intimacy, undefined);
  const empty = checkBible(bible({ intimacy: { preferences: [" "], attractions: [] } }), { intimacy: true });
  assert.ok(typeof empty !== "string" && empty.intimacy === undefined, "nothing usable is no block");

  // The bible step's schema lets an overshoot through, and checkBible trims it to the handful.
  const many = bible({
    intimacy: { preferences: ["first", ...OVERSHOOT, "last"], attractions: [...OVERSHOOT, "7th"] },
  });
  assert.ok(BibleSchema.safeParse(many).success, "an overshoot is not refused");
  const trimmed = checkBible(many, { intimacy: true });
  assert.ok(typeof trimmed !== "string");
  assert.deepEqual(trimmed.intimacy!.preferences, ["first", ...OVERSHOOT.slice(0, INTIMACY_ITEMS_MAX - 1)]);
  assert.equal(trimmed.intimacy!.attractions.length, INTIMACY_ITEMS_MAX);
});

test("an older bible gains only its intimacy block, once, on request; the run view never shows its text", async () => {
  const runKey = "r-intim-bbbbbb";
  let calls = 0;
  const replies = Array.from({ length: 30 }, () => (messages: CapabilityLanguageModelMessage[]) => {
    if (isIntimacy(messages)) {
      calls += 1;
      return json({ intimacy: { ...INTIMACY, preferences: [...INTIMACY.preferences, ...OVERSHOOT] } });
    }
    return messages[0]!.content.includes("chapter planner") ? json(planReply()) : json(beatReply());
  });
  const t = await storyWorld({ runKey, replies });
  const call = runRoutes(t, runKey);
  const before = (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  // The reply overshoots; the block is trimmed to the handful.
  const FILLED = {
    ...INTIMACY,
    preferences: [...INTIMACY.preferences, ...OVERSHOOT].slice(0, INTIMACY_ITEMS_MAX),
  };

  // An SFW story never writes one.
  const refused = await call("POST", "/runs/:run/lis/:li/intimacy", {}, { li: KAI });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "conflict");
  assert.equal(calls, 0);

  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    content: nsfw(),
  }));
  const filled = await call("POST", "/runs/:run/lis/:li/intimacy", {}, { li: KAI });
  assert.equal(filled.status, 200, JSON.stringify(filled.body));
  assert.deepEqual(filled.body, { intimacy: true }, "the response carries no text either");
  assert.equal(calls, 1);
  const after = (await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!;
  assert.deepEqual(after.bible!.intimacy, FILLED);
  const { intimacy: _added, ...rest } = after.bible!;
  assert.deepEqual(rest, before.bible, "every other bible field is kept");
  assert.equal(after.bibleEdited, before.bibleEdited);
  const prompt = text(t.calls.find((entry) => isIntimacy(entry.messages))!.messages);
  assert.match(prompt, /Every other part of the bible stays as it is/);

  // Never twice: a second press reads the block back with no call.
  assert.equal((await call("POST", "/runs/:run/lis/:li/intimacy", {}, { li: KAI })).status, 200);
  assert.equal(calls, 1);

  // The run view says the block exists, and nothing of what is in it.
  const view = (await call("GET", "/runs/:run")).body.view;
  const kai = view.lis.find((li: { id: string }) => li.id === KAI);
  assert.equal(kai.intimacy, true);
  assert.ok(!JSON.stringify(view).includes("PREF-MARK"));

  // An edit that does not carry the block keeps it.
  const { intimacy: _block, ...edited } = after.bible!;
  const saved = await call(
    "POST",
    "/runs/:run/lis/:li/bible",
    { bible: { ...edited, role: "Harbour pilot" } },
    { li: KAI },
  );
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual((await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!.bible!.intimacy, FILLED);

  // Back to SFW: an edit cannot add or change the block, and the one written before is kept as it was.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    content: defaultContent(),
  }));
  const sneaked = { ...edited, intimacy: { preferences: ["SNEAKED"], attractions: [] } };
  assert.equal((await call("POST", "/runs/:run/lis/:li/bible", { bible: sneaked }, { li: KAI })).status, 200);
  assert.deepEqual((await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!.bible!.intimacy, FILLED);
  const mir = (await t.store.readDoc(unitId(t.runId, MIR), normalizeUnit))!;
  const fresh = { ...mir.bible!, intimacy: { preferences: ["SNEAKED"], attractions: [] } };
  assert.equal((await call("POST", "/runs/:run/lis/:li/bible", { bible: fresh }, { li: MIR })).status, 200);
  assert.equal((await t.store.readDoc(unitId(t.runId, MIR), normalizeUnit))!.bible!.intimacy, undefined);

  // NSFW again: an edit that empties both lists clears the block, and the cast offers to add it again.
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    content: nsfw(),
  }));
  const blank = { ...edited, intimacy: { preferences: [" "], attractions: [] } };
  const cleared = await call("POST", "/runs/:run/lis/:li/bible", { bible: blank }, { li: KAI });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
  assert.equal(cleared.body.bible.intimacy, undefined, "the edit is not undone");
  assert.equal((await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!.bible!.intimacy, undefined);
  const cleanView = (await call("GET", "/runs/:run")).body.view;
  assert.equal(cleanView.lis.find((li: { id: string }) => li.id === KAI).intimacy, undefined);
});

test("scenes draw on the block now and then in an NSFW story; an SFW story's prompts never carry it", async () => {
  for (const content of [nsfw(), defaultContent()]) {
    const runKey = content.heat === "sfw" ? "r-intim-sfw000" : "r-intim-nsfw00";
    const replies = Array.from(
      { length: 30 },
      () => (messages: CapabilityLanguageModelMessage[]) =>
        messages[0]!.content.includes("chapter planner") ? json(planReply()) : json(beatReply()),
    );
    const t = await storyWorld({ runKey, replies, content });
    // A block kept from before Heat was lowered must not reach an SFW story's prompts.
    await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
      ...unit,
      bible: { ...unit.bible!, intimacy: INTIMACY },
    }));
    assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
    assert.equal(
      (await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key: "main-1", i: "0" })).status,
      200,
    );
    const plan = text(t.calls[0]!.messages);
    const scene = text(t.calls.find((entry) => text(entry.messages).includes("Narrate node 1 of"))!.messages);
    const run = (await readRun(t.store, t.runId))!;
    const banner = (kind: "memories" | "his-wardrobe") =>
      text(
        bannerPlanMessages({
          ...run,
          kind,
          featured: run.units.find((unit) => unit.id === KAI)!,
          earlierTitles: [],
          memory: "",
        }),
      );
    // A wardrobe banner plans looks only: never their tastes (its Snapshots share the call).
    assert.ok(!banner("his-wardrobe").includes("PREF-MARK"));
    if (content.heat === "sfw") {
      for (const prompt of [plan, scene, banner("memories")]) {
        assert.ok(!prompt.includes("PREF-MARK") && !/intimacy/i.test(prompt));
      }
    } else {
      assert.ok(banner("memories").includes("Kai's tastes in sex and intimacy:"), "a Character Story may draw on it");
      assert.match(
        scene,
        /Kai's tastes in sex and intimacy: into PREF-MARK: being praised; slow teasing; drawn to ATTR-MARK: strong hands\. Bring them in when a scene turns intimate and they fit; not every intimate scene needs them, and Kai can want other things too\./,
      );
      assert.ok(plan.includes("Kai's tastes in sex and intimacy:"), "planners get it as its own line");
      assert.ok(!plan.includes('"intimacy":'), "never inside the bible's JSON");
    }
  }
});
