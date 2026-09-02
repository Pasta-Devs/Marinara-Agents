import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Release notes are published as notes.json BESIDE the catalog.json they
// describe — never as a key on a catalog entry and never inside a package
// manifest.
//
// The Engine's catalog entry schema is strict and its parser DROPS entries
// carrying keys it does not know, so a new entry key would empty the Agents
// browser on every already-shipped Engine that predates it, not merely hide the
// notes. A manifest key is worse still: it rewrites every artifact and every
// sha256 to publish a sentence. A sibling document old Engines never request has
// neither problem, and an Engine that does request it treats a 404 as "no notes".

/** Mirrors the Engine's capabilityReleaseNotesSchema. Kept in step by hand; the
 *  Engine rejects the whole document if either cap is exceeded, so a drift here
 *  fails loudly at fetch time rather than truncating a note into a modal. */
export const MAX_RELEASE_NOTE_CHARACTERS = 1000;
export const MAX_RELEASE_NOTE_VERSIONS = 20;

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
// "## 1.3.0 — 2026-09-01 [highlight]" — em dash or hyphen, marker optional.
const HEADING_PATTERN = /^##\s+(\S+)\s+[—-]\s+(\S+)\s*(\[[a-z]+\])?\s*$/u;

function parseSemver(value, context) {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) throw new Error(`${context}: "${value}" is not a valid version`);
  return match.slice(1, 4).map(Number);
}

/** SemVer precedence, so ordering does not depend on any component staying small.
 *
 *  Packed arithmetic (major * 1e6 + minor * 1e3 + patch) looks tidy and is wrong:
 *  1.0.1001 outranks 1.1.0 under it. A release carrying a prerelease suffix also
 *  precedes the release it leads to, per SemVer, and dotted prerelease identifiers
 *  compare numerically when both sides are numeric and as text otherwise. */
function comparePrereleaseIdentifiers(left, right) {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    // A shorter set of identifiers has lower precedence when all preceding ones are equal.
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/u.test(leftPart);
    const rightNumeric = /^\d+$/u.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) - Number(rightPart);
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

export function compareVersions(left, right, context) {
  const leftParts = parseSemver(left, context);
  const rightParts = parseSemver(right, context);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  const leftPrerelease = left.includes("-") ? left.slice(left.indexOf("-") + 1) : null;
  const rightPrerelease = right.includes("-") ? right.slice(right.indexOf("-") + 1) : null;
  if (leftPrerelease === rightPrerelease) return 0;
  if (leftPrerelease === null) return 1;
  if (rightPrerelease === null) return -1;
  return comparePrereleaseIdentifiers(leftPrerelease, rightPrerelease);
}

/** Whether moving from `previous` to `version` changed the major or minor part.
 *
 *  This is the default for the highlight dot, and it is why authors almost never
 *  have to think about the flag: semver already encodes "the user will notice
 *  this". The explicit markers exist for the two cases semver gets wrong — a
 *  patch that repairs a badly broken agent, and a minor that only adds a setting
 *  nobody sees. */
function isNotableBump(version, previous, context) {
  if (!previous) return false;
  const [major, minor] = parseSemver(version, context);
  const [previousMajor, previousMinor] = parseSemver(previous, context);
  return major !== previousMajor || minor !== previousMinor;
}

