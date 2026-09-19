import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The package typecheck must fail on a dangling relative import (TS2307), an undefined name, a
// missing export (TS2305), a member that exists but was never exported (TS2459/TS2724), a name
// bound twice (TS2300), and a file that does not parse at all (TS1xxx), while still ignoring Node globals, Engine host modules
// and bare dependency specifiers.
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

  rmSync(join(serverRoot, "broken.ts"));

  writeFileSync(join(serverRoot, "exports.ts"), "export const present = 1;\n");
  writeFileSync(
    join(serverRoot, "missing-export.ts"),
    ['import { absent } from "./exports.js";', "export const value = absent;", ""].join("\n"),
  );
  const missingExport = check();
  const missingExportOutput = `${missingExport.stdout}${missingExport.stderr}`;
  assert.equal(missingExport.status, 1, `a missing export must fail the check:\n${missingExportOutput}`);
  assert.match(missingExportOutput, /missing-export\.ts\(\d+,\d+\): error TS2305: /u);
  rmSync(join(serverRoot, "missing-export.ts"));

  // Slice 10 split a module and left the moved symbols imported but unexported. That is not
  // TS2305: the member is there, it is just private, so the gate saw nothing and esbuild found it.
  writeFileSync(join(serverRoot, "inner.ts"), "export const shared = 1;\n");
  writeFileSync(join(serverRoot, "facade.ts"), 'import { shared } from "./inner.js";\nexport const use = shared;\n');
  writeFileSync(
    join(serverRoot, "unexported-member.ts"),
    ['import { shared } from "./facade.js";', "export const value = shared;", ""].join("\n"),
  );
  const unexported = check();
  const unexportedOutput = `${unexported.stdout}${unexported.stderr}`;
  assert.equal(unexported.status, 1, `an unexported member must fail the check:\n${unexportedOutput}`);
  assert.match(unexportedOutput, /unexported-member\.ts\(\d+,\d+\): error TS2459: /u);
  rmSync(join(serverRoot, "unexported-member.ts"));

  // The other half of a mechanical split: the same name pulled in from two places at once.
  writeFileSync(
    join(serverRoot, "duplicate-import.ts"),
    [
      'import { shared } from "./inner.js";',
      'import { shared } from "./facade.js";',
      "export const value = shared;",
      "",
    ].join("\n"),
  );
  const duplicate = check();
  const duplicateOutput = `${duplicate.stdout}${duplicate.stderr}`;
  assert.equal(duplicate.status, 1, `a name bound twice must fail the check:\n${duplicateOutput}`);
  assert.match(duplicateOutput, /duplicate-import\.ts\(\d+,\d+\): error TS2300: /u);
  rmSync(join(serverRoot, "duplicate-import.ts"));
  rmSync(join(serverRoot, "facade.ts"));
  rmSync(join(serverRoot, "inner.ts"));
  rmSync(join(serverRoot, "exports.ts"));

  // A file whose only defect is a syntax error. TypeScript emits no semantic diagnostics for it, so
  // before TS1xxx was reported this fixture passed the gate while `missingName` went unmentioned.
  writeFileSync(
    join(serverRoot, "unparseable.tsx"),
    ["export function Broken() {", "  return <>", "    <span>{missingName}</span>", "  ;", "}", ""].join("\n"),
  );

  const unparseable = check();
  const syntaxOutput = `${unparseable.stdout}${unparseable.stderr}`;
  assert.equal(unparseable.status, 1, `a file that does not parse must fail the check:\n${syntaxOutput}`);
  assert.match(syntaxOutput, /unparseable\.tsx\(\d+,\d+\): error TS1\d{3}: /u);
  // Proof the gate was blind before: no TS2304 is emitted for `missingName` in an unparsed file.
  assert.doesNotMatch(syntaxOutput, /Cannot find name 'missingName'/u);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
