/** Ensure the splash mirrors the public release history. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getSlurp2UnseenReleases,
  SLURP2_RELEASES,
  SLURP2_VERSION,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-release.ts";

const root = join(import.meta.dirname, "..", "packages", "slurp2");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as { version: string };
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
const expectedVersions = [
  "0.2.63",
  "0.2.62",
  "0.2.61",
  "0.2.60",
  "0.2.59",
  "0.2.58",
  "0.2.57",
  "0.2.56",
  "0.2.55",
  "0.2.54",
  "0.2.53",
  "0.2.52",
  "0.2.51",
  "0.2.50",
  "0.2.49",
  "0.2.48",
  "0.2.47",
  "0.2.46",
  "0.2.45",
  "0.2.44",
  "0.2.43",
  "0.2.42",
  "0.2.41",
  "0.2.40",
  "0.2.39",
  "0.2.38",
  "0.2.37",
  "0.2.36",
  "0.2.35",
  "0.2.34",
  "0.2.29",
  "0.2.28",
  "0.2.27",
  "0.2.26",
  "0.2.24",
  "0.2.23",
  "0.2.22",
  "0.2.20",
  "0.2.19",
  "0.2.18",
  "0.2.17",
  "0.2.16",
  "0.2.15",
  "0.2.8",
  "0.2.7",
  "0.2.5",
  "0.2.4",
  "0.2.3",
  "0.2.2",
  "0.2.1",
  "0.2.0",
  "0.1.3",
  "0.1.2",
  "0.1.1",
  "0.1.0",
  "0.0.22",
];

assert.equal(SLURP2_VERSION, "0.2.63");
assert.equal(SLURP2_VERSION, manifest.version);
for (const version of expectedVersions) assert.match(changelog, new RegExp(`^## ${version} — `, "mu"));
assert.deepEqual(
  SLURP2_RELEASES.map((release) => release.version),
  expectedVersions,
);
const unseenAfter = (seenVersion: string) => expectedVersions.slice(0, expectedVersions.indexOf(seenVersion));
assert.deepEqual(
  getSlurp2UnseenReleases(null).map((release) => release.version),
  expectedVersions,
);
for (const seenVersion of [
  "0.0.22",
  "0.1.0",
  "0.1.1",
  "0.1.3",
  "0.2.0",
  "0.2.1",
  "0.2.2",
  "0.2.3",
  "0.2.4",
  "0.2.5",
  "0.2.28",
  "0.2.29",
  "0.2.34",
]) {
  assert.deepEqual(
    getSlurp2UnseenReleases(seenVersion).map((release) => release.version),
    unseenAfter(seenVersion),
  );
}

console.log("slurp2 release notes mirror CHANGELOG.md");
