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
// The splash is a curated subset of the changelog: pre-release and some old entries are not shown.
// Check what must hold for any version: same order as the changelog, newest matches the package,
// and nothing on the current minor line is hidden.
const changelogVersions = [...changelog.matchAll(/^## (\d+\.\d+\.\d+) — /gmu)].map(([, version]) => version!);
const splashVersions = SLURP2_RELEASES.map((release) => release.version);
const currentLine = manifest.version.split(".").slice(0, 2).join(".") + ".";

assert.ok(changelogVersions.length > 0, "CHANGELOG.md must list releases");
assert.equal(changelogVersions[0], manifest.version, "CHANGELOG.md's newest entry is the packaged version");
assert.equal(SLURP2_VERSION, manifest.version);
assert.equal(splashVersions[0], SLURP2_VERSION, "the splash's newest release is the current version");
assert.deepEqual(
  splashVersions.filter((version) => changelogVersions.includes(version)),
  splashVersions,
  "every splash release must exist in CHANGELOG.md",
);
const inChangelogOrder = splashVersions.map((version) => changelogVersions.indexOf(version));
assert.deepEqual(
  inChangelogOrder,
  [...inChangelogOrder].sort((a, b) => a - b),
  "splash releases keep CHANGELOG.md order",
);
for (const version of changelogVersions.filter((item) => item.startsWith(currentLine))) {
  assert.ok(splashVersions.includes(version), `${version} is on the current line and must be shown in the splash`);
}

const unseenAfter = (seenVersion: string) => splashVersions.slice(0, splashVersions.indexOf(seenVersion));
assert.deepEqual(
  getSlurp2UnseenReleases(null).map((release) => release.version),
  splashVersions,
);
for (const seenVersion of [splashVersions[1]!, splashVersions.at(-1)!]) {
  assert.deepEqual(
    getSlurp2UnseenReleases(seenVersion).map((release) => release.version),
    unseenAfter(seenVersion),
  );
}

console.log("slurp2 release notes mirror CHANGELOG.md");
