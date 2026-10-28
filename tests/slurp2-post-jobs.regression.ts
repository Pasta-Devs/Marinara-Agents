/**
 * Post jobs (slurp2 0.4.6): the niche weighs the job, the main niche keeps at most half of the
 * last 8 posts, a Creator never repeats one of the last 3 jobs, and jobs never touch spice.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeSlurpNiches,
  selectSlurpPostJob,
  slurpPostJob,
  SLURP_POST_JOBS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-jobs.ts";
import { parseSlurpBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import {
  mergeSlurpCanonAnchors,
  normalizeSlurpCanonAnchors,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-brief.ts";

const gym = { main: "fitness" as const, side: ["cosplay" as const] };

// Niche: only known ids survive; main is never also a side niche.
assert.deepEqual(
  normalizeSlurpNiches({ main: "Fitness", side: ["fitness", "cosplay", "knitting", "gamer", "music"] }),
  {
    main: "fitness",
    side: ["cosplay", "gamer"],
  },
);
assert.equal(normalizeSlurpNiches({ main: "", side: [] }), undefined);
assert.deepEqual(normalizeSlurpCanonAnchors({ places: ["the gym"], niches: { main: "fitness", side: [] } })?.niches, {
  main: "fitness",
  side: [],
});

// Over many slots: never one of the last 3 jobs, main niche ≤ half of the last 8, no foreign niche.
const recent: string[] = [];
const seen = new Set<string>();
for (let sequence = 0; sequence < 200; sequence += 1) {
  const job = selectSlurpPostJob("kyrie", sequence, gym, { recentJobs: recent })!;
  assert.ok(job, "a job is always available");
  assert.ok(!recent.slice(0, 3).includes(job.id), `job ${job.id} repeats one of the last 3`);
  assert.ok(
    job.niches.length === 0 || job.niches.includes("fitness") || job.niches.includes("cosplay"),
    `${job.id} is outside the Creator's niches`,
  );
  recent.unshift(job.id);
  const main = recent.slice(0, 8).filter((id) => slurpPostJob(id)?.niches.includes("fitness")).length;
  assert.ok(main <= 4, `main niche took ${main} of the last 8`);
  seen.add(job.id);
}
assert.ok(
  [...seen].some((id) => slurpPostJob(id)?.niches.includes("fitness")),
  "the main niche shows up",
);
assert.ok(
  [...seen].some((id) => slurpPostJob(id)?.niches.includes("cosplay")),
  "a side niche shows up",
);
assert.ok(seen.size >= 10, "one Creator posts many kinds of posts");

// Fit: a wholesome card gets no intimate job, a placed post gets no job with its own place, and an
// avoided topic drops the job; a post with no place may take a placed job.
const pick = (fit: Parameters<typeof selectSlurpPostJob>[4], niches = gym) =>
  Array.from({ length: 300 }, (_, sequence) => selectSlurpPostJob("fit", sequence, niches, {}, fit)!);
assert.ok(
  pick({ heatMax: 0 }).every((job) => (job.minHeat ?? 0) === 0),
  "heat 0 gets no intimate job",
);
assert.ok(
  pick({ heatMax: 3, placeFree: false }).every((job) => !job.place),
  "a placed post keeps its place",
);
assert.ok(
  pick({ heatMax: 3, placeFree: true, avoid: ["gym", "lingerie"] }).every(
    (job) => job.id !== "workout-set" && job.id !== "lingerie-set" && job.id !== "post-gym",
  ),
  "avoided topics drop the job",
);
assert.ok(
  pick({ heatMax: 3, placeFree: true }).some((job) => job.place),
  "a post with no place may take a placed job",
);

// A Creator whose day sets the place still gets a niche job, and no implied-setting job.
for (const main of ["music", "dance", "tech", "nerd", "outdoors", "cooking"] as const) {
  const jobs = Array.from({ length: 100 }, (_, sequence) =>
    selectSlurpPostJob("fit", sequence, { main, side: [] }, {}, { heatMax: 3, placeFree: false }),
  );
  assert.ok(
    jobs.some((job) => job!.niches.includes(main)),
    `${main} has a place-free job`,
  );
  assert.ok(jobs.every((job) => !job!.place && !["day-off", "night-out", "post-gym", "get-ready"].includes(job!.id)));
}

// Emptying the card keeps the fresh reading's niches.
const fresh = normalizeSlurpCanonAnchors({ places: ["the gym"], niches: gym });
const base = normalizeSlurpCanonAnchors({ places: ["the gym"], niches: gym });
assert.deepEqual(mergeSlurpCanonAnchors(null, base, fresh)?.niches, gym);

// No niche (an old cache): everyday jobs only.
for (let sequence = 0; sequence < 50; sequence += 1)
  assert.deepEqual(selectSlurpPostJob("old", sequence, undefined, {})!.niches, []);

// A stored beat keeps a known job and drops an unknown one.
const beat = { type: "showcase", anchorKind: "places", anchor: "the gym", line: "x", cast: [] };
assert.equal(parseSlurpBeat({ ...beat, job: SLURP_POST_JOBS[0]!.id })?.job, SLURP_POST_JOBS[0]!.id);
assert.equal(parseSlurpBeat({ ...beat, job: "nope" })?.job, undefined);

// Jobs never touch spice: the job module and the job wiring do not read heat or the dial.
const jobs = readFileSync("packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-jobs.ts", "utf8");
assert.deepEqual(jobs.match(/from "[^"]+"/gu), ['from "./slp-weighted.js"'], "jobs import nothing about spice");
assert.doesNotMatch(jobs.slice(jobs.indexOf("export function selectSlurpPostJob")), /heatFloor|explicit|SexualLevel/u);
const service = readFileSync(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-beat-service.ts",
  "utf8",
);
assert.match(
  service,
  /return \{ \.\.\.beat, job: job\.id, \.\.\.\(job\.place && placeFree \? \{ place: job\.place \} : \{\}\) \};/u,
);

console.log("slurp2 post jobs: ok");
