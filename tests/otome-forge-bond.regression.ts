// Otome Forge 0.23.0: the bond ranks. After a love interest's finale (stage 6) levels 11-20 open, one rank at a time,
// each rank's story played before the next opens (C/shared/bond.ts, SH/economy.ts bondRankOf, S/story/bond.ts), and the
// last of them opens the prestige loop (#2025). Past the finale the scene card sends the bond reveals up to the rank he
// stands at INSTEAD of his stage secrets, which his route already revealed; the planners' bible JSON keeps them.
import assert from "node:assert/strict";
import test from "node:test";
import type { Bible } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  BOND_RANKS,
  bondStepOf,
  bondStoriesPlayed,
  bondStoryKey,
  bondStoryLevel,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/bond.ts";
import * as economy from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
  beatMessages,
  otomeSceneCard,
  SCENE_CARD_MAX_TOKENS,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
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
import { KAI, bible, beatReply, json, storyWorld } from "./fixtures/otome-forge-story.ts";

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

test("past the finale his route shows the next bond rank, the one whose story waits, and is complete only at 20", () => {
  // 0.24.5: Story → Routes said the route was complete from the finale on, with ten ranks still ahead. Each case reads
  // the run view the client gets (toRunView), as the card does.
  const unit = normalizeUnit({ id: KAI, name: "Kai", source: "archetype" })!;
  const bondOf = (points: number, played: number) =>
    JSON.parse(
      JSON.stringify(
        toRunView(
          "r-bond-abcdef",
          normalizeWorld({}),
          normalizePlayer({}),
          [unit],
          normalizeState({ lis: { [KAI]: { points, stage: 6 } }, chapters: playedChapters(played) as never }),
        ),
      ),
    ).lis[0].bond;
  const name = (step: ReturnType<typeof bondStepOf>) =>
    step && ("waiting" in step ? `waiting ${step.waiting.name}` : `next ${step.next.level} ${step.next.name}`);
  // Level 10, just past the finale: no rank yet, and rank 11 is next.
  assert.equal(name(bondStepOf(bondOf(economy.levelFloor(10), 0), false)), "next 11 named");
  // Rank 11 reached, its story waiting.
  assert.equal(name(bondStepOf(bondOf(economy.levelFloor(11), 0), true)), "waiting named");
  // Rank 11's story played, rank 12 not reached yet.
  assert.equal(name(bondStepOf(bondOf(economy.levelFloor(11), 1), false)), "next 12 kept");
  // Rank 20's story waiting, then played: only then is the route complete.
  assert.equal(name(bondStepOf(bondOf(12_350, 9), true)), "waiting always");
  assert.equal(bondStepOf(bondOf(12_350, 10), false), null);
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
  // Every reveal up to the rank he stands at is settled ground, so the card keeps all five, not the three a list keeps.
  const tested = card(6, 4);
  for (let level = 11; level <= 15; level += 1) {
    assert.ok(tested.includes(`BOND-TRUTH-${level}`), `rank ${level}'s reveal is one she has learned`);
  }
  assert.ok(!tested.includes("BOND-TRUTH-16"), "rank 16 is not known yet");
  assert.ok(!tested.includes("Hidden ("), "nothing is hidden any more: the route revealed his secrets");
  // The ladder stays inside the card's 250-token budget, so it never crowds out his voice or the red lines.
  const full = normalizeUnit({
    id: KAI,
    name: "Kai",
    source: "archetype",
    bible: bible({
      redLines: ["never cruel to her"],
      bond: BOND_RANKS.map((entry) => ({
        level: entry.level,
        truth: `BOND-TRUTH-${entry.level}: two full sentences of what she learns about him at this rank, in the bible's voice, at the length a generated reveal runs. The second adds the detail that makes it his.`,
      })),
    }),
  })!;
  for (const played of [0, 4, 9]) {
    const whole = otomeSceneCard(full, { stage: 6, points: 99_999, bondPlayed: played });
    assert.ok(estimateTextTokens(whole) <= SCENE_CARD_MAX_TOKENS, `rank ${11 + played}'s card fits the budget`);
    assert.ok(whole.includes("Red lines:"), "the ladder never pushes the red lines off the card");
  }
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
  if (text.includes("This is the group chat of an otome visual novel"))
    return JSON.stringify({ messages: [{ speaker: "Kai", text: "Some of us sleep." }] });
  // The narrator's node: the fixture's own P6 reply, under the story context every scene opens with.
  if (text.includes("You are the narrator of an otome visual novel")) return json(beatReply());
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

/** Every prompt the rank contract names, built through the production caller that sends it, in the run's order. */
async function rankPrompts(
  t: Awaited<ReturnType<typeof storyWorld>>,
  { stage, points, played }: { stage: number; points: number; played: number },
) {
  const { serveNote } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/note.ts");
  const { sendMessage } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts");
  const { sendToGroup } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/group.ts");
  const { startReadMe } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-me.ts");
  const { startReadHim } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-him.ts");
  const { serveBeat } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts");
  const { chapterPlanMessages } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts");
  const { normalizeChapter } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts");
  const { chapterId } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts");

  // One run, one rank state, every card in it read from `run.state.chapters` by the caller that builds the prompt.
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, stage, points } },
    chapters: { ...state.chapters, ...playedChapters(played) } as never,
  }));
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) =>
    unit ? { ...unit, bible: unit.bible ? { ...unit.bible, bond: bondTruths() } : unit.bible } : unit,
  );
  // The group chat needs two met love interests (the fixture's cast is), and the scene a chapter with Kai in it.
  const node = { i: 0, kind: "beat" as const, guide: "Kai waits alone at the lamp.", cast: [KAI] };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, "main-2")), normalizeChapter, () => ({
    key: "main-2",
    kind: "main",
    number: 2,
    lead: KAI,
    title: "The Bell",
    tags: [],
    summary: "",
    nodes: [node],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: "2026-10-28T10:00:00.000Z",
    connectionId: "conn-text",
  }));

  const before = t.calls.length;
  await serveNote(t.deps, t.runId, KAI, { debugMode: false });
  await sendMessage(t.deps, t.runId, KAI, { text: "Are you awake?" }, { debugMode: false });
  await sendToGroup(t.deps, t.runId, { text: "Who is up?" }, { debugMode: false });
  await startReadMe(t.deps, t.runId, KAI, { debugMode: false });
  await startReadHim(t.deps, t.runId, KAI, { debugMode: false });
  await serveBeat(t.deps, t.runId, "main-2", 0, { debugMode: false });

  const calls = t.calls.slice(before).map((call) => call.messages.map((message) => message.content).join("\n"));
  // The planner's bible block is built from the same run state, as its prompt sends it (P5's Lead is Kai).
  const { readRun } =
    await import("../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts");
  const run = (await readRun(t.store, t.runId))!;
  const unit = run.units.find((entry) => entry.id === KAI)!;
  const plan = chapterPlanMessages({
    world: run.world,
    player: run.player,
    units: run.units,
    state: run.state,
    number: 2,
    lead: KAI,
    memory: "",
  })
    .map((message) => message.content)
    .join("\n");
  return {
    note: calls[0]!,
    chat: calls[1]!,
    group: calls[2]!,
    readMe: calls[3]!,
    readHim: calls[4]!,
    scene: calls[5]!,
    plan,
    unit,
  };
}

