// Otome Hearth friends (#2458) and End the Story (#2459): their levels, who may join and when (SH/friends.ts), Add a
// friend (POST /runs/:run/friends, S/story/friends.ts), what a main chapter and their own stories pay them
// (S/state/rewards.ts), their grievances (S/state/friends.ts), rank stories, hangouts and the Wingman
// (S/story/friend-stories.ts, S/story/friend-rewards.ts), their block in the story prompts (S/prompts.ts), the ending
// (S/story/ending.ts) and an ended story's lock (S/routes/ended.ts). #2475: a met friend's card, a friend in Your cast
// (their bible, card link and appearance), no newcomer on a cast member's card, and their portrait cut out on opening
// the story. #2502: what she wants to talk about on a hangout reaches its plan, and a plan stopped keeps nothing.
// Run: npx tsx --tsconfig tests/tsconfig.regressions.json --test tests/otome-forge-friends.regression.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { RunState } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  FRIEND_CHAPTER_AFFECTION,
  defaultFriendState,
  friendBlock,
  friendRankKey,
  friendLevelOf,
  friendProgressOf,
  friendRankOf,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/friends.ts";
import {
  chapterId,
  runDocTarget,
  sideCastId,
  stateId as stateIdOf,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizeChapter } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import type {
  OtomeRequest,
  RouteDeps,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import { cutoutsSettled } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import { paintClaimed } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import {
  chatTarget,
  normalizeThread,
  readThread,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import {
  friendPlanMessages,
  friendsBlock,
  storyContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { normalizeSideCast } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/side-cast.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  grant,
  payFriends,
  readBeatToEnd,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/rewards.ts";
import {
  applyFriendHurts,
  mendOpen,
  withFriendSpace,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/friends.ts";
import { applyMessageHurts } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/relationship.ts";
import { namesClash } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/side-cast.ts";
import { endedGuard } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/ended.ts";
import { listArcs } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/arc.ts";
import { endingView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/ending.ts";
import { askWingman } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/friend-rewards.ts";
import { waitingRank } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/friend-stories.ts";
import { friendCards } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/friends.ts";
import { introduceLoveInterest } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/introduce.ts";
import {
  CAST,
  HE,
  KAI,
  KAVEH,
  MIR,
  friendBible,
  json,
  planReply,
  seedFriend,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";
import { artWorld, routesOf } from "./fixtures/otome-forge-art.ts";

test("a friend's levels follow the love interests' first four steps, five stars at 1,100", () => {
  assert.deepEqual(
    [0, 199, 200, 449, 450, 749, 750, 1099, 1100, 9000].map(friendLevelOf),
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
  );
  assert.deepEqual(friendProgressOf(250), { current: 50, required: 250 });
  assert.deepEqual(friendProgressOf(9000), { current: 350, required: 350 }, "a full bar at the last star");
});

test("as many friends as love interests, and one joins per story arc", () => {
  assert.equal(friendBlock(2, [], 1), null);
  assert.equal(friendBlock(2, [{ arc: 1 }], 1), "arc");
  assert.equal(friendBlock(2, [{ arc: 1 }], 2), null, "the next arc may bring the next friend");
  assert.equal(friendBlock(2, [{ arc: 1 }, { arc: 2 }], 3), "full");
});

test("the state keeps friends apart from the love interests and drops a damaged entry", () => {
  const state = normalizeState({
    lis: { [KAI]: {} },
    friends: {
      "li-kaveh-ab12": { points: 260, arc: 2, joinedAt: "2026-11-24T10:00:00.000Z" },
      [KAI]: { points: 5, arc: 0 },
      "li-broken-ab12": "nope",
    },
  });
  assert.deepEqual(Object.keys(state.friends), ["li-kaveh-ab12"]);
  assert.equal(normalizeState(undefined).friends && Object.keys(normalizeState(undefined).friends).length, 0);
});

test("a main chapter pays the friends who spoke in it, as a story earning, and nobody else", () => {
  const state = normalizeState({ friends: { "li-kaveh-ab12": { points: 180, arc: 0, joinedAt: "x" } } });
  const paid = payFriends(state, ["li-kaveh-ab12", "li-kaveh-ab12", "li-ghost-0000"]);
  assert.equal(paid.state.friends["li-kaveh-ab12"]!.points, 180 + FRIEND_CHAPTER_AFFECTION);
  assert.deepEqual(paid.grants, [{ source: "friend", li: "li-kaveh-ab12", affection: FRIEND_CHAPTER_AFFECTION }]);
  assert.equal(payFriends(state, []).state, state, "no one heard, nothing written");
});

test("Add a friend writes someone new with their own bible, keeps them out of the cast, and waits for the next arc", async () => {
  const t = await storyWorld({ runKey: "r-friends-aaaaaa", replies: [json(friendBible()), json(friendBible())] });
  const added = await t.call("POST", "/runs/:run/friends", {
    source: "new",
    name: "Kaveh",
    pronouns: HE,
    notes: "My neighbour, an architect.",
  });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  assert.equal(t.calls.length, 1, "one text call, the bible");
  const run = (await readRun(t.store, t.runId))!;
  const id = added.body.friend.id as string;
  assert.deepEqual(
    Object.keys(run.state.lis),
    CAST.map((li) => li.id),
    "never a love interest",
  );
  assert.deepEqual(Object.keys(run.state.friends), [id]);
  assert.equal(run.state.friends[id]!.arc, 0);
  const unit = run.friends!.find((friend) => friend.id === id)!;
  assert.equal(unit.bible, null);
  assert.equal(unit.friend?.arcana, "star");
  assert.deepEqual(Object.keys(unit.friend!.onLis), [KAI], "a stance on someone not in the cast is dropped");
  assert.equal(unit.identityLine, "tall, ash hair");
  assert.equal(
    run.units.some((li) => li.id === id),
    false,
  );

  const again = await t.call("POST", "/runs/:run/friends", { source: "new", name: "Nahida", pronouns: HE });
  assert.equal(again.status, 409, "one friend joins per story arc");
  assert.equal(t.calls.length, 1, "and a refusal pays for nothing");
  const story = await t.call("GET", "/runs/:run/story");
  assert.equal(story.body.friendBlock, "arc");
});

test("Add a friend refuses a love interest's name, and offers the people she has met", async () => {
  const t = await storyWorld({ runKey: "r-friends-bbbbbb", replies: [json(friendBible())] });
  const taken = await t.call("POST", "/runs/:run/friends", { source: "new", name: "Mireille", pronouns: HE });
  assert.equal(taken.status, 400, JSON.stringify(taken.body));
  assert.equal(t.calls.length, 0);
  await t.store.mutateDoc(runDocTarget("sides", sideCastId(t.runId)), normalizeSideCast, (sides) => ({
    ...sides,
    people: {
      kaveh: { key: "kaveh", name: "Kaveh", chapters: ["main-1"], at: "2026-11-24T10:00:00.000Z" },
      mireille: { key: "mireille", name: "Mireille", chapters: ["main-1"], at: "2026-11-24T11:00:00.000Z" },
    },
  }));
  const met = await t.call("GET", "/runs/:run/friends/met");
  assert.deepEqual(met.body.met, [{ key: "kaveh", name: "Kaveh" }], "never a love interest");
  assert.equal(met.body.block, null);
  const added = await t.call("POST", "/runs/:run/friends", { source: "met", key: "kaveh", pronouns: HE });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  assert.equal(added.body.friend.name, "Kaveh");
});

test("the story prompts carry her friends in main, route and repair chapters only, with the rank's theme", () => {
  const state = normalizeState({
    lis: { [KAI]: {}, [MIR]: {} },
    friends: { "li-kaveh-ab12": { points: 300, arc: 0, joinedAt: "x" } },
    // Their rank-2 story read, so the prompts tell rank 2 (friendRankOf).
    chapters: { [friendRankKey("li-kaveh-ab12", 2)]: { beatsRead: 1, completed: "x" } },
  }) as RunState;
  const kaveh = { id: "li-kaveh-ab12", name: "Kaveh", pronouns: HE, friend: friendBible() } as never;
  const run = { friends: [kaveh], state };
  assert.equal(friendCards(run, "date"), undefined);
  assert.equal(friendCards(run, "story"), undefined);
  const cards = friendCards(run, "main")!;
  assert.equal(cards[0]!.level, 2);
  const units = CAST.map((li) => ({ id: li.id, name: li.name, pronouns: HE, bible: null })) as never;
  const block = friendsBlock(cards, units);
  assert.match(block, /^HER FRIENDS/u);
  assert.match(block, /Kaveh \(he\/him\/his\), friendship 2 of 5/u);
  assert.match(block, /on Kai: ships, KAI-STANCE-WHY/u);
  assert.match(block, /RANK-TWO/u);
  const world = normalizeWorld({ setting: "A harbour city.", language: "English" });
  const player = normalizePlayer({ name: "Ines" });
  assert.ok(storyContext({ world, player, units, memory: "", friends: cards }).includes(block));
  assert.doesNotMatch(storyContext({ world, player, units, memory: "" }), /HER FRIENDS/u, "no friends, no block");
});

// ── Grievances, their stories' pay, and the ending ──

const friendsState = (friend: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  normalizeState({
    lis: { [KAI]: {}, [MIR]: {} },
    friends: { [KAVEH]: { points: 300, arc: 1, joinedAt: "x", ...friend } },
    ...extra,
  });
const story = (friendStory: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({
    key: "story-x",
    kind: "story",
    lead: "",
    nodes: [{ i: 0, kind: "beat", guide: "g", cast: [] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    friendStory,
    ...extra,
  }) as never;

test("a serious hurt in Messages opens a friend's grievance once an arc; a milder one costs 15, never below the level", () => {
  const at = "2026-11-24T10:00:00.000Z";
  const opened = applyFriendHurts(friendsState(), [{ li: KAVEH, text: "You lied to me.", severity: "major" }], {
    at,
    arc: 2,
  });
  assert.deepEqual(opened.opened, [KAVEH]);
  assert.equal(opened.state.friends[KAVEH]!.grievance?.text, "You lied to me.");
  assert.equal(opened.state.friends[KAVEH]!.grievanceArc, 2);
  const again = applyFriendHurts(opened.state, [{ li: KAVEH, text: "And again.", severity: "rupture" }], {
    at,
    arc: 2,
  });
  assert.deepEqual(again.opened, [], "one stands already");
  assert.equal(again.state.friends[KAVEH]!.points, 285, "so it costs as a milder one does");
  const mild = applyFriendHurts(friendsState({ points: 205 }), [{ li: KAVEH, text: "Rude.", severity: "minor" }], {
    at,
    arc: 2,
  });
  assert.equal(mild.state.friends[KAVEH]!.points, 200, "level 2's floor holds");
  assert.deepEqual(
    applyFriendHurts(friendsState(), [{ li: KAI, text: "x", severity: "major" }], { at, arc: 2 }).hurt,
    [],
    "a love interest's hurt is not a friend's",
  );
});

test("while a friend's grievance stands they earn nothing; their make-up story waits a chapter, then clears it for 300", () => {
  const held = friendsState({ grievance: { text: "Hurt.", severity: "major", opened: "x", space: 0 } });
  assert.equal(grant(held, { source: "close-and-remember", li: KAVEH, affection: 5 }).granted.affection, 0);
  assert.deepEqual(payFriends(held, [KAVEH]).grants, []);
  assert.equal(mendOpen(held.friends[KAVEH]), false);
  const spaced = withFriendSpace(held);
  assert.equal(mendOpen(spaced.friends[KAVEH]), true);
  const done = readBeatToEnd(spaced, story({ kind: "mend", friends: [KAVEH] }), 0, { at: "y", dayKey: "2026-11-24" });
  assert.equal(done.state.friends[KAVEH]!.grievance, null);
  assert.equal(done.state.friends[KAVEH]!.points, 600);
  assert.deepEqual(
    done.grants.filter((entry) => entry.source === "friend"),
    [{ source: "friend", li: KAVEH, affection: 300 }],
  );
  const replay = readBeatToEnd(done.state, story({ kind: "mend", friends: [KAVEH] }), 0, { at: "z" });
  assert.deepEqual(replay.grants, [], "paid once");
});

test("a friend's own stories pay as their kind does; the epilogue's end ends the story", () => {
  const day = "2026-11-24";
  const rank = readBeatToEnd(friendsState(), story({ kind: "rank", friends: [KAVEH], level: 2 }), 0, {
    at: "a",
    dayKey: day,
  });
  assert.deepEqual(rank.grants, [
    { source: "beat", starlight: 30 },
    { source: "chapter", starlight: 300 },
  ]);
  const MEI = "li-mei-cd34";
  const two = normalizeState({
    lis: { [KAI]: {} },
    friends: { [KAVEH]: { points: 0, arc: 0, joinedAt: "x" }, [MEI]: { points: 0, arc: 1, joinedAt: "x" } },
  });
  const hangout = readBeatToEnd(two, story({ kind: "hangout", friends: [KAVEH, MEI] }), 0, { at: "b", dayKey: day });
  assert.deepEqual(hangout.grants, [
    { source: "chapter", starlight: 120 },
    { source: "friend", li: KAVEH, affection: 50 },
    { source: "friend", li: MEI, affection: 50 },
  ]);
  const air = readBeatToEnd(friendsState({ asked: "x" }), story({ kind: "clear-air", friends: [KAVEH] }), 0, {
    at: "c",
  });
  assert.equal(air.state.friends[KAVEH]!.asked, null);
  const epilogue = readBeatToEnd(friendsState(), story(undefined as never, { ending: "epilogue" }), 0, { at: "d" });
  assert.deepEqual(epilogue.state.ended, { at: "d" });
});

test("rank stories wait in order for the level; the Wingman waives a love interest's space once an arc", async () => {
  const state = friendsState({ points: 760 });
  assert.equal(waitingRank(state, KAVEH), 2);
  const second = normalizeState({
    ...state,
    chapters: { [friendRankKey(KAVEH, 2)]: { beatsRead: 1, completed: "x" } },
  });
  assert.equal(waitingRank(second, KAVEH), 3);
  assert.equal(waitingRank(friendsState({ points: 100 }), KAVEH), null);

  const t = await storyWorld({ runKey: "r-friends-cccccc" });
  await t.store.mutateDoc(runDocTarget("state", stateIdOf(t.runId)), normalizeState, (current) => ({
    ...current,
    friends: { [KAVEH]: { ...current.friends[KAVEH], ...defaultFriendState(0, "x"), points: 1100 } },
    chapters: { ...current.chapters, [friendRankKey(KAVEH, 5)]: { beatsRead: 3, completed: "x", applied: [] } },
    lis: {
      ...current.lis,
      [KAI]: {
        ...current.lis[KAI]!,
        grievances: [
          { id: "g1", li: KAI, by: "li", text: "x", severity: "rupture", opened: "main-1/0", status: "open" },
        ],
        rupture: { grievanceId: "g1", since: "x", space: 0 },
      },
    },
  }));
  const asked = await askWingman(t.deps, t.runId, KAVEH, KAI);
  assert.deepEqual(asked, { li: KAI, helper: KAVEH });
  const after = await t.state();
  assert.equal(after.lis[KAI]!.rupture?.space, 2);
  assert.equal(after.lis[KAI]!.rupture?.helper, KAVEH);
  await assert.rejects(() => askWingman(t.deps, t.runId, KAVEH, KAI), /already helped|nothing for them/u);
});

test("End the Story is offered once every love interest stands at level 20, and plans nothing before", async () => {
  const at20 = { points: 20000, stage: 6 };
  const bond = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`story-bond-${KAI}-${11 + i}`, { beatsRead: 1, completed: "x" }]),
  );
  const run = {
    units: CAST.slice(0, 1).map((li) => ({ id: li.id, bible: {} })),
    state: normalizeState({ lis: { [KAI]: at20 }, chapters: bond }),
  };
  assert.equal(endingView(run as never, [], null).offered, true);
  assert.equal(
    endingView({ ...run, state: normalizeState({ lis: { [KAI]: { points: 100 } } }) } as never, [], null).offered,
    false,
  );
  const t = await storyWorld({ runKey: "r-ending-aaaaaa" });
  const refused = await t.call("POST", "/runs/:run/ending");
  assert.equal(refused.status, 409);
  assert.equal(t.calls.length, 0);

  // A story from before arcs, every love interest at 20: the finale is planned with no arc, never planning one.
  const old = await storyWorld({ runKey: "r-ending-bbbbbb", replies: [json(planReply())] });
  await old.store.updateDoc(runDocTarget("state", stateIdOf(old.runId)), normalizeState, (state) => ({
    ...state,
    lis: Object.fromEntries(Object.entries(state.lis).map(([id, li]) => [id, { ...li, ...at20 }])),
    chapters: Object.fromEntries(
      Object.keys(state.lis).flatMap((id) =>
        Array.from({ length: 10 }, (_, i) => [`story-bond-${id}-${11 + i}`, { beatsRead: 1, completed: "x" }]),
      ),
    ),
  }));
  const finale = await old.call("POST", "/runs/:run/ending");
  assert.equal(finale.status, 200, JSON.stringify(finale.body));
  assert.equal(finale.body.chapter.ending, "finale");
  assert.equal(finale.body.chapter.arc, undefined, "in no arc");
  assert.deepEqual(await listArcs(old.store, old.runId), [], "and none planned");
});

test("an ended story refuses what plays and keeps what only looks", async () => {
  const handled: string[] = [];
  const routes = new Map<string, (request: unknown, reply: unknown) => Promise<unknown>>();
  const fake = {
    get: () => undefined,
    post: (path: string, handler: (request: unknown, reply: unknown) => Promise<unknown>) => routes.set(path, handler),
  };
  const ended = { readDoc: async () => normalizeState({ ended: { at: "x" } }) } as never;
  const router = endedGuard(fake as never, ended);
  for (const path of ["/runs/:run/wish/pull", "/runs/:run/chapters/:key/beats/:i/read", "/runs/:run/friends"]) {
    router.post(path, async () => handled.push(path));
  }
  const reply = () => {
    const sent: { status?: number; body?: unknown } = {};
    return {
      sent,
      status(code: number) {
        sent.status = code;
        return this;
      },
      send(body: unknown) {
        sent.body = body;
        return sent;
      },
    };
  };
  const request = { params: { run: "r-ended-aaaaaa" } };
  const pull = reply();
  await routes.get("/runs/:run/wish/pull")!(request, pull);
  assert.equal(pull.sent.status, 409);
  await routes.get("/runs/:run/chapters/:key/beats/:i/read")!(request, reply());
  await routes.get("/runs/:run/friends")!(request, reply());
  assert.deepEqual(handled, ["/runs/:run/chapters/:key/beats/:i/read"], "reading again still works");
});

test("the prompts tell a friend's rank no further than the rank stories read, and names clash either way", () => {
  assert.equal(friendRankOf(760, {}, KAVEH), 1, "level 3, but no rank story read yet");
  assert.equal(friendRankOf(760, { [friendRankKey(KAVEH, 2)]: { completed: "x" } }, KAVEH), 2);
  assert.equal(
    friendRankOf(100, { [friendRankKey(KAVEH, 2)]: { completed: "x" } }, KAVEH),
    1,
    "never above the level, should points fall",
  );
  assert.ok(namesClash("Kai", "Kai Moreno") && namesClash("Kai Moreno", "Kai"));
  assert.equal(namesClash("Kaveh", "Kai"), false);
});

test("the finale read to its end settles every grievance, both ways, and none opens after it", () => {
  const at = "2026-11-24T12:00:00.000Z";
  const state = friendsState(
    { grievance: { text: "Hurt.", severity: "major", opened: "x", space: 0 }, upset: { since: "x" } },
    {
      lis: {
        [KAI]: {
          grievances: [
            { id: "g1", li: KAI, by: "li", text: "You left.", severity: "rupture", opened: "x", status: "open" },
          ],
          rupture: { grievanceId: "g1", since: "x", space: 0 },
          upset: { since: "x" },
          points: 500,
        },
        [MIR]: {},
      },
    },
  );
  const finale = {
    key: "main-9",
    kind: "main",
    number: 9,
    lead: KAI,
    ending: "finale",
    nodes: [{ i: 0, kind: "beat", guide: "g", cast: [KAI] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
  } as never;
  const read = readBeatToEnd(state, finale, 0, { at, dayKey: "2026-11-24" }).state;
  assert.deepEqual(read.finale, { at });
  assert.equal(read.lis[KAI]!.rupture, null);
  assert.equal(read.lis[KAI]!.upset, null);
  assert.equal(read.lis[KAI]!.grievances[0]!.status, "addressed");
  assert.equal(read.friends[KAVEH]!.grievance, null);
  assert.equal(read.friends[KAVEH]!.upset, null);
  const friendHurt = applyFriendHurts(read, [{ li: KAVEH, text: "Rude.", severity: "major" }], { at, arc: 9 });
  assert.deepEqual(friendHurt.opened, [], "no friend's grievance after the finale");
  const hisHurt = applyMessageHurts(read, [{ li: KAI, text: "Cruel.", severity: "rupture" }], {
    ref: "chat/m1",
    at,
    arc: 9,
  });
  assert.equal(hisHurt.state.lis[KAI]!.rupture, null, "nor his");
  assert.equal(hisHurt.state.lis[KAI]!.grievances.length, read.lis[KAI]!.grievances.length, "nor any grievance");
  assert.equal(hisHurt.state.lis[KAI]!.points, read.lis[KAI]!.points - 15, "though it still hurts");
});

// ── #2475: a met friend's card, Your cast, and their cut-outs ──

/** The Engine cards these tests offer, by id: a card's `name` is what readCard reads. */
const cardsOf = (names: Record<string, string>) =>
  Object.entries(names).map(([id, name]) => ({ id, data: JSON.stringify({ name }), comment: "" }));

/** The run routes (Your cast's card link and appearance, GET /runs/:run), with `li` as the route's :li. */
function runRoutes(deps: RouteDeps, runKey: string, li = "") {
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

test("#2475: a friend she has met takes the card the player picks, never one in the cast, and is painted from it", async () => {
  const t = await artWorld({ runKey: "r-friendcard-aaaaaa", replies: [json(friendBible())] });
  const cards = cardsOf({ "card-kaveh": "Kaveh", "card-kaveh-alt": "Kaveh the Architect", "card-kai": "Kai" });
  t.runtime.resources.listCharacters = async (ids) => cards.filter((card) => !ids || ids.includes(card.id));
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-kai",
  }));
  await t.store.mutateDoc(runDocTarget("sides", sideCastId(t.runId)), normalizeSideCast, (sides) => ({
    ...sides,
    people: {
      kaveh: {
        key: "kaveh",
        name: "Kaveh",
        cardId: "card-kaveh",
        chapters: ["main-1"],
        at: "2026-11-24T10:00:00.000Z",
      },
    },
  }));
  const met = await t.call("GET", "/runs/:run/friends/met");
  assert.deepEqual(met.body.met, [{ key: "kaveh", name: "Kaveh", cardId: "card-kaveh" }], "the card his name matches");

  const taken = await t.call("POST", "/runs/:run/friends", {
    source: "met",
    key: "kaveh",
    pronouns: HE,
    cardId: "card-kai",
  });
  assert.equal(taken.status, 400, "a love interest's card is not a friend's");
  assert.equal(t.calls.length, 0, "and a refusal pays for nothing");

  const added = await t.call("POST", "/runs/:run/friends", {
    source: "met",
    key: "kaveh",
    pronouns: HE,
    cardId: "card-kaveh-alt",
  });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  const id = added.body.friend.id as string;
  assert.equal(added.body.friend.name, "Kaveh", "someone she has met keeps the name she knows");
  const unit = (await readRun(t.store, t.runId))!.friends!.find((friend) => friend.id === id)!;
  assert.equal(unit.cardId, "card-kaveh-alt", "the card the player picked, not the one his name matches");
  assert.equal(unit.source, "card");

  // His portrait is painted with that card as its likeness reference, as a love interest's is.
  const paint = await paintClaimed(t.deps, t.runId, `li:${id}`, { debugMode: false });
  assert.equal(paint.state, "ready");
  assert.equal(t.paid.length, 1);
  assert.equal(t.paid[0]!.request.unit?.cardId, "card-kaveh-alt");
});

test("#2475: a friend she has met joins without a card when the player picks none", async () => {
  const t = await storyWorld({
    runKey: "r-friendnocard-bbbbbb",
    replies: [json(friendBible())],
    characters: cardsOf({ "card-kaveh": "Kaveh" }),
  });
  await t.store.mutateDoc(runDocTarget("sides", sideCastId(t.runId)), normalizeSideCast, (sides) => ({
    ...sides,
    people: {
      kaveh: {
        key: "kaveh",
        name: "Kaveh",
        cardId: "card-kaveh",
        chapters: ["main-1"],
        at: "2026-11-24T10:00:00.000Z",
      },
    },
  }));
  const added = await t.call("POST", "/runs/:run/friends", { source: "met", key: "kaveh", pronouns: HE, cardId: null });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  const unit = (await readRun(t.store, t.runId))!.friends![0]!;
  assert.equal(unit.cardId, undefined);
  assert.equal(unit.source, "archetype");
});

test("#2475: someone new mid-story never takes the card a friend or love interest has under another name", async () => {
  const t = await storyWorld({
    runKey: "r-friendnew-eeeeee",
    characters: cardsOf({ "card-alha": "Alhaitham", "card-tide": "Tidecaller" }),
  });
  // Kaveh linked to Alhaitham's card, and Kai relinked to another card, in Your cast: neither name is the card's.
  await seedFriend(t, { cardId: "card-alha", source: "card" });
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-tide",
  }));
  const units = async () => (await t.store.listRun("unit", t.runId)).length;
  const had = await units();
  for (const cardId of ["card-alha", "card-tide"]) {
    await assert.rejects(
      introduceLoveInterest(t.deps, t.runId, { source: "card", cardId, pronouns: HE }),
      /already someone in your story's cast/u,
      cardId,
    );
  }
  assert.equal(await units(), had, "no unit was written");
  assert.equal(t.calls.length, 0, "and no bible was paid for");
});

test("#2475: Your cast shows a friend's bible behind the spoiler gate, takes an edit checked whole, and links their card", async () => {
  const t = await artWorld({ runKey: "r-friendcast-cccccc" });
  const cards = cardsOf({ "card-kaveh": "Kaveh", "card-kai": "Kai" });
  t.runtime.resources.listCharacters = async (ids) => cards.filter((card) => !ids || ids.includes(card.id));
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cardId: "card-kai",
  }));
  await seedFriend(t);
  const path = "/runs/:run/friends/:li/bible";
  const friendParams = { li: KAVEH };

  const gated = await t.call("GET", path, {}, friendParams);
  assert.equal(gated.status, 400, "a bible is a spoiler");
  const read = await t.call("GET", path, { spoilers: "1" }, friendParams);
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.equal(read.body.bible.growth["2"], "RANK-TWO");
  assert.equal((await t.call("GET", path, { spoilers: "1" }, { li: KAI })).status, 404, "a love interest is no friend");

  const young = await t.call("POST", path, { bible: friendBible({ age: 17 }) }, friendParams);
  assert.equal(young.status, 400, "adults only");
  const edited = friendBible({
    onHer: "EDITED: cheering her on.",
    look: { identityLine: "short ash hair, red eyes", outfitLine: "linen coat", presentation: "man" },
  });
  const saved = await t.call("POST", path, { bible: edited }, friendParams);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const unit = (await t.store.readDoc(unitId(t.runId, KAVEH), normalizeUnit))!;
  assert.equal(unit.friend?.onHer, "EDITED: cheering her on.");
  assert.deepEqual(Object.keys(unit.friend!.onLis), [KAI], "a stance on someone not in the cast is dropped");
  assert.equal(unit.identityLine, "short ash hair, red eyes", "the edited look steers the next paint");
  assert.equal(unit.bible, null, "never a love interest's bible");
  assert.equal((await t.call("POST", path, { bible: edited }, { li: KAI })).status, 404);

  // The card link and appearance take him as they take a love interest.
  const asFriend = runRoutes(t.deps, "r-friendcast-cccccc", KAVEH);
  const theirs = await asFriend("POST", "/runs/:run/lis/:li/card", { cardId: "card-kai" });
  assert.equal(theirs.status, 409, "Kai's card is his");
  const linked = await asFriend("POST", "/runs/:run/lis/:li/card", { cardId: "card-kaveh" });
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  assert.equal((await t.store.readDoc(unitId(t.runId, KAVEH), normalizeUnit))!.cardId, "card-kaveh");
  const asKai = runRoutes(t.deps, "r-friendcast-cccccc", KAI);
  assert.equal((await asKai("POST", "/runs/:run/lis/:li/card", { cardId: "card-kaveh" })).status, 409, "nor his");
  const look = await asFriend("POST", "/runs/:run/lis/:li/appearance", { identityLine: "silver hair" });
  assert.equal(look.status, 200, JSON.stringify(look.body));
  assert.equal(look.body.identityLine, "silver hair");
  const view = (await asFriend("GET", "/runs/:run")).body.view;
  const shown = view.friends.find((friend: { id: string }) => friend.id === KAVEH);
  assert.equal(shown.cardId, "card-kaveh");
  assert.equal(shown.look.identityLine, "silver hair");
});

test("#2475: opening the story cuts out a friend's painted portrait, and the view shows the cut-out once it is ready", async () => {
  const t = await artWorld({ runKey: "r-friendcut-dddddd" });
  const PORTRAIT = "/api/global-gallery/file/kaveh-matte.png";
  // Painted before #2475: a portrait on its chroma matte with no cut-out yet.
  await seedFriend(t, {
    portrait: PORTRAIT,
    portraitRef: "global-gallery:kaveh-matte",
    art: { state: "ready", at: "2026-11-24T10:00:00.000Z", url: PORTRAIT, ref: "global-gallery:kaveh-matte" },
  });
  const run = runRoutes(t.deps, "r-friendcut-dddddd");
  const first = (await run("GET", "/runs/:run")).body.view;
  assert.equal(first.cutoutsPending, true, "the view polls while his cut-out is made");
  assert.equal(first.friends[0].portrait, PORTRAIT, "the matte until the cut-out is ready");
  await cutoutsSettled();
  const unit = (await t.store.readDoc(unitId(t.runId, KAVEH), normalizeUnit))!;
  assert.equal(unit.cutouts[PORTRAIT]?.state, "ready");
  const next = (await run("GET", "/runs/:run")).body.view;
  assert.equal(next.friends[0].portrait, `${PORTRAIT}.cut.png`);
  assert.ok(next.friends[0].cut.includes(`${PORTRAIT}.cut.png`), "framed whole as a cut-out");
  assert.equal(next.cutoutsPending, undefined);
});

// ── #2502: what she wants to talk about on a hangout, and a plan stopped ──

/** A hangout's plan prompt from fixed documents: Kaveh, somewhere he chooses, with `topic` when one is given. */
function hangoutPlanPrompt(topic?: string) {
  const kaveh = { id: KAVEH, name: "Kaveh", pronouns: HE, friend: friendBible() } as never;
  return friendPlanMessages({
    world: normalizeWorld({ setting: "A harbour city.", language: "English" }),
    player: normalizePlayer({ name: "Ines" }),
    units: CAST.map((li) => ({ id: li.id, name: li.name, pronouns: HE, bible: null })) as never,
    for: {
      kind: "hangout",
      friends: [{ unit: kaveh, level: 2 }],
      place: "somewhere Kaveh chooses",
      ...(topic === undefined ? {} : { topic }),
    },
    memory: "They watched the lanterns go out.",
    nodes: 3,
  });
}

/** The hangout plan without a topic, as it was before #2502 (2026-11-27). */
const BEFORE_TOPIC = "4cec252ef2cad6ac";

test("#2502: a hangout's topic goes in its plan's task in the player's words; without one the prompt is as it was", () => {
  const digest = (messages: unknown) =>
    createHash("sha256").update(JSON.stringify(messages)).digest("hex").slice(0, 16);
  const without = hangoutPlanPrompt();
  assert.equal(digest(without), BEFORE_TOPIC);
  assert.deepEqual(hangoutPlanPrompt("   "), without, "a blank topic is none");
  const topic = 'Whether he "really" misses home';
  const topical = hangoutPlanPrompt(topic);
  assert.equal(topical.length, without.length);
  assert.equal(topical[0]!.content, without[0]!.content, "the instructions are as they were");
  // One short block in the task, after the story memory, with her words JSON-quoted.
  const task = without[1]!.content;
  const cut = task.indexOf("\n\nPlan it now.");
  assert.ok(cut > task.indexOf("They watched the lanterns go out."));
  const user = topical[1]!.content;
  assert.ok(user.startsWith(task.slice(0, cut)) && user.endsWith(task.slice(cut)));
  const block = user.slice(cut, user.length - (task.length - cut));
  assert.ok(block.includes(`\n${JSON.stringify(topic)}\n`), block);
  assert.ok(block.trim().split("\n").length <= 3, "a short block");
});

const hangoutPlan = () => ({
  title: "The Lantern Walk",
  tags: [],
  summary: "An evening along the quay.",
  nodes: [{ guide: "They meet at the bridge." }, { guide: "They share a cake." }, { guide: "They part at the row." }],
  memento: "Kaveh and Ines on the quay, lanterns behind them.",
});

test("#2502: Plan a hangout takes a topic of 300 characters at most, and Cancel keeps no plan and no answer", async () => {
  let cancel = () => {};
  const t = await storyWorld({
    runKey: "r-hangout-aaaaaa",
    cancellation: true,
    // The first plan is stopped while it is written, as Close does (POST /runs/:run/cancel); the second is kept.
    replies: [
      () => {
        cancel();
        return json(hangoutPlan());
      },
      json(hangoutPlan()),
    ],
  });
  cancel = () => void t.call("POST", "/runs/:run/cancel");
  await seedFriend(t);
  const invite = "m-hangout-0001abcd";
  await t.store.mutateDoc(chatTarget(t.runId, KAVEH), normalizeThread, (thread) => ({
    ...thread,
    li: KAVEH,
    messages: [
      {
        id: invite,
        who: "li",
        text: "Walk with me?",
        at: "2026-11-27T10:00:00.000Z",
        invite: { status: "pending", kind: "hangout" },
      },
    ],
  }));
  const body = { friends: [KAVEH], place: "partner-choice", herLook: "base", invite: { message: invite } };
  const long = await t.call("POST", "/runs/:run/hangouts", { ...body, topic: "x".repeat(301) });
  assert.equal(long.status, 400, JSON.stringify(long.body));
  assert.equal(t.calls.length, 0, "refused before anything is planned");

  const topic = 'Whether he "really" misses home';
  const stopped = await t.call("POST", "/runs/:run/hangouts", { ...body, topic: `  ${topic}  ` });
  assert.equal(stopped.status, 409, JSON.stringify(stopped.body));
  await t.settle();
  assert.deepEqual((await t.call("GET", "/runs/:run/hangouts")).body.hangouts, [], "no hangout is kept");
  const asked = (await readThread(t.store, t.runId, KAVEH))!.messages[0]!.invite;
  assert.deepEqual(asked, { status: "pending", kind: "hangout" }, "and the invitation still waits");

  const planned = await t.call("POST", "/runs/:run/hangouts", { ...body, topic: `  ${topic}  ` });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const [system, user] = t.calls.at(-1)!.messages;
  assert.ok(user!.content.includes(`\n${JSON.stringify(topic)}\n`), "her words, trimmed and quoted, in the task");
  assert.ok(!system!.content.includes(topic), "never in the instructions");
  assert.equal((await readThread(t.store, t.runId, KAVEH))!.messages[0]!.invite?.status, "accepted");
  // #2509: her everyday pick is kept on the hangout, so it starts her in it, never in what the last chapter left.
  const hangout = await t.store.readDoc(chapterId(t.runId, planned.body.chapter.key), normalizeChapter);
  assert.equal(hangout?.friendStory?.herLook, "base");
});
