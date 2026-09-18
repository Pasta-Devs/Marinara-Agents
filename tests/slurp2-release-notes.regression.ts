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
  [
    "0.0.24",
    "0.0.22",
    "0.0.21",
    "0.0.20",
    "0.0.19",
    "0.0.18",
    "0.0.17",
    "0.0.16",
    "0.0.15",
    "0.0.14",
    "0.0.13",
    "0.0.12",
    "0.0.11",
    "0.0.10",
    "0.0.9",
    "0.0.8",
    "0.0.7",
    "0.0.6",
    "0.0.5",
  ],
  "an update from the previous release must show only the new release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.2").map((release) => release.version),
  [
    "0.0.24",
    "0.0.22",
    "0.0.21",
    "0.0.20",
    "0.0.19",
    "0.0.18",
    "0.0.17",
    "0.0.16",
    "0.0.15",
    "0.0.14",
    "0.0.13",
    "0.0.12",
    "0.0.11",
    "0.0.10",
    "0.0.9",
    "0.0.8",
    "0.0.7",
    "0.0.6",
    "0.0.5",
    "0.0.4",
  ],
  "a skipped update must retain every unseen release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.8").map((release) => release.version),
  [
    "0.0.24",
    "0.0.22",
    "0.0.21",
    "0.0.20",
    "0.0.19",
    "0.0.18",
    "0.0.17",
    "0.0.16",
    "0.0.15",
    "0.0.14",
    "0.0.13",
    "0.0.12",
    "0.0.11",
    "0.0.10",
    "0.0.9",
  ],
  "an update from 0.0.8 must show both newer releases",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.9").map((release) => release.version),
  [
    "0.0.24",
    "0.0.22",
    "0.0.21",
    "0.0.20",
    "0.0.19",
    "0.0.18",
    "0.0.17",
    "0.0.16",
    "0.0.15",
    "0.0.14",
    "0.0.13",
    "0.0.12",
    "0.0.11",
    "0.0.10",
  ],
  "an update from 0.0.9 must show the audience release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.10").map((release) => release.version),
  [
    "0.0.24",
    "0.0.22",
    "0.0.21",
    "0.0.20",
    "0.0.19",
    "0.0.18",
    "0.0.17",
    "0.0.16",
    "0.0.15",
    "0.0.14",
    "0.0.13",
    "0.0.12",
    "0.0.11",
  ],
  "an update from 0.0.10 must show the draft fix",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.11").map((release) => release.version),
  [
    "0.0.24",
    "0.0.22",
    "0.0.21",
    "0.0.20",
    "0.0.19",
    "0.0.18",
    "0.0.17",
    "0.0.16",
    "0.0.15",
    "0.0.14",
    "0.0.13",
    "0.0.12",
  ],
  "an update from 0.0.11 must show the smart draft release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.12").map((release) => release.version),
  ["0.0.24", "0.0.22", "0.0.21", "0.0.20", "0.0.19", "0.0.18", "0.0.17", "0.0.16", "0.0.15", "0.0.14", "0.0.13"],
  "an update from 0.0.12 must show the ownership fix release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.13").map((release) => release.version),
  ["0.0.24", "0.0.22", "0.0.21", "0.0.20", "0.0.19", "0.0.18", "0.0.17", "0.0.16", "0.0.15", "0.0.14"],
  "an update from 0.0.13 must show the integration release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.14").map((release) => release.version),
  ["0.0.24", "0.0.22", "0.0.21", "0.0.20", "0.0.19", "0.0.18", "0.0.17", "0.0.16", "0.0.15"],
  "an update from 0.0.14 must show the layout and follow fix release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.15").map((release) => release.version),
  ["0.0.24", "0.0.22", "0.0.21", "0.0.20", "0.0.19", "0.0.18", "0.0.17", "0.0.16"],
  "an update from 0.0.15 must show the audience redesign release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.16").map((release) => release.version),
  ["0.0.24", "0.0.22", "0.0.21", "0.0.20", "0.0.19", "0.0.18", "0.0.17"],
  "an update from 0.0.16 must show the Backstage release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.17").map((release) => release.version),
  ["0.0.24", "0.0.22", "0.0.21", "0.0.20", "0.0.19", "0.0.18"],
  "an update from 0.0.17 must show the reply and post length release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.18").map((release) => release.version),
  ["0.0.24", "0.0.22", "0.0.21", "0.0.20", "0.0.19"],
  "an update from 0.0.18 must show the force reply and setup fix releases",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.19").map((release) => release.version),
  ["0.0.24", "0.0.22", "0.0.21", "0.0.20"],
  "an update from 0.0.19 must show the setup and schedule fix release",
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.22").map((release) => release.version),
  ["0.0.24"],
  "an update from 0.0.22 must show the source layout release",
);
assert.deepEqual(getSlurp2UnseenReleases("0.0.24"), [], "the current release must not reopen an acknowledged splash");

console.log("slurp2 release notes mirror CHANGELOG.md");
