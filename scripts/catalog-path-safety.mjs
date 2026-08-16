import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const WINDOWS_RESERVED_COMPONENT =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

function isUnsafePortableSegment(segment) {
  return (
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.includes(":") ||
    /[. ]$/u.test(segment) ||
    WINDOWS_RESERVED_COMPONENT.test(segment)
  );
}

export function assertPortableRelativePath(value, label = "Path") {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (value.includes("\0")) throw new Error(`${label} must not contain NUL bytes`);
  if (value.includes("\\")) throw new Error(`${label} must use portable forward slashes`);
  if (isAbsolute(value) || /^[A-Za-z]:/u.test(value)) {
    throw new Error(`${label} must be relative`);
  }
  if (value.startsWith("-")) throw new Error(`${label} must not look like a command-line option`);

  const segments = value.split("/");
  if (segments.some(isUnsafePortableSegment)) {
    throw new Error(`${label} must not contain non-portable path segments`);
  }
  return value;
}

export function resolvePortableRelativePath(root, value, label = "Path") {
  const safePath = assertPortableRelativePath(value, label);
  const normalizedRoot = resolve(root);
  const candidate = resolve(normalizedRoot, ...safePath.split("/"));
  const relativeCandidate = relative(normalizedRoot, candidate);
  if (
    relativeCandidate.length === 0 ||
    relativeCandidate === ".." ||
    relativeCandidate.startsWith(`..${sep}`) ||
    isAbsolute(relativeCandidate)
  ) {
    throw new Error(`${label} must stay within its package directory`);
  }
  return candidate;
}

function assertCanonicalContainment(canonicalRoot, canonicalCandidate, label) {
  const relativeCandidate = relative(canonicalRoot, canonicalCandidate);
  if (
    relativeCandidate.length === 0 ||
    relativeCandidate === ".." ||
    relativeCandidate.startsWith(`..${sep}`) ||
    isAbsolute(relativeCandidate)
  ) {
    throw new Error(`${label} must stay within its root directory after resolving symlinks`);
  }
}

export async function resolveContainedPortablePath(
  root,
  value,
  label = "Path",
  { allowMissing = false } = {},
) {
  const candidate = resolvePortableRelativePath(root, value, label);
  const canonicalRoot = await realpath(root);
  try {
    assertCanonicalContainment(canonicalRoot, await realpath(candidate), label);
    return candidate;
  } catch (error) {
    if (!allowMissing || error?.code !== "ENOENT") throw error;
  }

  let ancestor = candidate;
  while (ancestor !== dirname(ancestor)) {
    try {
      const canonicalAncestor = await realpath(ancestor);
      const canonicalCandidate = resolve(canonicalAncestor, relative(ancestor, candidate));
      assertCanonicalContainment(canonicalRoot, canonicalCandidate, label);
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    try {
      if ((await lstat(ancestor)).isSymbolicLink()) {
        throw new Error(`${label} must not pass through a dangling symlink`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    ancestor = dirname(ancestor);
  }
  throw new Error(`${label} has no existing parent directory`);
}

export function assertPortableFilenameComponent(value, label = "Filename component") {
  assertPortableRelativePath(value, label);
  if (
    value.includes("/") ||
    !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(value) ||
    value.endsWith(".")
  ) {
    throw new Error(`${label} must be a portable filename component`);
  }
  return value;
}

export function packageArtifactName(packageId, version) {
  const safeId = assertPortableFilenameComponent(packageId, "Package id");
  const safeVersion = assertPortableFilenameComponent(version, `Package ${safeId} version`);
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(safeVersion)) {
    throw new Error(`Package ${safeId} version must be a semantic version`);
  }
  return `${safeId}-${safeVersion}.zip`;
}
