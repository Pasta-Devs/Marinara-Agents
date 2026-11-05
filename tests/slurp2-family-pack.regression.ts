/**
 * S — the Family pack (docs/STORYLINES.md, PR 6): four pregnancy storylines (partner, collab, the
 * player, a father she won't name), off until the pack is on; the hard ending only behind its dial;
 * stage influences reach the lead's growth and earnings; turn-ons lean the lead pick; the child line.
 */
import assert from "node:assert/strict";
import {
  slpAdvanceDrama,
  slpDramaStageMultiplier,
  slpRequestDrama,
  SLP_EMPTY_DRAMA_STATE,
  type SlpDramaCreator,
  type SlpDramaState,
  type SlpDramaWorld,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-runtime.ts";
import { slpDramaCast } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-cast.ts";
import {
  SLP_EMPTY_DRAMA_LIBRARY,
  slpDramaEnabledIds,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-library.ts";
import {
  SLURP_FAMILY_PACK,
  SLURP_FAMILY_STORYLINES,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-family-pack.ts";
import { slurp2Source } from "./slurp2-source.ts";
import { slpStorylineSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-storyline.ts";

const HOUR = 3_600_000;
const T0 = Date.parse("2026-10-01T00:00:00.000Z");
const creator = (id: string, extra: Partial<SlpDramaCreator> = {}): SlpDramaCreator => ({
  id,
  name: id,
  automatic: true,
  gender: "female",
  spice: 3,
  tags: [],
  joinedAt: new Date(T0 - 60 * 24 * HOUR).toISOString(),
  followers: 1000,
  fitText: "",
  ...extra,
});
const world = (creators: SlpDramaCreator[], ties: string[] = []): SlpDramaWorld => ({
  creators,
  relations: new Map(),
  ties: new Set(ties),
});
const byKind = (kind: string) => SLURP_FAMILY_STORYLINES.find((entry) => entry.id === `family-pregnancy-${kind}`)!;
let counter = 0;
const advance = (
  state: SlpDramaState,
  at: number,
  storyline: (typeof SLURP_FAMILY_STORYLINES)[number],
  scene: SlpDramaWorld,
  dials = {},
) =>
  slpAdvanceDrama(state, {
    at: new Date(at),
    level: "soap",
    situations: [],
    dramas: [storyline],
    dials,
    world: scene,
    activity: 1,
    newId: () => `id-${++counter}`,
  }).state;

// The pack: off by default; its four storylines run only while it is on.
assert.equal(SLURP_FAMILY_PACK.defaultOn, false);
assert.equal(SLURP_FAMILY_STORYLINES.length, 4);
for (const storyline of SLURP_FAMILY_STORYLINES)
  assert.ok(slpStorylineSchema.safeParse(storyline).success, storyline.id);
assert.deepEqual(slpDramaEnabledIds(SLP_EMPTY_DRAMA_LIBRARY, [], {}), [], "off by default");
assert.deepEqual(
  slpDramaEnabledIds(SLP_EMPTY_DRAMA_LIBRARY, [], { "slurp-pack-family": true }).sort(),
  SLURP_FAMILY_STORYLINES.map((entry) => entry.id).sort(),
  "on: all four run",
);

// The hard line: no look or moment pictures a child; after the birth the child stays off camera.
for (const storyline of SLURP_FAMILY_STORYLINES) {
  for (const stage of storyline.stages) {
    assert.doesNotMatch(
      stage.condition?.look ?? "",
      /baby|child|kid|newborn|infant/iu,
      `${storyline.id} ${stage.key} look`,
    );
    for (const beat of [...stage.beats, ...stage.deck])
      assert.notEqual(beat.channel === "post" && /baby|child/iu.test(beat.heat?.line ?? ""), true);
  }
  const born = storyline.endings.find((ending) => ending.key === "born")!;
  assert.match(JSON.stringify(born.outcomes), /never in a picture, never in a spicy post/u, `${storyline.id} born`);
}

// Ways in: the partner one needs a partner, the collab one a collab tie and casts that partner.
const mia = creator("mia");
const lena = creator("lena");
const couple = byKind("couple");
const asked = (storylineId: string) => slpRequestDrama(SLP_EMPTY_DRAMA_STATE, storylineId, "mia");
assert.equal(advance(asked(couple.id), T0, couple, world([mia, lena])).runs.length, 0, "no partner, no start");
const collab = byKind("collab");
const collabWorld = world(
  [
    { ...mia, storyTags: ["collab"] },
    { ...lena, storyTags: ["collab"] },
  ],
  ["collab:lena|mia"],
);
const started = advance(asked(collab.id), T0, collab, collabWorld);
assert.equal(started.runs[0]?.cast.mom, "mia", "she leads");
const castDad = (scene: SlpDramaWorld) =>
  slpDramaCast(
    collab.cast,
    ["mom", "dad"],
    { mom: "mia" },
    { world: scene, busy: new Set(), seed: "s", at: new Date(T0) },
  )?.dad;
assert.equal(castDad(collabWorld), "lena", "her collab partner is the father");
assert.equal(castDad(world([{ ...mia, storyTags: ["collab"] }, lena])), undefined, "no collab tie: nobody to cast");

// The hard ending is offered only with the `hard` dial on.
const surprise = byKind("surprise");
const scan = (dials: Record<string, Record<string, string>>) => {
  let state = asked(surprise.id);
  for (let at = T0; at < T0 + 60 * 24 * HOUR; at += 6 * HOUR) {
    state = advance(state, at, surprise, world([mia]), dials);
    const run = state.runs[0];
    if (run?.stage === "month-6" && run.choice) return run.choice;
    if (run?.endedAt) break;
  }
  throw new Error("never reached the scan");
};
assert.equal(scan({}).count, 3, "hard off: only good scans");
assert.equal(scan({ [surprise.id]: { hard: "on" } }).count, 4, "hard on: the bad news is one of four");

// Business: an announced pregnancy multiplies the lead's growth, not anybody else's.
const announced = {
  runs: [{ ...started.runs[0]!, stage: "announced", cast: { mom: "mia", dad: "lena" }, endedAt: null }],
} as SlpDramaState;
assert.equal(slpDramaStageMultiplier(announced, [collab], "mia", "audience.growth"), 1.3);
assert.equal(slpDramaStageMultiplier(announced, [collab], "lena", "audience.growth"), 1);
assert.equal(slpDramaStageMultiplier(announced, [collab], "mia", "messages.reply-delay"), 1);

// Both multiplier paths read the stage factor: influences, and real income (earnCreatorIncome).
const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
assert.match(
  server("data/host/slp-storage-context.ts"),
  /slurpDramaStageFactor\(settingsStore, creatorAccountId, "economy\.creator-earnings"\)/u,
);
assert.match(
  server("data/world/slp-story-engine-storage.ts"),
  /slurpDramaStageFactor\(settingsStore, creatorAccountId, target\)/u,
);

// Turn-ons lean the lead pick: a Creator into breeding takes it more often than an even share.
const eager = creator("ivy", { turnOns: ["breeding"] });
let leaned = 0;
for (let seed = 0; seed < 200; seed += 1) {
  const cast = slpDramaCast(
    surprise.cast,
    ["mom"],
    {},
    {
      world: world([eager, creator("zoe")]),
      busy: new Set(),
      seed: `s${seed}`,
      at: new Date(T0),
      leadFit: surprise.fit,
    },
  );
  if (cast?.mom === "ivy") leaned += 1;
}
assert.ok(leaned > 120, `turn-on lean: ${leaned} of 200`);

console.log("slurp2 family pack: ok");
