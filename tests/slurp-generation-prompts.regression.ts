import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  modelAnswerForCorrection,
  requireModelAnswer,
} from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-model-answer";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const generation = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts");
const reply = read("packages/slurp/src/engine/packages/server/src/services/slurp/slurp-reply-generation.service.ts");

const scheduleText = "Current Conversation Schedule for Ari: Tuesday: busy at work and slow to reply";
assert.match(generation, /scheduleContext,/u);
assert.match(generation, /input\.scheduleContext \?\? "No active Conversation Schedule/u);
assert.match(reply, /scheduleContext: input\.scheduleContext/u);
assert.match(reply, /resolveSlurpCreatorScheduleContext\(createCharactersStorage\(input\.db\), source/u);
assert.match(generation, /resolveSlurpCreatorScheduleContext\(\s*createCharactersStorage\(db\),/u);
assert.ok([generation, reply].some((source) => source.includes(scheduleText)) === false);
assert.match(
  generation,
  /input\.scheduleContext \?\? "No active Conversation Schedule/u,
  "Post prompt must have a schedule slot",
);
assert.match(reply, /scheduleContext/u, "Reply request must carry a schedule slot");

for (const answer of ["", "   ", "[]", "```json\n[]\n```"]) {
  if (!answer.trim() || /^\s*```json\s*\[\s*\]\s*```\s*$/u.test(answer)) {
    assert.equal(modelAnswerForCorrection(answer), null);
  }
}
assert.throws(() => requireModelAnswer("", "a creator profile"), /empty response/u);
assert.equal(modelAnswerForCorrection('{"displayName":"Ari"}'), '{"displayName":"Ari"}');

console.log("Slurp generation prompt regressions passed");
