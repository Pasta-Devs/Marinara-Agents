// Otome Hearth friends (#2458, part 1): their levels, who may join and when (SH/friends.ts), Add a friend (POST
// /runs/:run/friends, S/story/friends.ts), the friendship a main chapter pays them (S/state/rewards.ts payFriends) and
// their block in the story prompts (S/prompts.ts friendsBlock, S/story/friends.ts friendCards).
// Run: npx tsx --tsconfig tests/tsconfig.regressions.json --test tests/otome-forge-friends.regression.ts
import assert from "node:assert/strict";
import test from "node:test";
import type { RunState } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  FRIEND_CHAPTER_AFFECTION,
  friendBlock,
  friendLevelOf,
  friendProgressOf,
  type FriendBible,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/friends.ts";
import {
  runDocTarget,
  sideCastId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
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
import { payFriends } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/rewards.ts";
import { friendCards } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/friends.ts";
import { CAST, HE, KAI, MIR, json, storyWorld } from "./fixtures/otome-forge-story.ts";

function friendBible(changes: Partial<FriendBible> = {}): FriendBible {
  return {
    age: 24,
    role: "Architect of the harbour's new bridge",
    howWeMet: "They share a wall in the lantern-keepers' row.",
    publicFace: "Sharp-tongued and always right.",
    personality: "Proud, fussy, secretly soft.",
    wound: "A failed bridge.",
    want: "To build something that lasts.",
    need: "To let someone help.",
    fear: "Being ordinary.",
    flaws: ["stubborn"],
    virtues: ["loyal"],
    voice: { register: "Precise and dry.", tics: ["Honestly."], samples: { warm: "W", teasing: "T", worried: "R" } },
    likes: ["blueprints"],
    dislikes: ["mess"],
    growth: { "1": "RANK-ONE", "2": "RANK-TWO", "3": "RANK-THREE", "4": "RANK-FOUR", "5": "RANK-FIVE" },
    onLis: { [KAI]: { stance: "ships", why: "KAI-STANCE-WHY" }, "li-ghost-0000": { stance: "against", why: "gone" } },
    onHer: "Worried she works too hard.",
    arcana: "star",
    look: { identityLine: "tall, ash hair", outfitLine: "linen coat", presentation: "man" },
    ...changes,
  };
}

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
