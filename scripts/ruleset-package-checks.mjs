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
// asset honestly: that it parses, that it carries the identity the Engine keys on, and
// that the ids a catalog or a `battle` block points at exist on the sheet beside them.
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

// Capability API 1.22 added the `battle` block: the sheet pools and lists a fight
// may read, and write back to. It lives inside `ruleset.json` like `catalogs`, so
// the manifest cannot show it and the gate is read from the document instead.
export const RULESET_BATTLE_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 22 });

// Capability API 1.23 added `scaled`: the columns of a picked row whose number the
// RULESET keeps up to date rather than the player. It is a new key in a strict
// file, inline in `ruleset.json` or inside a `catalogs/<id>.json` asset, so an
// older Engine refuses whichever file holds it.
export const RULESET_SCALED_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 23 });

// How many columns of one row a ruleset may keep, and how long a step table may be.
const RULESET_SCALED_MAX_COLUMNS = 4;
const RULESET_STEP_TABLE_MAX = 100;

// A value reference names exactly one of these. The same closed set the Engine has.
const VALUE_REF_KEYS = Object.freeze([
  "const",
  "field",
  "derived",
  "abilityScore",
  "abilityMod",
  "abilityModFromField",
  "skillMod",
  "saveMod",
]);

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

/** Declared paths inside the reserved `catalogs/` family that do not have its shape. They would
 *  otherwise be hashed and zipped like any asset while slipping past every catalog check. */
