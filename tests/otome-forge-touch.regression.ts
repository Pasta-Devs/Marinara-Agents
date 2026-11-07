// Otome Hearth's touch on Home (#2152): P15 writes head, cheek, chest and hand lines in every world and the crotch under
// NSFW Heat only, with a face per zone; NSFW Heat writes the pack under the full `chat` contract (his tastes beside his
// card, comfort still warmth only) while an SFW or Dark-with-SFW-Heat world keeps the `home` contract word for word; a
// pack is stamped from the settings (never from prompt text), so Home never serves an NSFW pack under settings it was
// not written for, and a stale pack (no cheek, or other NSFW settings) is written once more and then left alone; the
// fixed pack is stamped too, so the Claw Machine never says claw lines written under NSFW settings the world has left
// and they are written again with the next pack; an odd face never fails P15's reply; a declined NSFW pack waits out
// the cool-down while the SFW pack keeps serving; and Home shows the crotch only under NSFW Heat with lines for it, a
// fond touch bringing its zone's face.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type {
  LinesView,
  StageLines,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  defaultContent,
  type ContentSettings,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  TAP_ZONES,
  tapZonesFor,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/home.ts";
import { liPlushId } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/claw.ts";
import {
  ZONE_FACE,
  fallbackTapKeys,
  homeFace,
  shownZones,
  tapFace,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/tap-mood.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import {
  LINE_PACK_MAX_TOKENS,
  contentStamp,
  linesView,
  normalizeLinePack,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/lines.ts";
import { LinePackReplySchema } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/replies.ts";
import type { RouteHandler } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  finishClawRound,
  playView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/claw.ts";
import {
  SLOW_BURN_LAST_STAGE,
  linePackMessages,
  otomeContentContract,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  registerHomeRoutes,
  type HomeRouteDeps,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/home.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeLinePacks,
  normalizeUnit,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { KAI, MIR, bible, json, storyWorld } from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
const system = (messages: Messages) =>
  messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
const isPack = (messages: Messages) => system(messages).includes("pre-written Home lines");

const AT = "2026-11-07T10:00:00.000Z";
const SFW = defaultContent();
const EXPLICIT: ContentSettings = { ...defaultContent(), heat: "explicit" };
const DARK_SFW: ContentSettings = { ...defaultContent(), darkness: "dark" };

const lines = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix} line ${index + 1}.`);
const times = (zone: string) => ({
  morning: lines(`${zone} morning`, 3),
  day: lines(`${zone} day`, 3),
  night: lines(`${zone} night`, 3),
});
/** P15's reply with every zone, crotch included (an SFW pack must drop it), and a face per zone. */
function packReply(name = "Kai") {
  return {
    tap: Object.fromEntries(TAP_ZONES.map((zone) => [zone, times(`${name} ${zone}`)])) as Record<
      (typeof TAP_ZONES)[number],
      ReturnType<typeof times>
    >,
    faces: { head: "tender", cheek: "flustered", heart: "hurt", hand: "tender", crotch: "angry" } as Record<
      string,
      string
    >,
    annoyed: lines(`${name} annoyed`, 4),
    cold: lines(`${name} cold`, 6),
    comfort: lines(`${name} comfort`, 8),
    claw: {
      cheer: lines(`${name} cheer`, 4),
      cheat: lines(`${name} cheat`, 3),
      win: lines(`${name} win`, 3),
      miss: lines(`${name} miss`, 3),
      plush: lines(`${name} plush`, 3),
    },
  };
}
const packName = (messages: Messages) => /Home lines of ([^,]+),/.exec(system(messages))?.[1] ?? "Kai";
/** Answers every P15 call with a pack named after whoever it is for. */
const packAnswers = () =>
  Array.from({ length: 40 }, () => (messages: Messages) => {
    if (isPack(messages)) return json(packReply(packName(messages)));
    throw new Error("unexpected prompt");
  });

/** A stored pack as P15 would have written it before 0.14.0: head, hand and heart, no cheek, contract or faces. */
const oldPack = (stage = 1): StageLines => ({
  stage,
  tap: { head: times("old head"), hand: times("old hand"), heart: times("old heart") },
  annoyed: lines("old annoyed", 4),
  cold: lines("old cold", 6),
  at: AT,
});
const fixedLines = () => ({
  comfort: lines("first comfort", 8),
  claw: {
    cheer: lines("first cheer", 4),
    cheat: lines("first cheat", 3),
    win: lines("first win", 3),
    miss: lines("first miss", 3),
    plush: lines("first plush", 3),
  },
  at: AT,
});

/** The Home routes on a fake router, wrapped in the kit's time zones as server-entry wraps them. */
function homeRoutes(deps: HomeRouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  registerHomeRoutes(
    forgeTimeZoneRoutes({
      get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
    }),
    deps,
  );
  return async (path: string, params: Record<string, string> = {}) => {
    const handler = routes.get(`GET ${path}`)!;
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
    const result = await handler(
      { method: "GET", url: path, params: { run: runKey, ...params }, query: { timeZone: "UTC", debugMode: false } },
      reply,
    );
    assert.equal(status, 200, JSON.stringify(payload));
    return (result === reply ? payload : result) as Record<string, any>;
  };
}

async function touchWorld(runKey: string, content: ContentSettings, replies = packAnswers()) {
  const t = await storyWorld({ runKey, replies, content });
  const background = createBackgroundQueue(t.runtime);
  const deps: HomeRouteDeps = { ...t.deps, background };
  const get = homeRoutes(deps, runKey);
  const packs = () => t.calls.filter((entry) => isPack(entry.messages));
  const unit = async (li: string) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  const view = async (li = KAI) => (await get("/runs/:run/lis/:li/lines", { li })) as LinesView;
  const setContent = (next: ContentSettings) =>
    t.store.mutateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
      ...world,
      content: next,
    }));
  const setLines = (li: string, value: { stages: Record<string, StageLines>; fixed: unknown }) =>
    t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (current) => ({
      ...current,
      lines: value as never,
    }));
  return { ...t, deps, get, packs, unit, view, setContent, setLines };
}

/** Lets queued background work run. */
async function settle(runId: string, until: () => boolean | Promise<boolean> = () => false) {
  for (let round = 0; round < 200; round += 1) {
    if (await until()) return;
    await new Promise((done) => setImmediate(done));
    await runForeground(runId, async () => undefined);
  }
}

// ── The pack ──

test("a pack holds the zones the world's Heat opens, valid faces and the stamp; an old pack still reads", () => {
  const sfw = normalizeLinePack(packReply(), { stage: 2, withFixed: false, at: AT, content: SFW });
  assert.ok(typeof sfw !== "string", String(sfw));
  assert.deepEqual(Object.keys(sfw.stage.tap), ["head", "cheek", "heart", "hand"], "an SFW pack never keeps crotch");
  assert.equal(sfw.stage.contract, "home");
  assert.deepEqual(sfw.stage.faces, { head: "tender", cheek: "flustered", heart: "hurt", hand: "tender" });

  const nsfw = normalizeLinePack(packReply(), { stage: 2, withFixed: false, at: AT, content: EXPLICIT });
  assert.ok(typeof nsfw !== "string", String(nsfw));
  assert.deepEqual(Object.keys(nsfw.stage.tap), ["head", "cheek", "heart", "hand", "crotch"]);
  assert.equal(nsfw.stage.tap.crotch!.night.length, 3);
  assert.equal(nsfw.stage.contract, contentStamp(EXPLICIT));
  assert.equal(nsfw.stage.faces!.crotch, "angry");

  // Under NSFW Heat the crotch is required; cheek everywhere. A face that is not one of the five is dropped.
  const noCrotch = packReply();
  delete (noCrotch.tap as Partial<typeof noCrotch.tap>).crotch;
  assert.match(
    String(normalizeLinePack(noCrotch, { stage: 1, withFixed: false, at: AT, content: EXPLICIT })),
    /tap\.crotch\.morning needs 3/,
  );
  assert.ok(typeof normalizeLinePack(noCrotch, { stage: 1, withFixed: false, at: AT, content: SFW }) !== "string");
  const noCheek = packReply();
  delete (noCheek.tap as Partial<typeof noCheek.tap>).cheek;
  assert.match(
    String(normalizeLinePack(noCheek, { stage: 1, withFixed: false, at: AT, content: SFW })),
    /tap\.cheek\.morning needs 3/,
  );
  const oddFace = { ...packReply(), faces: { head: "smug", hand: "tender" } };
  const odd = normalizeLinePack(oddFace, { stage: 1, withFixed: false, at: AT, content: SFW });
  assert.ok(typeof odd !== "string");
  assert.deepEqual(odd.stage.faces, { hand: "tender" });
  const faceless = normalizeLinePack(
    { ...packReply(), faces: null },
    { stage: 1, withFixed: false, at: AT, content: SFW },
  );
  assert.ok(typeof faceless !== "string" && faceless.stage.faces === undefined);
  // Faces are decoration: whatever the model writes there, the reply parses (no repair turn) and the odd ones drop.
  for (const faces of [
    { head: null, hand: "tender" },
    { head: ["tender"], hand: "tender" },
    { head: "flustered, a little shy and hiding a smile at the touch", hand: "tender" },
    ["tender"],
    "tender",
  ]) {
    const parsed = LinePackReplySchema.safeParse({ ...packReply(), faces });
    assert.ok(parsed.success, JSON.stringify(faces));
    const pack = normalizeLinePack(parsed.data, { stage: 1, withFixed: false, at: AT, content: SFW });
    assert.ok(typeof pack !== "string", String(pack));
    assert.deepEqual(
      pack.stage.faces,
      Array.isArray(faces) || typeof faces === "string" ? undefined : { hand: "tender" },
    );
  }

  // A pack stored before 0.14.0 (no cheek, contract or faces) still reads; the new fields are kept on a read.
  const stored = normalizeLinePacks({ stages: { "1": oldPack(), "2": nsfw.stage }, fixed: fixedLines() });
  assert.deepEqual(stored!.stages["1"], oldPack());
  assert.deepEqual(stored!.stages["2"], nsfw.stage);
  assert.deepEqual(stored!.fixed, fixedLines());
  // The fixed pack carries the stamp it was written under, kept on a read.
  const first = normalizeLinePack(packReply(), { stage: 1, withFixed: true, at: AT, content: EXPLICIT });
  assert.ok(typeof first !== "string" && first.fixed);
  assert.equal(first.fixed.contract, contentStamp(EXPLICIT));
  assert.deepEqual(normalizeLinePacks({ stages: {}, fixed: first.fixed })!.fixed, first.fixed);
  assert.equal(LINE_PACK_MAX_TOKENS, 4500);
});

test("the stamp comes from the settings: home outside NSFW Heat, a stable hash of them under it", () => {
  assert.equal(contentStamp(SFW), "home");
  assert.equal(contentStamp(DARK_SFW), "home", "Dark romance with SFW Heat keeps the home pack");
  const stamp = contentStamp(EXPLICIT);
  assert.match(stamp, /^nsfw:[0-9a-f]{12}$/);
  // Pinned, from settings written out in full: rewording a prompt (or a default) never moves it.
  const pinned: ContentSettings = {
    heat: "fade",
    darkness: "angst",
    limits: {
      "violence-others": "allow",
      gore: "veil",
      threats: "allow",
      captivity: "veil",
      manipulation: "allow",
      stalking: "veil",
      "violence-to-protagonist": "line",
      torture: "line",
      "self-harm": "line",
      "dubious-consent": "veil",
      "non-consent": "line",
      pregnancy: "line",
    },
    custom: [{ text: "spiders", level: "veil" }],
    mcRole: "switch",
  };
  assert.equal(contentStamp(pinned), "nsfw:a03a9945b53a");
  const reordered = { ...EXPLICIT, limits: Object.fromEntries(Object.entries(EXPLICIT.limits).reverse()) };
  assert.equal(contentStamp(reordered as ContentSettings), stamp, "the key order does not matter");
  const changed: ContentSettings[] = [
    { ...EXPLICIT, heat: "fade" },
    { ...EXPLICIT, darkness: "dark" },
    { ...EXPLICIT, limits: { ...EXPLICIT.limits, gore: "line" } },
    { ...EXPLICIT, custom: [{ text: "spiders", level: "line" }] },
    { ...EXPLICIT, mcRole: "sub" },
  ];
  for (const content of changed) assert.notEqual(contentStamp(content), stamp, JSON.stringify(content));
});

// ── P15 ──

function packPrompt(content: ContentSettings, withFixed = true) {
  const world = { ...normalizeWorld({}), content, language: "English", setting: "A harbour city." };
  const unit = {
    name: "Kai",
    pronouns: { subject: "he", object: "him", possessive: "his" },
    bible: bible({ intimacy: { preferences: ["TASTE: being pinned"], attractions: ["confidence"] } }),
  };
  const messages = linePackMessages({
    world,
    player: { name: "Ines", pronouns: unit.pronouns },
    unit,
    stage: 2,
    withFixed,
  });
  return { world, sent: system(messages as Messages), user: messages.at(-1)!.content };
}

test("P15 keeps the home contract outside NSFW Heat and writes touch under the full contract under it", () => {
  for (const content of [SFW, DARK_SFW]) {
    const { world, sent, user } = packPrompt(content);
    assert.ok(sent.includes("pre-written Home lines"), "the phrase the fakes detect P15 by");
    assert.ok(
      sent.includes(otomeContentContract({ world, lis: [{ name: "Kai" }], kind: "home" })),
      "the home contract, word for word",
    );
    assert.match(sent, /CONTENT CONTRACT[\s\S]*Heat: SFW\./);
    assert.ok(!/Heat: NSFW/.test(sent));
    assert.match(sent, /head: hair or head; cheek: cheek or face; heart: chest; hand: hand\)/);
    assert.ok(!sent.includes("crotch") && !sent.includes("groin"), "no intimate zone");
    assert.match(sent, /"faces": \{"head": "\.\.\.", "cheek": "\.\.\.", "heart": "\.\.\.", "hand": "\.\.\."\}/);
    assert.match(sent, /- faces: for each place, the one face Kai shows .*tender, flustered, cold, hurt, angry/);
    assert.match(sent, /whatever the stage and the rules below: no darkness/);
    assert.ok(!user.includes("TASTE: being pinned"), "no tastes outside NSFW Heat");
    assert.match(
      sent,
      new RegExp(
        `Touch draws a bolder answer as they grow closer: at stage 1 it meets Kai's mask; by stage 6 Kai answers it as someone who is theirs\\. Through stage ${SLOW_BURN_LAST_STAGE} Kai never says`,
      ),
    );
  }
  assert.match(packPrompt(DARK_SFW).sent, /possessive or sharp about story events only/, "its Dark line stays");

  for (const heat of ["fade", "explicit"] as const) {
    const content = { ...EXPLICIT, heat };
    const { world, sent, user } = packPrompt(content);
    assert.ok(
      sent.includes(otomeContentContract({ world, lis: [{ name: "Kai" }], kind: "chat" })),
      "the chat contract",
    );
    assert.match(sent, /Heat: NSFW/);
    assert.match(sent, /heart: chest; hand: hand; crotch: the groin, between the legs\)/);
    assert.match(sent, /"crotch": \{\.\.\.\}\}, "faces": \{[^}]*"crotch": "\.\.\."\}/);
    assert.match(sent, /A touch to the chest or the crotch is an intimate one/);
    assert.match(user, /Kai's tastes in sex and intimacy: into TASTE: being pinned/, "his tastes beside his card");
    assert.match(sent, /These lines are warmth only, whatever the stage, the Heat and the rules below/);
    assert.ok(sent.includes("pre-written Home lines"));
  }
  assert.ok(!packPrompt(EXPLICIT, false).sent.includes("- comfort:"), "a later stage writes no comfort lines");
});

