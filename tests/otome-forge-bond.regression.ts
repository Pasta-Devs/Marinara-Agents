// Otome Forge 0.23.0: the bond ranks. After a love interest's finale (stage 6) levels 11-20 open, one rank at a time,
// each rank's story played before the next opens (C/shared/bond.ts, SH/economy.ts bondRankOf, S/story/bond.ts), and the
// last of them opens the prestige loop (#2025). Past the finale the scene card sends the bond reveals up to the rank he
// stands at INSTEAD of his stage secrets, which his route already revealed; the planners' bible JSON keeps them.
import assert from "node:assert/strict";
import test from "node:test";
import type { Bible } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  BOND_RANKS,
  bondStoriesPlayed,
  bondStoryKey,
  bondStoryLevel,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/bond.ts";
import * as economy from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
  beatMessages,
  otomeSceneCard,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  runDocTarget,
  stateId,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { stateAtMoment } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/his-side.ts";
import {
  normalizeState,
  toRunView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { waitingBondRank } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/bond.ts";
import { KAI, bible, storyWorld } from "./fixtures/otome-forge-story.ts";

const L10 = economy.MAX_LEVEL_POINTS;
/** A story state with `played` bond stories read to their end. */
const playedChapters = (played: number) =>
  Object.fromEntries(
    Array.from({ length: played }, (_, i) => [
      bondStoryKey(KAI, 11 + i),
      { beatsRead: 1, completed: "x", applied: [] },
    ]),
  );
const rank = (points: number, open: boolean, played: number) => economy.bondRankOf(points, open, played);

test("the bond ladder continues the level curve: ten ranks at +50, level 20 at 12,350", () => {
  assert.deepEqual(economy.BOND_COSTS, [650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100]);
  assert.equal(economy.BOND_MAX_LEVEL, 20);
  assert.equal(economy.BOND_MAX_POINTS, 12_350);
  assert.equal(economy.levelFloor(11), L10 + 650, "rank 11 costs 650 past level 10");
  assert.equal(economy.levelFloor(20), 12_350);
  // The names are the maintainer's, one word each, in order.
  assert.deepEqual(
    BOND_RANKS.map((entry) => [entry.level, entry.name]),
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((level, i) => [
      level,
      ["named", "kept", "told", "hungry", "tested", "afraid", "chosen", "ahead", "home", "always"][i],
    ]),
  );
});

test("bond ranks need his finale, and no banked affection skips a rank", () => {
  // Shut: exactly the old ladder, whatever the points.
  assert.equal(rank(12_350, false, 0), 10);
  assert.equal(rank(99_999, false, 10), 10);
  assert.deepEqual(economy.affectionProgressOf(99_999), { current: 600, required: 600 }, "level 10 reads as finished");
  // At level 10 the gate opens nothing yet: rank 11 still costs its 650.
  assert.equal(rank(L10, true, 0), 10);
  // Open with rank 11's points and no story played: one rank, the first.
  assert.equal(rank(economy.levelFloor(11), true, 0), 11);
  assert.equal(rank(99_999, true, 0), 11, "affection alone never passes the first rank");
  // Each played story buys exactly one more, however many points he has.
  assert.equal(rank(99_999, true, 1), 12);
  assert.equal(rank(99_999, true, 4), 15);
  assert.equal(rank(99_999, true, 10), 20);
  // Points still gate the rank: at rank 12's floor with no story played, he stays at 11.
  assert.equal(rank(economy.levelFloor(13), true, 0), 11, "his points would buy 13, the unplayed ranks stop at 11");
  assert.equal(rank(economy.levelFloor(13), true, 1), 12);
  assert.equal(rank(economy.levelFloor(13), true, 2), 13);
});

test("a choice loss never takes a bond rank back, and stops at the last one's floor", () => {
  const floor = (points: number, played: number) => economy.affectionFloorOf(points, true, played);
  assert.equal(floor(economy.levelFloor(11) + 10, 0), economy.levelFloor(11), "rank 11's floor holds a loss");
  assert.equal(floor(economy.levelFloor(13) + 10, 2), economy.levelFloor(13), "rank 13's floor holds a loss");
  assert.equal(floor(12_350 + 10, 10), 12_350, "the last rank's floor");
  assert.equal(economy.affectionFloorOf(12_350 + 10, false, 10), L10, "without the gate, level 10's floor");
});

test("prestige opens only at level 20 with the gate, never before it", () => {
  assert.equal(economy.prestigeOf(99_999, false).unlocked, 0);
  assert.equal(economy.prestigeOf(12_349, true).unlocked, 0);
  assert.equal(economy.prestigeOf(12_650, true).points, 1);
  assert.deepEqual(economy.prestigeOf(12_350 + 900, true), { unlocked: 1, points: 0, current: 0, required: 300 });
  assert.equal(economy.nextPrestige(12_650, 0, true), null, "300 past the last rank is a point, not yet a story");
  assert.equal(economy.nextPrestige(12_350 + 900, 0, true), 1);
  assert.equal(economy.nextPrestige(12_350 + 900, 0, false), null);
});

test("the run view projects the bond rank, the stories played and the prestige at 20", () => {
  const unit = normalizeUnit({ id: KAI, name: "Kai", source: "archetype" })!;
  const view = (points: number, stage: number, played: number) =>
    JSON.parse(
      JSON.stringify(
        toRunView(
          "r-bond-abcdef",
          normalizeWorld({}),
          normalizePlayer({}),
          [unit],
          normalizeState({
            lis: { [KAI]: { points, stage } },
            chapters: playedChapters(played) as never,
          }),
        ),
      ),
    ).lis[0];
  const shut = view(99_999, 5, 0);
  assert.equal(shut.level, 10);
  assert.equal("bond" in shut, false, "no bond rank before the finale");
  assert.equal("prestige" in shut, false);
  const first = view(economy.levelFloor(11), 6, 0);
  assert.equal(first.level, 11);
  assert.deepEqual(first.bond, { level: 11, name: "named", played: 0, next: 12 });
  assert.equal("prestige" in first, false);
  const mid = view(99_999, 6, 4);
  assert.equal(mid.level, 15);
  assert.deepEqual(mid.bond, { level: 15, name: "tested", played: 4, next: 16 });
  const last = view(12_350, 6, 10);
  assert.equal(last.level, 20);
  assert.deepEqual(last.bond, { level: 20, name: "always", played: 10, next: null });
  assert.deepEqual(last.prestige, { unlocked: 0, points: 0, current: 0, required: 300 });
});

test("bond stories are counted only once read to their end, and only for their own love interest", () => {
  const chapters = {
    [bondStoryKey(KAI, 11)]: { beatsRead: 1, completed: "x", applied: [] },
    [bondStoryKey(KAI, 12)]: { beatsRead: 1, completed: null, applied: [] },
    [bondStoryKey("li-mir", 11)]: { beatsRead: 1, completed: "x", applied: [] },
    "main-1": { beatsRead: 1, completed: "x", applied: [] },
  };
  assert.equal(bondStoriesPlayed(chapters, KAI), 1, "an unfinished story does not count, and no other story does");
  assert.equal(bondStoryLevel(bondStoryKey(KAI, 14), KAI), 14);
  assert.equal(bondStoryLevel(bondStoryKey(KAI, 21), KAI), null, "no rank above 20");
  assert.equal(bondStoryLevel("main-1", KAI), null);
  // The waiting rank moves as his stories are played.
  assert.equal(waitingBondRank({ points: L10, stage: 5 }, 0), undefined, "not before the finale");
  assert.equal(waitingBondRank({ points: L10, stage: 6 }, 0), undefined, "rank 11 costs its 650 first");
  assert.equal(waitingBondRank({ points: economy.levelFloor(11), stage: 6 }, 0)?.level, 11);
  assert.equal(waitingBondRank({ points: economy.levelFloor(14), stage: 6 }, 3)?.level, 14);
  assert.equal(waitingBondRank({ points: economy.levelFloor(19), stage: 6 }, 10)?.level, 19, "points gate it too");
});

test("past the finale the scene card sends the bond reveals, not the stage secrets; before it, nothing moves", () => {
  const bond: Bible["bond"] = BOND_RANKS.map((entry) => ({ level: entry.level, truth: `BOND-TRUTH-${entry.level}` }));
  const unit = normalizeUnit({ id: KAI, name: "Kai", source: "archetype", bible: bible({ bond }) })!;
  const card = (stage: number, played: number) => otomeSceneCard(unit, { stage, points: 99_999, bondPlayed: played });
  // Below the finale the stage secrets carry the card exactly as before.
  const early = card(4, 0);
  assert.ok(early.includes("HIDDEN-TRUTH"), "his stage-4 secret is what she learned");
  assert.ok(!early.includes("BOND-TRUTH"), "no bond reveal before the finale");
  // At rank 11 one reveal is known, the rest are not.
  const named = card(6, 0);
  assert.ok(named.includes("BOND-TRUTH-11"));
  assert.ok(!named.includes("BOND-TRUTH-12"), "rank 12 is not known yet");
  assert.ok(!named.includes("HIDDEN-TRUTH"), "his stage secrets leave the card");
  // The card keeps its three newest known reveals (the list's cap), newest first: 15, 14, 13.
  const tested = card(6, 4);
  assert.ok(tested.includes("BOND-TRUTH-15"), "rank 15's reveal is the newest she learns");
  assert.ok(tested.includes("BOND-TRUTH-14") && tested.includes("BOND-TRUTH-13"));
  assert.ok(!tested.includes("BOND-TRUTH-12"), "older ones fall off the card's list, as any list there does");
  assert.ok(!tested.includes("BOND-TRUTH-16"), "rank 16 is not known yet");
  assert.ok(!tested.includes("Hidden ("), "nothing is hidden any more: the route revealed his secrets");
});

// ── Dottore's proofs (#2254): the rank reaches every prompt through its production caller, and his side stops where
// his moment did ──

/** Kai's bible with all ten bond truths, so a card that reaches rank 15 can show them. */
const bondTruths = (): Bible["bond"] =>
  BOND_RANKS.map((entry) => ({ level: entry.level, truth: `BOND-TRUTH-${entry.level}` }));

/** The reply each prompt kind wants, whichever caller asks: the note, a chat reply, a Read Me set, a Read Him set. */
const anyReply = (list: ReadonlyArray<{ content: string }>) => {
  const text = list.map((message) => message.content).join("\n");
  if (text.includes("message of the day in an otome visual novel"))
    return JSON.stringify({
      text: "The lamp room was warm.",
      face: "tender",
      mood: { word: "calm", reason: "harbour" },
    });
  if (text.includes("in your private message thread"))
    return JSON.stringify({ messages: [{ text: "Awake. Barely." }], suggestions: [] });
  if (text.includes('"Read Me", a mini-game'))
    return JSON.stringify({
      context: "Kai studies you over the sea wall.",
      guesses: ["likes", "fears", "habits", "dreams"].map((category, i) => ({
        category,
        line: `You would rather sit out the storm indoors, would you not? (${i})`,
        face: "tender",
        fact: `Ines keeps her own hours, case ${i}.`,
        reactions: {
          right: { line: "I knew it.", face: "tender" },
          close: { line: "Nearly.", face: "" },
          wrong: { line: "Hm. Noted.", face: "cold" },
        },
      })),
    });
  if (text.includes('", a mini-game in an otome visual novel. Each round'))
    return JSON.stringify({
      rounds: Array.from({ length: 5 }, (_, i) => ({
        context: `Kai polishes the lamp glass, moment ${i}.`,
        line: "You are early today.",
        face: "guarded",
        readings: ["He is glad you came.", "He wants the room to himself.", "He is counting the bells."],
        trueIndex: 0,
        thought: "She came back.",
        tell: null,
      })),
    });
  throw new Error(`Unexpected prompt: ${text.slice(0, 120)}`);
};

test("a rank 15 love interest is named at rank 15 by the note, chat, Read Me and Read Him callers", async () => {
  // Dottore (#2254): a test that passes bondPlayed in itself proves nothing; these go through the functions the routes
  // call, which read the count from the run state. Reverting one caller's `bondPlayed` makes its line read 11 of 20.
  const { serveNote } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/note.ts");
  const { sendMessage } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts");
  const { startReadMe } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-me.ts");
  const { startReadHim } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-him.ts");
  const t = await storyWorld({
    runKey: "r-bond15car-aaaaaa",
    lis: { [KAI]: { stage: 6, points: economy.levelFloor(15) } },
    replies: Array.from({ length: 24 }, () => anyReply),
  });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, ...playedChapters(4) } as never,
  }));
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) =>
    unit ? { ...unit, bible: unit.bible ? { ...unit.bible, bond: bondTruths() } : unit.bible } : unit,
  );
  await serveNote(t.deps, t.runId, KAI, { debugMode: false });
  await sendMessage(t.deps, t.runId, KAI, { text: "Are you awake?" }, { debugMode: false });
  await startReadMe(t.deps, t.runId, KAI, { debugMode: false });
  await startReadHim(t.deps, t.runId, KAI, { debugMode: false });

  const prompts = t.calls.map((call) => call.messages.map((message) => message.content).join("\n"));
  assert.equal(prompts.length, 4, "one call per caller: the note, the reply, the two sets");
  for (const text of prompts) {
    assert.ok(text.includes("bond rank 15 of 20"), "each caller names the rank he stands at");
    assert.ok(text.includes("BOND-TRUTH-15"), "each knows rank 15's reveal");
    assert.ok(!text.includes("BOND-TRUTH-16"), "and none past it");
  }
});