export function malformedRulesetCatalogAssetPaths(manifest) {
  const paths = manifest?.contributions?.assets?.paths;
  if (!Array.isArray(paths)) return [];
  return paths.filter(
    (path) => typeof path === "string" && path.startsWith("catalogs/") && !isRulesetCatalogAssetPath(path),
  );
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
  const malformedCatalogPaths = malformedRulesetCatalogAssetPaths(manifest);
  if (malformedCatalogPaths.length > 0) {
    throw new Error(`${id} declares ${malformedCatalogPaths[0]}, which is not a "catalogs/<id>.json" asset`);
  }
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

/** One catalog's entries, wherever it ships them from, or null when there are none to read.
 *
 *  A missing or unparseable asset is assertRulesetCatalogs' story to tell, and it tells it with a
 *  better message, so this reads only what is actually there. Both checks run together everywhere
 *  a ruleset is built or validated. */
function catalogEntryList(catalog, catalogSources) {
  if (Array.isArray(catalog?.entries)) return catalog.entries;
  const raw = typeof catalog?.asset === "string" ? catalogSources.get(catalog.asset) : undefined;
  if (typeof raw !== "string") return null;
  try {
    const file = JSON.parse(raw);
    return Array.isArray(file?.entries) ? file.entries : null;
  } catch {
    return null;
  }
}

/** Why this value reference cannot be resolved against the sheet beside it, or null when it can.
 *  A reference to a field that is not there, or to a text field where a number is needed, reads as
 *  nothing and would quietly leave the column at whatever the row was picked with. */
function valueRefIssue(ref, names) {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return "must be a value reference";
  const unknown = Object.keys(ref).find((key) => !VALUE_REF_KEYS.includes(key));
  if (unknown !== undefined) return `has the unknown key ${JSON.stringify(unknown)}`;
  const present = VALUE_REF_KEYS.filter((key) => ref[key] !== undefined);
  if (present.length !== 1) return `names exactly one of: ${VALUE_REF_KEYS.join(", ")}`;
  const key = present[0];
  const value = ref[key];
  if (key === "const") {
    return typeof value === "number" && Number.isFinite(value) ? null : "const must be a finite number";
  }
  if (key === "field" || key === "abilityModFromField") {
    const field = names.fields.get(value);
    if (!field) return `names unknown field ${JSON.stringify(value)}`;
    // `abilityModFromField` reads an enum field whose VALUE is an ability id, which is how a caster
    // points at their own spellcasting ability; every other reference wants a plain number.
    const wanted = key === "field" ? "number" : "enum";
    return field.type === wanted ? null : `field "${value}" is not ${wanted === "enum" ? "an enum" : "a number"}`;
  }
  const declared = {
    derived: [names.derived, "derived value"],
    abilityScore: [names.abilities, "ability"],
    abilityMod: [names.abilities, "ability"],
    skillMod: [names.skills, "skill"],
    saveMod: [names.saves, "save"],
  }[key];
  return declared[0].has(value) ? null : `names unknown ${declared[1]} ${JSON.stringify(value)}`;
}

/** Why this step table is not one, or null when it is. Thresholds ascend, because the lookup walks
 *  them in order and takes the last one at or below the input. */
function stepTableIssue(table) {
  if (!Array.isArray(table) || table.length === 0) return "table must be a non-empty array";
  if (table.length > RULESET_STEP_TABLE_MAX) return `table holds ${table.length} steps, over ${RULESET_STEP_TABLE_MAX}`;
  let previous = null;
  for (const step of table) {
    if (!Array.isArray(step) || step.length !== 2 || !step.every((entry) => Number.isFinite(entry))) {
      return "each table step is a [threshold, value] pair of numbers";
    }
    if (previous !== null && step[0] <= previous) return "table thresholds must ascend";
    previous = step[0];
  }
  return null;
}

/** Assert the `scaled` columns of every catalog entry, and report how many rows carry one.
 *
 *  These are the Engine's own rules restated at the narrow shape the key has, for the same reason
 *  the battle block's are: a scaled column is a reference into the sheet beside it, so one that
 *  names a column the list does not have, or a field the sheet does not declare, publishes fine
 *  and then leaves a maximum the ruleset promised to keep sitting at whatever it was picked with.
 *
 *  `catalogSources` maps each `catalogs/<id>.json` path to its raw bytes, exactly as
 *  assertRulesetCatalogs takes them, so this stays a pure function a test can drive. */
export function assertRulesetScaled(manifest, document, catalogSources = new Map()) {
  const id = manifest?.id ?? "package";
  const catalogs = Array.isArray(document?.catalogs) ? document.catalogs : [];
  const sheet = document?.sheet ?? {};
  const listColumns = new Map(
    (sheet.lists ?? []).map((list) => [list.id, new Map((list.columns ?? []).map((column) => [column.id, column]))]),
  );
  const ids = (items) => new Set((items ?? []).map((item) => item?.id));
  const names = {
    fields: new Map((sheet.fields ?? []).map((field) => [field.id, field])),
    derived: ids(sheet.derived),
    abilities: ids(sheet.abilities),
    skills: ids(sheet.skills),
    saves: ids(sheet.saves),
  };

  let scaledRows = 0;
  for (const catalog of catalogs) {
    for (const entry of catalogEntryList(catalog, catalogSources) ?? []) {
      const rows = Array.isArray(entry?.rows) ? entry.rows : [];
      // A kept row has to be the entry's only one for its list, or a marked row on a sheet could
      // not be matched back to the spec it came from without guessing which of two it was.
      const perList = new Map();
      for (const row of rows) perList.set(row?.list, (perList.get(row?.list) ?? 0) + 1);
      for (const row of rows) {
        if (row?.scaled === undefined) continue;
        const where = `${id} catalog "${catalog?.id}" entry "${entry?.id}"`;
        scaledRows += 1;
        const api = RULESET_SCALED_MIN_CAPABILITY_API;
        if (!meetsCapabilityApi(manifest, api)) {
          throw new Error(`${id} ships scaled catalog rows and must declare capability API ${api.major}.${api.minor}`);
        }
        if (!row.scaled || typeof row.scaled !== "object" || Array.isArray(row.scaled)) {
          throw new Error(`${where} has a scaled that is not an object`);
        }
        if (perList.get(row.list) > 1) {
          throw new Error(`${where} scales a row that is not its only one for the list "${row.list}"`);
        }
        const columnIds = Object.keys(row.scaled);
        if (columnIds.length === 0 || columnIds.length > RULESET_SCALED_MAX_COLUMNS) {
          throw new Error(`${where} scales ${columnIds.length} columns, not 1 to ${RULESET_SCALED_MAX_COLUMNS}`);
        }
        const columns = listColumns.get(row.list);
        if (!columns) throw new Error(`${where} scales a row of unknown list "${row.list}"`);
        for (const columnId of columnIds) {
          if (columns.get(columnId)?.type !== "number") {
            throw new Error(`${where} scales "${columnId}", which is not a number column of "${row.list}"`);
          }
          // `values` still holds what the row starts as, because an entry is picked before anything
          // knows which sheet it lands on: without it the cell would sit empty until a first edit.
          if (typeof row.values?.[columnId] !== "number") {
            throw new Error(`${where} scales "${columnId}" but its values hold no starting number for it`);
          }
          const spec = row.scaled[columnId];
          if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
            throw new Error(`${where} scaled "${columnId}" must be an object`);
          }
          const extra = Object.keys(spec).find((key) => key !== "from" && key !== "table");
          if (extra !== undefined) {
            throw new Error(`${where} scaled "${columnId}" has the unknown key ${JSON.stringify(extra)}`);
          }
          const refIssue = valueRefIssue(spec.from, names);
          if (refIssue) throw new Error(`${where} scaled "${columnId}" from ${refIssue}`);
          const tableIssue = spec.table === undefined ? null : stepTableIssue(spec.table);
          if (tableIssue) throw new Error(`${where} scaled "${columnId}" ${tableIssue}`);
        }
      }
    }
  }
  return scaledRows;
}

/** Why `equals` is not a value this list column could hold, or null when it is. A comparison that
 *  can never match is a typo, and the row it was meant to let through would simply never appear. */
function columnEqualsIssue(column, equals) {
  if (column.type === "enum") {
    return typeof equals === "string" && (column.values ?? []).includes(equals)
      ? null
      : `${JSON.stringify(equals)} is not one of the values of "${column.id}"`;
  }
  if (column.type === "number") {
    return typeof equals === "number" ? null : `"${column.id}" is a number column, so equals must be a number`;
  }
  if (column.type === "boolean") {
    return typeof equals === "boolean" ? null : `"${column.id}" is a boolean column, so equals must be true or false`;
  }
  return typeof equals === "string" ? null : `"${column.id}" is a text column, so equals must be a string`;
}

