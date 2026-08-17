import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const { LTM_DEBUG_MAX_EVENT_BYTES, LTM_DEBUG_MAX_LOG_BYTES, readLtmDebugLog, recordLtmDebugEvent } =
    await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/debug-log.ts");
  const { getLongTermMemoryDirectories } =
    await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/paths.ts");
  const root = await mkdtemp(join(tmpdir(), "marinara-ltm-debug-log-"));
  try {
    const boundedCounts = await recordLtmDebugEvent({
      root,
      phase: "diagnostic",
      action: "bounded-counts",
      status: "ok",
      counts: Object.fromEntries(
        Array.from({ length: 200 }, (_, index) => [`${index}-${"count-key-".repeat(40)}`, index]),
      ),
    });
    assert.ok(boundedCounts?.counts);
    assert.equal(Object.keys(boundedCounts.counts).length, 80);
    assert.equal(
      Object.keys(boundedCounts.counts).every((key) => key.length <= 240),
      true,
    );
    const oversized = await recordLtmDebugEvent({
      root,
      phase: "diagnostic",
      action: "x".repeat(1_000),
      status: "error",
      message: "界".repeat(10_000),
      uiSummary: "界".repeat(10_000),
      error: new Error("e".repeat(10_000)),
      counts: Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`${index}-${"界".repeat(300)}`, index])),
      diagnostics: Array.from({ length: 200 }, (_, index) => ({
        index,
        text: "d".repeat(10_000),
        nested: { one: { two: { three: { four: { five: "too deep" } } } } },
      })),
      details: Object.fromEntries(
        Array.from({ length: 200 }, (_, index) => [`key-${index}`, ["v".repeat(10_000), "discarded"]]),
      ),
    });
    assert.ok(oversized);
    assert.equal(oversized.action.length, 120);
    assert.equal(oversized.message, undefined);
    assert.equal(oversized.counts, undefined);
    assert.equal(oversized.diagnostics, undefined);
    const debugPath = getLongTermMemoryDirectories(root).debugLog;
    const firstLine = (await readFile(debugPath, "utf8")).trim().split("\n")[1]!;
    assert.equal(Buffer.byteLength(`${firstLine}\n`) <= LTM_DEBUG_MAX_EVENT_BYTES, true);
    assert.deepEqual(JSON.parse(firstLine), oversized);

    await Promise.all(
      Array.from({ length: 80 }, (_, index) =>
        recordLtmDebugEvent({
          root,
          phase: index % 2 ? "retrieval" : "rebuild",
          action: `rotation-${index}`,
          status: index % 3 ? "ok" : "error",
          diagnostics: Array.from({ length: 30 }, (_, diagnosticIndex) => ({
            diagnosticIndex,
            payload: `${index}:`.padEnd(2_000, "z"),
          })),
        }),
      ),
    );
    assert.equal((await stat(debugPath)).size <= LTM_DEBUG_MAX_LOG_BYTES, true);
    const content = await readFile(debugPath, "utf8");
    assert.equal(content.endsWith("\n"), true);
    const lines = content.trim().split("\n");
    assert.equal(lines.length < 81, true);
    for (const line of lines) assert.doesNotThrow(() => JSON.parse(line));
    const errors = await readLtmDebugLog({ status: "error" }, root);
    assert.equal(errors.length > 0, true);
    assert.equal(
      errors.every((event) => event.status === "error"),
      true,
    );
    const retrieval = await readLtmDebugLog({ phase: "retrieval" }, root);
    assert.equal(retrieval.length > 0, true);
    assert.equal(
      retrieval.every((event) => event.phase === "retrieval"),
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  process.stdout.write("Long-Term Memory debug log regression: bounds, rotation, and filters ok\n");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
