import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertPackagePrivateImportBoundary,
  findPackagePrivateEngineImports,
  readPackageEngineBoundary,
} from "../scripts/package-engine-boundary.mjs";

let root = null;
let outside = null;
try {
  root = await mkdtemp(join(tmpdir(), "marinara-boundary-"));
  outside = await mkdtemp(join(tmpdir(), "marinara-boundary-outside-"));
  await writeFile(join(root, "entry.ts"), [
    'import value = require("./outside");',
    'const dynamic = import("./outside");',
    'const common = require("./outside");',
    'const dynamicTemplate = import(`./dynamic-template`);',
    'const commonTemplate = require(`./common-template`);',
    'const ignoredDynamic = import(`./${name}`);',
    'const ignoredCommon = require(`./${name}`);',
  ].join("\n"));
  await symlink(join(outside, "outside.ts"), join(root, "outside.ts"));
  await symlink(join(outside, "dynamic-template.ts"), join(root, "dynamic-template.ts"));
  await symlink(join(outside, "common-template.ts"), join(root, "common-template.ts"));
  assert.deepEqual(await findPackagePrivateEngineImports(root), [
    { source: "entry.ts", specifier: "./common-template" },
    { source: "entry.ts", specifier: "./dynamic-template" },
    { source: "entry.ts", specifier: "./outside" },
  ]);
  const boundaryPath = join(root, "boundary.json");
  await writeFile(boundaryPath, JSON.stringify({
    schemaVersion: 1,
    capabilityApi: { major: 1, minor: 3 },
    builtAgainst: {
      engineVersion: "2.3.3",
      engineCommit: "0".repeat(40),
    },
    privateEngineImports: [
      { source: "entry.ts", specifier: "./common-template" },
      { source: "entry.ts", specifier: "./dynamic-template" },
      { source: "entry.ts", specifier: "./outside" },
    ],
  }));
  await assertPackagePrivateImportBoundary({
    sourceRoot: root,
    boundaryPath,
    displayName: "Fixture",
    capabilityApi: { major: 1, minor: 3 },
  });
  await writeFile(join(root, "boundary.json"), JSON.stringify({
    schemaVersion: 1,
    capabilityApi: { major: 1, minor: 3 },
    builtAgainst: {
      engineVersion: "2.3.3",
      engineCommit: "0".repeat(40),
    },
    privateEngineImports: [{ source: "removed.ts", specifier: "./gone" }],
  }));
  await assert.rejects(
    assertPackagePrivateImportBoundary({
      sourceRoot: root,
      boundaryPath,
      displayName: "Fixture",
      capabilityApi: { major: 1, minor: 3 },
    }),
    /Inventory diff:[\s\S]*added entry\.ts: \.\/outside[\s\S]*removed removed\.ts: \.\/gone/u,
  );
  await assert.rejects(
    readPackageEngineBoundary({
      boundaryPath: join(root, "missing-boundary.json"),
      displayName: "Fixture",
    }),
    /must declare its capability API/u,
  );
  process.stdout.write("Package boundary regression: symlink, ESM, CommonJS, and import assignment checks ok\n");
} finally {
  if (root) await rm(root, { recursive: true, force: true });
  if (outside) await rm(outside, { recursive: true, force: true });
}
