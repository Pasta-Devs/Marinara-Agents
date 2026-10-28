import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeCatalogFamily } from "../catalog-lanes.mjs";
import {
  MAX_RELEASE_NOTE_CHARACTERS,
  MAX_RELEASE_NOTE_VERSIONS,
  assertReleaseNotesForFeatureBumps,
  buildReleaseNotesDocument,
  compareVersions,
  parsePackageChangelog,
} from "../catalog-release-notes.mjs";

// Release notes ship as notes.json beside the catalog.json they describe, built
// from each package's CHANGELOG.md. These checks pin the parts a mistake would
// otherwise surface only in a user's update prompt:
//   * the highlight dot defaults from the semver bump, so authors do not have to
//     remember it, with explicit markers for the cases semver gets wrong;
//   * the caps the Engine schema also enforces fail the BUILD instead of being
//     truncated into a modal at fetch time;
//   * a sidecar only ever describes packages in its own lane, and disappears
//     when a lane has no notes at all;
//   * a minor or major bump with no changelog entry fails the build, because
//     optional notes rot and a version history full of gaps reads as abandoned.

function entry(id, version, { min = "2.3.0", maxExclusive = "3.0.0" } = {}) {
  return {
    manifest: {
      schemaVersion: 1,
      id,
      name: id,
      version,
      engine: { min, maxExclusive },
    },
  };
}

// ── SemVer precedence ─────────────────────────────────────────────────────────
// Packed arithmetic (major * 1e6 + minor * 1e3 + patch) reads tidily and ranks
// 1.0.1001 above 1.1.0, which would let an out-of-order changelog through.
assert.ok(compareVersions("1.1.0", "1.0.1001", "fixture") > 0, "A minor bump outranks any patch count");
assert.ok(compareVersions("2.0.0", "1.999.999", "fixture") > 0);
assert.ok(compareVersions("1.0.0", "1.0.0-rc.1", "fixture") > 0, "A release outranks its own prerelease");
assert.ok(compareVersions("1.0.0-rc.2", "1.0.0-rc.1", "fixture") > 0, "Numeric identifiers compare numerically");
assert.ok(compareVersions("1.0.0-rc.10", "1.0.0-rc.9", "fixture") > 0, "…not as text");
assert.ok(compareVersions("1.0.0-beta", "1.0.0-alpha", "fixture") > 0);
assert.ok(compareVersions("1.0.0-rc.1.1", "1.0.0-rc.1", "fixture") > 0, "More identifiers outrank fewer");
assert.equal(compareVersions("1.2.3", "1.2.3", "fixture"), 0);

assert.doesNotThrow(
  () => parsePackageChangelog("## 1.1.0 — 2026-09-01\n- x\n\n## 1.0.1001 — 2026-08-01\n- y\n", "fixture"),
  "A high patch count below a minor bump is correctly ordered",
);

// ── Parsing and the highlight default ─────────────────────────────────────────
const parsed = parsePackageChangelog(
  [
    "# Background",
    "",
    "## 1.2.0 — 2026-09-01",
    "- Handles flashbacks.",
    "",
    "## 1.1.1 — 2026-08-20 [highlight]",
    "- Fixed a silent failure on long chats.",
    "",
    "## 1.1.0 — 2026-08-10 [quiet]",
    "- Added an internal setting nobody sees.",
    "",
    "## 1.0.0 — 2026-08-01",
    "- First release.",
  ].join("\n"),
  "fixture",
);
assert.deepEqual(
  parsed.map((note) => [note.version, note.highlight]),
  [
    ["1.2.0", true], // minor bump: notable by default
    ["1.1.1", true], // patch, but the author overrode it
    ["1.1.0", false], // minor, but the author quieted it
    ["1.0.0", false], // nothing older to compare against
  ],
  "highlight derives from the semver bump unless the author overrides it",
);
assert.equal(parsed[0].notes, "- Handles flashbacks.", "Prose before the first heading is not part of any entry");

