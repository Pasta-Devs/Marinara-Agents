import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The package typecheck must fail on a dangling relative import (TS2307) as well as an undefined
// name, while still ignoring Node globals, Engine host modules and bare dependency specifiers.
const repoRoot = join(import.meta.dirname, "..");
const id = `zz-typecheck-fixture-${process.pid}`;
const fixtureRoot = join(repoRoot, "packages", id);
const serverRoot = join(fixtureRoot, "src/engine/packages/server/src/services/fixture");

const check = () =>
  spawnSync(process.execPath, [join(repoRoot, "scripts/typecheck-packages.mjs"), id], {
    cwd: repoRoot,
    encoding: "utf8",
  });

try {
  mkdirSync(serverRoot, { recursive: true });
  writeFileSync(
    join(serverRoot, "tolerated.ts"),
    [
      'import "bare-dependency-the-overlay-does-not-install";',
      'import { db } from "../../db/connection.js";',
      "setImmediate(() => db);",
      "",
    ].join("\n"),
  );

  const clean = check();
  assert.equal(clean.status, 0, `tolerated diagnostics must not fail the check:\n${clean.stdout}${clean.stderr}`);

  writeFileSync(
    join(serverRoot, "broken.ts"),
    ['import { moved } from "./moved-away.js";', "export const value = moved + undefinedFixtureName;", ""].join("\n"),
  );

  const broken = check();
  const output = `${broken.stdout}${broken.stderr}`;
  assert.equal(broken.status, 1, `a dangling import must fail the check:\n${output}`);
  assert.match(output, /error TS2307: Cannot find module '\.\/moved-away\.js'/u);
  assert.match(output, /error TS2304: Cannot find name 'undefinedFixtureName'/u);
  assert.doesNotMatch(output, /db\/connection|bare-dependency|setImmediate/u);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
