// Contract checks for the `ruleset` package kind.
//
// A ruleset package is the one package shape in this catalog that ships no Agent
// and no code: its entire payload is validated data assets, `ruleset.json` plus
// any `catalogs/<id>.json` it declares, that the Engine reads by reserved
// filename. Every other package here is agent-shaped, so the agent-definition
// assertions in validate-catalog.mjs cannot apply to it and these checks stand in
// their place.
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

// Capability API 1.21 added catalogs: ready-made entries a picker copies into a
// sheet's lists. A catalog that ships as its own asset needs a host that knows
// the reserved `catalogs/<id>.json` family, so declaring one against 1.20 would
// again advertise an install that cannot work.
export const RULESET_CATALOG_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 21 });

// The Engine refuses a catalog asset on its declared size before reading it, and
// refuses a catalog holding more entries than this. Both are mirrored here so a
// package that would be rejected on install never reaches the catalog.
export const RULESET_CATALOG_MAX_BYTES = 1024 * 1024;
export const RULESET_CATALOG_MAX_ENTRIES = 2000;
const RULESET_CATALOGS_MAX = 12;

// `catalogs/<id>.json` is a reserved asset family: the file name is the
// catalog's own id, so the Engine finds the file from the ruleset alone and no
// catalog can name another one's file.
const RULESET_CATALOG_ASSET_PATTERN = /^catalogs\/[a-z][a-z0-9_]{0,39}\.json$/u;
const RULESET_CATALOG_ID_PATTERN = /^[a-z][a-z0-9_]{0,39}$/u;
const RULESET_CATALOG_ENTRY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function isRulesetPackage(manifest) {
  return Array.isArray(manifest?.kind) && manifest.kind.includes("ruleset");
}

/** Whether a declared package asset path belongs to the catalog family. */
export function isRulesetCatalogAssetPath(path) {
  return typeof path === "string" && RULESET_CATALOG_ASSET_PATTERN.test(path);
}

/** The catalog asset paths a manifest declares, in declaration order. */
export function rulesetCatalogAssetPaths(manifest) {
  const paths = manifest?.contributions?.assets?.paths;
  return Array.isArray(paths) ? paths.filter(isRulesetCatalogAssetPath) : [];
}

