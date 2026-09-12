import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isNotableAudienceArcChange,
  slurpAudienceArcDescription,
  slurpNextAudienceArc,
  SLURP_AUDIENCE_ARCS,
  SLURP_AUDIENCE_ARC_DAYS,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-audience-arc.js";

const base = {
  stage: "follower" as const,
  interactions: 10,
  spent: 0,
  daysSinceSeen: 1,
  daysOnAudienceArc: 0,
  audienceArc: "steady" as const,
};

// ── A direction has to be earned ────────────────────────────────────────────
// Calling somebody's second visit a trend is noise, and it would spend the readable-handful budget
// on people who have barely arrived.
assert.equal(slurpNextAudienceArc({ ...base, interactions: 1 }), "steady");
assert.equal(slurpNextAudienceArc({ ...base, interactions: 2 }), "steady");
// Rising needs recency AND a real relationship, or every active liker reads as on the way up.
assert.equal(slurpNextAudienceArc({ ...base, interactions: 12 }), "rising");
assert.equal(slurpNextAudienceArc({ ...base, interactions: 12, stage: "liker" }), "steady", "a liker is not rising");
assert.equal(slurpNextAudienceArc({ ...base, interactions: 12, daysSinceSeen: 6 }), "steady", "rising needs recency");

// ── Burnout is specific, not just silence ───────────────────────────────────
// A quiet spell from a casual reader is not a story. The same silence from somebody who invested
// heavily is the best story the funnel can tell.
assert.equal(
  slurpNextAudienceArc({ ...base, stage: "whale", interactions: 40, spent: 400, daysSinceSeen: 20 }),
  "burnout",
);
assert.equal(
  slurpNextAudienceArc({ ...base, interactions: 6, spent: 9, daysSinceSeen: 20 }),
  "cooling",
  "somebody who never paid much is cooling, not burning out",
);

// ── Coming back is the strongest beat ───────────────────────────────────────
assert.equal(slurpNextAudienceArc({ ...base, stage: "lapsed", daysSinceSeen: 2 }), "returning");
// Still gone is not the same as back.
assert.equal(slurpNextAudienceArc({ ...base, stage: "lapsed", daysSinceSeen: 90 }), "steady");

// ── Arcs expire ─────────────────────────────────────────────────────────────
// Without this the first arc somebody was ever given would describe them permanently, which is the
// opposite of having a trajectory.
assert.equal(
  slurpNextAudienceArc({
    ...base,
    daysSinceSeen: 6,
    daysOnAudienceArc: SLURP_AUDIENCE_ARC_DAYS + 5,
    audienceArc: "rising",
  }),
  "steady",
);
assert.equal(
  slurpNextAudienceArc(
    {
      ...base,
      stage: "subscriber",
      interactions: 9,
      spent: 30,
      daysSinceSeen: 5,
      daysOnAudienceArc: 8,
      audienceArc: "returning",
    },
    "s",
  ),
  "steady",
  "coming back is a moment, not a permanent state",
);

// Nonsense inputs must still yield a usable arc.
for (const bad of [Number.NaN, -5]) {
  const arc = slurpNextAudienceArc({ ...base, daysSinceSeen: bad, interactions: bad, daysOnAudienceArc: bad });
  assert.ok(SLURP_AUDIENCE_ARCS.includes(arc), `unusable arc for ${bad}`);
}

// ── Only report what somebody would notice ──────────────────────────────────
// Sliding back to steady is the absence of news; reporting it spends the notification budget on
// nothing happening.
assert.equal(isNotableAudienceArcChange("rising", "steady"), false);
assert.equal(isNotableAudienceArcChange("steady", "cooling"), false, "drifting off is quiet by nature");
assert.equal(isNotableAudienceArcChange("steady", "burnout"), true);
assert.equal(isNotableAudienceArcChange("steady", "returning"), true);
assert.equal(isNotableAudienceArcChange("steady", "rising"), true);
assert.equal(isNotableAudienceArcChange("rising", "rising"), false);

// ── An arc must be sayable, or it is just a column ──────────────────────────
for (const arc of SLURP_AUDIENCE_ARCS) {
  const description = slurpAudienceArcDescription(arc);
  if (arc === "steady") assert.equal(description, null, "steady is the absence of a direction");
  else assert.ok(description && description.length > 10, `${arc} needs a phrase`);
}

// ── Wiring ──────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// The arc is derived from state alone: a trajectory the player cannot account for is worse than
// none, because they would learn to distrust the ones that are real.
assert.deepEqual(
  slurpNextAudienceArc({ ...base, interactions: 12 }),
  slurpNextAudienceArc({ ...base, interactions: 12 }),
);

// It has to reach the two prompts the audience speaks through, or a trajectory nobody can hear is
// just a database column.
assert.match(
  read("services/slurp/slurp-reply-generation.service.ts"),
  /slurpAudienceArcDescription\(tie\.audienceArc\)/u,
);
assert.match(
  read("services/slurp/slurp-fan-activity.service.ts"),
  /slurpAudienceArcDescription\(persona\.audienceArc as SlurpAudienceArc\)/u,
);

const world = read("services/slurp/slurp-world.operation.ts");
assert.match(world, /slurpNextAudienceArc\(/u);
// Arcs read the same silence churn does, and recomputing a three-week trajectory on every page
// load would be a full scan for nothing.
assert.match(world, /elapsedDays >= CHURN_MIN_ELAPSED_DAYS \? accounts : \[\]/u);
assert.match(world, /isNotableAudienceArcChange\(tie\.audienceArc, next\)/u);
assert.match(read("services/slurp/slurp-population.ts"), /slurpReactivationStage/u);

const schema = read("db/schema/slurp.ts");
assert.match(schema, /audienceArc: text\("audience_arc"\)\.notNull\(\)\.default\("steady"\)/u);
assert.match(schema, /audienceArcSince: text\("audience_arc_since"\)/u);

console.log("slurp audience arc regression passed");
