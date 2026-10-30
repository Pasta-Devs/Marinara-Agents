// Otome Forge M4: Wish's numbers and the pull (SH/wish.ts, S/wish/pull.ts). The roll is Gacha Forge's interpolated
// pity with Otome's constants: 1.5% from the first pull, rising from pull 46 by (1 − 1.5%) / 15 a pull, certain at 60;
// a 4★ at 10%, and every 10th pull a 4★ at least; a 5★ resets both. Pity is per banner kind, carried over and shared
// by Echoes. The charge and the roll land in one state write, which re-rolls on a conflict; a pull the wallet cannot
// pay rolls nothing; duplicates refund; a retried request id charges once; the Memory Selector opens at level 10, once.
// Each item won is kept with when it was won, in the same write.
// Seeded Math.random, as in Gacha Forge's summon-rates regression.
import assert from "node:assert/strict";
import test from "node:test";
import type { RunState } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import * as wish from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import {
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { readBanner } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/banners.ts";
import {
  applyPull,
  claimSelector,
  pullWish,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/pull.ts";
import { KAI, MIR, SOL, ageWorld, rotationReplies, seeded, wishWorld } from "./fixtures/otome-forge-wish.ts";

const { fiveStarChance, rollRarity } = wish;
const always = (value: number) => () => value;

test("Wish's numbers are pinned", () => {
  assert.deepEqual(
    {
      kinds: wish.BANNER_KINDS,
      days: wish.ROTATION_DAYS,
      five: wish.FIVE_STAR_RATE,
      soft: wish.SOFT_PITY_FROM,
      hard: wish.HARD_PITY,
      four: wish.FOUR_STAR_RATE,
      every: wish.FOUR_STAR_EVERY,
      refunds: wish.DUPLICATE_REFUNDS,
      counts: wish.PULL_COUNTS,
      sizes: wish.BANNER_SIZES,
      costs: [wish.wishCost(1), wish.wishCost(10)],
    },
    {
      kinds: ["memories", "his-wardrobe", "my-wardrobe"],
      days: 14,
      five: 0.015,
      soft: 46,
      hard: 60,
      four: 0.1,
      every: 10,
      refunds: { 5: 400, 4: 60, 3: 10 },
      counts: [1, 10],
      sizes: { five: 1, four: 3, three: 6 },
      costs: [100, 1000],
    },
  );
});

test("the 5★ chance is 1.5% to pull 45, ramps from pull 46 in fifteen equal steps, and pull 60 is certain", () => {
  const step = (1 - 0.015) / 15;
  for (const count of [0, 10, 44]) assert.equal(fiveStarChance(count), 0.015);
  assert.ok(Math.abs(fiveStarChance(45) - (0.015 + step)) < 1e-12, "pull 46 is the first step");
  assert.ok(Math.abs(fiveStarChance(58) - (0.015 + 14 * step)) < 1e-12, "pull 59 is the fourteenth");
  assert.equal(fiveStarChance(59), 1, "pull 60 is guaranteed");
  for (let count = 45; count < 59; count += 1) assert.ok(fiveStarChance(count + 1) > fiveStarChance(count));

  // Just under each threshold rolls the 5★; at the threshold it does not.
  assert.equal(rollRarity({ count: 0, since4: 0 }, always(0.015 - 1e-6)).rarity, 5);
  assert.notEqual(rollRarity({ count: 0, since4: 0 }, always(0.015)).rarity, 5);
  assert.notEqual(rollRarity({ count: 44, since4: 0 }, always(0.07)).rarity, 5, "pull 45 is still the base rate");
  assert.equal(rollRarity({ count: 45, since4: 0 }, always(0.07)).rarity, 5, "pull 46 already rises past 7%");
  assert.notEqual(rollRarity({ count: 58, since4: 0 }, always(0.999999)).rarity, 5);
  assert.equal(rollRarity({ count: 59, since4: 0 }, always(0.999999)).rarity, 5);
});

test("every 10th pull is a 4★ at least, and a 5★ resets both counters", () => {
  const high = always(0.999999);
  assert.deepEqual(rollRarity({ count: 3, since4: 8 }, high), { rarity: 3, pity: { count: 4, since4: 9 } });
  assert.deepEqual(rollRarity({ count: 4, since4: 9 }, high), { rarity: 4, pity: { count: 5, since4: 0 } });
  assert.deepEqual(rollRarity({ count: 59, since4: 9 }, high), { rarity: 5, pity: { count: 0, since4: 0 } });
  // The 4★ draw only happens once the 5★ missed.
  assert.equal(rollRarity({ count: 0, since4: 0 }, always(0.05)).rarity, 4);
  // Never more than 59 pulls without a 5★, or 9 without a 4★: the exact count the client shows.
  let pity = wish.freshPity();
  for (let pull = 1; pull <= 600; pull += 1) {
    pity = rollRarity(pity, high).pity;
    assert.ok(pity.count < 60 && pity.since4 < 10);
  }
  assert.deepEqual(wish.pityView({ count: 37, since4: 2 }), { fiveIn: 23, fourIn: 8 });
  assert.deepEqual(wish.pityView(wish.freshPity()), { fiveIn: 60, fourIn: 10 });
});

test("a seeded run of ordinary pulls agrees with both base rates", () => {
  const random = seeded();
  const count = 100_000;
  let fives = 0;
  let fours = 0;
  for (let index = 0; index < count; index += 1) {
    const { rarity } = rollRarity({ count: 0, since4: 0 }, random);
    if (rarity === 5) fives += 1;
    if (rarity === 4) fours += 1;
  }
  const within = (hits: number, rate: number) =>
    Math.abs(hits - count * rate) < 5 * Math.sqrt(count * rate * (1 - rate));
  assert.ok(within(fives, 0.015), `${fives}/${count} five-star rolls`);
  assert.ok(within(fours, 0.985 * 0.1), `${fours}/${count} four-star rolls`);
  // With pity carried over, a 5★ lands at least once in every 60 pulls.
  let pity = wish.freshPity();
  let since = 0;
  for (let index = 0; index < count; index += 1) {
    const roll = rollRarity(pity, random);
    pity = roll.pity;
    since = roll.rarity === 5 ? 0 : since + 1;
    assert.ok(since < 60);
  }
});

/** A world with this rotation's three banners created (three P20 replies, no art connection). */
async function openWorld(runKey: string, later: string[] = []) {
  const t = await wishWorld({ runKey, images: { connectionId: null }, replies: [...rotationReplies(), ...later] });
  const opened = await t.call("POST", "/runs/:run/wish/open");
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.deepEqual(opened.body.failed, []);
  const state = async (): Promise<RunState> => (await t.store.readDoc(stateId(t.runId), normalizeState))!;
  return { ...t, state, opened: opened.body };
}

test("a pull charges and rolls in one write: a conflict re-rolls on top, and the counter always matches", async () => {
  const t = await openWorld("r-m4pity01-aaaaaa");
  const calls = t.calls.length;
  // Another writer (a read paying 30 Starlight) lands first: the pull applies on top of it.
  t.fake.interfere(stateId(t.runId), (data) => ({ ...data, wallet: { starlight: data.wallet.starlight + 30 } }));
  const pulled = await pullWish(t.deps, t.runId, { banner: "memories-0", count: 10, random: always(0.5) });
  assert.equal(pulled.results.length, 10);
  const after = await t.state();
  const refunds = pulled.results.reduce((sum, result) => sum + result.refund, 0);
  assert.equal(after.wallet.starlight, 2000 + 30 - 1000 + refunds);
  assert.equal(pulled.starlight, after.wallet.starlight);
  // 0.5 misses 5★ and 4★ every time, so the 10th is the 4★ guarantee.
  assert.deepEqual(
    pulled.results.map((result) => result.rarity),
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 4],
  );
  assert.deepEqual(after.pity.memories, { count: 10, since4: 0 });
  assert.deepEqual(pulled.pity.memories, { fiveIn: 50, fourIn: 10 });
  assert.equal(t.calls.length, calls, "a pull never calls a model");
});

test("a pull the wallet cannot pay rolls nothing and changes nothing", async () => {
  const t = await openWorld("r-m4pity02-bbbbbb");
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    wallet: { starlight: 950 },
  }));
  const before = await t.state();
  let draws = 0;
  const counted = () => ((draws += 1), 0.5);
  await assert.rejects(pullWish(t.deps, t.runId, { banner: "memories-0", count: 10, random: counted }), {
    statusCode: 409,
    code: "insufficient",
  });
  assert.equal(draws, 0, "nothing was rolled");
  assert.deepEqual(await t.state(), before);
  const refused = await t.call("POST", "/runs/:run/wish/pull", { banner: "memories-0", count: 10 });
  assert.deepEqual([refused.status, refused.body.code], [409, "insufficient"]);
  // One wish still fits.
  const one = await t.call("POST", "/runs/:run/wish/pull", { banner: "memories-0", count: 1 });
  assert.equal(one.status, 200);
  assert.equal((await t.state()).wallet.starlight, 950 - 100 + one.body.results[0].refund);
});

