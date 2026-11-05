// Package files: a ruleset or an Experience (held Engine catalog work, numbers given when it lands upstream) as one plain JSON file,
// `{"format":...,"version":1,"manifest":{...},"files":{"<path>":"<base64>",...}}`, never a package zip.
// The text written here is byte for byte what the Engine's own writer (experienceFileParts) makes, so a
// rebuild is deterministic and the validator can rebuild the expected bytes from the package source.
import { assertPortableFilenameComponent } from "./catalog-path-safety.mjs";

export const RULESET_FILE_FORMAT = "marinara-ruleset";
export const RULESET_FILE_EXTENSION = ".ruleset.json";
/** The Engine installs a catalog ruleset from a ruleset file from this Capability API minor on. */
export const RULESET_FILE_CAPABILITY_MINOR = 335;
const PACKAGE_FILE_VERSION = 1;

/** The package file's bytes: the manifest, then each declared file's bytes in base64, in the given order. */
export function packageFileBuffer(format, manifest, files) {
  const parts = [
    `{"format":${JSON.stringify(format)},"version":${PACKAGE_FILE_VERSION},\n"manifest":${JSON.stringify(manifest, null, 2)},\n"files":{`,
  ];
  files.forEach(({ path, data }, index) => {
    parts.push(`${index ? "," : ""}\n${JSON.stringify(path)}:"${Buffer.from(data).toString("base64")}"`);
  });
  parts.push("\n}}\n");
  return Buffer.from(parts.join(""), "utf8");
}

/** A package file read back: its format, manifest and files. Only for files this repository built. */
export function readPackageFile(buffer, format) {
  const document = JSON.parse(buffer.toString("utf8"));
  if (Object.keys(document).join(",") !== "format,version,manifest,files") {
    throw new Error("A package file holds format, version, manifest and files, in that order");
  }
  if (document.format !== format) throw new Error(`Expected a ${format} file, found ${document.format}`);
  if (document.version !== PACKAGE_FILE_VERSION) throw new Error(`Unknown package file version ${document.version}`);
  return {
    manifest: document.manifest,
    files: new Map(Object.entries(document.files).map(([path, base64]) => [path, Buffer.from(base64, "base64")])),
  };
}

export const isRulesetManifest = (manifest) => Boolean(manifest?.kind?.includes("ruleset"));

/** `<id>-<version>.ruleset.json`, under the same naming rules as a package zip. */
export function rulesetArtifactName(packageId, version) {
  const safeId = assertPortableFilenameComponent(packageId, "Package id");
  const safeVersion = assertPortableFilenameComponent(version, `Package ${safeId} version`);
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(safeVersion)) {
    throw new Error(`Package ${safeId} version must be a semantic version`);
  }
  return `${safeId}-${safeVersion}${RULESET_FILE_EXTENSION}`;
}

/** Fails unless a ruleset manifest declares the Capability API that reads ruleset files. */
export function assertRulesetFileCapability(manifest) {
  const api = manifest.capabilityApi;
  if (manifest.schemaVersion !== 2 || !api || api.major !== 1 || api.minor < RULESET_FILE_CAPABILITY_MINOR) {
    throw new Error(
      `${manifest.id} ships as a ruleset file, which needs Capability API 1.${RULESET_FILE_CAPABILITY_MINOR} or newer`,
    );
  }
}