// ── Serving and staleness ──

test("Home never serves an NSFW pack under other settings, and rewrites a stale pack once", async () => {
  const t = await touchWorld("r-touch-aaaaaa", EXPLICIT);
  await t.get("/runs/:run/home");
  await settle(t.runId, async () => t.packs().length >= 3 && !!(await t.unit(MIR)).lines?.fixed);
  await settle(t.runId);
  assert.equal(t.packs().length, 3, "one call per love interest");
  const written = (await t.unit(KAI)).lines!;
  assert.equal(written.stages["1"]!.contract, contentStamp(EXPLICIT));
  assert.equal(written.fixed!.contract, contentStamp(EXPLICIT), "the fixed pack is stamped too");
  const nsfw = await t.view();
  assert.equal(nsfw.claw!.cheer[0], "Kai cheer line 1.");
  assert.equal(nsfw.ready, true);
  assert.equal(nsfw.tap!.crotch!.day[0], "Kai crotch day line 1.");
  assert.deepEqual(nsfw.faces, { head: "tender", cheek: "flustered", heart: "hurt", hand: "tender", crotch: "angry" });
  assert.match(system(t.packs()[0]!.messages), /Heat: NSFW, explicit/);

  // Heat lowered to SFW: the NSFW pack is not served at once (the catalog's lines meanwhile), and one rewrite is queued.
  await t.setContent(SFW);
  const lowered = await t.view();
  assert.deepEqual([lowered.ready, lowered.tap, lowered.faces, lowered.claw], [false, null, {}, null]);
  assert.equal(lowered.comfort[0], "Kai comfort line 1.", "comfort keeps the care rule's warmth, so it stays");
  assert.equal((await t.get("/runs/:run/home")).lines.ready, false);
  await settle(t.runId, async () => (await t.unit(KAI)).lines!.stages["1"]!.contract === "home");
  await settle(t.runId);
  assert.equal(t.packs().length, 6, "every love interest's pack is written once more, for SFW");
  assert.match(system(t.packs()[3]!.messages), /Heat: SFW\./);
  assert.match(system(t.packs()[3]!.messages), /- claw: /, "the NSFW fixed pack is written again in the same call");
  const sfw = await t.view();
  assert.equal(sfw.ready, true);
  assert.deepEqual(Object.keys(sfw.tap!), ["head", "cheek", "heart", "hand"], "no crotch");
  assert.equal((await t.unit(KAI)).lines!.fixed!.contract, "home");
  assert.equal(sfw.claw!.plush[0], "Kai plush line 1.");

  // Raised again: the SFW pack serves until the NSFW one lands.
  await t.setContent(EXPLICIT);
  const raised = await t.view();
  assert.equal(raised.ready, false);
  assert.equal(raised.tap!.crotch, undefined);
  assert.equal(raised.tap!.cheek!.day[0], "Kai cheek day line 1.");
  await settle(t.runId, async () => (await t.unit(KAI)).lines!.stages["1"]!.contract !== "home");
  await settle(t.runId);
  assert.equal(t.packs().length, 7, "only the love interest whose lines were read");
  assert.ok(!system(t.packs()[6]!.messages).includes("- claw: "), "an SFW fixed pack serves anywhere and stays");
  assert.ok((await t.view()).tap!.crotch);
  assert.equal((await t.view()).claw!.cheer[0], "Kai cheer line 1.");

  // A new Line changes the stamp: written once, then left alone.
  const withLine: ContentSettings = { ...EXPLICIT, custom: [{ text: "spiders", level: "line" }] };
  await t.setContent(withLine);
  assert.equal((await t.view()).tap, null, "the pack written before the Line is not served");
  await settle(t.runId, async () => (await t.unit(KAI)).lines!.stages["1"]!.contract === contentStamp(withLine));
  await settle(t.runId);
  assert.equal(t.packs().length, 8);
  assert.match(system(t.packs()[7]!.messages), /Lines \(never written, not even implied\): [^\n]*spiders/);
  assert.equal((await t.view()).ready, true);
  await settle(t.runId);
  assert.equal(t.packs().length, 8, "a current pack is never written again");
});