/** Assert a ruleset package's `battle` block, and report whether it has one.
 *
 *  This one does look into the sheet, unlike the checks above, because a battle block is nothing but
 *  references into it: a pool id that is not a live pool, or a column that cannot hold the value
 *  compared against it, would publish fine and then lend a fight nothing. The Engine makes the same
 *  checks when it parses the file, so these are its rules restated at the narrow shape the block
 *  has, not a second copy of the ruleset schema. */
export function assertRulesetBattle(manifest, document) {
  const id = manifest?.id ?? "package";
  const battle = document?.battle;
  if (battle === undefined) return false;
  if (!battle || typeof battle !== "object" || Array.isArray(battle)) {
    throw new Error(`${id} battle must be an object`);
  }
  // A battle key means the host has to understand battles at all: an older Engine's strict schema
  // refuses the whole ruleset file, exactly as it does for catalogs under 1.21.
  const api = RULESET_BATTLE_MIN_CAPABILITY_API;
  if (!meetsCapabilityApi(manifest, api)) {
    throw new Error(`${id} ships a battle block and must declare capability API ${api.major}.${api.minor} or newer`);
  }

  const pools = new Map((document.sheet?.live?.pools ?? []).map((pool) => [pool.id, pool]));
  const lists = new Map((document.sheet?.lists ?? []).map((list) => [list.id, list]));
  // A list whose rows are pools is keyed by a row's name, so it comes and goes as the player edits
  // the sheet. A battle names declared live pools only.
  const livePool = (pool, where) => {
    if (pools.has(pool)) return;
    throw new Error(
      lists.get(pool)?.pools
        ? `${id} battle ${where} "${pool}" is a list whose rows are pools, not a live pool`
        : `${id} battle ${where} names unknown live pool ${JSON.stringify(pool)}`,
    );
  };

  if (!battle.health || typeof battle.health.pool !== "string") {
    throw new Error(`${id} battle must name a health pool`);
  }
  livePool(battle.health.pool, "health");
  // A pool that starts empty counts up (stress, corruption), so as health it would put every fresh
  // character into their first fight already down.
  if (pools.get(battle.health.pool).start === "empty") {
    throw new Error(`${id} battle health pool "${battle.health.pool}" starts empty, so it cannot be hit points`);
  }
  if (battle.energy !== undefined) {
    livePool(battle.energy?.pool, "energy");
    // The Engine drains hit points as damage and spends energy as a cost, and one pool cannot be both.
    if (battle.energy.pool === battle.health.pool) {
      throw new Error(`${id} battle energy pool "${battle.energy.pool}" cannot also be the health pool`);
    }
  }

  const slots = battle.slots ?? [];
  if (!Array.isArray(slots)) throw new Error(`${id} battle slots must be an array`);
  const slotPools = new Set();
  const slotLevels = new Set();
  for (const slot of slots) {
    livePool(slot?.pool, "slot pool");
    if (slot.pool === battle.health.pool || slot.pool === battle.energy?.pool) {
      throw new Error(`${id} battle slot pool "${slot.pool}" is already the health or energy pool`);
    }
    if (slotPools.has(slot.pool)) throw new Error(`${id} battle repeats the slot pool "${slot.pool}"`);
    slotPools.add(slot.pool);
    if (!Number.isInteger(slot.level) || slot.level < 1 || slot.level > 9) {
      throw new Error(`${id} battle slot pool "${slot.pool}" has level ${JSON.stringify(slot.level)}, not 1 to 9`);
    }
    if (slotLevels.has(slot.level)) throw new Error(`${id} battle repeats the slot level ${slot.level}`);
    slotLevels.add(slot.level);
  }

  const skills = battle.skills ?? [];
  if (!Array.isArray(skills)) throw new Error(`${id} battle skills must be an array`);
  for (const source of skills) {
    const list = lists.get(source?.list);
    if (!list) throw new Error(`${id} battle skills name unknown list ${JSON.stringify(source?.list)}`);
    const columns = new Map((list.columns ?? []).map((column) => [column.id, column]));
    if (source.onlyWhen !== undefined && columns.get(source.onlyWhen)?.type !== "boolean") {
      throw new Error(`${id} battle skills onlyWhen ${JSON.stringify(source.onlyWhen)} must name a boolean column`);
    }
    // alwaysWhen is the exception to onlyWhen. Alone it would gate nothing, which reads like a
    // filter and is not one.
    if (source.alwaysWhen !== undefined && source.onlyWhen === undefined) {
      throw new Error(`${id} battle skills alwaysWhen is the exception to onlyWhen, so it needs onlyWhen beside it`);
    }
    if (source.alwaysWhen !== undefined) {
      const column = columns.get(source.alwaysWhen?.column);
      if (!column) {
        throw new Error(
          `${id} battle skills alwaysWhen names unknown column ${JSON.stringify(source.alwaysWhen?.column)}`,
        );
      }
      const mismatch = columnEqualsIssue(column, source.alwaysWhen.equals);
      if (mismatch) throw new Error(`${id} battle skills alwaysWhen ${mismatch}`);
    }
  }
  return true;
}