/** Parse one package CHANGELOG.md into catalog notes entries, newest first. */
export function parsePackageChangelog(markdown, context) {
  const lines = markdown.split(/\r?\n/u);
  const sections = [];
  for (const line of lines) {
    const heading = HEADING_PATTERN.exec(line.trim());
    if (heading) {
      sections.push({ version: heading[1], date: heading[2], marker: heading[3] ?? null, body: [] });
      continue;
    }
    // Anything before the first heading is a title or preamble and is dropped.
    if (sections.length > 0) sections.at(-1).body.push(line);
  }
  if (sections.length === 0) throw new Error(`${context}: no "## <version> — <YYYY-MM-DD>" entries found`);

  const seen = new Set();
  const entries = sections.map((section, index) => {
    parseSemver(section.version, context);
    if (!DATE_PATTERN.test(section.date)) {
      throw new Error(`${context}: ${section.version} needs a YYYY-MM-DD date, got "${section.date}"`);
    }
    if (seen.has(section.version)) throw new Error(`${context}: ${section.version} is listed twice`);
    seen.add(section.version);

    const notes = section.body.join("\n").trim();
    if (!notes) throw new Error(`${context}: ${section.version} has no notes`);
    if (notes.length > MAX_RELEASE_NOTE_CHARACTERS) {
      throw new Error(
        `${context}: ${section.version} has ${notes.length} characters of notes, over the ${MAX_RELEASE_NOTE_CHARACTERS} cap`,
      );
    }
    if (section.marker && section.marker !== "[highlight]" && section.marker !== "[quiet]") {
      throw new Error(`${context}: ${section.version} has an unknown marker ${section.marker}`);
    }

    const previous = sections[index + 1]?.version ?? null;
    const highlight =
      section.marker === "[highlight]"
        ? true
        : section.marker === "[quiet]"
          ? false
          : isNotableBump(section.version, previous, context);
    return { version: section.version, date: section.date, notes, highlight };
  });

  for (let index = 1; index < entries.length; index += 1) {
    if (compareVersions(entries[index - 1].version, entries[index].version, context) <= 0) {
      throw new Error(`${context}: entries must be newest first`);
    }
  }

  // Older entries fall off the end rather than failing the build: a long-lived
  // package must not become unpublishable because it has shipped 30 versions.
  return entries.slice(0, MAX_RELEASE_NOTE_VERSIONS);
}

/** Notes for one package, or null when it publishes no CHANGELOG.md. */
export async function readPackageReleaseNotes(repoRoot, id) {
  let markdown;
  try {
    markdown = await readFile(join(repoRoot, "packages", id, "CHANGELOG.md"), "utf8");
  } catch (error) {
    // Only a missing file means "this package publishes no notes". A permission
    // error or an unreadable directory swallowed here would silently drop a
    // package's notes from the catalog instead of failing the build.
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  return parsePackageChangelog(markdown, `packages/${id}/CHANGELOG.md`);
}

/** Build the notes document for a set of catalog entries.
 *
 *  Throws when a package's committed CHANGELOG.md does not lead with the version
 *  the catalog is about to publish, so notes cannot silently describe the wrong
 *  release. */
export async function buildReleaseNotesDocument(repoRoot, entries) {
  const packages = {};
  for (const entry of [...entries].sort((left, right) => left.manifest.id.localeCompare(right.manifest.id))) {
    const { id, version } = entry.manifest;
    const versions = await readPackageReleaseNotes(repoRoot, id);
    if (!versions) continue;
    if (versions[0].version !== version) {
      throw new Error(
        `packages/${id}/CHANGELOG.md leads with ${versions[0].version} but the catalog publishes ${version}`,
      );
    }
    packages[id] = { versions };
  }
  return { schemaVersion: 1, packages };
}

/** Every package id that ships a CHANGELOG.md, for coverage reporting. */
export async function listPackagesWithChangelogs(repoRoot) {
  const ids = [];
  const directories = await readdir(join(repoRoot, "packages"), { withFileTypes: true });
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    if ((await readPackageReleaseNotes(repoRoot, directory.name)) !== null) ids.push(directory.name);
  }
  return ids.sort();
}

/** Fail a build that ships a feature release with no notes.
 *
 *  Optional notes rot: authors skip them, and within two months the version
 *  history looks abandoned. Patch releases may stay silent, but a minor or major
 *  bump — including a package's first appearance — owes the user a sentence.
 *  `previousVersions` comes from the catalog committed before this build, so the
 *  gate needs no retroactive changelog for the packages already published. */
export function assertReleaseNotesForFeatureBumps(entries, notesDocument, previousVersions) {
  for (const entry of entries) {
    const { id, version } = entry.manifest;
    const previous = previousVersions.get(id) ?? null;
    if (previous === version) continue;
    // A first appearance always owes notes, checked before the bump test: an
    // initial 0.0.1 reads as a patch against a synthetic 0.0.0 and would slip past.
    if (previous !== null && !isNotableBump(version, previous, `packages/${id}`)) continue;
    const published = notesDocument.packages[id]?.versions.some((note) => note.version === version);
    if (published) continue;
    throw new Error(
      `${id} ${version} is a feature release${previous ? ` (was ${previous})` : ""} with no packages/${id}/CHANGELOG.md entry. ` +
        `Add one, or ship it as a patch release.`,
    );
  }
}