function meetsCapabilityApi(manifest, { major, minor }) {
  const declared = manifest?.capabilityApi;
  if (!Number.isInteger(declared?.major) || !Number.isInteger(declared?.minor)) return false;
  return declared.major > major || (declared.major === major && declared.minor >= minor);
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
  const catalogPaths = rulesetCatalogAssetPaths(manifest);
  // A catalog only means anything to the ruleset that declares it, so the
  // binding is the same one the reserved ruleset asset has: the family and the
  // kind go together in both directions.
  if (catalogPaths.length > 0 && !declaresRulesetKind) {
    throw new Error(`${id} declares the reserved ${catalogPaths[0]} asset but is not kind "ruleset"`);
  }

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
  const declaredFiles = Array.isArray(manifest.files) ? manifest.files : [];
  if (!declaredFiles.some((file) => file?.path === RULESET_ASSET_PATH)) {
    throw new Error(`${id} must declare ${RULESET_ASSET_PATH} in manifest.files with its sha256 and byte size`);
  }
  for (const catalogPath of catalogPaths) {
    if (!declaredFiles.some((file) => file?.path === catalogPath)) {
      throw new Error(`${id} must declare ${catalogPath} in manifest.files with its sha256 and byte size`);
    }
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
  if (!meetsCapabilityApi(manifest, RULESET_MIN_CAPABILITY_API)) {
    throw new Error(`${id} is kind "ruleset" and must declare capability API ${major}.${minor} or newer`);
  }
  const catalogApi = RULESET_CATALOG_MIN_CAPABILITY_API;
  if (catalogPaths.length > 0 && !meetsCapabilityApi(manifest, catalogApi)) {
    throw new Error(
      `${id} ships a catalog asset and must declare capability API ${catalogApi.major}.${catalogApi.minor} or newer`,
    );
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

/** Every entry of one catalog, wherever it ships from.
 *
 *  The same rows are checked whether they sit inline in `ruleset.json` or in a
 *  `catalogs/<id>.json` asset, because the Engine runs one check over both: a
 *  catalog may never write a row the sheet could not hold. This stays at the
 *  shape the catalog itself owns (ids, the lists it feeds, the columns it
 *  names) rather than restating the Engine's schema — see the scope note at the
 *  top of this file. */
function assertCatalogEntries(entries, catalog, lists, where) {
  if (!Array.isArray(entries)) throw new Error(`${where} entries must be an array`);
  if (entries.length > RULESET_CATALOG_MAX_ENTRIES) {
    throw new Error(`${where} holds ${entries.length} entries, over the ${RULESET_CATALOG_MAX_ENTRIES} limit`);
  }
  const feeds = new Set(catalog.feeds);
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${where} has a non-object entry`);
    if (typeof entry.id !== "string" || !RULESET_CATALOG_ENTRY_ID_PATTERN.test(entry.id) || entry.id.length > 80) {
      throw new Error(`${where} entry id ${JSON.stringify(entry.id)} is not lowercase letters, digits and hyphens`);
    }
    if (seen.has(entry.id)) throw new Error(`${where} repeats the entry id "${entry.id}"`);
    seen.add(entry.id);
    if (typeof entry.label !== "string" || entry.label.trim().length === 0) {
      throw new Error(`${where} entry "${entry.id}" must carry a non-empty label`);
    }
    if (!Array.isArray(entry.rows) || entry.rows.length === 0) {
      throw new Error(`${where} entry "${entry.id}" must write at least one row`);
    }
    for (const row of entry.rows) {
      if (!feeds.has(row?.list)) {
        throw new Error(`${where} entry "${entry.id}" writes into "${row?.list}", which is not one of its feeds`);
      }
      const columns = lists.get(row.list);
      if (!columns) throw new Error(`${where} entry "${entry.id}" writes into unknown list "${row.list}"`);
      for (const column of Object.keys(row.values ?? {})) {
        if (!columns.has(column)) {
          throw new Error(`${where} entry "${entry.id}" sets "${column}", which list "${row.list}" has no column for`);
        }
      }
    }
  }
  return entries.length;
}

/** Assert a ruleset package's catalogs, and report one summary per catalog.
 *
 *  `catalogSources` maps each declared `catalogs/<id>.json` path to its raw
 *  committed bytes, so this stays a pure function the regression test can drive
 *  with fixtures instead of a tree on disk. */
export function assertRulesetCatalogs(manifest, document, catalogSources = new Map()) {
  const id = manifest?.id ?? "package";
  const declaredPaths = rulesetCatalogAssetPaths(manifest);
  const catalogs = document?.catalogs;
  if (catalogs === undefined) {
    if (declaredPaths.length > 0) {
      throw new Error(`${id} declares ${declaredPaths[0]} but its ${RULESET_ASSET_PATH} has no catalogs`);
    }
    return [];
  }
  // A catalogs key means the host has to understand catalogs at all, inline or
  // not: an older Engine's strict schema refuses the whole ruleset file.
  const catalogApi = RULESET_CATALOG_MIN_CAPABILITY_API;
  if (!meetsCapabilityApi(manifest, catalogApi)) {
    throw new Error(
      `${id} ships catalogs and must declare capability API ${catalogApi.major}.${catalogApi.minor} or newer`,
    );
  }
  if (!Array.isArray(catalogs) || catalogs.length === 0) throw new Error(`${id} catalogs must be a non-empty array`);
  if (catalogs.length > RULESET_CATALOGS_MAX) {
    throw new Error(`${id} ships ${catalogs.length} catalogs, over the ${RULESET_CATALOGS_MAX} limit`);
  }

  const lists = new Map(
    (document.sheet?.lists ?? []).map((list) => [list.id, new Set((list.columns ?? []).map((column) => column.id))]),
  );
  const seen = new Set();
  const namedPaths = new Set();
  const summaries = [];
  for (const catalog of catalogs) {
    if (typeof catalog?.id !== "string" || !RULESET_CATALOG_ID_PATTERN.test(catalog.id)) {
      throw new Error(`${id} has a catalog whose id ${JSON.stringify(catalog?.id)} is not a usable sheet id`);
    }
    if (seen.has(catalog.id)) throw new Error(`${id} repeats the catalog id "${catalog.id}"`);
    seen.add(catalog.id);
    if (!Array.isArray(catalog.feeds) || catalog.feeds.length === 0) {
      throw new Error(`${id} catalog "${catalog.id}" must feed at least one list`);
    }
    for (const listId of catalog.feeds) {
      if (!lists.has(listId)) throw new Error(`${id} catalog "${catalog.id}" feeds unknown list "${listId}"`);
    }
    const hasEntries = catalog.entries !== undefined;
    const hasAsset = catalog.asset !== undefined;
    if (hasEntries === hasAsset) {
      throw new Error(`${id} catalog "${catalog.id}" must have exactly one of "entries" or "asset"`);
    }
    if (!hasAsset) {
      summaries.push({
        id: catalog.id,
        entryCount: assertCatalogEntries(catalog.entries, catalog, lists, `${id} catalog "${catalog.id}"`),
        bytes: null,
      });
      continue;
    }

    const expected = `catalogs/${catalog.id}.json`;
    if (catalog.asset !== expected) {
      throw new Error(`${id} catalog "${catalog.id}" must name "${expected}", not ${JSON.stringify(catalog.asset)}`);
    }
    if (!declaredPaths.includes(expected)) {
      throw new Error(`${id} catalog "${catalog.id}" is not declared in contributions.assets.paths`);
    }
    namedPaths.add(expected);
    const raw = catalogSources.get(expected);
    if (typeof raw !== "string") throw new Error(`${id} is missing the ${expected} payload`);
    const bytes = Buffer.byteLength(raw);
    if (bytes > RULESET_CATALOG_MAX_BYTES) {
      throw new Error(`${id} ${expected} is ${bytes} bytes, over the ${RULESET_CATALOG_MAX_BYTES}-byte limit`);
    }
    let file;
    try {
      file = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${id} ${expected} is not valid JSON`, { cause: error });
    }
    if (!file || typeof file !== "object" || Array.isArray(file))
      throw new Error(`${id} ${expected} must be an object`);
    if (file.schemaVersion !== 1) throw new Error(`${id} ${expected} must carry schemaVersion 1`);
    if (file.catalog !== catalog.id) {
      throw new Error(`${id} ${expected} names catalog ${JSON.stringify(file.catalog)}, not "${catalog.id}"`);
    }
    summaries.push({
      id: catalog.id,
      entryCount: assertCatalogEntries(file.entries, catalog, lists, `${id} ${expected}`),
      bytes,
    });
  }
  // An asset nothing names would ship and be hashed but never be read, so it is
  // an orphan the package should not be publishing.
  for (const path of declaredPaths) {
    if (!namedPaths.has(path))
      throw new Error(`${id} declares ${path} but no catalog in ${RULESET_ASSET_PATH} names it`);
  }
  return summaries;
}
