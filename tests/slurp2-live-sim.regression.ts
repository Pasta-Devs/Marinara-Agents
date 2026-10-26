/**
 * Live shows v3, slice 1: the code-only simulation that runs a show while nobody watches.
 * It must be seeded (same show, same story), keep to the Creator's spice level, and book money exactly.
 */
import assert from "node:assert/strict";
import {
  SLP_DEFAULT_LIVE_SETTINGS,
  normalizeSlpLiveSettings,
  slpLiveApplyTip,
  slpLiveMenuFor,
  slpLiveMinute,
  slpLiveStart,
  slpLiveWorkQueue,
  slurpLiveSlot,
  SLP_LIVE_ORDER_MS,
  type SlpLiveFan,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-live.ts";

// The menu follows the spice level: no strip items for a clean Creator, all of them for an explicit one.
const clean = slpLiveMenuFor("none").map((item) => item.id);
assert.ok(!clean.includes("layer") && !clean.includes("flash") && !clean.includes("toy"));
assert.ok(slpLiveMenuFor("explicit").some((item) => item.id === "toy"));
assert.equal(slpLiveStart({ level: "none", fans: 10 }).stripMax, 0);

// Goals grow, and each hit queues its reward for free.
const state = slpLiveStart({ level: "nudity", fans: 20 });
const [first, second] = state.goals;
assert.ok(first!.target < second!.target);
slpLiveApplyTip(state, { by: "fan-1", name: "Juno", amount: first!.target }, 1000);
assert.equal(state.raised, first!.target);
assert.equal(state.goals[0]!.hitAt, 1000);
assert.equal(state.goals[1]!.hitAt, null);
assert.ok(state.queue.some((order) => order.by === "goal" && order.itemId === first!.reward));
assert.deepEqual(state.tippers, { "fan-1": first!.target });

// A tip that pays a strip item queues it; the layer comes off only after the order before it had its time.
const strip = slpLiveStart({ level: "suggestive", fans: 0 });
const layer = strip.menu.find((item) => item.strip)!;
slpLiveApplyTip(strip, { by: "fan-2", name: "Dax", amount: layer.price, itemId: layer.id }, 0);
slpLiveWorkQueue(strip, SLP_LIVE_ORDER_MS - 1);
assert.equal(strip.strip, 0);
slpLiveWorkQueue(strip, SLP_LIVE_ORDER_MS);
assert.equal(strip.strip, 1);
// Never more than the level allows.
for (let index = 0; index < 5; index += 1) {
  slpLiveApplyTip(strip, { by: "fan-2", name: "Dax", amount: layer.price, itemId: layer.id }, 0);
  slpLiveWorkQueue(strip, SLP_LIVE_ORDER_MS * (index + 2));
}
assert.equal(strip.strip, strip.stripMax);

// A room fills from the fans who are awake, and the same show replays the same way.
const fans: SlpLiveFan[] = Array.from({ length: 40 }, (_, index) => ({
  id: `fan-${index}`,
  name: `Fan ${index}`,
  activeHour: 21,
  tipChance: 0.35,
  maxTip: 90,
}));
function run() {
  const show = slpLiveStart({ level: "explicit", fans: 40 });
  const tips = [];
  for (let minute = 0; minute < 30; minute += 1) {
    for (const tip of slpLiveMinute(show, fans, { showId: "show-a", minute, hour: 21 })) {
      tips.push(tip);
      slpLiveApplyTip(show, tip, minute * 60_000);
    }
  }
  return { show, tips };
}
const one = run();
const two = run();
assert.deepEqual(one.tips, two.tips);
assert.ok(one.show.room.length > 5, `room fills at the fans' hour (got ${one.show.room.length})`);
assert.ok(one.tips.length > 3, `fans tip (got ${one.tips.length})`);
assert.equal(
  one.show.raised,
  one.tips.reduce((sum, tip) => sum + tip.amount, 0),
);
assert.ok(one.tips.every((tip) => tip.amount >= 5 && tip.amount <= 90));

// Shows fall one per slot at a seeded time, with a length inside the settings.
const live = { ...SLP_DEFAULT_LIVE_SETTINGS, everyDays: 1, minMinutes: 30, maxMinutes: 60 };
const slot = slurpLiveSlot("creator-1", live, Date.parse("2026-10-26T12:00:00Z"));
assert.equal(slot.id, slurpLiveSlot("creator-1", live, slot.startAt).id);
const minutes = (slot.endsAt - slot.startAt) / 60_000;
assert.ok(minutes >= 30 && minutes <= 60);
assert.equal(normalizeSlpLiveSettings({ minMinutes: 50, maxMinutes: 20 }).maxMinutes, 50);
assert.equal(normalizeSlpLiveSettings({ everyDays: "x" }).everyDays, SLP_DEFAULT_LIVE_SETTINGS.everyDays);

console.log("slurp2 live sim: ok");
