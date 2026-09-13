/**
 * The splash screen ships the release notes inside the client bundle, so they are a second copy of
 * CHANGELOG.md. Copies drift: this fails the build when the mirror, the changelog and the shipped
 * version stop agreeing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error -- plain .mjs helper, no types published.
import { parsePackageChangelog } from "../scripts/catalog-release-notes.mjs";
import {
  getSlurp2UnseenReleases,
  SLURP2_RELEASES,
  SLURP2_VERSION,
} from "../packages/slurp2/src/engine/packages/client/src/components/slurp/slurp2-release.ts";

const root = join(import.meta.dirname, "..", "packages", "slurp2");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as { version: string };
const changelog = parsePackageChangelog(readFileSync(join(root, "CHANGELOG.md"), "utf8"), "slurp2") as Array<{
  version: string;
  date: string;
  notes: string;
}>;

assert.equal(SLURP2_VERSION, manifest.version, "SLURP2_VERSION must match the shipped manifest version");
assert.equal(SLURP2_VERSION, changelog[0].version, "the newest changelog entry must be the shipped version");

assert.deepEqual(
  SLURP2_RELEASES.map((release) => ({ version: release.version, date: release.date, notes: release.notes })),
  changelog.map((entry) => ({
    version: entry.version,
    date: entry.date,
    notes: entry.notes
      .split("\n")
      .filter(Boolean)
      .map((line) => line.replace(/^-\s*/u, "")),
  })),
  "the splash release notes must mirror CHANGELOG.md",
);

assert.deepEqual(
  getSlurp2UnseenReleases(null).map((release) => release.version),
  SLURP2_RELEASES.map((release) => release.version),
  "a fresh install must retain the complete release history for progressive disclosure",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.4").map((release) => release.version),
  ["0.0.5"],
  "an update from the previous release must show only the new release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.2").map((release) => release.version),
  ["0.0.5", "0.0.4", "0.0.3"],
  "a skipped update must retain every unseen release",
);
assert.deepEqual(getSlurp2UnseenReleases("0.0.5"), [], "the current release must not reopen an acknowledged splash");

console.log("slurp2 release notes mirror CHANGELOG.md");
