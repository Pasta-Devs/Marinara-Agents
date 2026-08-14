import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  NOODLE_FINISHED_REFRESH_RUN_RETENTION_LIMIT,
  pruneNoodleRefreshRuns,
  selectNoodleRefreshRunIdsToPrune,
} from "../packages/noodle/src/engine/packages/server/src/services/storage/noodle-refresh-run-retention";

type RefreshRun = {
  id: string;
  status: "running" | "completed" | "failed";
  createdAt: string;
};

function run(id: string, status: RefreshRun["status"], minute: number): RefreshRun {
  return {
    id,
    status,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
  };
}

const finished = Array.from({ length: 140 }, (_, index) =>
  run(`finished-${String(index).padStart(3, "0")}`, index % 2 === 0 ? "completed" : "failed", index),
);
const active = [run("active-old", "running", -60), run("active-recent", "running", 200)];
const oversized = [...finished.slice().reverse(), ...active];
const staleIds = new Set(selectNoodleRefreshRunIdsToPrune(oversized));
const retained = oversized.filter((row) => !staleIds.has(row.id));
const retainedFinished = retained
  .filter((row) => row.status !== "running")
  .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

assert.equal(retainedFinished.length, NOODLE_FINISHED_REFRESH_RUN_RETENTION_LIMIT);
assert.deepEqual(
  retainedFinished.map((row) => row.id),
  finished.slice(-NOODLE_FINISHED_REFRESH_RUN_RETENTION_LIMIT).reverse().map((row) => row.id),
  "retention must keep the newest finished runs first",
);
assert.deepEqual(
  retained.filter((row) => row.status === "running").map((row) => row.id),
  ["active-old", "active-recent"],
  "retention must not remove active runs",
);

const recentOnly = [run("recent-completed", "completed", 1), run("recent-failed", "failed", 2)];
assert.deepEqual(selectNoodleRefreshRunIdsToPrune(recentOnly), []);

async function main() {
  const root = await mkdtemp(join(tmpdir(), "marinara-noodle-refresh-retention-"));
  const primaryPath = join(root, "noodle_refresh_runs.json");
  const backupPath = `${primaryPath}.bak`;
  let rows = oversized.slice();
  let dirty = false;
  try {
    await writeFile(primaryPath, JSON.stringify(oversized));
    await writeFile(backupPath, JSON.stringify(oversized.slice().reverse()));
    await pruneNoodleRefreshRuns({
      list: async () => rows.slice(),
      replace: async (nextRows) => {
        rows = nextRows;
        dirty = true;
      },
      touch: async () => {
        dirty = true;
      },
      flush: async () => {
        if (!dirty) return;
        await copyFile(primaryPath, backupPath);
        await writeFile(primaryPath, JSON.stringify(rows));
        dirty = false;
      },
    });

    for (const path of [primaryPath, backupPath]) {
      const snapshot = JSON.parse(await readFile(path, "utf8")) as RefreshRun[];
      assert.equal(snapshot.filter((row) => row.status !== "running").length, 100);
      assert.equal(snapshot.filter((row) => row.status === "running").length, 2);
      assert.equal(snapshot[0]?.id, "active-recent", "persisted records must be newest first");
      assert.deepEqual(selectNoodleRefreshRunIdsToPrune(snapshot), []);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main()
  .then(() => console.log("Noodle refresh-run retention regressions passed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
