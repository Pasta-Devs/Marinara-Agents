import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workDir = mkdtempSync(join(tmpdir(), "noodle-evaluator-"));

function evaluate(samples: unknown, name: string) {
  const path = join(workDir, `${name}.json`);
  writeFileSync(path, JSON.stringify(samples));
  const run = spawnSync(
    process.execPath,
    ["scripts/evaluate-noodle-generation.mjs", path],
    { encoding: "utf8" },
  );
  return { ...run, report: run.stdout ? JSON.parse(run.stdout) : null };
}

// Malformed input is rejected, not silently scored.
assert.match(
  evaluate({ samples: [] }, "not-an-array").stderr,
  /must contain a JSON array/u,
);
assert.match(evaluate([null], "null-sample").stderr, /Sample 0 must be an object/u);
assert.match(
  evaluate([{ content: 42 }], "non-string-content").stderr,
  /Sample 0 must have a string "content" field/u,
);
assert.match(
  evaluate([{ content: "   " }], "empty-content").stderr,
  /Sample 0 has empty content/u,
);
assert.match(
  evaluate([{ content: "Fine.", kind: "poll" }], "bad-kind").stderr,
  /unsupported kind "poll"/u,
);
assert.equal(evaluate([], "empty-array").report?.pass, false);

const ok = evaluate(
  [
    { author: "a", kind: "post", content: "A bright short update from the workshop." },
    { author: "b", kind: "reply", content: "Thank you, I will send the notes over." },
  ],
  "passing",
);
assert.equal(ok.status, 0);
assert.equal(ok.report.pass, true);

// Each failing quality gate fails the run.
const duplicate = evaluate(
  [
    { author: "a", content: "The same post twice." },
    { author: "b", content: "The same post twice." },
  ],
  "duplicate",
);
assert.equal(duplicate.status, 1);
assert.equal(duplicate.report.duplicateTexts, 1);

const oneAuthor = evaluate(
  [
    { author: "a", content: "One voice only, first post." },
    { author: "a", content: "One voice only, second post." },
  ],
  "one-author",
);
assert.equal(oneAuthor.status, 1);
assert.equal(oneAuthor.report.authors, 1);

const gloomy = evaluate(
  [
    { author: "a", content: "I feel hopeless about the studio tonight." },
    { author: "b", content: "Everything is empty and I am tired of it." },
  ],
  "negative",
);
assert.equal(gloomy.status, 1);
assert.equal(gloomy.report.negativeMood, 2);

const tooLong = evaluate(
  [
    { author: "a", kind: "reply", content: "x".repeat(241) },
    { author: "b", kind: "post", content: "y".repeat(281) },
  ],
  "over-target",
);
assert.equal(tooLong.status, 1);
assert.equal(tooLong.report.overTarget, 2);

console.log("Noodle generation evaluator regressions passed.");