// ── Authoring mistakes fail loudly ────────────────────────────────────────────
const rejects = [
  ["## 1.0.0 — 2026-09-01\n", /has no notes/u],
  ["## 1.0 — 2026-09-01\n- x\n", /not a valid version/u],
  ["## 1.0.0 — 09-01-2026\n- x\n", /YYYY-MM-DD/u],
  ["## 1.0.0 — 2026-09-01 [urgent]\n- x\n", /unknown marker/u],
  ["## 1.0.0 — 2026-09-01\n- x\n\n## 1.0.0 — 2026-08-01\n- y\n", /listed twice/u],
  ["## 1.0.0 — 2026-08-01\n- x\n\n## 1.1.0 — 2026-09-01\n- y\n", /newest first/u],
  ["Nothing here at all.\n", /no "## <version>/u],
  [`## 1.0.0 — 2026-09-01\n${"x".repeat(MAX_RELEASE_NOTE_CHARACTERS + 1)}\n`, /over the 1000 cap/u],
];
for (const [markdown, pattern] of rejects) {
  assert.throws(() => parsePackageChangelog(markdown, "fixture"), pattern);
}

// A long-lived package must stay publishable, so old entries fall off the end
// rather than failing the build.
const long = Array.from({ length: MAX_RELEASE_NOTE_VERSIONS + 5 }, (_, index) => {
  const version = MAX_RELEASE_NOTE_VERSIONS + 5 - index;
  return `## 1.0.${version} — 2026-09-01\n- Change ${version}.\n`;
}).join("\n");
assert.equal(parsePackageChangelog(long, "fixture").length, MAX_RELEASE_NOTE_VERSIONS);

// ── The feature-release gate ──────────────────────────────────────────────────
const emptyNotes = { schemaVersion: 1, packages: {} };
assert.doesNotThrow(
  () => assertReleaseNotesForFeatureBumps([entry("alpha", "1.0.1")], emptyNotes, new Map([["alpha", "1.0.0"]])),
  "A patch release may ship silently",
);
assert.doesNotThrow(
  () => assertReleaseNotesForFeatureBumps([entry("alpha", "1.0.0")], emptyNotes, new Map([["alpha", "1.0.0"]])),
  "An unchanged package is not a release at all",
);
assert.throws(
  () => assertReleaseNotesForFeatureBumps([entry("alpha", "1.1.0")], emptyNotes, new Map([["alpha", "1.0.0"]])),
  /feature release \(was 1\.0\.0\) with no packages\/alpha\/CHANGELOG\.md entry/u,
);
assert.throws(
  () => assertReleaseNotesForFeatureBumps([entry("alpha", "1.0.0")], emptyNotes, new Map()),
  /with no packages\/alpha\/CHANGELOG\.md entry/u,
  "A package's first appearance owes the user a sentence too",
);
assert.throws(
  () => assertReleaseNotesForFeatureBumps([entry("alpha", "0.0.1")], emptyNotes, new Map()),
  /with no packages\/alpha\/CHANGELOG\.md entry/u,
  "…including one that first appears at 0.0.1, which reads as a patch against a synthetic 0.0.0",
);

// ── End to end through the lane chokepoint ────────────────────────────────────
const root = await mkdtemp(join(tmpdir(), "agents-release-notes-"));
try {
  await mkdir(join(root, "packages/alpha"), { recursive: true });
  await mkdir(join(root, "packages/beta"), { recursive: true });
  await writeFile(join(root, "packages/alpha/CHANGELOG.md"), "## 1.1.0 — 2026-09-01\n- Alpha grew a feature.\n");
  await writeFile(join(root, "packages/beta/CHANGELOG.md"), "## 1.0.0 — 2026-09-01\n- Beta arrived.\n");

  // beta spans v2 and v3; alpha is v2 only. A sidecar must never describe a
  // package the Engine reading that lane cannot install.
  const catalog = {
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    packages: [entry("alpha", "1.1.0"), entry("beta", "1.0.0", { maxExclusive: "4.0.0" })],
  };
  await writeCatalogFamily(root, catalog);

  const legacy = JSON.parse(await readFile(join(root, "catalog/notes.json"), "utf8"));
  assert.deepEqual(Object.keys(legacy.packages), ["alpha", "beta"]);
  assert.equal(legacy.packages.alpha.versions[0].notes, "- Alpha grew a feature.");
  assert.deepEqual(
    JSON.parse(await readFile(join(root, "catalog/v2/notes.json"), "utf8")),
    legacy,
    "The legacy alias mirrors the v2 lane, notes included",
  );
  assert.deepEqual(
    Object.keys(JSON.parse(await readFile(join(root, "catalog/v3/notes.json"), "utf8")).packages),
    ["beta"],
    "The v3 sidecar carries only the packages published in the v3 lane",
  );

  // A changelog that does not lead with the version being published would
  // describe the wrong release to every user reading the prompt.
  await writeFile(join(root, "packages/alpha/CHANGELOG.md"), "## 9.9.9 — 2026-09-01\n- Wrong release.\n");
  await assert.rejects(
    buildReleaseNotesDocument(root, catalog.packages),
    /leads with 9\.9\.9 but the catalog publishes 1\.1\.0/u,
  );

  // Withdrawing every changelog removes the sidecars rather than leaving empty
  // documents behind. Versions are unchanged, so the feature-release gate has
  // nothing to complain about.
  await rm(join(root, "packages/alpha/CHANGELOG.md"));
  await rm(join(root, "packages/beta/CHANGELOG.md"));
  await writeCatalogFamily(root, catalog);
  for (const path of ["catalog/notes.json", "catalog/v2/notes.json", "catalog/v3/notes.json"]) {
    await assert.rejects(readFile(join(root, path), "utf8"), /ENOENT/u, `${path} must not survive as an empty file`);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("catalog release notes: OK");
