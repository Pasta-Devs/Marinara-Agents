/**
 * S — the kink theme packs (docs/SPICY.md, PR 1): five packs, off by default; each storyline is valid, reaches only
 * Creators at its level with no hard-no against it, a fan vote leads to a stage with her set, and the ending puts
 * the set in her closet.
 */
import assert from "node:assert/strict";
import {
  slpAdvanceDrama,
  slpRequestDrama,
  SLP_EMPTY_DRAMA_STATE,
  type SlpDramaWorld,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-runtime.ts";
import {
  SLP_EMPTY_DRAMA_LIBRARY,
  slpDramaEnabledIds,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-library.ts";
import { SLURP_CONTENT_PACK_LIBRARY } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-content-pack-library.ts";
import { SLURP_KINK_PACKS } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-kink-packs.ts";
import { slurpPackFits } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-occasion-beats.ts";
import { slurpStageOutcomes } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-project-storyline.ts";
import { slpStorylineSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-storyline.ts";

const ids = [
  "slurp-pack-lingerie",
  "slurp-pack-cosplay",
  "slurp-pack-feet",
  "slurp-pack-domsub",
  "slurp-pack-exhibition",
];
assert.deepEqual(
  SLURP_KINK_PACKS.map((pack) => pack.id),
  ids,
);
for (const id of ids)
  assert.ok(
    SLURP_CONTENT_PACK_LIBRARY.some((pack) => pack.id === id),
    `${id} in the library`,
  );
const storylines = SLURP_KINK_PACKS.flatMap((pack) => pack.storylines ?? []);
assert.equal(new Set(storylines.map((entry) => entry.id)).size, storylines.length, "unique storyline ids");
for (const storyline of storylines) {
  assert.ok(slpStorylineSchema.safeParse(storyline).success, storyline.id);
  assert.ok(storyline.fit?.hardNo?.length && storyline.fit.topic?.length, `${storyline.id} is gated`);
}

// Off by default; a pack's storylines run while it is on.
assert.ok(SLURP_KINK_PACKS.every((pack) => !pack.defaultOn));
assert.deepEqual(slpDramaEnabledIds(SLP_EMPTY_DRAMA_LIBRARY, [], {}), [], "off by default");
assert.deepEqual(slpDramaEnabledIds(SLP_EMPTY_DRAMA_LIBRARY, [], { "slurp-pack-feet": true }).sort(), [
  "feet-fans",
  "heels-or-socks",
]);

// The fit gate: level, hard-nos and "never" lines.
const byId = (id: string) => storylines.find((entry) => entry.id === id)!;
const fits = (id: string, level: "suggestive" | "nudity" | "explicit", hardNoes: string[] = [], text = "") =>
  slurpPackFits(byId(id).fit!, { text, level, hardNoes });
assert.ok(fits("feet-fans", "suggestive"));
assert.ok(!fits("feet-fans", "explicit", ["feet"]), "hard-no rules her out");
assert.ok(!fits("feet-fans", "explicit", ["foot fetish"]), "a foot hard-no rules her out");
assert.ok(!fits("domme-era", "explicit", ["BDSM"]), "hard-no is case-blind");
assert.ok(!fits("almost-caught", "suggestive"), "exhibition needs nudity");
assert.ok(fits("almost-caught", "nudity"));
assert.ok(!fits("cosplay-pick", "explicit", [], "I would never wear a costume."), "a never line rules her out");

// A fan vote leads to the voted set, and the ending puts it in her closet.
const HOUR = 3_600_000;
const T0 = Date.parse("2026-10-01T00:00:00.000Z");
const week = byId("lingerie-week");
const scene: SlpDramaWorld = {
  creators: [
    {
      id: "mia",
      name: "mia",
      automatic: true,
      gender: "female",
      spice: 3,
      tags: [],
      joinedAt: new Date(T0 - 60 * 24 * HOUR).toISOString(),
      followers: 1000,
      fitText: "",
    },
  ],
  relations: new Map(),
  ties: new Set(),
};
let counter = 0;
let state = slpRequestDrama(SLP_EMPTY_DRAMA_STATE, week.id, "mia");
const seen = new Set<string>();
for (let at = T0; at < T0 + 30 * 24 * HOUR; at += 6 * HOUR) {
  state = slpAdvanceDrama(state, {
    at: new Date(at),
    level: "soap",
    situations: [],
    dramas: [week],
    dials: {},
    world: scene,
    activity: 1,
    newId: () => `id-${++counter}`,
  }).state;
  const run = state.runs[0];
  if (run?.stage) seen.add(run.stage);
  if (run?.endedAt) break;
}
assert.ok(seen.has("haul") && seen.has("finale"), `stages: ${[...seen]}`);
assert.equal(["black", "red", "white"].filter((key) => seen.has(key)).length, 1, "one voted set");
assert.ok(state.runs[0]?.endedAt, "the week ends");
const done = week.endings.find((ending) => ending.key === "done")!;
assert.ok(
  done.outcomes.some((outcome) => outcome.kind === "add-look"),
  "the set goes in her closet",
);

// Every fan vote plays exactly one branch, for each option.
const runOf = (storyline: (typeof storylines)[number], pick: number) => {
  let next = slpRequestDrama(SLP_EMPTY_DRAMA_STATE, storyline.id, "mia");
  const keys = new Set<string>();
  for (let at = T0; at < T0 + 40 * 24 * HOUR; at += 6 * HOUR) {
    next = slpAdvanceDrama(next, {
      at: new Date(at),
      level: "soap",
      situations: [],
      dramas: [storyline],
      dials: {},
      world: scene,
      activity: 1,
      newId: () => `id-${++counter}`,
    }).state;
    const run = next.runs[0];
    if (run?.stage) keys.add(run.stage);
    if (run?.choice && run.choice.answer === null)
      next = { ...next, runs: [{ ...run, choice: { ...run.choice, answer: pick, by: "fans" } }] };
    if (run?.endedAt) break;
  }
  return keys;
};
for (const storyline of storylines) {
  const choice = storyline.stages.find((entry) => entry.choice)?.choice;
  if (!choice) continue;
  const branches = choice.options.map((option) => option.next);
  for (const [pick, branch] of branches.entries()) {
    const keys = runOf(storyline, pick);
    assert.deepEqual(
      branches.filter((key) => keys.has(key)),
      [branch],
      `${storyline.id} vote ${pick}: ${[...keys]}`,
    );
  }
}

// A stage condition reaches the writer: it has a track, a line and its look.
const entered = slurpStageOutcomes(week, { enter: "black" }).find((outcome) => outcome.kind === "add-creator-fact");
assert.equal(entered?.kind === "add-creator-fact" && entered.track, "work");
assert.match(JSON.stringify(entered), /black lace/);
const dare = slurpStageOutcomes(byId("fan-dares"), { enter: "balcony" }).find(
  (outcome) => outcome.kind === "add-creator-fact",
);
assert.equal(dare?.kind === "add-creator-fact" && dare.track, "public");
// Each storyline has its own condition tag, so one ending never removes another storyline's condition.
for (const storyline of storylines)
  for (const entry of storyline.stages)
    if (entry.condition) assert.equal(entry.condition.tag, storyline.id, `${storyline.id}/${entry.key} tag`);

console.log("slurp2 kink packs: ok");
