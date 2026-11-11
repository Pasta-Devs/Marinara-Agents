/**
 * The world clock (docs/WORLD-CLOCK.md). Behavior first, then the ordering and
 * boundaries the server code must keep:
 *   1. world time is real time plus one offset, starting at zero;
 *   2. a restore epoch refuses work that started before it;
 *   3. a skip moves due times and leaves history alone, and rejects bad skips;
 *   4. pruning keeps the newest auto checkpoints and never touches manual ones;
 *   5. a skip checkpoints first, simulates nothing, and purges nothing;
 *   6. a restore verifies, checkpoints, fences, rolls back and keeps the paused state.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SlurpWorldEpochChangedError,
  assertSlurpWorldEpoch,
  setSlurpWorldEpoch,
  setSlurpWorldOffsetMs,
  slurpWorldEpoch,
  slurpWorldNow,
  slurpWorldNowMs,
  slurpWorldOffsetMs,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-world-clock.ts";
import {
  selectCheckpointsToPrune,
  shiftSlurpDueJson,
  slurpSkipTarget,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/maintenance/slp-timeline.ts";

const server = join(import.meta.dirname, "../packages/slurp2/src/engine/packages/server/src/slp");
const read = (path: string) => readFileSync(join(server, path), "utf8");
const DAY = 86_400_000;

// ── 1. Offset ────────────────────────────────────────────────────────────────
assert.equal(slurpWorldOffsetMs(), 0, "an existing install starts with a zero offset");
assert.ok(Math.abs(slurpWorldNowMs() - Date.now()) < 50, "zero offset reads the real clock");
setSlurpWorldOffsetMs(3 * DAY);
assert.ok(Math.abs(slurpWorldNow().getTime() - (Date.now() + 3 * DAY)) < 50, "the offset moves world time");
setSlurpWorldOffsetMs(Number.NaN);
assert.equal(slurpWorldOffsetMs(), 0, "a corrupt stored offset falls back to zero");

// ── 2. Epoch fence ───────────────────────────────────────────────────────────
setSlurpWorldEpoch(4);
const started = slurpWorldEpoch();
assert.doesNotThrow(() => assertSlurpWorldEpoch(started));
setSlurpWorldEpoch(5);
assert.throws(() => assertSlurpWorldEpoch(started), SlurpWorldEpochChangedError, "work from before a restore is refused");
setSlurpWorldEpoch(0);

// ── 3. Skip rules ────────────────────────────────────────────────────────────
const t0 = Date.parse("2026-03-01T10:30:00.000Z");
assert.equal(slurpSkipTarget(t0, 2, 3650), t0 + 2 * DAY, "a skip keeps the time of day");
assert.throws(() => slurpSkipTarget(t0, 0, 3650), /at least one day/u, "no skip backward or by zero");
assert.throws(() => slurpSkipTarget(t0, -3, 3650), /at least one day/u);
assert.throws(() => slurpSkipTarget(t0, 1.5, 3650), /at least one day/u);
assert.throws(() => slurpSkipTarget(t0, 4000, 3650), /at most 3650/u);

const state = {
  coolUntil: "2026-03-01T12:00:00.000Z",
  createdAt: "2026-02-20T09:00:00.000Z",
  nested: [{ dueAt: "2026-03-02T00:00:00.000Z", note: "2026-03-02T00:00:00.000Z" }],
  startedAt: "not a date",
  occurrence: { startsAt: "2026-03-03T00:00:00.000Z", endsAt: "2026-03-04T00:00:00.000Z" },
};
const shifted = shiftSlurpDueJson(state, 5 * DAY) as typeof state;
assert.equal(shifted.coolUntil, "2026-03-06T12:00:00.000Z", "a due time moves with the skip");
assert.equal(shifted.nested[0].dueAt, "2026-03-07T00:00:00.000Z", "nested due times move");
assert.equal(shifted.occurrence.startsAt, "2026-03-08T00:00:00.000Z", "a running event window moves, so nothing starts or ends because of the skip");
assert.equal(shifted.createdAt, state.createdAt, "history keeps its dates");
assert.equal(shifted.nested[0].note, state.nested[0].note, "only due-style keys move");
assert.equal(shifted.startedAt, "not a date", "a value that is not a timestamp is untouched");

// ── 4. Pruning ───────────────────────────────────────────────────────────────
const ref = (id: string, kind: "manual" | "auto" | "safety", day: number) => ({
  id,
  kind,
  createdAt: `2026-03-${String(day).padStart(2, "0")}T00:00:00.000Z`,
});
const all = [
  ...Array.from({ length: 7 }, (_, i) => ref(`a${i}`, "auto", i + 1)),
  ref("m1", "manual", 1),
  ref("m2", "manual", 2),
  ...Array.from({ length: 5 }, (_, i) => ref(`s${i}`, "safety", i + 1)),
];
const doomed = selectCheckpointsToPrune(all, 5, 3).map((meta) => meta.id).sort();
assert.deepEqual(doomed, ["a0", "a1", "s0", "s1"], "the newest 5 auto and 3 safety stay, the oldest go");
assert.ok(!doomed.includes("m1") && !doomed.includes("m2"), "manual checkpoints are never pruned");
assert.deepEqual(selectCheckpointsToPrune(all, 50, 50), [], "nothing is pruned under the limit");

// ── 5. Skip job: checkpoint first, simulate nothing ─────────────────────────
const jobs = read("features/maintenance/slp-timeline-jobs.ts");
const skipJob = jobs.slice(jobs.indexOf("const createSkipJob"), jobs.indexOf("const createRestoreCheckpointJob"));
assert.ok(
  skipJob.indexOf("writeCheckpoint(job, \"auto\"") !== -1 &&
    skipJob.indexOf("writeCheckpoint(job, \"auto\"") < skipJob.indexOf("applySlurpWorldSkip"),
  "the automatic checkpoint is awaited before the skip, so a failed checkpoint aborts it",
);
assert.doesNotMatch(skipJob, /advanceSlurp|tickSlurp|drain|topUp|runSlurpAutopurge/u, "a skip runs no simulation or purge");
const storage = read("data/settings/slp-world-clock-storage.ts");
const tickState = read("features/world/slp-world-tick-state.ts");
for (const key of ["slurp2.world.tick", "slurp2.world.maintenance", "slurp2.world.pulse"]) {
  assert.ok(storage.includes(`"${key}"`) && tickState.includes(`"${key}"`), `the skip resets the ${key} mark the world reads`);
}
assert.match(storage, /setSlurpWorldOffset\(db, slurpWorldOffsetMs\(\) \+ deltaMs\)/u, "a skip only adds to the offset");
assert.match(jobs, /AUTO_CHECKPOINT_KEEP_DEFAULT = 5/u, "five automatic checkpoints are kept by default");

// Purges read the real clock, so a skip never ages anything out.
for (const [file, needle] of [
  ["data/host/slp-storage-constants.ts", /const cutoff = Date\.now\(\) - 30/u],
  ["data/feed/slp-feed-post-storage-2.ts", /listExpiredDeletedNoodlerPostIds\(at = Date\.now\(\)\)/u],
  ["data/continuity/slp-continuity-storage.ts", /pruneSlurpContinuity\(db, input\.creatorAccountId\)/u],
  ["data/discovery/slp-trends-storage.ts", /pruneSlurpTrends\(next\.trends, new Date\(\)\)/u],
  ["features/audience/slp-fan-activity-operation.ts", /const realNow = new Date\(\)/u],
] as const) {
  assert.match(read(file), needle, `${file} must keep purging on the real clock`);
}
// Infrastructure keeps the real clock: the scheduler's poll spacing and claim leases.
assert.match(read("features/world/slp-world-scheduler-service.ts"), /lastRunMs = Date\.now\(\)/u);
assert.doesNotMatch(read("features/world/slp-world-scheduler-service.ts"), /lastRunMs = slurpWorldNowMs/u);
// Simulation reads the world clock.
assert.match(read("features/world/slp-world-operation.ts"), /advanceSlurpWorld\(db: DB, until = slurpWorldNow\(\)\)/u);

// ── 6. Restore ───────────────────────────────────────────────────────────────
const inOrder = (text: string, steps: string[], message: string) => {
  const at = steps.map((step) => text.indexOf(step));
  assert.ok(at.every((index) => index !== -1), `${message}: a step is missing`);
  assert.deepEqual([...at].sort((x, y) => x - y), at, message);
};
const replace = jobs.slice(jobs.indexOf("const replaceWith"), jobs.indexOf("const rollBack"));
inOrder(
  replace,
  ["paused: true", "The first fence", "applyRestoreArchive(job, archive, true, true)", "job.skipped.length > 0", "setSlurpWorldOffset(app.db, to.worldNowMs - Date.now())", "paused: priorPaused"],
  "replace order: pause, fence, replace (kept paused), verify, world date, prior paused state",
);
assert.match(replace, /Not every media file was restored/u, "the media count is verified");
const restore = jobs.slice(jobs.indexOf("const createRestoreCheckpointJob"), jobs.indexOf("return { createCheckpointJob"));
inOrder(
  restore,
  ["inspectRestoreArchive(archive)", "writeCheckpoint(job, \"safety\"", "replaceWith(job, archive, meta", "rollBack(job, safety"],
  "restore order: verify, safety checkpoint, replace, roll back",
);
assert.match(restore, /priorPaused = \(await noodle\.getSlurpSettings\(\)\)\.paused/u, "the paused state is read before the restore");
assert.match(restore, /archive\.length !== meta\.bytes/u, "the archive size is checked");
assert.match(skipJob, /rollBack\(job, meta/u, "a skip that fails half way puts its checkpoint back");
assert.match(read("features/maintenance/slp-backup-jobs.ts"), /if \(keepPaused\) await noodle\.updateSlurpSettings\(\{ paused: true \}\)/u, "imported settings cannot unpause a restore");

// Claim and lease stamps share the real clock with their stale checks.
assert.match(read("data/messages/slp-reply-storage-methods.ts"), /claimedAt: realNow\(\)/u);
assert.match(read("data/messages/slp-messages-storage-commissions.ts"), /deliveryClaimedAt: realNow\(\)/u);
assert.match(read("data/messages/slp-messages-storage-follow-ups.ts"), /const timestamp = realNow\(\);[\s\S]{0,1200}status: "claimed"/u);
assert.match(read("features/world/slp-world-scheduler-service.ts"), /isSlurpBackupActive\(\)\) return/u, "the world tick waits while a skip or restore holds the data");
// A skip moves the offset and marks last, after the due times moved.
assert.ok(storage.lastIndexOf("setSlurpWorldOffset(db, slurpWorldOffsetMs() + deltaMs)") > storage.indexOf("for (const [table, columns] of SHIFTED_COLUMNS)"), "the offset moves after the due times");

// In-flight model and image work is fenced by the epoch.
assert.match(read("base/model/slp-provider-retry.ts"), /assertSlurpWorldEpoch\(epoch\)/u);
assert.match(read("base/media/slp-image-retry.ts"), /assertSlurpWorldEpoch\(epoch\)/u);
assert.match(read("base/media/slp-image-retry.ts"), /instanceof SlurpWorldEpochChangedError\) throw error/u, "a fenced image is not retried");
// A load after a restore never lowers the epoch.
assert.match(storage, /Math\.max\(slurpWorldEpoch\(\)/u);

console.log("slurp2 world clock regression: ok");