test("a rank 15 love interest is named at rank 15 by every prompt, through its production caller", async () => {
  // Dottore (#2254): a test that passes bondPlayed in itself proves nothing; these go through the functions the routes
  // call, which read the count from the run state. Reverting one caller's `bondPlayed` makes its line read 11 of 20.
  const t = await storyWorld({
    runKey: "r-bond15car-aaaaaa",
    lis: { [KAI]: { stage: 6, points: economy.levelFloor(15) } },
    replies: Array.from({ length: 40 }, () => anyReply),
  });
  const prompts = await rankPrompts(t, { stage: 6, points: economy.levelFloor(15), played: 4 });
  // Kai at stage 6 with rank 15's points and four bond stories played stands at rank 15 exactly.
  assert.equal(economy.bondRankOf(prompts.unit ? economy.levelFloor(15) : 0, true, 4), 15);
  const every = {
    note: prompts.note,
    chat: prompts.chat,
    group: prompts.group,
    readMe: prompts.readMe,
    readHim: prompts.readHim,
    scene: prompts.scene,
  };
  for (const [kind, text] of Object.entries(every)) {
    assert.ok(text.includes("bond rank 15 of 20"), `${kind} names the rank he stands at`);
    assert.ok(text.includes('"tested"'), `${kind} names that rank's word`);
    // The scene card's reveals: ranks 11-15's truths, and none of 16's.
    if (kind === "scene" || kind === "group") {
      for (let level = 11; level <= 15; level += 1) {
        assert.ok(text.includes(`BOND-TRUTH-${level}`), `${kind} carries rank ${level}'s truth`);
      }
    }
    assert.ok(text.includes("BOND-TRUTH-15"), `${kind} knows rank 15's truth`);
    assert.ok(!text.includes("BOND-TRUTH-16"), `${kind} knows nothing past the rank`);
    assert.ok(!text.includes("HIDDEN-TRUTH"), `${kind} keeps no stage secret: his route revealed them`);
  }
  // The planner's bible JSON carries the same limit, in his bible block.
  assert.ok(prompts.plan.includes("bond rank 15 of 20"), "the planner names the rank");
  const bibleJson = /BIBLE: (\{[^]*?\})\n/u.exec(prompts.plan)?.[1];
  assert.ok(bibleJson, "P5 sends the bible as JSON");
  const bond = (JSON.parse(bibleJson) as { bond?: Array<{ level: number }> }).bond ?? [];
  assert.deepEqual(
    bond.map((entry) => entry.level),
    [11, 12, 13, 14, 15],
    "the bible JSON keeps the reached ranks and none past them",
  );
});

test("before the finale no prompt names a bond rank, and his stage secrets stay", async () => {
  const t = await storyWorld({
    runKey: "r-bond5car-aaaaaa",
    lis: { [KAI]: { stage: 5, points: 99_999 } },
    replies: Array.from({ length: 40 }, () => anyReply),
  });
  // Four stories are on record, but the finale is unread, so no rank opens.
  const prompts = await rankPrompts(t, { stage: 5, points: 99_999, played: 4 });
  for (const [kind, text] of Object.entries({
    note: prompts.note,
    chat: prompts.chat,
    group: prompts.group,
    readMe: prompts.readMe,
    readHim: prompts.readHim,
    scene: prompts.scene,
    plan: prompts.plan,
  })) {
    assert.ok(!text.includes("bond rank"), `${kind} names no bond rank before his finale`);
    assert.ok(!text.includes("BOND-TRUTH"), `${kind} carries no bond reveal before the finale`);
  }
  // His stage-4 secret was revealed by stage 5, so it stays on the card as it always was.
  assert.ok(prompts.scene.includes("HIDDEN-TRUTH"), "the scene still knows his revealed secret");
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
