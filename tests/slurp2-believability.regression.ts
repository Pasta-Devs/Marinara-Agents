import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { slurpLapseReason } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-audience-subscription.js";
import {
  SLURP_REALISTIC_TUNING,
  SLURP_TUNING_PULSE_PER_TICK_CEILING,
  slurpRhythmMultiplier,
  slurpTuningForPreset,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-tuning.js";
import {
  planSlurpWorldPulse,
  slurpPostViralMultiplier,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-pulse.js";
import { slurpLapseNote } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world-copy.js";
import { slurp2Source } from "./slurp2-source";

const R = SLURP_REALISTIC_TUNING;
const audience = Array.from({ length: 24 }, (_, index) => `fan-${index}`);
const fresh = [{ creatorAccountId: "c1", postId: "fresh", ageHours: 1, creatorReach: 3_000 }];

// ── Rhythm ──────────────────────────────────────────────────────────────────
// A crowd that behaves the same at four in the morning as at nine at night is the cheapest tell
// that nothing behind the feed is real.
const weekday = (hour: number) => slurpRhythmMultiplier(new Date(Date.UTC(2026, 2, 4, hour)));
const hours = Array.from({ length: 24 }, (_, hour) => weekday(hour));
const trough = hours.indexOf(Math.min(...hours));
const peak = hours.indexOf(Math.max(...hours));
assert.ok(trough >= 2 && trough <= 5, `the quietest hour must be deep night, got ${trough}`);
assert.ok(peak >= 19 && peak <= 22, `the busiest hour must be evening, got ${peak}`);
assert.ok(weekday(4) < weekday(12) && weekday(12) < weekday(21), "the day has to climb");
assert.equal(weekday(4), R.rhythm.nightLow, "deep night is the low setting exactly");
// The weekend is busier at the same hour, and only at the weekend.
assert.ok(slurpRhythmMultiplier(new Date(Date.UTC(2026, 2, 7, 21))) > weekday(21), "Saturday is busier");
assert.equal(slurpRhythmMultiplier(new Date(Date.UTC(2026, 2, 6, 21))), weekday(21), "Friday is a weekday");
// Mild, not a behaviour break: a day never swings by more than about a factor of two.
assert.ok(Math.max(...hours) / Math.min(...hours) < 2.5, "the realistic rhythm must stay mild");
// Off is exactly neutral, at every hour of every day.
for (const hour of [0, 4, 12, 21]) {
  for (const day of [4, 7]) {
    assert.equal(
      slurpRhythmMultiplier(new Date(Date.UTC(2026, 2, day, hour)), { ...R.rhythm, enabled: false }),
      1,
      "a disabled rhythm must change nothing",
    );
  }
}

// ── Lapse reasons and their copy ────────────────────────────────────────────
assert.equal(slurpLapseReason({ weeklyBudget: 10, price: 12, daysSinceSeen: 0 }), "price");
assert.equal(slurpLapseReason({ weeklyBudget: 40, price: 12, daysSinceSeen: 30 }), "quiet");
assert.equal(slurpLapseReason({ weeklyBudget: 40, price: 12, daysSinceSeen: 1 }), "drift");
// Somebody with no budget at all did not leave over the price; they were never going to pay.
assert.equal(slurpLapseReason({ weeklyBudget: 0, price: 12, daysSinceSeen: 20 }), "quiet");
for (const reason of ["price", "quiet", "drift"] as const) {
  const warm = slurpLapseNote("m:c:2026-03-04", reason, "warm");
  assert.ok(warm.length > 0 && warm === slurpLapseNote("m:c:2026-03-04", reason, "warm"), "notes are deterministic");
  // A warm audience never says the unkind version of the same reason.
  const blunt = new Set(
    ["mixed", "unfiltered"].map((tone) => slurpLapseNote("m:c:2026-03-04", reason, tone as "mixed")),
  );
  assert.equal(blunt.size, 1, "mixed and unfiltered share the blunt bank");
  assert.ok(!blunt.has(warm), `a warm audience must not produce the blunt ${reason} line`);
}

// The tick writes exactly one event per lapse, carries the note, and stays under the events cap.
const world = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-world.operation.ts",
  "utf8",
);
const lapseBlock = world.slice(
  world.indexOf('if (decision === "lapse")'),
  world.indexOf('if (decision === "lapse")') + 900,
);
assert.equal(lapseBlock.match(/recordCreatorEvent/gu)?.length, 1, "one lapse writes exactly one event");
assert.match(lapseBlock, /note: slurpLapseNote\(/u, "the lapse event carries the bank line");
assert.match(lapseBlock, /readSlurpAudienceTone\(settings\.audienceTone\)/u, "the lapse line respects the tone");
// `noodle` is the storage wrapped by `slurpCapTickEvents`, so the lapse event is inside the cap.
assert.match(lapseBlock, /await noodle\.recordCreatorEvent/u, "the lapse event goes through the capped storage");
assert.match(world, /slurpCapTickEvents\(createSlurpStorage\(db\), tuning\.clock\.maxEventsPerTick\)/u);
// The rhythm reaches both the pulse and the world-event plan.
assert.equal(world.match(/activity: activity \* rhythm/gu)?.length, 2, "rhythm feeds pulse and world events");

// ── Word of mouth ───────────────────────────────────────────────────────────
const follows = (tuning: typeof R.pulse, reach: number, seeds = 40) => {
  let total = 0;
  for (let index = 0; index < seeds; index += 1) {
    total += planSlurpWorldPulse(
      {
        elapsedMinutes: 180,
        targets: [{ ...fresh[0]!, creatorReach: reach }],
        audience,
        seed: `wom${index}`,
      },
      tuning,
    ).filter((action) => action.kind === "follow").length;
  }
  return total;
};
const quietPulse = { ...R.pulse, wordOfMouth: 0, viralChance: 0 };
const loudPulse = { ...R.pulse, viralChance: 0 };
assert.ok(follows(loudPulse, 3_000) > follows(quietPulse, 3_000), "word of mouth adds follows");
assert.ok(follows(loudPulse, 30_000) > follows(loudPulse, 3_000), "word of mouth scales with followers");
// A setting nobody should use still cannot flood one tick.
for (const reach of [3_000, 10_000_000]) {
  const flood = planSlurpWorldPulse(
    { elapsedMinutes: 60 * 24 * 30, targets: [{ ...fresh[0]!, creatorReach: reach }], audience, seed: "flood" },
    { ...R.pulse, wordOfMouth: 0.05, likeBudgetScale: 20 },
  );
  assert.ok(flood.length <= SLURP_TUNING_PULSE_PER_TICK_CEILING, "the hard ceiling holds");
}
// Deterministic per seed.
const args = { elapsedMinutes: 600, targets: fresh, audience, seed: "same" } as const;
assert.deepEqual(planSlurpWorldPulse(args, R.pulse), planSlurpWorldPulse(args, R.pulse));

// ── Viral luck ──────────────────────────────────────────────────────────────
const lucky = Array.from({ length: 400 }, (_, index) => slurpPostViralMultiplier(`post-${index}`, 1)).filter(
  (value) => value > 1,
);
assert.ok(lucky.length > 0 && lucky.length < 40, `a lucky post must be rare, got ${lucky.length} of 400`);
assert.ok(lucky.every((value) => value === R.pulse.viralMultiplier));
const luckyId = Array.from({ length: 400 }, (_, index) => `post-${index}`).find(
  (id) => slurpPostViralMultiplier(id, 1) > 1,
)!;
assert.equal(slurpPostViralMultiplier(luckyId, 1), slurpPostViralMultiplier(luckyId, 1), "luck is deterministic");
// Time-boxed: past the window the same post is ordinary again.
assert.equal(slurpPostViralMultiplier(luckyId, R.pulse.viralHours + 1), 1, "luck runs out");
assert.equal(slurpPostViralMultiplier(luckyId, 1, { ...R.pulse, viralChance: 0 }), 1, "zero chance is off");
// A lucky post outdraws an equally fresh ordinary one.
const share = (postId: string) => {
  let count = 0;
  for (let index = 0; index < 120; index += 1) {
    count += planSlurpWorldPulse(
      {
        elapsedMinutes: 60,
        targets: [
          { creatorAccountId: "c1", postId, ageHours: 1, creatorReach: 9_000 },
          { creatorAccountId: "c1", postId: "plain", ageHours: 1, creatorReach: 9_000 },
        ],
        audience,
        seed: `v${index}`,
      },
      R.pulse,
    ).filter((action) => action.postId === postId).length;
  }
  return count;
};
assert.ok(share(luckyId) > share("plain-twin"), "a lucky post draws more than an ordinary one");

// ── Old posts ───────────────────────────────────────────────────────────────
// The realistic default is no longer zero: a post stays quietly alive after its first two days.
assert.ok(R.pulse.oldPostTrickle > 0 && R.pulse.oldPostTrickle < 0.2, "the trickle is mild, not zero");
const older = { creatorAccountId: "c1", postId: "old", ageHours: R.pulse.postMaxAgeHours + 12, creatorReach: 12_000 };
const oldest = {
  creatorAccountId: "c1",
  postId: "oldest",
  ageHours: R.pulse.postMaxAgeHours * 6,
  creatorReach: 12_000,
};
const landed = new Map<string, number>();
for (let index = 0; index < 200; index += 1) {
  for (const action of planSlurpWorldPulse(
    { elapsedMinutes: 240, targets: [older, oldest], audience, seed: `old${index}` },
    R.pulse,
  )) {
    landed.set(action.postId, (landed.get(action.postId) ?? 0) + 1);
  }
}
assert.ok((landed.get("old") ?? 0) > 0, "an old post still gets something");
assert.ok((landed.get("oldest") ?? 0) < (landed.get("old") ?? 0), "and less of it the older it gets");

// A fan who liked a post can still comment on it later. The plan's dedupe is per pulse only, and
// the storage dedupes on (post, actor, type), so a like never blocks a later reply.
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const dedupe = storage.slice(storage.indexOf("async createNoodlerWorldInteraction("));
assert.match(
  dedupe.slice(0, 4_000),
  /eq\(noodleInteractions\.postId, postId\),\s*eq\(noodleInteractions\.actorAccountId, input\.actorId\),\s*eq\(noodleInteractions\.type, input\.type\),/u,
  "the interaction dedupe key includes the type, so a like cannot block a later comment",
);
let revisited = false;
for (let index = 0; index < 200 && !revisited; index += 1) {
  const first = planSlurpWorldPulse({ elapsedMinutes: 240, targets: fresh, audience, seed: `a${index}` }, R.pulse);
  const second = planSlurpWorldPulse({ elapsedMinutes: 240, targets: fresh, audience, seed: `b${index}` }, R.pulse);
  revisited = first.some((action) =>
    second.some(
      (later) =>
        later.postId === action.postId && later.actorAccountId === action.actorAccountId && later.kind !== action.kind,
    ),
  );
}
assert.ok(revisited, "a later pulse must be able to bring the same person back to the same post");

// ── Presets carry the new rules ─────────────────────────────────────────────
for (const preset of ["quiet", "realistic", "lively", "generous"] as const) {
  const tuning = slurpTuningForPreset(preset);
  assert.ok(tuning.rhythm.nightLow < tuning.rhythm.eveningHigh, `${preset} rhythm has a shape`);
  assert.ok(tuning.pulse.wordOfMouth > 0, `${preset} has word of mouth`);
  assert.ok(tuning.pulse.viralChance > 0, `${preset} has viral luck`);
  assert.ok(tuning.pulse.oldPostTrickle > 0, `${preset} keeps old posts alive`);
}
const quiet = slurpTuningForPreset("quiet");
const lively = slurpTuningForPreset("lively");
assert.ok(quiet.pulse.wordOfMouth < lively.pulse.wordOfMouth, "quiet spreads more slowly than lively");
assert.ok(quiet.rhythm.eveningHigh < lively.rhythm.eveningHigh);

console.log("slurp2 believability regression passed");
