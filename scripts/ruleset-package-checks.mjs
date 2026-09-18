// Contract checks for the `ruleset` package kind.
//
// A ruleset package is the one package shape in this catalog that ships no Agent
// and no code: its entire payload is a validated data asset, `ruleset.json`, that
// the Engine reads by reserved filename. Every other package here is agent-shaped,
// so the agent-definition assertions in validate-catalog.mjs cannot apply to it and
// these checks stand in their place.
//
// Scope note: the Engine owns the `ruleset.json` schema and validates it on install.
// Re-implementing that schema here would give this repository a second copy of a
// contract it does not own, which would drift silently the first time the Engine
// adds a field. These checks cover only what the catalog itself needs to publish the
// asset honestly: that it parses, and that it carries the identity the Engine keys on.
//
// The functions are pure so they can be exercised directly by
// scripts/tests/ruleset-package.regression.mjs; validate-catalog.mjs does the file
// reading and calls them.

export const RULESET_ASSET_PATH = "ruleset.json";

// Capability API 1.20 is the Engine release that introduced the ruleset seam. An
// older host has no way to read the asset, so a lower declaration would advertise
// an install that cannot work.
export const RULESET_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 20 });

export function isRulesetPackage(manifest) {
  return Array.isArray(manifest?.kind) && manifest.kind.includes("ruleset");
}

/** Assert the ruleset contract for one manifest, and report whether it is one.
 *
 *  Runs over EVERY catalogued package, not just ruleset ones, because the binding
 *  is an if-and-only-if: a package declaring the reserved asset must be kind
 *  `ruleset`, or the Engine would read rules out of something that never claimed
 *  to be a ruleset. Returns true for a ruleset package so the caller can skip the
 *  agent-definition block that does not apply to it. */
export function assertRulesetPackageContract(manifest) {
  const id = manifest?.id ?? "package";
  const assetPaths = manifest?.contributions?.assets?.paths;
  const listsRulesetAsset = Array.isArray(assetPaths) && assetPaths.includes(RULESET_ASSET_PATH);
  const declaresRulesetKind = isRulesetPackage(manifest);

  // Kinds compose elsewhere in this catalog (agent plus maps, agent plus turn-game). Not here: a
  // ruleset package takes the data-only branch of the validator and skips the Agent contract, so a
  // mixed kind would publish an Agent nobody checked. The rule is this catalog's, not the Engine's;
  // relax it by running BOTH contracts if a ruleset ever needs to ship an Agent alongside.
  if (declaresRulesetKind && manifest.kind.length !== 1) {
    throw new Error(`${id} must declare "ruleset" as its only kind, because a ruleset package ships only data`);
  }
  if (listsRulesetAsset && !declaresRulesetKind) {
    throw new Error(`${id} declares the reserved ${RULESET_ASSET_PATH} asset but is not kind "ruleset"`);
  }
  if (!declaresRulesetKind) return false;
  if (!listsRulesetAsset) {
    throw new Error(`${id} is kind "ruleset" but does not list ${RULESET_ASSET_PATH} in contributions.assets.paths`);
  }
  if (!(Array.isArray(manifest.files) ? manifest.files : []).some((file) => file?.path === RULESET_ASSET_PATH)) {
    throw new Error(`${id} must declare ${RULESET_ASSET_PATH} in manifest.files with its sha256 and byte size`);
  }
  for (const name of ["server", "client", "agents", "knowledge"]) {
    if (manifest.entrypoints?.[name]) {
      throw new Error(`${id} is kind "ruleset" and ships only data, so it must not declare the ${name} entrypoint`);
    }
  }
  if (!Array.isArray(manifest.permissions) || manifest.permissions.length > 0) {
    throw new Error(`${id} is kind "ruleset" and ships only data, so it must declare no permissions`);
  }
  if (manifest.restartRequired !== false) {
    throw new Error(`${id} is kind "ruleset" and ships only data, so restartRequired must be false`);
  }
  if (manifest.schemaVersion !== 2) {
    throw new Error(`${id} is kind "ruleset" and must use capability package manifest v2`);
  }
  const { major, minor } = RULESET_MIN_CAPABILITY_API;
  const declared = manifest.capabilityApi;
  if (
    !Number.isInteger(declared?.major) ||
    !Number.isInteger(declared?.minor) ||
    declared.major < major ||
    (declared.major === major && declared.minor < minor)
  ) {
    throw new Error(`${id} is kind "ruleset" and must declare capability API ${major}.${minor} or newer`);
  }
  return true;
}

/** Parse and sanity-check a package's ruleset.json payload.
 *
 *  Deliberately shallow: see the scope note above. Returns the parsed document. */
export function assertRulesetAssetDocument(raw, packageId) {
  let document;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${packageId} ${RULESET_ASSET_PATH} is not valid JSON`, { cause: error });
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`${packageId} ${RULESET_ASSET_PATH} must be a JSON object`);
  }
  if (typeof document.id !== "string" || document.id.trim().length === 0) {
    throw new Error(`${packageId} ${RULESET_ASSET_PATH} must carry a non-empty string id`);
  }
  if (!Number.isInteger(document.version) || document.version < 1) {
    throw new Error(`${packageId} ${RULESET_ASSET_PATH} must carry an integer version of 1 or more`);
  }
  if (typeof document.name !== "string" || document.name.trim().length === 0) {
    throw new Error(`${packageId} ${RULESET_ASSET_PATH} must carry a non-empty string name`);
  }
  return document;
}
