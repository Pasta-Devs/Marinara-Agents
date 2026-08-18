import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeArchivePath(value) {
  if (!value || value.includes("\\") || value.startsWith("/") || value.includes("\0")) {
    throw new Error(`Unsafe package path: ${JSON.stringify(value)}`);
  }
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes(":"))) {
    throw new Error(`Unsafe package path: ${JSON.stringify(value)}`);
  }
  return parts.join("/");
}

function inside(root, candidate) {
  const base = resolve(root);
  const target = resolve(candidate);
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    throw new Error(`Package path escapes its installation root: ${candidate}`);
  }
  return target;
}

function isSymlink(entry) {
  return ((entry.attr >>> 16) & 0o170000) === 0o120000;
}

export async function installPackageBrowserFixture({ agentsRoot, engineRoot, dataDir, packageId }) {
  const packageRoot = join(agentsRoot, "packages", packageId);
  const manifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
  if (manifest.id !== packageId) throw new Error(`Package manifest ID does not match ${packageId}`);

  const catalog = JSON.parse(await readFile(join(agentsRoot, "catalog", "catalog.json"), "utf8"));
  const catalogEntry = catalog.packages.find((entry) => entry.manifest?.id === packageId);
  if (!catalogEntry) throw new Error(`${packageId} is missing from catalog/catalog.json`);
  if (JSON.stringify(catalogEntry.manifest) !== JSON.stringify(manifest)) {
    throw new Error(`${packageId} manifest does not match its catalog entry`);
  }

  const artifactPath = join(agentsRoot, "artifacts", `${packageId}-${manifest.version}.zip`);
  const archive = await readFile(artifactPath);
  if (archive.byteLength !== catalogEntry.artifact.bytes || sha256(archive) !== catalogEntry.artifact.sha256) {
    throw new Error(`${packageId} artifact does not match its catalog integrity metadata`);
  }

  const requireFromEngine = createRequire(join(engineRoot, "package.json"));
  const AdmZip = requireFromEngine("adm-zip");
  const zip = new AdmZip(archive);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  const names = new Set();
  const declared = new Map(manifest.files.map((file) => [normalizeArchivePath(file.path), file]));
  const manifestEntry = entries.find((entry) => entry.entryName === "manifest.json");
  if (!manifestEntry) throw new Error(`${packageId} artifact has no manifest.json`);
  const archivedManifest = JSON.parse(manifestEntry.getData().toString("utf8"));
  if (JSON.stringify(archivedManifest) !== JSON.stringify(manifest)) {
    throw new Error(`${packageId} artifact manifest differs from the package manifest`);
  }

  const installRoot = join(dataDir, "capability-packages");
  const versionRoot = join(installRoot, "versions", packageId, manifest.version);
  await rm(installRoot, { recursive: true, force: true });
  await mkdir(versionRoot, { recursive: true });

  for (const entry of entries) {
    const name = normalizeArchivePath(entry.entryName);
    if (names.has(name)) throw new Error(`${packageId} artifact contains duplicate path ${name}`);
    names.add(name);
    if (isSymlink(entry)) throw new Error(`${packageId} artifact contains a symbolic link`);
    if (name === "manifest.json") {
      await writeFile(join(versionRoot, name), entry.getData(), {
        mode: 0o600,
      });
      continue;
    }
    const declaration = declared.get(name);
    if (!declaration) throw new Error(`${packageId} artifact contains undeclared file ${name}`);
    const data = entry.getData();
    if (data.byteLength !== declaration.bytes || sha256(data) !== declaration.sha256) {
      throw new Error(`${packageId} artifact payload does not match ${name}`);
    }
    const destination = inside(versionRoot, join(versionRoot, name));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, data, { mode: 0o600 });
  }

  if (entries.length !== declared.size + 1) {
    throw new Error(`${packageId} artifact contains missing or extra payload files`);
  }

  await writeFile(
    join(installRoot, "installed.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        packages: [
          {
            id: packageId,
            version: manifest.version,
            manifest,
            installedAt: new Date().toISOString(),
            status: "active",
            error: null,
            readiness: manifest.entrypoints.server ? "pending" : "ready",
            readinessError: null,
            legacy: false,
          },
        ],
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
}
