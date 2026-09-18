import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// "Create posts now" once reported a full batch while the feed showed one post fewer: a Story slot
// sends the post to the Stories row, and a Creator busy with another run was skipped at once.
const root = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const operation = read("server/src/services/slurp/slurp-post.operation.ts");
const targeted = operation.slice(operation.indexOf("export async function refreshTargetedNoodlerCreatorsNow"));
assert.match(targeted, /\{ allowStory: false \}/u, "manual refresh must not produce Stories");
assert.match(
  targeted,
  /while \(result\.status === "busy" && Date\.now\(\) - startedAt < MANUAL_REFRESH_BUSY_WAIT_MS\)/u,
);

const generation = read("server/src/services/slurp/slurp-generation.service.ts");
assert.match(generation, /input\.allowStory !== false && variation\?\.story === true/u);

const settings = read("client/src/components/slurp/SlurpSettings.tsx");
assert.match(settings, /description: names\(\(status\) => status === "skipped"\)/u);

console.log("slurp2 manual refresh regression passed");