test("duplicates refund by rarity, Snapshots join the timeline once, and a retried request id charges once", async () => {
  const t = await openWorld("r-m4pity03-cccccc");
  const random = seeded(7);
  const first = await pullWish(t.deps, t.runId, {
    banner: "memories-0",
    count: 10,
    requestId: "pull-aaaa-0001",
    random,
  });
  const seen = new Set<string>();
  for (const result of first.results) {
    const expected = seen.has(result.item.id) ? wish.DUPLICATE_REFUNDS[result.rarity] : 0;
    assert.equal(result.refund, expected, `${result.item.id} refund`);
    assert.equal(result.isNew, !seen.has(result.item.id));
    seen.add(result.item.id);
    if (result.isNew && result.item.kind === "snapshot3") assert.match(result.item.text ?? "", /^SNAPSHOT-memories/);
  }
  const state = await t.state();
  assert.deepEqual(state.owned.items, [...seen]);
  const [pulledAt] = state.pulls.map((entry) => entry.at);
  assert.deepEqual(state.owned.at, Object.fromEntries([...seen].map((id) => [id, pulledAt])), "each won when pulled");
  const snapshots = state.timeline.filter((entry) => entry.kind === "snapshot");
  assert.deepEqual(
    snapshots.map((entry) => entry.ref),
    [...seen].filter((id) => /-s\d$/.test(id)),
  );

  // The same request again (a dropped reply): the same results, no charge, no new roll.
  const again = await pullWish(t.deps, t.runId, {
    banner: "memories-0",
    count: 10,
    requestId: "pull-aaaa-0001",
    random,
  });
  assert.deepEqual(
    again.results.map((result) => [result.item.id, result.rarity, result.isNew, result.refund]),
    first.results.map((result) => [result.item.id, result.rarity, result.isNew, result.refund]),
  );
  assert.deepEqual(await t.state(), state);
  const wrong = await t.call("POST", "/runs/:run/wish/pull", {
    banner: "my-wardrobe-0",
    count: 1,
    requestId: "pull-aaaa-0001",
  });
  assert.deepEqual([wrong.status, wrong.body.code], [400, "bad-request"]);

  // Owning everything: every further pull is a duplicate and refunds.
  const banner = (await readBanner(t.store, t.runId, "memories-0"))!;
  const all = [...banner.items.five, ...banner.items.four, ...banner.items.three];
  const full = { ...state, owned: { items: all } };
  const { state: next, results } = applyPull(full, { banner, items: new Map(), count: 10, random: always(0.5) });
  assert.ok(results.every((result) => !result.isNew));
  assert.equal(next.wallet.starlight, full.wallet.starlight - 1000 + 9 * 10 + 60);
  assert.deepEqual(next.owned.items, all);
});