test("his side stops at the moment it retells: a bond story played since is not counted", () => {
  // Dottore (#2254): stateAtMoment rewinds his card but used to keep today's chapters, so a scene of one afternoon was
  // annotated with the ranks learned weeks later.
  const state = normalizeState({
    lis: { [KAI]: { stage: 6, points: economy.levelFloor(15) } },
    chapters: playedChapters(4) as never,
  });
  const moment = {
    arc: 0,
    ref: "main-1/0",
    moment: "truth" as const,
    stage: 6,
    trust: 0,
    tension: 0,
    open: [],
    rupture: null,
    at: "2026-09-01T00:00:00.000Z",
  };
  const then = stateAtMoment(state, KAI, moment);
  for (let level = 11; level <= 14; level += 1)
    assert.equal(then.chapters[bondStoryKey(KAI, level)], undefined, `rank ${level}'s story is not there yet`);
  const unit = normalizeUnit({ id: KAI, name: "Kai", source: "archetype", bible: bible({ bond: bondTruths() }) })!;
  const node = { i: 0, kind: "beat" as const, guide: "At the lamp.", cast: [KAI] };
  const card = (at: typeof state) =>
    beatMessages({
      world: normalizeWorld({ language: "English" }),
      player: normalizePlayer({ name: "Ines" }),
      units: [unit],
      state: at,
      chapter: { key: "story-bond-1", kind: "story", li: KAI, lead: KAI, title: "After", nodes: [node] },
      node,
      storySoFar: [],
      memory: "",
    })
      .map((message) => message.content)
      .join("\n");
  const held = card(then);
  assert.ok(held.includes("bond rank 11 of 20"), "the rank he held at the moment");
  assert.ok(!held.includes("BOND-TRUTH-12"), "nothing learned after it");
  // The same scene read now: every rank played is his again.
  const now = card(state);
  assert.ok(now.includes("bond rank 15 of 20"));
  assert.ok(!now.includes("BOND-TRUTH-16"), "still not past the rank he stands at");
});
