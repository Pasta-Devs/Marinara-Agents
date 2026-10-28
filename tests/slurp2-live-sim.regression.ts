/**
 * Live shows v3, slice 1: the code-only simulation that runs a show while nobody watches.
 * It must be seeded (same show, same story), keep to the Creator's spice level, and book money exactly.
 */
import assert from "node:assert/strict";
import {
  SLP_DEFAULT_LIVE_SETTINGS,
  normalizeSlpLiveSettings,
  slpLiveApplyTip,
  slpLiveLog,
  slpLiveMenuFor,
  slpLiveMinute,
  slpLiveStart,
  slpLiveSummaryText,
  slpLiveWorkQueue,
  slurpLiveSlot,
  SLP_LIVE_ORDER_MS,
  type SlpLiveFan,
  slpLiveView,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-live.ts";
import {
  slpLiveFeedDelay,
  slpLiveFeedMerge,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/live/slp-live-feed.ts";
import {
  slpLiveApplyBeat,
  slpLiveParseBeat,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-live-beat.ts";
import {
  slpLivePictureDue,
  slpLivePictureScene,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-live-picture.ts";
import { slpLiveApplyPrivate } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-live-private.ts";
import { slpExtensionFromLegacy } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-extensions.ts";

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

// An install saved before Live existed keeps it off; only the player turns it on.
assert.equal(
  slpExtensionFromLegacy("live", { paused: false }, { inlineAdsEnabled: true, brandDealsPace: "normal" }),
  false,
);

// A player tip is booked once per request id, however often the request is retried.
const retry = slpLiveStart({ level: "none", fans: 0 });
assert.equal(slpLiveApplyTip(retry, { by: "persona:p1", name: "Kit", amount: 50 }, 0, "req-12345678"), true);
assert.equal(slpLiveApplyTip(retry, { by: "persona:p1", name: "Kit", amount: 50 }, 0, "req-12345678"), false);
assert.equal(retry.raised, 50);

// The chat shows the last lines of the first poll at once, then queues new ones and never repeats a line.
const join = (at: number) => ({ at, kind: "join" as const, by: `fan:${at}`, name: `Fan ${at}` });
const feedFirst = slpLiveFeedMerge({ shown: [], queue: [], seen: new Set() }, [1, 2, 3, 4].map(join), 2);
assert.deepEqual(
  feedFirst.shown.map((event) => event.at),
  [3, 4],
);
assert.equal(feedFirst.queue.length, 0);
const feedSecond = slpLiveFeedMerge(
  feedFirst,
  [3, 4, 5].map(join).concat([{ at: 6, kind: "leave", by: "fan:6", name: "Fan 6" }]),
);
assert.deepEqual(
  feedSecond.queue.map((event) => event.at),
  [5],
);
const twice = { at: 7, kind: "tip" as const, by: "fan:7", name: "Fan 7", amount: 5 };
const feedTwice = slpLiveFeedMerge(feedSecond, [twice, twice]);
assert.equal(feedTwice.queue.length, 3, "two equal tips in one minute are two lines");
assert.equal(slpLiveFeedMerge(feedTwice, [twice, twice]).queue.length, 3, "and never repeat");
assert.equal(slpLiveFeedDelay(1), 3_000);
assert.equal(slpLiveFeedDelay(100), 600);

// A beat keeps only lines from the host and fans in the room, spaced out; the player's message cuts the
// unplayed rest of the last beat, and the screen only shows lines whose moment has come.
assert.equal(slpLiveParseBeat({ lines: [{ t: "x", who: "a", text: "b" }] }), null);
const room = slpLiveStart({ level: "suggestive", fans: 10 });
room.room = ["fan:1"];
room.names = { "fan:1": "Kit" };
const beat = slpLiveParseBeat({
  lines: [
    { t: 0, who: "host", text: "hi Kit", action: "waves" },
    { t: 0, who: "Kit", text: "hiii" },
    { t: 3, who: "Stranger", text: "not in the room" },
    { t: 2, who: "cam", text: "Mara waves at the cam from the bed" },
    { t: 99, who: "Mara", text: "the end" },
  ],
  patch: { heat: 40, strip: true, place: "on the bed" },
})!;
assert.equal(slpLiveApplyBeat(room, beat, { at: 10_000, seconds: 30, host: "Mara" }), 3);
const said = room.log.filter((event) => event.kind === "say" || event.kind === "chat");
assert.deepEqual(
  said.map((event) => event.at),
  [10_000, 11_500, 40_000],
);
assert.equal(room.heat, 20, "heat patch is capped at 10");
assert.equal(room.strip, 1);
assert.equal(room.place, "on the bed");
assert.equal(room.beatTo, 40_000);
// A cam line keeps its own time and never spaces the talk.
assert.deepEqual(
  room.log.filter((event) => event.kind === "cam").map((event) => [event.at, event.text]),
  [[12_000, "Mara waves at the cam from the bed"]],
);
slpLiveApplyBeat(room, slpLiveParseBeat({ lines: [{ t: 1, who: "host", text: "Alex, yes!" }] })!, {
  at: 20_000,
  seconds: 30,
  host: "Mara",
  you: { by: "persona:p1", name: "Alex", text: "can you dance?" },
});
assert.deepEqual(
  room.log.filter((event) => ["say", "chat", "you"].includes(event.kind)).map((event) => event.text),
  ["hi Kit", "hiii", "can you dance?", "Alex, yes!"],
);
const shown = slpLiveView(
  {
    id: "s",
    hostId: "h",
    hostKind: "creator",
    startedAt: new Date(0).toISOString(),
    endsAt: new Date(3_600_000).toISOString(),
    endedAt: null,
    state: room,
  },
  20_500,
  null,
);
assert.equal(shown.log.at(-1)?.kind, "you", "the answer waits for its moment");

// Pictures: an opening shot first, then one per `pictureSeconds`, event moments first, all under the cap.
const pics = slpLiveStart({ level: "nudity", fans: 10 });
const rate = { pictureSeconds: 60, pictureMax: 2 };
assert.equal(slpLivePictureDue(pics, 0, rate), "opening");
pics.pictureAt = 0;
pics.shooting = 0;
assert.equal(slpLivePictureDue(pics, 90_000, rate), null, "one picture at a time");
pics.shooting = null;
pics.pictures = [{ at: 20_000, path: "a.png" }];
assert.equal(slpLivePictureDue(pics, 30_000, rate), null, "the rate holds");
assert.equal(slpLivePictureDue(pics, 61_000, rate), "rate");
pics.log.push({ at: 50_000, kind: "order", by: "f1", name: "a", amount: 60, itemId: "closeUp" });
assert.equal(slpLivePictureDue(pics, 61_000, rate), "order", "a visual order goes first");
pics.shooting = -4 * 60_000;
assert.equal(slpLivePictureDue(pics, 61_000, rate), "order", "a lost picture does not block the show");
pics.pictures.push({ at: 70_000, path: "b.png" });
assert.equal(slpLivePictureDue(pics, 200_000, rate), null, "the cap holds");
pics.queue.push({ id: "q", itemId: "closeUp", by: "f1", name: "a", at: 50_000, doneAt: null });
assert.match(slpLivePictureScene(pics, 61_000, "order"), /close-up/);
const picView = (at: number) =>
  slpLiveView(
    {
      id: "s",
      hostId: "h",
      hostKind: "creator",
      startedAt: new Date(0).toISOString(),
      endsAt: new Date(3_600_000).toISOString(),
      endedAt: null,
      state: pics,
    },
    at,
    null,
  );
assert.deepEqual(picView(30_000).picture, { n: 0, at: 20_000 }, "a picture shows only once it has landed");
assert.deepEqual(picView(80_000).picture, { n: 1, at: 70_000 });
assert.equal(JSON.stringify(picView(80_000)).includes("b.png"), false, "media paths stay on the server");

// Private show: one payer at a time, own block extends, the room waits, only the Creator talks.
const priv = slpLiveStart({ level: "nudity", fans: 10 });
priv.room = ["f1"];
priv.names = { f1: "dex" };
slpLiveLog(priv, { at: 70_000, kind: "chat", by: "f1", name: "dex", text: "written ahead" });
const buy = { by: "persona:p", name: "Kai", price: 300, minutes: 10 };
assert.equal(slpLiveApplyPrivate(priv, buy, 60_000, "r1"), true);
assert.equal(slpLiveApplyPrivate(priv, buy, 60_000, "r1"), false, "a retry books once");
assert.equal(
  priv.log.some((event) => event.text === "written ahead"),
  false,
  "public talk written ahead stops",
);
assert.equal(priv.raised, 0, "private coins do not fill the goals");
assert.equal(slpLiveApplyPrivate(priv, { ...buy, by: "persona:q" }, 120_000, "r2"), false, "one payer at a time");
assert.equal(slpLiveApplyPrivate(priv, buy, 120_000, "r3"), true);
assert.equal(priv.private?.to, 60_000 + 20 * 60_000, "buying again extends");
const privFans = [{ id: "f1", name: "dex", activeHour: 12, tipChance: 1, maxTip: 500 }];
assert.deepEqual(
  slpLiveMinute(priv, privFans, { showId: "p", minute: 3, hour: 12 }),
  [],
  "nobody tips into a private show",
);
priv.room = ["f1"];
const privBeat = slpLiveParseBeat({
  lines: [
    { t: 0, who: "host", text: "just us now" },
    { t: 1, who: "dex", text: "hello?" },
  ],
})!;
slpLiveApplyBeat(priv, privBeat, { at: 200_000, seconds: 20, host: "Rowan" });
assert.equal(
  priv.log.filter((event) => event.at >= 200_000 && event.kind === "chat").length,
  0,
  "no fan chat in private",
);
assert.equal(slpLivePictureDue(priv, 200_000, { pictureSeconds: 60, pictureMax: 5 }), "opening");
priv.pictureAt = 59_000;
assert.equal(
  slpLivePictureDue(priv, 130_000, { pictureSeconds: 60, pictureMax: 5 }),
  "private",
  "a private block opens with a picture",
);
priv.pictureAt = 125_000;
assert.equal(
  slpLivePictureDue(priv, 130_000, { pictureSeconds: 60, pictureMax: 5 }),
  null,
  "an extension is no new opening",
);
const privView = (me: string) =>
  slpLiveView(
    {
      id: "p",
      hostId: "h",
      hostKind: "creator",
      startedAt: new Date(0).toISOString(),
      endsAt: new Date(3_600_000).toISOString(),
      endedAt: null,
      state: priv,
    },
    300_000,
    me,
  );
assert.equal(privView("persona:p").private?.mine, true);
// A private beat that comes back after its block ended is dropped, not said to the room.
const lateBeat = slpLiveParseBeat({ lines: [{ t: 0, who: "host", text: "still just us" }] })!;
assert.equal(
  slpLiveApplyBeat(priv, lateBeat, { at: priv.private!.to + 1_000, seconds: 20, host: "Rowan", alone: priv.private }),
  0,
);
assert.equal(privView("persona:q").private?.mine, false);

// The player hosts: their line is the host's, the model's host lines are dropped, the ideas are kept.
{
  const hosted = { ...slpLiveStart({ level: "suggestive", fans: 10 }), hostPersona: "p" };
  hosted.room = ["f1"];
  hosted.names.f1 = "Kai";
  const hostBeat = slpLiveParseBeat({
    lines: [
      { t: 0, who: "host", text: "the model must not speak for the player" },
      { t: 1, who: "Kai", text: "omg hi" },
    ],
    next: ["Ask Kai about their day", "Tease the goal", ""],
  })!;
  assert.deepEqual(hostBeat.next, ["Ask Kai about their day", "Tease the goal"]);
  const kept = slpLiveApplyBeat(hosted, hostBeat, {
    at: 10_000,
    seconds: 20,
    host: "Rowan",
    you: { by: "persona:p", name: "Rowan", text: "hey chat" },
    hosting: true,
  });
  assert.equal(kept, 1);
  const says = hosted.log.filter((event) => event.kind === "say");
  assert.deepEqual(
    says.map((event) => event.text),
    ["hey chat"],
  );
  assert.equal(
    hosted.log.some((event) => event.kind === "you"),
    false,
  );
  assert.deepEqual(hosted.next, hostBeat.next);
  // Only-ideas beats still count when the room is quiet.
  assert.ok(slpLiveParseBeat({ lines: [], next: ["Wave"] }));
  const hostView = (me: string) =>
    slpLiveView(
      {
        id: "h",
        hostId: "c",
        hostKind: "player",
        startedAt: new Date(0).toISOString(),
        endsAt: new Date(3_600_000).toISOString(),
        endedAt: null,
        state: hosted,
      },
      20_000,
      me,
    );
  assert.equal(hostView("persona:p").hosting, true);
  assert.deepEqual(hostView("persona:p").next, hostBeat.next);
  assert.equal(hostView("persona:q").hosting, false);
  assert.deepEqual(hostView("persona:q").next, []);
}

// Somebody answers the go-live notice: the first minute never leaves a room with fans empty.
{
  const quiet = slpLiveStart({ level: "nudity", fans: 1 });
  slpLiveMinute(quiet, [{ id: "q1", name: "quiet_crash", activeHour: 3, tipChance: 0, maxTip: 5 }], {
    showId: "quiet",
    minute: 0,
    hour: 15,
  });
  assert.deepEqual(quiet.room, ["q1"]);
  assert.equal(quiet.names.q1, "quiet_crash");
}

// A fan named "Cam" speaks as a fan; a hosting player's show ignores the model's strip and place.
const camRoom = slpLiveStart({ level: "suggestive", fans: 10 });
camRoom.room = ["fan:9"];
camRoom.names = { "fan:9": "Cam" };
slpLiveApplyBeat(
  camRoom,
  slpLiveParseBeat({ lines: [{ t: 0, who: "cam", text: "hey" }], patch: { strip: true, place: "bed" } })!,
  { at: 1_000, seconds: 30, host: "Mara", hosting: true },
);
assert.deepEqual(
  camRoom.log.filter((event) => event.kind === "chat").map((event) => event.by),
  ["fan:9"],
);
assert.equal(camRoom.strip, 0);
assert.notEqual(camRoom.place, "bed");

// The recap is built from the show, so two shows with the same top tipper read differently.
const recapState = slpLiveStart({ level: "explicit", fans: 10 });
recapState.raised = 120;
recapState.tippers = { "fan:1": 90, "fan:2": 30 };
recapState.names = { "fan:1": "CopperCountess", "fan:2": "Moth" };
recapState.queue = [{ id: "o1", itemId: "dance", by: "fan:1", name: "CopperCountess", at: 0, doneAt: 5 }];
const recapA = slpLiveSummaryText("show-a", { ...recapState, place: "the bed" });
const recapB = slpLiveSummaryText("show-b", recapState);
assert.match(recapA, /the bed/u);
assert.match(recapA, /a dance/u);
assert.match(recapA, /120 coins from 2 tippers/u);
assert.notEqual(recapA, recapB);

console.log("slurp2 live sim: ok");