test("the pull that wins a couple set's second half dates it on the Love Timeline, once", async () => {
  const t = await openWorld("r-m4pity06-ffffff");
  await pullWish(t.deps, t.runId, { banner: "his-wardrobe-0", count: 1, random: always(0.001) });
  assert.deepEqual((await t.state()).timeline, [], "half a set is not dated");
  await pullWish(t.deps, t.runId, { banner: "my-wardrobe-0", count: 1, random: always(0.001) });
  await pullWish(t.deps, t.runId, { banner: "my-wardrobe-0", count: 1, random: always(0.001) });
  const couples = (await t.state()).timeline.filter((entry) => entry.kind === "couple");
  assert.deepEqual(
    couples.map((entry) => [entry.ref, entry.li, entry.text]),
    [["couple:his-wardrobe-0-f+my-wardrobe-0-f", KAI, "Harbour Night · Lantern Silk"]],
  );
});

test("pity is per kind, carried over to the next banner, and shared by Echoes", async () => {
  // The second rotation features Mireille, who has not been featured yet.
  const t = await openWorld("r-m4pity04-dddddd", rotationReplies(MIR, " II"));
  await pullWish(t.deps, t.runId, { banner: "memories-0", count: 10, random: always(0.5) });
  await pullWish(t.deps, t.runId, { banner: "memories-0", count: 1, random: always(0.5) });
  assert.deepEqual((await t.state()).pity, {
    memories: { count: 11, since4: 1 },
    "his-wardrobe": { count: 0, since4: 0 },
    "my-wardrobe": { count: 0, since4: 0 },
  });
  // A wardrobe pull moves only its own counter.
  await pullWish(t.deps, t.runId, { banner: "his-wardrobe-0", count: 1, random: always(0.5) });
  assert.deepEqual((await t.state()).pity["his-wardrobe"], { count: 1, since4: 1 });

  // Fourteen days on, rotation 0 is an Echo; a pull on it and one on the new banner share one memories counter.
  assert.ok(await ageWorld(t, 15));
  const opened = await t.call("POST", "/runs/:run/wish/open");
  assert.deepEqual(opened.body.failed, []);
  assert.deepEqual(
    opened.body.wish.echoes.map((banner: { key: string }) => banner.key),
    ["my-wardrobe-0", "his-wardrobe-0", "memories-0"],
  );
  assert.equal(opened.body.wish.pity.memories.fiveIn, 49);
  const echo = await pullWish(t.deps, t.runId, { banner: "memories-0", count: 1, random: always(0.5) });
  assert.deepEqual(echo.pity.memories, { fiveIn: 48, fourIn: 8 });
  const fresh = await pullWish(t.deps, t.runId, { banner: "memories-1", count: 1, random: always(0.001) });
  assert.equal(fresh.results[0]!.rarity, 5);
  assert.equal(fresh.results[0]!.item.id, "memories-1-f", "the 5★ is always the featured item");
  assert.deepEqual((await t.state()).pity.memories, { count: 0, since4: 0 });
});

