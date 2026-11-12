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
  onSlurpWorldOffsetChange,
  setSlurpWorldEpoch,
  setSlurpWorldOffsetMs,
  slurpWorldEpoch,
  slurpWorldNow,
  slurpWorldNowMs,
  slurpWorldOffsetMs,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-world-clock.ts";
import {
  EXTRAS_OFFER_DUE_KEY,
  WALLET_DUE_KEY,
  selectCheckpointsToPrune,
  setSlurpMarkJson,
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
assert.throws(
  () => assertSlurpWorldEpoch(started),
  SlurpWorldEpochChangedError,
  "work from before a restore is refused",
);
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
assert.equal(
  shifted.occurrence.startsAt,
  "2026-03-08T00:00:00.000Z",
  "a running event window moves, so nothing starts or ends because of the skip",
);
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
const doomed = selectCheckpointsToPrune(all, 5, 3)
  .map((meta) => meta.id)
  .sort();
assert.deepEqual(doomed, ["a0", "a1", "s0", "s1"], "the newest 5 auto and 3 safety stay, the oldest go");
assert.ok(!doomed.includes("m1") && !doomed.includes("m2"), "manual checkpoints are never pruned");
assert.deepEqual(selectCheckpointsToPrune(all, 50, 50), [], "nothing is pruned under the limit");

// ── 5. Skip job: checkpoint first, simulate nothing ─────────────────────────
const jobs = read("features/maintenance/slp-timeline-jobs.ts");
const skipJob = jobs.slice(jobs.indexOf("const createSkipJob"), jobs.indexOf("const createRestoreCheckpointJob"));
assert.ok(
  skipJob.indexOf('writeCheckpoint(job, "auto"') !== -1 &&
    skipJob.indexOf('writeCheckpoint(job, "auto"') < skipJob.indexOf("applySlurpWorldSkip"),
  "the automatic checkpoint is awaited before the skip, so a failed checkpoint aborts it",
);
assert.doesNotMatch(
  skipJob,
  /advanceSlurp|tickSlurp|drain|topUp|runSlurpAutopurge/u,
  "a skip runs no simulation or purge",
);
const storage = read("data/settings/slp-world-clock-storage.ts");
const tickState = read("features/world/slp-world-tick-state.ts");
for (const key of ["slurp2.world.tick", "slurp2.world.maintenance", "slurp2.world.pulse"]) {
  assert.ok(
    storage.includes(`"${key}"`) && tickState.includes(`"${key}"`),
    `the skip resets the ${key} mark the world reads`,
  );
}
assert.match(
  storage,
  /setSlurpWorldOffset\(db, slurpWorldOffsetMs\(\) \+ deltaMs\)/u,
  "a skip only adds to the offset",
);
assert.match(jobs, /AUTO_CHECKPOINT_KEEP_DEFAULT = 5/u, "five automatic checkpoints are kept by default");

// Purges read the real clock, so a skip never ages anything out.
for (const [file, needle] of [
  ["data/host/slp-storage-constants.ts", /const cutoff = Date\.now\(\) - 30/u],
  ["data/feed/slp-feed-post-storage-2.ts", /listExpiredDeletedNoodlerPostIds\(at = Date\.now\(\)\)/u],
  ["data/continuity/slp-continuity-storage.ts", /pruneSlurpContinuity\(db, input\.creatorAccountId\)/u],
  ["data/discovery/slp-trends-storage.ts", /pruneSlurpTrends\(next\.trends, new Date\(Math\.min\(Date\.now\(\)/u],
  ["features/audience/slp-fan-activity-operation.ts", /const realNow = new Date\(Math\.min\(Date\.now\(\)/u],
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
  assert.ok(
    at.every((index) => index !== -1),
    `${message}: a step is missing`,
  );
  assert.deepEqual(
    [...at].sort((x, y) => x - y),
    at,
    message,
  );
};
const replace = jobs.slice(jobs.indexOf("const replaceWith"), jobs.indexOf("const rollBack"));
inOrder(
  replace,
  [
    "paused: true",
    "The first fence",
    "applyRestoreArchive(job, archive, true, true)",
    "job.skipped.length > 0",
    "setSlurpWorldOffset(app.db, to.worldNowMs - Date.now())",
    "paused: priorPaused",
  ],
  "replace order: pause, fence, replace (kept paused), verify, world date, prior paused state",
);
assert.match(replace, /Not every media file was restored/u, "the media count is verified");
const restore = jobs.slice(
  jobs.indexOf("const createRestoreCheckpointJob"),
  jobs.indexOf("return { createCheckpointJob"),
);
inOrder(
  restore,
  [
    "inspectRestoreArchive(archive)",
    'writeCheckpoint(job, "safety"',
    "replaceWith(job, archive, meta",
    "rollBack(job, safety",
  ],
  "restore order: verify, safety checkpoint, replace, roll back",
);
assert.match(
  restore,
  /priorPaused = \(await noodle\.getSlurpSettings\(\)\)\.paused/u,
  "the paused state is read before the restore",
);
assert.match(restore, /archive\.length !== meta\.bytes/u, "the archive size is checked");
assert.match(skipJob, /rollBack\(job, meta/u, "a skip that fails half way puts its checkpoint back");
assert.match(
  read("features/maintenance/slp-backup-jobs.ts"),
  /if \(keepPaused\) await noodle\.updateSlurpSettings\(\{ paused: true \}\)/u,
  "imported settings cannot unpause a restore",
);

// Claim and lease stamps share the real clock with their stale checks.
assert.match(read("data/messages/slp-reply-storage-methods.ts"), /claimedAt: realNow\(\)/u);
assert.match(read("data/messages/slp-messages-storage-commissions.ts"), /deliveryClaimedAt: realNow\(\)/u);
assert.match(
  read("data/messages/slp-messages-storage-follow-ups.ts"),
  /const timestamp = realNow\(\);[\s\S]{0,1200}status: "claimed"/u,
);
assert.match(
  read("features/world/slp-world-scheduler-service.ts"),
  /isSlurpBackupActive\(\)\) return/u,
  "the world tick waits while a skip or restore holds the data",
);
// A skip moves the offset and marks last, after the due times moved.
assert.ok(
  storage.lastIndexOf("setSlurpWorldOffset(db, slurpWorldOffsetMs() + deltaMs)") >
    storage.indexOf("for (const [table, columns] of SHIFTED_COLUMNS)"),
  "the offset moves after the due times",
);

// In-flight model and image work is fenced by the epoch.
assert.match(read("base/model/slp-provider-retry.ts"), /assertSlurpWorldEpoch\(epoch\)/u);
assert.match(read("base/media/slp-image-retry.ts"), /assertSlurpWorldEpoch\(epoch\)/u);
assert.match(
  read("base/media/slp-image-retry.ts"),
  /instanceof SlurpWorldEpochChangedError\) throw error/u,
  "a fenced image is not retried",
);
// A load after a restore never lowers the epoch.
assert.match(storage, /Math\.max\(slurpWorldEpoch\(\)/u);

// TTLs written with the real clock are compared with the real clock.
assert.match(read("features/world/slp-story-routes.ts"), /const now = Date\.now\(\); \/\/ preview TTL/u);
assert.doesNotMatch(
  read("features/world/slp-pending-text-service.ts"),
  /<= slurpWorldNowMs\(\)/u,
  "pending-text expiry uses the clock that wrote it",
);
assert.match(
  read("features/maintenance/slp-timeline-routes.ts"),
  /isSlurpBackupActive\(\)\) return reply\.code\(409\)/u,
  "a checkpoint cannot be deleted while a restore runs",
);
const clientClock = readFileSync(
  join(import.meta.dirname, "../packages/slurp2/src/engine/packages/client/src/slp/base/ui/slp-minute-clock.ts"),
  "utf8",
);
assert.match(clientClock, /setNow\(slurpWorldNowMs\(\)\)/u, "the minute clock stays on world time");

// Wallet subscription ends move with a skip, so no renewal is billed for skipped days; receipts keep their dates.
const wallet = {
  coins: 4,
  subscriptions: { c1: { paidThroughAt: "2026-03-10T00:00:00.000Z" } },
  receipts: [{ at: "2026-03-01T00:00:00.000Z" }],
};
const movedWallet = shiftSlurpDueJson(wallet, 5 * DAY, "", WALLET_DUE_KEY) as typeof wallet;
assert.equal(
  movedWallet.subscriptions.c1.paidThroughAt,
  "2026-03-15T00:00:00.000Z",
  "a wallet subscription end moves with the skip",
);
assert.equal(movedWallet.receipts[0].at, wallet.receipts[0].at, "wallet receipts keep their dates");
assert.equal(
  (shiftSlurpDueJson(wallet, 5 * DAY) as typeof wallet).subscriptions.c1.paidThroughAt,
  wallet.subscriptions.c1.paidThroughAt,
  "outside the wallet, paidThroughAt is not a shifted key",
);

// "Last advanced" stamps are set to the skip target, so ties, drama and Creator mood see zero elapsed time.
const marks = setSlurpMarkJson(
  {
    advancedAt: "2026-02-01T00:00:00.000Z",
    ties: { a: { advancedAt: "2026-02-02T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" } },
  },
  "2026-04-01T00:00:00.000Z",
  new Set(["advancedAt"]),
) as {
  advancedAt: string;
  ties: { a: { advancedAt: string; createdAt: string } };
};
assert.equal(marks.advancedAt, "2026-04-01T00:00:00.000Z");
assert.equal(marks.ties.a.advancedAt, "2026-04-01T00:00:00.000Z", "nested marks are set too");
assert.equal(marks.ties.a.createdAt, "2026-01-01T00:00:00.000Z", "other stamps are untouched");
for (const key of ["slurp2.creator-ties", "slurp2.drama.state", "SLURP_CREATOR_STATE_KEY"]) {
  assert.ok(storage.includes(key), `the skip sets the elapsed-time marks of ${key}`);
}
assert.match(storage, /WALLET_KEY\.test\(row\.key\) \? WALLET_DUE_KEY/u, "wallet settings use the wallet key rule");

// A restore can move the world clock back; the support desk guard must not stall on a negative gap.
assert.match(
  read("features/messages/desk/slp-desk-tick-operation.ts"),
  /sinceLastPass >= 0 && sinceLastPass < PASS_MS/u,
);
// The charged-payment freshness stamp and its check share the real clock; the bank lease reads the real clock.
assert.match(read("data/messages/slp-messages-storage-context.ts"), /status: "charged", updatedAt: realNow\(\)/u);
assert.match(
  read("data/messages/slp-messages-storage-base.ts"),
  /row\.updatedAt\)\) > Date\.now\(\) - 5 \* 60 \* 1000/u,
);
assert.match(
  read("features/world/slp-reaction-bank-operation.ts"),
  /tryBackgroundConnection\(connection\.id, new Date\(\)\)/u,
);
// A failed cleanup does not fail a committed skip or restore.
assert.match(jobs, /pruneQuietly = async[\s\S]{0,200}logger\.warn/u);
assert.doesNotMatch(jobs, /await pruneCheckpoints\(await readAutoCheckpointKeep\(app\.db\)\);\n\s+finish/u);
// Client: a restore refreshes every Slurp query, one failed status read does not end the wait, the sexting bar reads live.
const client = (path: string) =>
  readFileSync(join(import.meta.dirname, "../packages/slurp2/src/engine/packages/client/src/slp", path), "utf8");
assert.match(client("features/maintenance/slp-timeline.ts"), /invalidateQueries\(\{ queryKey: slpKeys\.all \}\)/u);
assert.match(client("features/maintenance/slp-timeline.ts"), /readJobWithRetry\(current\.id\)/u);
assert.match(client("features/messages/SlpSextingBar.tsx"), /const now = slurpWorldNowMs\(\);/u);

// Second review round: more due marks move, restore keeps the keep count, the keep count only stores.
for (const column of ['"publishAt"', '"moodUpdatedAt"', '"watchedAt"'])
  assert.ok(storage.includes(column), `the skip moves ${column}`);
assert.match(
  storage,
  /MARK_KEYS\[row\.key\][\s\S]{0,160}startsWith\(`\$\{SLURP_CREATOR_STATE_KEY\}\./u,
  "per-Creator state rows get their mood mark set too",
);
assert.match(storage, /THREAD_STATE_MARK_KEYS/u, "a thread's mood clock is set to the skip target");
assert.match(jobs, /AUTO_CHECKPOINT_KEEP_KEY, String\(keep\)/u, "a restore puts the player's keep count back");
assert.equal(
  jobs.match(/const keep = await readAutoCheckpointKeep\(app\.db\);/gu)?.length,
  2,
  "the skip and restore jobs read the keep count once, before any replace",
);
assert.match(jobs, /priorPaused,\s*keep,\s*error/u, "a rollback uses the keep count the job read, not the archive's");
assert.doesNotMatch(
  read("features/maintenance/slp-timeline-routes.ts").slice(
    read("features/maintenance/slp-timeline-routes.ts").indexOf('"/world/clock/settings"'),
  ),
  /pruneCheckpoints/u,
  "storing the keep count deletes nothing",
);
assert.match(
  read("features/discovery/slp-trends-service.ts"),
  /Date\.now\(\) - lastScanAt < SCAN_EVERY_MS/u,
  "the trend scan throttle uses the real clock",
);
assert.match(
  read("data/creators/slp-agent-memory-source.ts"),
  /Date\.now\(\) - Date\.parse\(String\(chat\.updatedAt\)\)/u,
  "chat freshness uses the real clock",
);
assert.match(
  read("base/media/slp-image-retry.ts"),
  /const epoch = slurpWorldEpoch\(\);\n\s+for \(let attempt/u,
  "the image retry reads the epoch once per run",
);

// A failed job's reason reaches the page: `errorMessage` returns nothing for a plain Error (seen live), so the panel reads it first.
const panel = client("features/maintenance/SlpWorldClockPanel.tsx");
assert.match(panel, /cause instanceof Error && cause\.message/u);
assert.doesNotMatch(
  panel,
  /setError\(errorMessage\(cause\)\)/u,
  "no handler passes a job failure to errorMessage alone",
);

// Third review round: infrastructure waits stay on the real clock; a restore never deletes the current fan plan.
assert.match(
  read("features/audience/slp-fan-activity-operation.ts"),
  /new Date\(Math\.min\(Date\.now\(\), at\.getTime\(\)\)\)/u,
);
assert.match(
  read("features/creators/slp-creator-page-service.ts"),
  /restingUntil\.set\(accountId, Date\.now\(\) \+ REST_MS\)/u,
);
assert.match(
  read("features/messages/slp-continuity-extraction-service.ts"),
  /failedUntil\.set\(threadId, Date\.now\(\) \+ FAILED_THREAD_WAIT_MS\)/u,
);
assert.match(read("features/live/slp-live-beat.ts"), /const t0 = Date\.now\(\)/u);
assert.match(read("data/messages/slp-messages-storage-context.ts"), /status: "charged", updatedAt: realNow\(\)/u);
assert.match(
  storage,
  /\{ updatedAt: target\.toISOString\(\), \.\.\.state \}/u,
  "a thread state with no stored updatedAt gets one at the skip",
);
assert.match(
  read("data/messages/slp-messages-storage-context.ts"),
  /status: "charged",[\s\S]{0,500}updatedAt: realNow\(\)/u,
  "a compensation inserted as charged is stamped on the clock its recovery check reads",
);

// Fourth review round, behavior: the extras offer and a paid sexting session move with a skip; the offset change is announced.
const extras = {
  firstSeenAt: "2026-03-01T00:00:00.000Z",
  lastOfferAt: "2026-03-02T00:00:00.000Z",
  pending: { at: "2026-03-03T00:00:00.000Z", id: "x" },
  answered: [{ at: "2026-02-01T00:00:00.000Z" }],
};
const extrasMoved = shiftSlurpDueJson(extras, 5 * DAY, "", EXTRAS_OFFER_DUE_KEY) as typeof extras;
assert.equal(extrasMoved.firstSeenAt, "2026-03-06T00:00:00.000Z", "the 3-day trigger keeps its days of use");
assert.equal(extrasMoved.lastOfferAt, "2026-03-07T00:00:00.000Z", "the 1-day cooldown keeps its remainder");
assert.equal(extrasMoved.pending.at, "2026-03-08T00:00:00.000Z");
const sexting = { startedAt: "2026-03-01T10:00:00.000Z", endsAt: "2026-03-01T10:20:00.000Z", pictureOffered: true };
const sextingMoved = shiftSlurpDueJson(sexting, 2 * DAY) as typeof sexting;
assert.equal(sextingMoved.endsAt, "2026-03-03T10:20:00.000Z", "a paid 20-minute session keeps its window");
assert.equal(sextingMoved.pictureOffered, true, "other fields are untouched");
let offsetEvents = 0;
const stopListening = onSlurpWorldOffsetChange(() => {
  offsetEvents += 1;
});
setSlurpWorldOffsetMs(7 * DAY);
setSlurpWorldOffsetMs(7 * DAY);
assert.equal(offsetEvents, 1, "a changed offset is announced once, an unchanged one not at all");
setSlurpWorldOffsetMs(0);
assert.equal(offsetEvents, 2);
stopListening();
setSlurpWorldOffsetMs(1);
assert.equal(offsetEvents, 2, "an unsubscribed listener hears nothing");
setSlurpWorldOffsetMs(0);

// Fourth review round, wiring.
assert.match(storage, /"moodUpdatedAt", "lastStrikeAt"/u, "a thread strike keeps its age across a skip");
assert.match(storage, /patch\.sexting = moved/u, "a paid sexting session is shifted");
assert.match(storage, /status === "pending" \|\| row\.status === "claimed"/u, "waiting openers keep their age");
assert.match(storage, /EXTRAS_OFFER_KEY \? EXTRAS_OFFER_DUE_KEY/u, "the extras offer stamps are shifted");
assert.match(
  read("features/maintenance/slp-backup-jobs.ts"),
  /job\.skipped = result\.skipped;[\s\S]{0,260}await loadSlurpWorldClock\(app\.db\);/u,
  "the restored offset is loaded right after the import",
);
assert.match(
  read("features/messages/slp-continuity-extraction-service.ts"),
  /slurpWorldEpoch\(\) !== startEpoch\) return recorded/u,
  "an extraction that ran across a restore does not write its checkpoint map",
);
assert.match(
  read("data/discovery/slp-trends-storage.ts"),
  /new Date\(Math\.min\(Date\.now\(\), at\.getTime\(\)\)\)/u,
  "the trend prune never runs ahead of the world date",
);
assert.match(
  read("features/live/slp-live-picture.ts"),
  /const t0 = Date\.now\(\)/u,
  "a live picture's draw time is measured on the real clock",
);
const timestamp = client("base/ui/SlpTimestamp.tsx");
assert.match(
  timestamp,
  /onSlurpWorldOffsetChange\(\(\) => \{[\s\S]{0,80}now = slurpWorldNowMs\(\)/u,
  "mounted timestamps follow an offset change",
);

// Fifth round (systematic audit): contracts, stages, answer windows, quotes, budget and backoffs.
const ties = {
  collabs: [
    {
      askedAt: "2026-03-01T00:00:00.000Z",
      plannedAt: "2026-03-06T00:00:00.000Z",
      dropAt: "2026-03-07T00:00:00.000Z",
      createdAt: "2026-02-01T00:00:00.000Z",
    },
  ],
  rivalries: [{ stageAt: "2026-03-02T00:00:00.000Z" }],
  bonds: [{ changedAt: "2026-03-03T00:00:00.000Z", since: "2026-01-01T00:00:00.000Z" }],
  deals: [{ offeredAt: "2026-03-04T00:00:00.000Z", answeredAt: "2026-03-05T00:00:00.000Z" }],
  contract: { weekStart: "2026-03-01T00:00:00.000Z" },
};
const tiesMoved = shiftSlurpDueJson(ties, 14 * DAY) as typeof ties;
for (const [name, value, was] of [
  ["a collab answer window", tiesMoved.collabs[0].askedAt, ties.collabs[0].askedAt],
  ["a planned collab", tiesMoved.collabs[0].plannedAt, ties.collabs[0].plannedAt],
  ["a collab drop", tiesMoved.collabs[0].dropAt, ties.collabs[0].dropAt],
  ["a rivalry stage", tiesMoved.rivalries[0].stageAt, ties.rivalries[0].stageAt],
  ["a bond change", tiesMoved.bonds[0].changedAt, ties.bonds[0].changedAt],
  ["a deal offer", tiesMoved.deals[0].offeredAt, ties.deals[0].offeredAt],
  ["a deal reminder", tiesMoved.deals[0].answeredAt, ties.deals[0].answeredAt],
  ["the desk contract week", tiesMoved.contract.weekStart, ties.contract.weekStart],
] as const) {
  assert.equal(
    Date.parse(value) - Date.parse(was),
    14 * DAY,
    `${name} moves with the skip, so nothing resolves because of it`,
  );
}
assert.equal(tiesMoved.collabs[0].createdAt, ties.collabs[0].createdAt, "history keeps its dates");
assert.match(
  storage,
  /DESK_KEY\.test\(row\.key\) \? DESK_MARK_KEYS/u,
  "the Support desk's last pass is set to the skip target",
);
assert.match(storage, /BARE_ISO_KEY\.test\(row\.key\)/u, "a bare cooldown value moves too");
assert.match(storage, /"audienceArcSince"/u);
assert.match(storage, /row\.state === "quoted"/u, "an open quote keeps the wait it had left");
assert.match(
  read("data/creators/slp-creators-storage-1.ts"),
  /!isSlurpSpendLedgerKey\(key\) &&/u,
  "a restore leaves the AI call ledger alone",
);
assert.doesNotMatch(
  read("base/model/slp-model-worker.ts"),
  /slurpWorldNow/u,
  "the AI call budget runs on the real clock: a skip hands back no calls",
);
assert.doesNotMatch(
  readFileSync(
    join(import.meta.dirname, "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts"),
    "utf8",
  ),
  /slurpWorldNow/u,
);
assert.match(read("features/feed/slp-shared-preseed-service.ts"), /failedUntil\.set\(key, Date\.now\(\)/u);
assert.match(read("data/creators/slp-canon-anchor-storage.ts"), /failedUntil\.set\(accountId, Date\.now\(\)/u);

// Sixth round: caches on the real clock, restore errors are not failures, archives are private, retry times convert.
assert.match(read("data/creators/slp-creators-storage-3.ts"), /Date\.now\(\) - cached\.at < 15_000/u);
assert.match(
  read("data/continuity/slp-continuity-storage.ts"),
  /at = new Date\(Math\.min\(Date\.now\(\), slurpWorldNow\(\)\.getTime\(\)\)\)/u,
  "continuity retention never runs ahead of the world date",
);
assert.match(
  read("features/maintenance/slp-backup-jobs.ts"),
  /createWriteStream\(filePath, \{ mode: 0o600 \}\)/u,
  "archives are written owner-only",
);
assert.match(
  read("features/messages/slp-continuity-extraction-service.ts"),
  /error instanceof SlurpWorldEpochChangedError \|\| slurpWorldEpoch\(\) !== startEpoch\) return recorded;[\s\S]{0,80}failedUntil\.set/u,
  "a restore during a call sets no retry wait and stops the drain",
);
assert.match(
  read("features/messages/slp-message-operation.ts"),
  /Date\.parse\(error\.retryAt\) \+ slurpWorldOffsetMs\(\)/u,
  "a real-clock budget retry time is moved to world time before it is stored",
);
assert.match(
  client("features/maintenance/slp-timeline.ts"),
  /useCreateSlpCheckpoint\(\) \{\n\s+const queryClient = useQueryClient\(\);\n\s+return useMutation/u,
  "saving a checkpoint refreshes only the checkpoint list",
);

console.log("slurp2 world clock regression: ok");
