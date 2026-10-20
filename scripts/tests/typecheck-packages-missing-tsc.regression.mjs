import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A checkout without node_modules has no tsc. The package typecheck used to read that spawn failure as empty compiler
// output and report the package clean, so a fresh worktree passed the gate without checking anything.
const repoRoot = join(import.meta.dirname, "../..");
const tree = await mkdtemp(join(tmpdir(), "marinara-typecheck-no-tsc-"));
try {
  await mkdir(join(tree, "scripts"));
  await copyFile(join(repoRoot, "scripts/typecheck-packages.mjs"), join(tree, "scripts/typecheck-packages.mjs"));
  await mkdir(join(tree, "sources/engine/packages"), { recursive: true });
  await mkdir(join(tree, "sources/claude-subscription-overlay"));
  const source = join(tree, "packages/fixture/src/engine/packages/server/src");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "broken.ts"), "export const value = undefinedFixtureName;\n");

  const result = spawnSync(process.execPath, [join(tree, "scripts/typecheck-packages.mjs"), "fixture"], {
    cwd: tree,
    encoding: "utf8",
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.notEqual(result.status, 0, `a typecheck that could not start tsc must fail:\n${output}`);
  assert.match(output, /Could not run tsc \(ENOENT\)/u);
  assert.doesNotMatch(output, /no syntax errors/u);
} finally {
  await rm(tree, { recursive: true, force: true });
}
console.log("typecheck-packages fails when tsc cannot start");
