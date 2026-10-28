import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectVendoredEngine, checkVendoredEngineBaseline } from "../validate-vendored-engine.mjs";

const root = await mkdtemp(join(tmpdir(), "marinara-vendored-"));
const engine = join(root, "host");
const vendor = join(root, "sources/engine");
try {
  await mkdir(engine);
  await mkdir(vendor, { recursive: true });
  await writeFile(join(engine, "package.json"), JSON.stringify({ name: "marinara-engine" }));
  for (const [path, content] of [
    ["same.ts", "same"],
    ["drift.ts", "old"],
    ["package-owned.ts", "still used"],
  ]) {
    await writeFile(join(vendor, path), content);
  }
  await writeFile(join(engine, "same.ts"), "same");
  await writeFile(join(engine, "drift.ts"), "updated");
  execFileSync("git", ["init", "--quiet", engine]);
  execFileSync("git", ["add", "."], { cwd: engine });
  // A local build can recreate an old path without restoring it to Engine staging.
  await writeFile(join(engine, "package-owned.ts"), "still used");
  const rows = await inspectVendoredEngine(root, engine);
  assert.deepEqual(
    rows.map(({ path, status }) => [path, status]),
    [
      ["drift.ts", "drifted"],
      ["package-owned.ts", "orphaned"],
      ["same.ts", "current"],
    ],
  );
  const baseline = Object.fromEntries(
    rows
      .filter((row) => row.status !== "current")
      .map((row) => [row.path, `${row.status}:${row.hash}:${row.hostHash}`]),
  );
  assert.deepEqual(checkVendoredEngineBaseline(rows, baseline), []);
  assert.match(checkVendoredEngineBaseline(rows, {})[0], /Unbaselined drifted/);
  assert.match(checkVendoredEngineBaseline(rows, baseline, {})[0], /Baseline may only shrink/);
  await writeFile(join(engine, "drift.ts"), "another host fix");
  assert.match(
    checkVendoredEngineBaseline(await inspectVendoredEngine(root, engine), baseline)[0],
    /Unbaselined drifted/,
  );
  await writeFile(join(engine, "drift.ts"), "updated");
  await writeFile(join(vendor, "drift.ts"), "a different stale implementation");
  assert.match(
    checkVendoredEngineBaseline(await inspectVendoredEngine(root, engine), baseline)[0],
    /Unbaselined drifted/,
  );
  await writeFile(join(vendor, "drift.ts"), "updated");
  const resolved = await inspectVendoredEngine(root, engine);
  assert.match(checkVendoredEngineBaseline(resolved, baseline)[0], /Remove resolved baseline entry/);
  const smaller = { "package-owned.ts": baseline["package-owned.ts"] };
  assert.deepEqual(checkVendoredEngineBaseline(resolved, smaller, baseline), []);
  await rm(join(vendor, "package-owned.ts"));
  assert.deepEqual(checkVendoredEngineBaseline(await inspectVendoredEngine(root, engine), {}, smaller), []);
  await writeFile(join(engine, "package.json"), JSON.stringify({ name: "wrong-checkout" }));
  await assert.rejects(inspectVendoredEngine(root, engine), /not a Marinara Engine checkout/);
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log(
  "Vendored Engine regression passed: classification, new drift, changed copies, baseline shrink, and invalid checkout.",
);
