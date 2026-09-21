/** Ensure the splash mirrors the public release history. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error -- plain .mjs helper, no types published.
import { parsePackageChangelog } from "../scripts/catalog-release-notes.mjs";
import {
  getSlurp2UnseenReleases,
  SLURP2_RELEASES,
  SLURP2_VERSION,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-release.ts";

const root = join(import.meta.dirname, "..", "packages", "slurp2");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as { version: string };
const changelog = parsePackageChangelog(readFileSync(join(root, "CHANGELOG.md"), "utf8"), "slurp2") as Array<{
  version: string;
  date: string;
  notes: string;
}>;

assert.equal(SLURP2_VERSION, "0.2.4");
assert.equal(SLURP2_VERSION, manifest.version);
assert.deepEqual(
  SLURP2_RELEASES.map(({ version, date, notes }) => ({ version, date, notes })),
  changelog
    .filter(
      (entry) =>
        entry.version === "0.2.4" ||
        entry.version === "0.2.3" ||
        entry.version === "0.2.2" ||
        entry.version === "0.2.1" ||
        entry.version === "0.2.0" ||
        entry.version === "0.1.3" ||
        entry.version === "0.1.2" ||
        entry.version === "0.1.1" ||
        entry.version === "0.1.0" ||
        entry.version === "0.0.22",
    )
    .map((entry) => ({
      version: entry.version,
      date: entry.date,
      notes: entry.notes
        .split("\n")
        .filter(Boolean)
        .map((line) => line.replace(/^-\s*/u, "")),
    })),
);
assert.deepEqual(
  SLURP2_RELEASES.map((release) => release.version),
  ["0.2.4", "0.2.3", "0.2.2", "0.2.1", "0.2.0", "0.1.3", "0.1.2", "0.1.1", "0.1.0", "0.0.22"],
);
assert.deepEqual(
  getSlurp2UnseenReleases(null).map((release) => release.version),
  ["0.2.4", "0.2.3", "0.2.2", "0.2.1", "0.2.0", "0.1.3", "0.1.2", "0.1.1", "0.1.0", "0.0.22"],
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.0.22").map((release) => release.version),
  ["0.2.4", "0.2.3", "0.2.2", "0.2.1", "0.2.0", "0.1.3", "0.1.2", "0.1.1", "0.1.0"],
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.1.0").map((release) => release.version),
  ["0.2.4", "0.2.3", "0.2.2", "0.2.1", "0.2.0", "0.1.3", "0.1.2", "0.1.1"],
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.1.1").map((release) => release.version),
  ["0.2.4", "0.2.3", "0.2.2", "0.2.1", "0.2.0", "0.1.3", "0.1.2"],
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.1.3").map((release) => release.version),
  ["0.2.4", "0.2.3", "0.2.2", "0.2.1", "0.2.0"],
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.2.0").map((release) => release.version),
  ["0.2.4", "0.2.3", "0.2.2", "0.2.1"],
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.2.1").map((release) => release.version),
  ["0.2.4", "0.2.3", "0.2.2"],
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.2.2").map((release) => release.version),
  ["0.2.4", "0.2.3"],
);
assert.deepEqual(
  getSlurp2UnseenReleases("0.2.3").map((release) => release.version),
  ["0.2.4"],
);
assert.deepEqual(getSlurp2UnseenReleases("0.2.4"), []);

console.log("slurp2 release notes mirror CHANGELOG.md");
