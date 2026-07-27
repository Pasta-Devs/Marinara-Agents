import { existsSync, realpathSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function isWithin(root, path) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

async function listSourceFiles(root) {
  const files = [];
  const realRoot = realpathSync(root);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    let realPath;
    try { realPath = realpathSync(path); } catch { continue; }
    if (!isWithin(realRoot, realPath)) continue;
    if (entry.isDirectory()) files.push(...(await listSourceFiles(realPath)));
    else if (sourceExtensions.includes(extname(entry.name))) files.push(realPath);
  }
  return files;
}

function packageOwnedTargetExists(importer, specifier, sourceRoot) {
  const unresolved = resolve(dirname(importer), specifier);
  if (!isWithin(sourceRoot, unresolved)) return false;

  const candidates = new Set([unresolved]);
  const extension = extname(unresolved);
  if (extension) {
    const withoutExtension = unresolved.slice(0, -extension.length);
    for (const candidateExtension of sourceExtensions) candidates.add(`${withoutExtension}${candidateExtension}`);
  } else {
    for (const candidateExtension of sourceExtensions) {
      candidates.add(`${unresolved}${candidateExtension}`);
      candidates.add(resolve(unresolved, `index${candidateExtension}`));
    }
  }
  return [...candidates].some((candidate) => {
    if (!existsSync(candidate)) return false;
    try {
      return isWithin(realpathSync(sourceRoot), realpathSync(candidate));
    } catch {
      return false;
    }
  });
}

function importSpecifiers(source) {
  const specifiers = new Set();
  const staticImport = /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s*)?["']([^"']+)["']/gsu;
  const dynamicImport = /\bimport\s*\(\s*(?:["']([^"']+)["']|`((?:(?!\$\{)[^`])+)`)\s*\)/gu;
  const commonJs = /\brequire\s*\(\s*(?:["']([^"']+)["']|`((?:(?!\$\{)[^`])+)`)\s*\)/gu;
  const importAssignment = /\bimport\s+[^=;]+\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/gu;
  for (const pattern of [staticImport, dynamicImport, commonJs, importAssignment]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1] ?? match[2]);
  }
  return [...specifiers];
}

export async function findPackagePrivateEngineImports(sourceRoot) {
  const imports = [];
  for (const file of await listSourceFiles(sourceRoot)) {
    const source = await readFile(file, "utf8");
    for (const specifier of importSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      if (packageOwnedTargetExists(file, specifier, sourceRoot)) continue;
      imports.push({
        source: relative(sourceRoot, file).split(sep).join("/"),
        specifier,
      });
    }
  }
  return imports.sort((left, right) =>
    `${left.source}\0${left.specifier}`.localeCompare(`${right.source}\0${right.specifier}`),
  );
}

export async function readPackageEngineBoundary({ boundaryPath, displayName, capabilityApi }) {
  if (!capabilityApi) throw new Error(`${displayName} must declare its capability API`);
  const boundary = JSON.parse(await readFile(boundaryPath, "utf8"));
  if (boundary.schemaVersion !== 1) throw new Error(`Unsupported ${displayName} boundary schema`);
  if (
    boundary.capabilityApi?.major !== capabilityApi.major ||
    boundary.capabilityApi?.minor !== capabilityApi.minor
  ) {
    throw new Error(`${displayName} must target capability API ${capabilityApi.major}.${capabilityApi.minor}`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(boundary.builtAgainst?.engineVersion ?? "")) {
    throw new Error(`${displayName} boundary is missing a valid Engine version`);
  }
  if (!/^[a-f0-9]{40}$/u.test(boundary.builtAgainst?.engineCommit ?? "")) {
    throw new Error(`${displayName} boundary is missing a full Engine commit`);
  }
  if (!Array.isArray(boundary.privateEngineImports)) {
    throw new Error(`${displayName} boundary is missing its private Engine import inventory`);
  }
  return boundary;
}

export async function assertPackagePrivateImportBoundary({
  sourceRoot,
  boundaryPath,
  displayName,
  capabilityApi,
}) {
  const [boundary, actual] = await Promise.all([
    readPackageEngineBoundary({ boundaryPath, displayName, capabilityApi }),
    findPackagePrivateEngineImports(sourceRoot),
  ]);
  const expected = boundary.privateEngineImports;
  const key = (entry) => `${entry.source}\0${entry.specifier}`;
  const actualKeys = new Set(actual.map(key));
  const expectedKeys = new Set(expected.map(key));
  const added = actual.filter((entry) => !expectedKeys.has(key(entry)));
  const removed = expected.filter((entry) => !actualKeys.has(key(entry)));
  if (added.length === 0 && removed.length === 0) return boundary;
  const detail = [
    ...added.map((entry) => `added ${entry.source}: ${entry.specifier}`),
    ...removed.map((entry) => `removed ${entry.source}: ${entry.specifier}`),
  ].join("\n");
  throw new Error(
    `${displayName} private Engine import inventory is invalid. New imports are forbidden; removals must update engine-boundary.json.\nInventory diff:\n${detail}`,
  );
}