test("the Memory Selector opens at level 10, once per love interest, for one of their Memories on an Echo", async () => {
  // Four rotations: the cast of three takes turns, so Kai's Memories are memories-0-f and memories-3-f.
  const t = await openWorld("r-m4pity05-eeeeee", [
    ...rotationReplies(MIR, " II"),
    ...rotationReplies(SOL, " III"),
    ...rotationReplies(KAI, " IV"),
  ]);
  const claim = (li: string, item: string) => t.call("POST", "/runs/:run/selector/:li", { item }, { li });
  const choices = async (li: string) => {
    const view = (await t.call("GET", "/runs/:run/wish")).body;
    const selector = view.selectors.find((entry: { li: string }) => entry.li === li);
    return [selector.available, selector.used, selector.choices.map((item: { id: string }) => item.id)];
  };
  const toRotation = async (days: number) => {
    assert.ok(await ageWorld(t, days));
    assert.deepEqual((await t.call("POST", "/runs/:run/wish/open")).body.failed, []);
  };
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, points: 2700 } },
  }));
  // His Memory on the live banner is pulled with pity: it is not offered, and claiming it is refused.
  assert.deepEqual(await choices(KAI), [true, false, []]);
  assert.equal((await claim(KAI, "memories-0-f")).status, 404);

  await toRotation(15);
  await toRotation(29);
  // Mireille is at level 1: her selector is locked, though her Memory (memories-1-f) is an Echo now.
  const locked = await claim(MIR, "memories-1-f");
  assert.deepEqual([locked.status, locked.body.code], [409, "locked"]);
  await toRotation(43);
  assert.deepEqual(await choices(KAI), [true, false, ["memories-0-f"]], "memories-3-f is live");
  assert.ok(await ageWorld(t, 57));
  assert.deepEqual(await choices(KAI), [true, false, ["memories-0-f", "memories-3-f"]]);
  assert.equal((await choices(MIR))[0], false);
  // Only a Memory of theirs: not another love interest's, not a Moment.
  assert.equal((await claim(MIR, "memories-0-f")).status, 404);
  assert.equal((await claim(KAI, "memories-0-a1")).status, 404);
  assert.equal((await claim(KAI, "not-an-item")).status, 404);

  const before = await t.state();
  const claiming = new Date().toISOString();
  const claimed = await claim(KAI, "memories-0-f");
  assert.equal(claimed.status, 200);
  assert.equal(claimed.body.item.owned, true);
  assert.deepEqual([claimed.body.selector.available, claimed.body.selector.used], [false, true]);
  const after = await t.state();
  assert.deepEqual(after.owned.items, ["memories-0-f"]);
  assert.ok(after.owned.at["memories-0-f"]! >= claiming, "and when it was won (the Album and Home date its CG so)");
  assert.deepEqual(after.selector, { [KAI]: "memories-0-f" }, "it records which Memory it claimed");
  assert.equal(after.wallet.starlight, before.wallet.starlight, "it costs nothing");
  assert.deepEqual(after.pity, before.pity, "and moves no pity");
  // Two claims at once, or a retry: it is claimed once.
  const [retry, twice] = await Promise.all([
    claim(KAI, "memories-0-f"),
    claimSelector(t.deps, t.runId, KAI, "memories-0-f"),
  ]);
  assert.equal(retry.status, 200);
  assert.equal(twice.item.id, "memories-0-f");
  assert.deepEqual(await t.state(), after);

  // His other Memory won on a pull is not the one the Selector claimed: a stale claim of it is refused.
  await pullWish(t.deps, t.runId, { banner: "memories-3", count: 1, random: always(0.001) });
  const won = await t.state();
  assert.ok(won.owned.items.includes("memories-3-f"));
  const stale = await claim(KAI, "memories-3-f");
  assert.deepEqual([stale.status, stale.body.code], [409, "conflict"]);
  assert.equal((await claim(KAI, "memories-0-f")).status, 200, "the claim that landed still answers");
  assert.deepEqual(await t.state(), won);
  // A state from before the claimed Memory was recorded reads as used, and never replays.
  assert.deepEqual(normalizeState({ ...won, selector: { [KAI]: true } }).selector, { [KAI]: true });
});
