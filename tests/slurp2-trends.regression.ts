import assert from "node:assert/strict";
import {
  readSlurpTrends,
  slurpAddAdopter,
  slurpPickTrendJoin,
  slurpTrendBlocked,
  slurpTrendLabel,
  slurpTrendLabelOf,
  slurpTrendLine,
  slurpTrendQuoteOf,
  slurpTrendMayStart,
  slurpTrendOrigin,
  slurpTrendRole,
  slurpTrendStage,
  type SlurpTrend,
  type SlurpTrendPost,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/discovery/slp-trends.ts";
import { SLP_TREND_ACTIONS } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-trend-actions.ts";
import { parseSlurpBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import { normalizeSlurpSharedWorldTrend } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-shared-preseed.ts";
import type { SlurpTieCreator } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";

const HOUR = 3_600_000;
const t0 = new Date("2026-10-15T12:00:00Z");
const ago = (hours: number) => new Date(t0.getTime() - hours * HOUR).toISOString();
const at = (hours: number) => new Date(t0.getTime() + hours * HOUR);

// Stage follows age alone.
const trend: SlurpTrend = {
  id: "t1",
  label: "Mirror selfies",
  source: "creator",
  starterId: "s",
  originPostId: "p",
  line: null,
  lean: null,
  spicy: false,
  startedAt: t0.toISOString(),
  adopters: [],
};
assert.deepEqual(
  [0, 35, 36, 71, 72, 119, 120].map((h) => slurpTrendStage(trend, at(h))),
  ["rising", "rising", "peak", "peak", "tired", "tired", "dead"],
);

// Only a public, fresh, clearly bigger post takes off; player likes, unlocks and tips weigh most.
const post = (over: Partial<SlurpTrendPost>): SlurpTrendPost => ({
  id: "x",
  createdAt: ago(5),
  access: "public",
  title: "Rooftop sunrise coffee run!",
  likes: 2,
  replies: 0,
  playerLikes: 0,
  unlocks: 0,
  tips: 0,
  spicy: false,
  ...over,
});
const quiet = [1, 2, 3].map((n) => post({ id: `q${n}`, createdAt: ago(60 + n), likes: 3 }));
assert.equal(slurpTrendOrigin([post({ likes: 10 }), ...quiet], t0), null, "ten likes is not taking off");
assert.equal(slurpTrendOrigin([post({ likes: 40 }), ...quiet], t0)?.id, "x");
assert.equal(
  slurpTrendOrigin([post({ playerLikes: 2, unlocks: 3, tips: 1 }), ...quiet], t0)?.id,
  "x",
  "30 by the weights",
);
assert.equal(
  slurpTrendOrigin([post({ likes: 40, access: "locked" }), ...quiet], t0),
  null,
  "a locked post never starts one",
);
assert.equal(slurpTrendOrigin([post({ likes: 40, createdAt: ago(80) }), ...quiet], t0), null, "too old");
assert.equal(slurpTrendOrigin([post({ likes: 40 })], t0), null, "no history");
assert.equal(
  slurpTrendLabel("“Rooftop sunrise coffee run for everyone here!”"),
  "Rooftop sunrise coffee run for everyone",
);

// Roles are stable and roughly the mix, and some Creators never join.
const ids = Array.from({ length: 1000 }, (_, n) => `c${n}`);
const mix: Record<string, number> = {};
for (const id of ids) mix[slurpTrendRole(id)] = (mix[slurpTrendRole(id)] ?? 0) + 1;
assert.equal(slurpTrendRole("c7"), slurpTrendRole("c7"));
assert.ok(
  mix.ignores! > 120 && mix.ignores! < 280 && mix.trendsetter! > 40 && mix.trendsetter! < 130,
  JSON.stringify(mix),
);

const creator = (id: string, text = "", tags: string[] = []): SlurpTieCreator =>
  ({ id, name: id, text, tags, automatic: true, followers: 100 }) as SlurpTieCreator;
const crowd = ids.map((id) => creator(id));
const byId = new Map([...crowd, creator("s", "", ["art"])].map((entry) => [entry.id, entry]));
const joins = (when: Date, tiedIds = new Set<string>()) =>
  crowd.filter((entry) =>
    slurpPickTrendJoin({
      creator: entry,
      sequence: 1,
      trends: [trend],
      at: when,
      automaticCount: 100,
      creators: byId,
      tiedIds,
      avoid: [],
    }),
  );
// A day-old trend: only the daily cap (15 of 100) can join, and never an "ignores" Creator.
const rising = joins(at(20));
assert.ok(rising.length > 0 && rising.every((entry) => slurpTrendRole(entry.id) !== "ignores"));
assert.equal(joins(at(130)).length, 0, "a dead trend is joined by nobody");
// Repeatable: same slot, same answer.
assert.deepEqual(
  joins(at(40)).map((e) => e.id),
  joins(at(40)).map((e) => e.id),
);

// Caps: the daily limit and the peak share stop joining.
const crowded: SlurpTrend = {
  ...trend,
  adopters: Array.from({ length: 15 }, (_, n) => ({
    id: `a${n}`,
    at: ago(1),
    role: "follower" as const,
    postId: null,
  })),
};
assert.equal(
  crowd.filter((entry) =>
    slurpPickTrendJoin({
      creator: entry,
      sequence: 1,
      trends: [crowded],
      at: t0,
      automaticCount: 100,
      creators: byId,
      tiedIds: new Set(),
      avoid: [],
    }),
  ).length,
  0,
  "15 joined in the last day is the daily limit for 100 Creators",
);

// Hard noes: the player's avoid list and a card that refuses it both skip.
assert.equal(slurpTrendBlocked("", ["selfies"], "Mirror selfies"), true);
assert.equal(slurpTrendBlocked("She never posts mirror selfies.", [], "Mirror selfies"), true);
assert.equal(slurpTrendBlocked("She loves mirror selfies.", [], "Mirror selfies"), false);

assert.equal(slurpTrendBlocked("", ["gym stuff"], "Gym fit check"), true, "short words count");
assert.equal(slurpTrendBlocked("", ["your mood"], "Show your morning coffee"), false, "stop words do not");
assert.equal(slurpTrendBlocked("", ["selfiestick"], "Mirror selfies"), false, "whole words only");

// Start rules and repairs.
assert.equal(slurpTrendMayStart([trend], "mirror selfies", t0), false, "same label");
assert.equal(
  slurpTrendMayStart([trend, { ...trend, id: "b", label: "B" }, { ...trend, id: "c", label: "C" }], "D", t0),
  false,
  "three live",
);
assert.equal(
  readSlurpTrends([{ id: "", label: "x" }, null, { ...trend, line: "No slot", adopters: [{ id: "" }] }]).length,
  1,
);
assert.equal(
  slurpAddAdopter(slurpAddAdopter([trend], "t1", { id: "z", at: ago(1), role: "early", postId: null }), "t1", {
    id: "z",
    at: ago(0),
    role: "early",
    postId: null,
  })[0]!.adopters.length,
  1,
);
// A world trend needs a label and a line with exactly one slot.
assert.deepEqual(
  normalizeSlurpSharedWorldTrend({ trend: { label: "Sock puppet day", line: "You show {a} with a sock." } }),
  {
    label: "Sock puppet day",
    line: "You show {a} with a sock.",
  },
);
assert.equal(normalizeSlurpSharedWorldTrend({ trend: { label: "x", line: "No slot." } }), null);
assert.equal(normalizeSlurpSharedWorldTrend({ trend: null }), null);
// The post is told who started it and how to join; a contrarian roasts the trend, not a person.
const join = (role: "follower" | "early" | "contrarian") => ({ trend, role, stage: "peak" as const });
assert.match(slurpTrendLine(join("follower"), "Mira"), /"Mirror selfies", started by Mira/u);
assert.match(slurpTrendLine(join("contrarian"), null), /roast it/u);
assert.equal(slurpTrendLine(join("follower"), "Mira"), slurpTrendLine(join("follower"), "Mira"));
assert.equal(
  slurpTrendLine({ ...join("follower"), trend: { ...trend, line: "You show {a}." } }, null),
  "You show {a}.",
);
// The origin post is quoted from the stamp.
assert.equal(slurpTrendQuoteOf({ slurpTrend: { id: "t1", label: "x", originPostId: "p" } }), "p");
assert.equal(slurpTrendQuoteOf({ slurpTrend: { id: "t1", label: "x", originPostId: null } }), null);
assert.equal(slurpTrendQuoteOf(null), null);
// A planned slot keeps its trend: the beat survives being stored and read back.
const beat = {
  type: "audience_game",
  anchorKind: "trend",
  anchor: "Mirror selfies",
  line: "x",
  cast: [],
  place: null,
  trend: { id: "t1", label: "Mirror selfies", originPostId: "p" },
};
assert.deepEqual(parseSlurpBeat(JSON.parse(JSON.stringify(beat)))?.trend, beat.trend);
// What the player says to lean into reaches every joining Creator, a world trend's line too.
const leaning = { ...join("follower"), trend: { ...trend, lean: "puppies" } };
assert.match(slurpTrendLine(leaning, null), /Lean into: puppies\./u);
assert.match(
  slurpTrendLine({ ...leaning, trend: { ...leaning.trend, line: "You show {a}." } }, null),
  /^You show \{a\}\. Lean into: puppies\.$/u,
);
assert.equal(readSlurpTrends([{ ...trend, lean: "  puppies " }])[0]!.lean, "puppies");
// The two Stir levers: a named starter and a lean are optional; an empty lean clears a steer.
assert.equal(SLP_TREND_ACTIONS["start-trend"].schema.safeParse({ label: "Puppies" }).success, true);
assert.equal(
  SLP_TREND_ACTIONS["start-trend"].schema.safeParse({ label: "Puppies", accountId: "a", lean: "cute" }).success,
  true,
);
assert.equal(SLP_TREND_ACTIONS["steer-trend"].schema.safeParse({ trendId: "t1", lean: "" }).success, true);
assert.equal(SLP_TREND_ACTIONS["steer-trend"].schema.safeParse({ trendId: "t1", lean: "x".repeat(81) }).success, false);
// The lean is held to the same hard noes as the label, and an origin-less trend lets its named starter post it once.
assert.equal(slurpTrendBlocked("", ["puppies"], "Cozy night puppies"), true);
const starterId = ids.find((id) => slurpTrendRole(id) === "early")!;
const stirTrend = { ...trend, originPostId: null, starterId, lean: null };
const starterJoins = Array.from({ length: 40 }, (_, sequence) => sequence).some((sequence) =>
  slurpPickTrendJoin({
    creator: crowd.find((entry) => entry.id === starterId)!,
    sequence,
    trends: [stirTrend],
    at: at(10),
    automaticCount: 100,
    creators: byId,
    tiedIds: new Set(),
    avoid: [],
  }),
);
assert.equal(starterJoins, true, "a named starter can post their own trend");
const withOrigin = { ...stirTrend, originPostId: "p" };
assert.equal(
  Array.from({ length: 40 }, (_, sequence) => sequence).some((sequence) =>
    slurpPickTrendJoin({
      creator: crowd.find((entry) => entry.id === starterId)!,
      sequence,
      trends: [withOrigin],
      at: at(10),
      automaticCount: 100,
      creators: byId,
      tiedIds: new Set(),
      avoid: [],
    }),
  ),
  false,
  "a starter with an origin post already posted it",
);
// The 40% is of everyone across all live trends together: 4 of 10 have joined, split over two trends.
const adopter = (id: string) => ({ id, at: ago(30), role: "follower" as const, postId: null });
const split = [
  { ...trend, id: "a", label: "A one", adopters: [adopter("x1"), adopter("x2")] },
  { ...trend, id: "b", label: "B two", adopters: [adopter("x3"), adopter("x4")] },
];
assert.equal(
  crowd.slice(0, 200).some((entry) =>
    slurpPickTrendJoin({
      creator: entry,
      sequence: 3,
      trends: split,
      at: at(20),
      automaticCount: 10,
      creators: byId,
      tiedIds: new Set(),
      avoid: [],
    }),
  ),
  false,
  "4 of 10 across two trends is the limit",
);
assert.equal(slurpTrendLabelOf({ slurpTrend: { id: "t", label: "Puppies" } }), "Puppies");
assert.equal(slurpTrendLabelOf(null), "");
console.log("slurp2 trends: ok");