test("a pack from before 0.14.0 is written once more for cheek; earlier stages and the fixed lines stay", async () => {
  const t = await touchWorld("r-touchold-aaaaaa", SFW);
  for (const li of [KAI, MIR]) await t.setLines(li, { stages: { "1": oldPack() }, fixed: fixedLines() });
  const before = await t.view();
  assert.equal(before.ready, false);
  assert.equal(before.tap!.head.day[0], "old head day line 1.", "the old pack serves until the new one lands");
  assert.equal(before.tap!.cheek, undefined, "cheek plays the catalog's lines meanwhile");
  await settle(t.runId, async () => !!(await t.unit(KAI)).lines!.stages["1"]!.tap.cheek);
  await settle(t.runId);
  assert.equal(t.packs().length, 1);
  assert.ok(!system(t.packs()[0]!.messages).includes("- comfort:"), "the fixed lines are not written again");
  const kai = (await t.unit(KAI)).lines!;
  assert.equal(kai.fixed!.comfort[0], "first comfort line 1.");
  assert.equal(kai.stages["1"]!.contract, "home");
  assert.equal((await t.view()).ready, true);
  await t.view();
  await settle(t.runId);
  assert.equal(t.packs().length, 1, "then left alone");
});

test("the Claw Machine says no cold, claw or plush line from an NSFW pack once Heat is lowered", () => {
  const pack = normalizeLinePack(packReply(), { stage: 1, withFixed: true, at: AT, content: EXPLICIT });
  assert.ok(typeof pack !== "string");
  const state = normalizeState({ lis: { [KAI]: {} } });
  const lines = { stages: { "1": pack.stage }, fixed: pack.fixed };
  const units = [{ id: KAI, name: "Kai", bible: null, cutouts: {}, outfits: [], lines }];
  const kept = playView(state, units as never, EXPLICIT, "2026-11-07");
  assert.deepEqual(kept.lis[KAI]!.lines.cold, pack.stage.cold);
  assert.deepEqual(kept.lis[KAI]!.lines.claw, pack.fixed!.claw);
  const lowered = playView(state, units as never, SFW, "2026-11-07");
  assert.deepEqual(lowered.lis[KAI]!.lines.cold, [], "the catalog's cold lines instead");
  assert.equal(lowered.lis[KAI]!.lines.claw, null, "the catalog's claw lines instead");
  const changed = { ...EXPLICIT, darkness: "dark" } as ContentSettings;
  assert.equal(
    playView(state, units as never, changed, "2026-11-07").lis[KAI]!.lines.claw,
    null,
    "other NSFW settings",
  );

  // His first plush: the plush line only under the settings it was written for.
  const plush = (content: ContentSettings, round: string) =>
    finishClawRound(
      state,
      units[0] as never,
      { li: KAI, round, first: "me", caught: [{ prize: liPlushId(KAI), by: "me" }], cheered: false },
      { at: AT, dayKey: "2026-11-07", content },
    ).result.line;
  assert.ok(pack.fixed!.claw.plush.includes(plush(EXPLICIT, "c-nsfw1-abcdef")!));
  assert.equal(plush(SFW, "c-sfw1-abcdef"), undefined, "no NSFW-era plush line in the round's record");

  // A fixed pack from before 0.14.0 (no stamp) was written under `home`: it serves in any world.
  const old = { ...units[0]!, lines: { stages: { "1": oldPack() }, fixed: fixedLines() } };
  for (const content of [SFW, EXPLICIT]) {
    assert.deepEqual(linesView(old, { stage: 1, rupture: null }, content).claw, fixedLines().claw);
    assert.ok(
      fixedLines().claw.plush.includes(
        finishClawRound(
          state,
          old as never,
          {
            li: KAI,
            round: "c-old1-abcdef",
            first: "me",
            caught: [{ prize: liPlushId(KAI), by: "me" }],
            cheered: false,
          },
          { at: AT, dayKey: "2026-11-07", content },
        ).result.line!,
      ),
    );
  }
});

