// Manifest integrity for every package in the tree, not just the listed ones.
//
// validate-catalog.mjs walks `catalog.packages`, so a package held back by
// INCOMPLETE_PACKAGE_IDS (scripts/catalog-incomplete.mjs) is in no catalog and
// was therefore never reached by any byte check. That is how pixelforge 0.11.0
// shipped a commit whose manifest, artifact zip, and source file disagreed
// about client.js by 3,280 bytes — one source file had been built while it sat
// CRLF on disk (#544, #545).
//
// The per-file assertions live here rather than inline in the catalog loop so
// the listed and held-back paths run the identical check and cannot drift.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  assertPortableFilenameComponent,
  assertPortableRelativePath,
  packageArtifactName,
  resolveContainedPortablePath,
} from "./catalog-path-safety.mjs";

export function readZip(args, { packageId, artifactPath, member = null, purpose }) {
  const result = spawnSync("unzip", args, {
    encoding: member ? undefined : "utf8",
    maxBuffer: 120 * 1024 * 1024,
  });
  if (result.error?.code === "ENOENT") {
    throw new Error(
      `Cannot ${purpose} ${packageId} artifact ${artifactPath}: unzip executable was not found; install unzip and retry`,
    );
  }
  if (result.status !== 0) {
    const detail = result.stderr?.toString().trim() || result.error?.message || `exit status ${result.status}`;
    throw new Error(
      `Could not ${purpose} ${member ? `member ${member} from ` : ""}${packageId} artifact ${artifactPath}: ${detail}`,
    );
  }
  return result;
}

// The #544 invariant: every file the manifest declares must weigh and hash
// exactly what the manifest says, both as the source file on disk and as the
// member committed inside the artifact, and those two must be byte-identical.
// A CRLF-smudged source trips this on the first `bytes` comparison.
export async function assertDeclaredFilesMatchManifest({ manifest, packageRoot, artifactPath }) {
  for (const declared of manifest.files) {
    const sourcePayload = await readFile(
      await resolveContainedPortablePath(packageRoot, declared.path, `Declared file for ${manifest.id}`),
    );
    const payloads = [["source", sourcePayload]];
    let archivedPayload = null;
    if (artifactPath) {
      archivedPayload = readZip(["-p", artifactPath, declared.path], {
        packageId: manifest.id,
        artifactPath,
        member: declared.path,
        purpose: "read",
      }).stdout;
      payloads.push(["artifact", archivedPayload]);
    }
    for (const [location, payload] of payloads) {
      if (payload.byteLength !== declared.bytes) {
        throw new Error(
          `${manifest.id} ${declared.path} ${location} size does not match its manifest ` +
            `(manifest ${declared.bytes} bytes, ${location} ${payload.byteLength} bytes)`,
        );
      }
      if (createHash("sha256").update(payload).digest("hex") !== declared.sha256) {
        throw new Error(`${manifest.id} ${declared.path} ${location} hash does not match its manifest`);
      }
    }
    if (archivedPayload && !sourcePayload.equals(archivedPayload)) {
      throw new Error(`${manifest.id} ${declared.path} differs between package source and artifact`);
    }
  }
}

// Verifies the artifact describes the same file set as the manifest, and that
// the manifest sealed inside the zip is the manifest on disk.
function assertArtifactMatchesManifest({ manifest, artifactPath }) {
  const listed = readZip(["-Z1", artifactPath], {
    packageId: manifest.id,
    artifactPath,
    purpose: "inspect",
  });
  const actualFiles = listed.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((path) => assertPortableRelativePath(path, `Archived file for ${manifest.id}`))
    .sort();
  const declaredFiles = ["manifest.json", ...manifest.files.map((file) => file.path)].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(declaredFiles)) {
    throw new Error(`Artifact file list mismatch for ${manifest.id}`);
  }
  const archivedManifest = readZip(["-p", artifactPath, "manifest.json"], {
    packageId: manifest.id,
    artifactPath,
    member: "manifest.json",
    purpose: "read",
  });
  if (JSON.stringify(JSON.parse(archivedManifest.stdout.toString("utf8"))) !== JSON.stringify(manifest)) {
    throw new Error(`Archived manifest does not match packages/${manifest.id}/manifest.json`);
  }
}

// Covers the packages the catalog loop never reaches. `cataloguedIds` are the
// ids validate-catalog.mjs already verified in full, so each package directory
// is checked exactly once by exactly one path.
export async function assertEveryPackageManifestIntegrity({ repoRoot, cataloguedIds }) {
  const packagesRoot = join(repoRoot, "packages");
  const artifactsRoot = join(repoRoot, "artifacts");
  const entries = await readdir(packagesRoot, { withFileTypes: true });
  const checked = [];
  const withoutArtifact = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    // `readdir` describes the entry itself, not its target, so a symlinked
    // package directory reports isDirectory() === false and the skip below
    // would drop it from the sweep without a word — the same silent-gap
    // failure this sweep exists to close. Reject rather than follow: a package
    // is a real directory in this tree, and following the link would make
    // coverage depend on core.symlinks, which Git for Windows sets to false.
    if (entry.isSymbolicLink()) {
      throw new Error(`packages/${entry.name} is a symbolic link; packages must be real directories`);
    }
    if (!entry.isDirectory()) continue;
    assertPortableFilenameComponent(entry.name, "Package directory");
    const packageRoot = await resolveContainedPortablePath(
      packagesRoot,
      entry.name,
      `Package directory for ${entry.name}`,
    );
    const manifestPath = join(packageRoot, "manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`packages/${entry.name} has no manifest.json`);
    }
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.id !== entry.name) {
      throw new Error(`packages/${entry.name}/manifest.json declares id ${manifest.id}`);
    }
    if (cataloguedIds.has(manifest.id)) continue;
    if (!Array.isArray(manifest.files)) {
      throw new Error(`Missing file declarations for ${manifest.id}`);
    }
    const declaredPaths = new Set();
    for (const [index, declared] of manifest.files.entries()) {
      const declaredPath = assertPortableRelativePath(declared?.path, `Declared file ${index + 1} for ${manifest.id}`);
      if (declaredPaths.has(declaredPath)) {
        throw new Error(`Duplicate declared file ${declaredPath} for ${manifest.id}`);
      }
      declaredPaths.add(declaredPath);
    }
    // A held-back package need not have been built yet, but when its artifact
    // is committed the artifact is held to the same contract as a listed one.
    const artifactName = packageArtifactName(manifest.id, manifest.version);
    const candidateArtifactPath = join(artifactsRoot, artifactName);
    let artifactPath = null;
    if (existsSync(candidateArtifactPath)) {
      artifactPath = await resolveContainedPortablePath(artifactsRoot, artifactName, `Artifact for ${manifest.id}`);
      assertArtifactMatchesManifest({ manifest, artifactPath });
    } else {
      withoutArtifact.push(manifest.id);
    }
    await assertDeclaredFilesMatchManifest({ manifest, packageRoot, artifactPath });
    checked.push(manifest.id);
  }
  return { checked, withoutArtifact };
}
