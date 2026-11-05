import assert from "node:assert/strict";
import { test } from "node:test";
import { HAFENKAI_PLACE as kit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import {
  callsOf,
  runTask,
  withCallLog,
  type ModelCall,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";

const good: ModelCall = async () => '{"stance":"refuse"}';
const adult = { on: true, confirm: true, intensity: 2, themes: [] } as never;
const input = (a?: unknown) => ({ kit, text: "No.", allowed: ["refuse", "delay"], adult: a }) as never;

test("the call log records each outcome and keeps no text", async () => {
  const id = "calls-1";
  const log = (n: number) =>
    callsOf(id)
      .slice(-n)
      .map((e) => e.outcome);

  await runTask("answer.tag", input(), { model: withCallLog(good, id) });
  assert.deepEqual(log(1), ["ok"]);

  // An Adult scene is refused once, the fade-to-black retry works.
  let n = 0;
  const refuses: ModelCall = async (m, o) => {
    if (n++ === 0) throw new Error("refused");
    return good(m, o);
  };
  await runTask("answer.tag", input(adult), { model: withCallLog(refuses, id) });
  assert.deepEqual(log(2), ["refusal", "retry"]);

  // The retry fails as well: Lite takes over and the log says so.
  const never: ModelCall = async () => {
    throw new Error("refused");
  };
  const out = await runTask("answer.tag", input(adult), { model: withCallLog(never, id) });
  assert.equal(out.source, "lite");
  assert.deepEqual(log(2), ["refusal", "lite"]);

  // A plain failure goes to Lite with one entry.
  await runTask("answer.tag", input(), { model: withCallLog(never, id) });
  assert.deepEqual(log(1), ["lite"]);

  for (const e of callsOf(id)) assert.deepEqual(Object.keys(e).sort(), ["ms", "outcome", "task"]);
  assert.equal(withCallLog(undefined, id), undefined);
});

test("the call log keeps the last 50 calls per run", async () => {
  const model = withCallLog(good, "calls-2");
  for (let i = 0; i < 55; i++) await runTask("answer.tag", input(), { model });
  assert.equal(callsOf("calls-2").length, 50);
  assert.equal(callsOf("calls-none").length, 0);
});