test("a declined NSFW pack waits out the cool-down while the SFW pack keeps serving, with no crotch", async () => {
  const t = await touchWorld("r-touchno-aaaaaa", EXPLICIT, ["", ""]);
  const sfw = normalizeLinePack(packReply(), { stage: 1, withFixed: false, at: AT, content: SFW });
  assert.ok(typeof sfw !== "string");
  await t.setLines(KAI, { stages: { "1": sfw.stage }, fixed: fixedLines() });
  const first = await t.view();
  assert.equal(first.tap!.crotch, undefined);
  await settle(t.runId, () => t.calls.length >= 2);
  await settle(t.runId);
  assert.equal(t.calls.length, 2, "the call and its repair turn");
  const again = await t.view();
  await settle(t.runId);
  assert.equal(t.calls.length, 2, "not asked again within the cool-down");
  assert.deepEqual(
    [again.ready, again.tap!.cheek!.night[0], again.tap!.crotch],
    [false, "Kai cheek night line 1.", undefined],
  );
});

// ── The client (pure) ──

test("Home shows the crotch only under NSFW Heat with lines for it; a fond touch brings its zone's face", () => {
  const view = (tap: LinesView["tap"], faces: LinesView["faces"] = {}): LinesView => ({
    ready: true,
    stage: 2,
    rupture: false,
    tap,
    faces,
    annoyed: [],
    cold: [],
    comfort: [],
    claw: null,
  });
  const withCrotch = view({ head: times("h"), hand: times("h"), heart: times("h"), crotch: times("c") });
  assert.deepEqual(shownZones(withCrotch, EXPLICIT), ["head", "cheek", "heart", "hand", "crotch"]);
  assert.deepEqual(
    shownZones(withCrotch, SFW),
    ["head", "cheek", "heart", "hand"],
    "a cached pack after Heat was lowered",
  );
  assert.deepEqual(shownZones(view(null), EXPLICIT), ["head", "cheek", "heart", "hand"], "during a rupture");
  assert.deepEqual(shownZones(null, EXPLICIT), ["head", "cheek", "heart", "hand"], "before his lines arrive");
  assert.deepEqual(tapZonesFor(EXPLICIT), [...TAP_ZONES]);
  assert.deepEqual(tapZonesFor(DARK_SFW), ["head", "cheek", "heart", "hand"]);

  assert.equal(tapFace(view(null, { cheek: "hurt" }), "cheek", "fond"), "hurt", "his pack's face for the zone");
  assert.equal(tapFace(null, "cheek", "fond"), ZONE_FACE.cheek);
  assert.equal(tapFace(view(null, { cheek: "hurt" }), "cheek", "annoyed"), "flustered");
  assert.equal(tapFace(view(null, { cheek: "hurt" }), "cheek", "cold"), "cold");
  assert.equal(homeFace("tender", "hurt", false), "hurt", "the touch's face while its line shows");
  assert.equal(homeFace("tender", null, true), "tender");
  assert.equal(homeFace("", null, true), "cold");

  // The catalog's cheek lines exist; the crotch has none (it shows only with his own lines).
  const catalog = JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/locales/en.json",
      ),
      "utf8",
    ),
  ) as Record<string, string>;
  const cheek = fallbackTapKeys("cheek", "fond");
  assert.equal(cheek.length, 3);
  for (const key of cheek) assert.ok(catalog[key], key);
  assert.deepEqual(fallbackTapKeys("crotch", "fond"), []);
  for (const key of ["tapCheek", "tapCrotch", "tapHeart"]) assert.ok(catalog[`ui.otomeForge.home.${key}`], key);
  assert.equal(catalog["ui.otomeForge.home.tapHeart"], "Chest");
});
