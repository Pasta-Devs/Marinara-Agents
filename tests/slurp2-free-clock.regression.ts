import assert from "node:assert/strict";
import { join } from "node:path";
import { tryNoodleOperation } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-operation-lock.ts";
import {
  SLURP_TUNING_EVENTS_PER_TICK_CEILING,
  SLURP_WORLD_IDLE_POLL_MS,
  slurpCapTickEvents,
  slurpWorldTimerDue,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-tuning.ts";
import { slurp2Source } from "./slurp2-source";

const src = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/services/slurp");
const read = (name: string) => slurp2Source(join(src, name));

async function main() {
  // Guard: two concurrent ticks on the shared key, one execution.
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const first = tryNoodleOperation("slurp-world-tick", async () => {
    runs += 1;
    await gate;
  });
  const second = await tryNoodleOperation("slurp-world-tick", async () => {
    runs += 1;
  });
  release();
  assert.equal((await first).acquired, true);
  assert.equal(second.acquired, false, "an overlapping tick must be refused");
  assert.equal(runs, 1);
  const operation = read("slurp-world.operation.ts");
  assert.match(operation, /tryNoodleOperation\("slurp-world-tick"/u, "every caller shares the tick guard");

  // Timer: on ticks every wake, off only every idle poll; interval and toggle re-read each wake.
  assert.equal(slurpWorldTimerDue({ backgroundTimer: true }, 1_000, 1_001), true);
  assert.equal(slurpWorldTimerDue({ backgroundTimer: false }, 1_000, 1_000 + 60_000), false);
  assert.equal(slurpWorldTimerDue({ backgroundTimer: false }, 1_000, 1_000 + SLURP_WORLD_IDLE_POLL_MS), true);
  assert.equal(slurpWorldTimerDue({ backgroundTimer: false }, 0, SLURP_WORLD_IDLE_POLL_MS), true, "first wake runs");
  const scheduler = read("slurp-world-scheduler.service.ts");
  const pollBody = scheduler.slice(scheduler.indexOf("const poll = async"));
  assert.match(
    pollBody,
    /getSettings\(\)[\s\S]*pollMs = clock\.tickMinutes \* 60_000[\s\S]*slurpWorldTimerDue\(clock/u,
  );
  assert.match(scheduler, /schedule\(slurpPollBackoffMs\(pollMs, consecutiveFailures\)\)/u);
  assert.match(read("server-entry.ts"), /startSlurpWorldScheduler\(app, addTeardown\)/u, "stopped on unload");

  // Events cap: truncates at the setting, never past the ceiling, and counts `this` calls.
  const written: string[] = [];
  const storage = {
    async recordCreatorEvent(kind: string) {
      written.push(kind);
    },
    async tickProjects() {
      await this.recordCreatorEvent("arc");
    },
  };
  const capped = slurpCapTickEvents(storage, 3);
  for (let index = 0; index < 5; index += 1) await capped.recordCreatorEvent("comment");
  await capped.tickProjects();
  assert.deepEqual(written, ["comment", "comment", "comment"]);
  written.length = 0;
  const huge = slurpCapTickEvents(storage, 10_000);
  for (let index = 0; index < SLURP_TUNING_EVENTS_PER_TICK_CEILING + 5; index += 1) await huge.recordCreatorEvent("x");
  assert.equal(written.length, SLURP_TUNING_EVENTS_PER_TICK_CEILING);
  assert.match(operation, /slurpCapTickEvents\(createSlurpStorage\(db\), tuning\.clock\.maxEventsPerTick\)/u);

  console.log("slurp2 free clock regression passed");
}

void main();
