import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
  });
}

function readSources(directories: string[]) {
  return directories.flatMap(sourceFiles).map((file) => [file, readFileSync(join(root, file), "utf8")] as const);
}

// Imports are checked as statements so feature names and comments do not count as active imports.
function activeImports(source: string): string[] {
  const statements: string[] = [];
  let statement = "";
  for (const line of source.split("\n")) {
    if (!statement && /^\s*import\b/u.test(line)) statement = line;
    else if (statement) statement += `\n${line}`;
    if (statement && statement.includes(";")) {
      statements.push(statement);
      statement = "";
    }
  }
  return statements;
}
const noodleSources = readSources([
  "packages/noodle/src/engine/packages/client",
  "packages/noodle/src/engine/packages/server",
]);
for (const [file, source] of noodleSources) {
  assert.doesNotMatch(source, /\/api\/slurp/u, `${file} depends on the Slurp API`);
  for (const statement of activeImports(source)) {
    assert.doesNotMatch(statement, /\b(?:Noodler|Creator)\b/u, `${file} has an active Noodler or Creator import`);
  }
}

const sharedNoodlePromptRegistry = readFileSync(
  join(root, "sources/engine/packages/server/src/services/prompt-overrides/registry/noodle.ts"),
  "utf8",
);
assert.match(
  sharedNoodlePromptRegistry,
  /export const NOODLE_IMAGE_INTERPRET\b/u,
  "the shared extraction snapshot must define the image prompt override imported by Slurp",
);

console.log("Noodle extraction import regressions passed.");
