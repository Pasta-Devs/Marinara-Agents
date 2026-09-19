import assert from "node:assert/strict";
import { refreshSlurpCreatorBatch } from "../packages/slurp2/src/engine/packages/client/src/slp/features/creators/slp-refresh-batch";
import { slurp2Source } from "./slurp2-source";

async function main() {
  const releases = new Map<string, () => void>();
  const started: string[] = [];
  const counts: number[] = [];
  let active = 0;
  let peak = 0;
  const result = refreshSlurpCreatorBatch(
    ["a", "b", "c", "d", "a"],
    async (accountId) => {
      started.push(accountId);
      peak = Math.max(peak, ++active);
      await new Promise<void>((resolve) => releases.set(accountId, resolve));
      active--;
      if (accountId === "b") throw new Error("failed provider");
      return { outcomes: [{ accountId, status: accountId === "c" ? "skipped" : "generated" }] };
    },
    (remaining) => counts.push(remaining),
  );
  assert.deepEqual(started, ["a", "b", "c"]);
  releases.get("b")!();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(counts, [4, 3], "a failed job also settles and updates progress before the batch finishes");
  assert.deepEqual(started, ["a", "b", "c", "d"]);
  releases.get("c")!();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(counts, [4, 3, 2]);
  releases.get("a")!();
  releases.get("d")!();
  assert.deepEqual(
    (await result).outcomes.map(({ status }) => status),
    ["generated", "error", "skipped", "generated"],
  );
  assert.deepEqual(counts, [4, 3, 2, 1, 0]);
  assert.equal(peak, 3);
  const server = slurp2Source(
    new URL(
      "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-post.operation.ts",
      import.meta.url,
    ),
  );
  assert.match(server, /MAX_CONCURRENT_MANUAL_REFRESH = 3;/u, "client and existing server batch caps must agree");
  console.log("Slurp2 per-creator remaining count and concurrency regression passed.");
}
void main();
