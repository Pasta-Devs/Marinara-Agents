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

// Capability API 1.26 added the `combat` block: how a fight is RESOLVED by the
// ruleset's own numbers, rather than what a fight may borrow from the sheet. It
// lives inside `ruleset.json` like `battle`, so the manifest cannot show it and
// the gate is read from the document instead.
export const RULESET_COMBAT_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 26 });

// Capability API 1.27 added bestiaries: a catalog that declares
// `"holds": "creatures"` and carries opponents instead of sheet rows. It can
// ride inline in `ruleset.json` or inside a `catalogs/<id>.json` asset, so an
// older Engine refuses whichever file holds it.
export const RULESET_CREATURES_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 27 });

// Capability API 1.28 gave a fight positions: `combat.distance` says what one cell
// of a board is worth, and `ranged`, `cover`, `opportunity` and an attack list's
// `reach` and `range` are all measured in it. A creature action's `range` may also
// be a `{ normal, long }` pair rather than a plain number. Those live in
// `ruleset.json` and in a `catalogs/<id>.json` asset, so an older Engine refuses
// whichever file holds one.
//
// A creature action carrying a plain `reach` or `range` is NOT gated here: those
// keys have been legal since 1.27, and a ruleset with no `distance` simply never
// reads them.
export const RULESET_POSITIONS_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 28 });

// What one TURN of a fight can do: an attack list that buys several strikes with
// one spend, a condition narrowed to certain saves or tied to the creature that
// caused it, an effect outside the list an older Engine knew, and the part of a
// standard action a flag alone does not carry. All of it lives in `ruleset.json`,
// so an Engine that does not know the keys refuses the whole strict file.
export const RULESET_TURN_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 29 });

// The condition effects an Engine before 1.29 knew. Written out rather than sliced
// off the list below, because the question this asks is what an OLDER Engine would
// refuse, which is fixed however long the current list grows.
const OLD_CONDITION_EFFECTS = Object.freeze([
  "own-attacks-advantage",
  "own-attacks-disadvantage",
  "attacks-against-advantage",
  "attacks-against-disadvantage",
  "attacks-against-adjacent-advantage",
  "attacks-against-far-disadvantage",
  "attacks-from-adjacent-critical",
  "cannot-act",
  "cannot-react",
  "speed-zero",
  "half-move-to-stand",
  "ends-on-damage",
]);

// An attack source may name a boolean column that holds ITS OWN row to a single
// strike however many the list buys, for a weapon that fires once a turn whatever
// its wielder's count. It lives in `ruleset.json`, so an older Engine refuses the
// whole file rather than ignoring the key.
export const RULESET_STRIKE_CAP_MIN_CAPABILITY_API = Object.freeze({ major: 1, minor: 32 });

// What the Engine's own schema allows a distance, in the ruleset's own unit.
const RULESET_DISTANCE_MAX = 10000;
const RULESET_DISTANCE_LABEL_MAX = 12;
const RULESET_COVER_MAX = 100;
const RULESET_RANGED_RULES = Object.freeze(["disadvantage", "normal"]);
// The shapes the Engine draws on a board, for a catalog entry and a creature action alike.
const RULESET_AREA_SHAPES = Object.freeze(["burst", "cone", "line"]);

// How many columns of one row a ruleset may keep, and how long a step table may be.
const RULESET_SCALED_MAX_COLUMNS = 4;
const RULESET_STEP_TABLE_MAX = 100;

// What the Engine's own schema allows one creature. Mirrored so a package that
// would be refused on install never reaches the catalog.
export const RULESET_CREATURE_MAX_ACTIONS = 12;
export const RULESET_CREATURE_MAX_TRAITS = 8;
const RULESET_CREATURE_MAX_APPLIES = 4;
const RULESET_CREATURE_MAX_SEQUENCE = 6;
const RULESET_COMBAT_MAX_BUDGETS = 8;
const RULESET_COMBAT_MAX_TIERS = 40;

// The closed effect list a condition maps onto, and the standard actions a
// ruleset may opt into. Both are the Engine's own vocabulary: a value outside
// them is refused rather than quietly ignored at import.
const RULESET_COMBAT_CONDITION_EFFECTS = Object.freeze([
  "own-attacks-advantage",
  "own-attacks-disadvantage",
  "attacks-against-advantage",
  "attacks-against-disadvantage",
  "attacks-against-adjacent-advantage",
  "attacks-against-far-disadvantage",
  "attacks-from-adjacent-critical",
  "cannot-act",
  "cannot-react",
  "speed-zero",
  "half-move-to-stand",
  "ends-on-damage",
  // Added by Capability API 1.29, with `saves` narrowing the two that are about saving throws.
  "own-saves-advantage",
  "own-saves-disadvantage",
  "resist-all",
  "cannot-target-source",
  "cannot-approach-source",
]);
const RULESET_COMBAT_STANDARD_ACTIONS = Object.freeze(["dash", "disengage", "dodge", "help", "hide", "ready"]);

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

// A sheet id, which is what a budget, a list, a save and a condition are all named by.
const RULESET_SHEET_ID_PATTERN = /^[a-z][a-z0-9_]*$/u;
const RULESET_SHEET_ID_MAX = 40;

// Dice a table really has: at least one die, of at least two sides, with no leading zeros. Mirrored
// from the Engine, which refuses "0d6", "1d1" and "01d6" outright, so a package carrying one never
// reaches the catalog.
export const RULESET_CATALOG_DICE_PATTERN = /^[1-9]\d{0,2}d(?:[2-9]|[1-9]\d{1,3})(?:[+-]\d{1,4})?$/u;

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
  // A bestiary's entries carry an opponent instead of rows, so the row checks below have nothing to
  // look at. What a creature must satisfy is assertRulesetCreatures' story to tell.
  const holdsCreatures = catalog.holds === "creatures";
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
    if (holdsCreatures) continue;
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
    // A bestiary writes no rows, so it feeds no list; everything else names the lists it fills.
    if (catalog.holds === "creatures") {
      if (catalog.feeds !== undefined)
        throw new Error(`${id} catalog "${catalog.id}" holds creatures, so it feeds no list`);
    } else if (!Array.isArray(catalog.feeds) || catalog.feeds.length === 0) {
      throw new Error(`${id} catalog "${catalog.id}" must feed at least one list`);
    }
    for (const listId of catalog.feeds ?? []) {
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

/** The sheet names a combat block or a creature may point at, gathered once. */
function sheetNames(document) {
  const sheet = document?.sheet ?? {};
  const ids = (items) => new Set((items ?? []).map((item) => item?.id));
  return {
    fields: new Map((sheet.fields ?? []).map((field) => [field.id, field])),
    derived: ids(sheet.derived),
    abilities: ids(sheet.abilities),
    skills: ids(sheet.skills),
    saves: ids(sheet.saves),
    pools: new Map((sheet.live?.pools ?? []).map((pool) => [pool.id, pool])),
    tracks: ids(sheet.live?.tracks),
    text: ids(sheet.live?.text),
    conditions: ids(sheet.live?.conditions),
    lists: new Map((sheet.lists ?? []).map((list) => [list.id, list])),
  };
}

/** Assert a ruleset package's `combat` block, and report whether it has one.
 *
 *  Like the battle block's checks, these look into the sheet, because a combat block is nothing but
 *  references into it: a defense that names no field, a budget an attack list cannot spend or a
 *  condition the sheet never declares would publish fine and then be a missing number in the middle
 *  of a turn. The Engine makes the same checks when it parses the file, so these are its rules
 *  restated at the narrow shape the block has, never stricter. */
export function assertRulesetCombat(manifest, document) {
  const id = manifest?.id ?? "package";
  const combat = document?.combat;
  if (combat === undefined) return false;
  if (!combat || typeof combat !== "object" || Array.isArray(combat)) throw new Error(`${id} combat must be an object`);
  const api = RULESET_COMBAT_MIN_CAPABILITY_API;
  if (!meetsCapabilityApi(manifest, api)) {
    throw new Error(`${id} ships a combat block and must declare capability API ${api.major}.${api.minor} or newer`);
  }
  if (combat.kind !== "attack-vs-defense") {
    throw new Error(`${id} combat kind ${JSON.stringify(combat.kind)} is not one the Engine resolves`);
  }

  // The same reading the Engine makes before it installs the package: any one of these keys and an
  // Engine that predates them refuses the file, so the package says which Engine it needs.
  const turnKeys = ["saves", "whileSourceInSight", "endsWhenSourceDown"];
  const carriesTurn =
    combat.standardEffects !== undefined ||
    (combat.attacks ?? []).some((source) => source?.strikes !== undefined) ||
    (combat.conditions ?? []).some(
      (entry) =>
        turnKeys.some((key) => entry?.[key] !== undefined) ||
        (entry?.effects ?? []).some(
          (effect) => RULESET_COMBAT_CONDITION_EFFECTS.includes(effect) && !OLD_CONDITION_EFFECTS.includes(effect),
        ),
    );
  if (carriesTurn) {
    const turnApi = RULESET_TURN_MIN_CAPABILITY_API;
    if (!meetsCapabilityApi(manifest, turnApi)) {
      throw new Error(
        `${id} says what one turn of a fight can do and must declare capability API ${turnApi.major}.${turnApi.minor} or newer`,
      );
    }
  }

  const names = sheetNames(document);
  const pool = names.pools.get(combat.health?.pool);
  if (!pool) throw new Error(`${id} combat health names unknown live pool ${JSON.stringify(combat.health?.pool)}`);
  // A pool that starts empty counts up, so as health it would put every fresh character into their
  // first fight already down.
  if (pool.start === "empty") {
    throw new Error(`${id} combat health pool "${combat.health.pool}" starts empty, so it cannot be hit points`);
  }
  const ref = (value, where) => {
    const issue = valueRefIssue(value, names);
    if (issue) throw new Error(`${id} combat ${where} ${issue}`);
  };
  ref(combat.defense, "defense");
  if (combat.initiative?.modifier !== undefined) ref(combat.initiative.modifier, "initiative modifier");
  if (combat.economy?.movement !== undefined) ref(combat.economy.movement, "economy movement");

  // A natural result is one face of one die, exactly as it is for a check.
  const singleDie = (dice, where) => {
    if (!Number.isInteger(dice?.count) || dice.count < 1) throw new Error(`${id} combat ${where} must roll whole dice`);
    return dice.count === 1;
  };
  const naturals = combat.attackRoll?.naturals ?? {};
  if (
    !singleDie(combat.attackRoll?.dice, "attack roll") &&
    ((naturals.max ?? "none") !== "none" || (naturals.min ?? "none") !== "none")
  ) {
    throw new Error(`${id} combat attack roll naturals need a single die`);
  }

  const budgets = new Set();
  const declared = combat.economy?.budgets;
  if (!Array.isArray(declared) || declared.length === 0 || declared.length > RULESET_COMBAT_MAX_BUDGETS) {
    throw new Error(`${id} combat economy declares 1 to ${RULESET_COMBAT_MAX_BUDGETS} budgets`);
  }
  for (const budget of declared) {
    // Named before it is counted: two budgets with no id at all would otherwise read as a duplicate
    // and say so, instead of saying that neither of them is named.
    if (
      typeof budget?.id !== "string" ||
      budget.id.length > RULESET_SHEET_ID_MAX ||
      !RULESET_SHEET_ID_PATTERN.test(budget.id)
    ) {
      throw new Error(`${id} combat budget id ${JSON.stringify(budget?.id)} is not a usable sheet id`);
    }
    if (budgets.has(budget.id)) throw new Error(`${id} combat repeats the budget "${budget.id}"`);
    budgets.add(budget.id);
    if (budget?.per !== "turn" && budget?.per !== "round") {
      throw new Error(
        `${id} combat budget "${budget?.id}" refills per turn or per round, not ${JSON.stringify(budget?.per)}`,
      );
    }
  }
  const budget = (value, where) => {
    if (!budgets.has(value)) throw new Error(`${id} combat ${where} names unknown budget ${JSON.stringify(value)}`);
  };

  // ── Positions: what a board measures, and what has to be there before any of it means anything ──
  //
  // The Engine's own rule, restated: `distance` is what makes a fight positionable, and every other
  // key below is a number measured in it, so declaring one without it is refused at import.
  // Each of the four is an object or it is not there. Checked before anything reads into one, so a
  // `null`, an array or a bare number says what is wrong with it instead of throwing a TypeError or,
  // worse, passing every check below because reading a key off it gave `undefined`.
  const blockOf = (key) => {
    const value = combat[key];
    if (value === undefined) return undefined;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${id} combat ${key} must be an object, not ${JSON.stringify(value)}`);
    }
    return value;
  };
  const distance = blockOf("distance");
  const ranged = blockOf("ranged");
  const cover = blockOf("cover");
  const opportunity = blockOf("opportunity");
  const positionKeys = ["ranged", "cover", "opportunity"].filter((key) => combat[key] !== undefined);
  // A row that caps its own strikes: the key, the column it names, and the number it caps.
  (combat.attacks ?? []).forEach((source, index) => {
    const cap = source?.strikesCappedBy;
    if (cap === undefined) return;
    const capApi = RULESET_STRIKE_CAP_MIN_CAPABILITY_API;
    if (!meetsCapabilityApi(manifest, capApi)) {
      throw new Error(
        `${id} caps a weapon's strikes and must declare capability API ${capApi.major}.${capApi.minor} or newer`,
      );
    }
    if (source.strikes === undefined) {
      throw new Error(`${id} combat attacks[${index}] caps strikes on a list that buys one a spend anyway`);
    }
    const list = (document?.sheet?.lists ?? []).find((entry) => entry?.id === source.list);
    const column = (list?.columns ?? []).find((entry) => entry?.id === cap?.column);
    if (!column || column.type !== "boolean") {
      throw new Error(
        `${id} combat attacks[${index}].strikesCappedBy names "${cap?.column}", which is not a boolean column of "${source.list}"`,
      );
    }
  });
  const attackDistances = (combat.attacks ?? []).flatMap((source, index) =>
    ["reach", "range"].filter((key) => source?.[key] !== undefined).map((key) => `attacks[${index}].${key}`),
  );
  if (distance === undefined) {
    const orphan = positionKeys[0] ?? attackDistances[0];
    if (orphan) {
      throw new Error(`${id} combat "${orphan}" is measured in cells, so the block declares "distance" too`);
    }
  } else {
    const api = RULESET_POSITIONS_MIN_CAPABILITY_API;
    if (!meetsCapabilityApi(manifest, api)) {
      throw new Error(
        `${id} gives a fight positions and must declare capability API ${api.major}.${api.minor} or newer`,
      );
    }
    const { label, perCell } = distance;
    if (typeof label !== "string" || label.length < 1 || label.length > RULESET_DISTANCE_LABEL_MAX) {
      throw new Error(
        `${id} combat distance label ${JSON.stringify(label)} is 1 to ${RULESET_DISTANCE_LABEL_MAX} characters`,
      );
    }
    if (!Number.isFinite(perCell) || perCell <= 0) {
      throw new Error(`${id} combat distance perCell is a number above zero, not ${JSON.stringify(perCell)}`);
    }
  }
  if (ranged !== undefined) {
    for (const key of ["long", "adjacentFoe"]) {
      const rule = ranged[key];
      if (rule !== undefined && !RULESET_RANGED_RULES.includes(rule)) {
        throw new Error(
          `${id} combat ranged ${key} is ${RULESET_RANGED_RULES.join(" or ")}, not ${JSON.stringify(rule)}`,
        );
      }
    }
  }
  if (cover !== undefined) {
    const bonus = cover.bonus;
    if (!Number.isInteger(bonus) || bonus < 0 || bonus > RULESET_COVER_MAX) {
      throw new Error(`${id} combat cover bonus is a whole number from 0 to ${RULESET_COVER_MAX}, not ${bonus}`);
    }
  }
  if (opportunity !== undefined) budget(opportunity.budget, "opportunity budget");

  for (const source of combat.attacks ?? []) {
    const list = names.lists.get(source?.list);
    if (!list) throw new Error(`${id} combat attacks name unknown list ${JSON.stringify(source?.list)}`);
    budget(source.budget, `attacks "${source.list}" budget`);
    const columns = new Map((list.columns ?? []).map((column) => [column.id, column]));
    const column = (value, wanted, where) => {
      if (value === undefined) return;
      const found = columns.get(value);
      if (!found) throw new Error(`${id} combat attacks ${where} names unknown column ${JSON.stringify(value)}`);
      if (!wanted.includes(found.type)) {
        throw new Error(`${id} combat attacks ${where} must name a ${wanted.join(" or ")} column, not ${found.type}`);
      }
    };
    column(source.name, ["text"], "name");
    column(source.toHit?.ability?.column, ["enum"], "toHit ability");
    column(source.toHit?.proficiency?.column, ["boolean"], "toHit proficiency");
    column(source.toHit?.bonus?.column, ["number"], "toHit bonus");
    column(source.damage?.dice?.column, ["dice"], "damage dice");
    column(source.damage?.ability?.column, ["enum"], "damage ability");
    column(source.damage?.bonus?.column, ["number"], "damage bonus");
    column(source.damage?.type?.column, ["text", "enum"], "damage type");
    if (source.damage?.dice?.column === undefined) {
      throw new Error(`${id} combat attacks "${source.list}" must name the dice column its rows are rolled from`);
    }
    // A distance one row carries: a number column of that same list, or the same number on every
    // row. Whichever it is, it is the Engine's own union, restated.
    const distance = (value, where) => {
      if (value === undefined) return undefined;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${id} combat attacks ${where} names a column or a constant, not ${JSON.stringify(value)}`);
      }
      if ("const" in value) {
        const fixed = value.const;
        if (!Number.isFinite(fixed) || fixed < 0 || fixed > RULESET_DISTANCE_MAX) {
          throw new Error(`${id} combat attacks ${where} const is a distance from 0 to ${RULESET_DISTANCE_MAX}`);
        }
        return fixed;
      }
      // `column` lets an absent name through, so an object carrying neither key would otherwise be
      // read as a distance and pass. It names one or the other, and nothing else is a distance.
      if (value.column === undefined) {
        throw new Error(`${id} combat attacks ${where} names a column or a constant, not ${JSON.stringify(value)}`);
      }
      column(value.column, ["number"], where);
      return undefined;
    };
    distance(source.reach, `"${source.list}" reach`);
    if (source.range !== undefined) {
      // Said before anything reads into it: `null` would throw a TypeError rather than a sentence,
      // and an array or a number would fall through to the message below, which is about a shape
      // that at least IS a pair.
      if (!source.range || typeof source.range !== "object" || Array.isArray(source.range)) {
        throw new Error(
          `${id} combat attacks "${source.list}" range is an ordinary distance and an optional longer one, not ${JSON.stringify(source.range)}`,
        );
      }
      if (source.range.normal === undefined) {
        throw new Error(`${id} combat attacks "${source.list}" range names the ordinary distance it is shot at`);
      }
      const normal = distance(source.range.normal, `"${source.list}" range normal`);
      const long = distance(source.range.long, `"${source.list}" range long`);
      // Only comparable when both are written once for every row. A pair of columns is the
      // player's own two numbers, and the Engine reads a shorter long distance as no long
      // distance at all rather than refusing the row.
      if (normal !== undefined && long !== undefined && long < normal) {
        throw new Error(`${id} combat attacks "${source.list}" range long is at least the ordinary one`);
      }
    }
  }

  for (const source of combat.abilities ?? []) {
    const list = names.lists.get(source?.list);
    if (!list) throw new Error(`${id} combat abilities name unknown list ${JSON.stringify(source?.list)}`);
    budget(source.budget, `abilities "${source.list}" budget`);
    const columns = new Map((list.columns ?? []).map((column) => [column.id, column]));
    if (source.onlyWhen !== undefined && columns.get(source.onlyWhen)?.type !== "boolean") {
      throw new Error(`${id} combat abilities onlyWhen ${JSON.stringify(source.onlyWhen)} must name a boolean column`);
    }
    if (source.alwaysWhen !== undefined && source.onlyWhen === undefined) {
      throw new Error(`${id} combat abilities alwaysWhen is the exception to onlyWhen, so it needs onlyWhen beside it`);
    }
    if (source.alwaysWhen !== undefined) {
      const column = columns.get(source.alwaysWhen?.column);
      if (!column) {
        throw new Error(
          `${id} combat abilities alwaysWhen names unknown column ${JSON.stringify(source.alwaysWhen?.column)}`,
        );
      }
      const mismatch = columnEqualsIssue(column, source.alwaysWhen.equals);
      if (mismatch) throw new Error(`${id} combat abilities alwaysWhen ${mismatch}`);
    }
    if (source.toHit !== undefined) ref(source.toHit, `abilities "${source.list}" toHit`);
    if (source.saveDifficulty !== undefined) ref(source.saveDifficulty, `abilities "${source.list}" saveDifficulty`);
  }

  const standard = new Set();
  for (const action of combat.standard ?? []) {
    if (!RULESET_COMBAT_STANDARD_ACTIONS.includes(action)) {
      throw new Error(`${id} combat standard action ${JSON.stringify(action)} is not one the Engine resolves`);
    }
    if (standard.has(action)) throw new Error(`${id} combat repeats the standard action "${action}"`);
    standard.add(action);
  }

  const mapped = new Set();
  for (const entry of combat.conditions ?? []) {
    if (!names.conditions.has(entry?.condition)) {
      throw new Error(`${id} combat maps unknown condition ${JSON.stringify(entry?.condition)}`);
    }
    if (mapped.has(entry.condition)) throw new Error(`${id} combat repeats the condition "${entry.condition}"`);
    mapped.add(entry.condition);
    for (const effect of entry.effects ?? []) {
      if (!RULESET_COMBAT_CONDITION_EFFECTS.includes(effect)) {
        throw new Error(`${id} combat condition "${entry.condition}" has the unknown effect ${JSON.stringify(effect)}`);
      }
    }
    for (const save of entry.failsSaves ?? []) {
      if (!names.saves.has(save)) {
        throw new Error(`${id} combat condition "${entry.condition}" fails unknown save ${JSON.stringify(save)}`);
      }
    }
  }

  if (combat.concentration !== undefined) {
    if (!names.text.has(combat.concentration?.text)) {
      throw new Error(
        `${id} combat concentration names unknown live text ${JSON.stringify(combat.concentration?.text)}`,
      );
    }
    if (!names.saves.has(combat.concentration?.save)) {
      throw new Error(`${id} combat concentration names unknown save ${JSON.stringify(combat.concentration?.save)}`);
    }
  }

  if (combat.dying !== undefined) {
    const dying = combat.dying;
    if (dying?.kind !== "saves")
      throw new Error(`${id} combat dying kind ${JSON.stringify(dying?.kind)} is not "saves"`);
    for (const key of ["successes", "failures"]) {
      if (!names.tracks.has(dying[key])) {
        throw new Error(`${id} combat dying ${key} names unknown track ${JSON.stringify(dying[key])}`);
      }
    }
    if (dying.successes === dying.failures) {
      throw new Error(`${id} combat dying counts successes and failures on two different tracks`);
    }
    if (dying.condition !== undefined && !names.conditions.has(dying.condition)) {
      throw new Error(`${id} combat dying names unknown condition ${JSON.stringify(dying.condition)}`);
    }
    const dyingNaturals = dying.naturals ?? {};
    if (
      !singleDie(dying.dice, "dying") &&
      ((dyingNaturals.max ?? "none") !== "none" || (dyingNaturals.min ?? "none") !== "none")
    ) {
      throw new Error(`${id} combat dying naturals need a single die`);
    }
  }

  const types = new Set();
  for (const type of combat.damageTypes ?? []) {
    const key = String(type).toLowerCase();
    if (types.has(key)) throw new Error(`${id} combat repeats the damage type "${type}"`);
    types.add(key);
  }

  if (combat.threat !== undefined) {
    const tiers = combat.threat?.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0 || tiers.length > RULESET_COMBAT_MAX_TIERS) {
      throw new Error(`${id} combat threat declares 1 to ${RULESET_COMBAT_MAX_TIERS} tiers`);
    }
    const seen = new Set();
    for (const tier of tiers) {
      if (seen.has(tier?.id)) throw new Error(`${id} combat threat repeats the tier "${tier.id}"`);
      seen.add(tier?.id);
      for (const key of ["health", "damagePerRound"]) {
        const band = tier?.[key];
        if (!Array.isArray(band) || band.length !== 2 || !band.every((value) => Number.isInteger(value))) {
          throw new Error(`${id} combat threat tier "${tier?.id}" ${key} is a pair of whole numbers`);
        }
        if (band[0] > band[1])
          throw new Error(`${id} combat threat tier "${tier.id}" ${key} lowest is above its highest`);
      }
      for (const key of ["defense", "toHit", "saveDifficulty"]) {
        if (!Number.isInteger(tier?.[key])) {
          throw new Error(`${id} combat threat tier "${tier?.id}" ${key} is a whole number`);
        }
      }
    }
  }
  return true;
}

/** Assert a ruleset package's bestiary catalogs, and report how many creatures they carry.
 *
 *  A creature is written entirely in the names the combat block and the sheet already declare, so
 *  every one of them is checked against the file beside it, exactly as the Engine checks them when
 *  it reads the catalog. `catalogSources` maps each `catalogs/<id>.json` path to its raw bytes, so
 *  this stays a pure function a test can drive with fixtures. */
export function assertRulesetCreatures(manifest, document, catalogSources = new Map()) {
  const id = manifest?.id ?? "package";
  const catalogs = Array.isArray(document?.catalogs) ? document.catalogs : [];
  const names = sheetNames(document);
  const combat = document?.combat;
  const budgets = combat ? new Set((combat.economy?.budgets ?? []).map((budget) => budget.id)) : new Set();
  const tiers = combat?.threat?.tiers ? new Set(combat.threat.tiers.map((tier) => tier.id)) : new Set();
  // Only checked where the ruleset says what its types are. One that declares none reads a type as
  // free text, exactly as a fight matches it.
  const types = combat?.damageTypes
    ? new Set(combat.damageTypes.map((type) => String(type).trim().toLowerCase()))
    : null;

  let count = 0;
  for (const catalog of catalogs) {
    if (catalog?.holds !== "creatures") {
      for (const entry of catalogEntryList(catalog, catalogSources) ?? []) {
        if (entry?.creature) {
          throw new Error(`${id} catalog "${catalog?.id}" holds rows, so entry "${entry.id}" cannot carry a creature`);
        }
      }
      continue;
    }
    const api = RULESET_CREATURES_MIN_CAPABILITY_API;
    if (!meetsCapabilityApi(manifest, api)) {
      throw new Error(`${id} ships a bestiary and must declare capability API ${api.major}.${api.minor} or newer`);
    }
    // The picker offers a catalog on the lists it feeds, so a bestiary declaring feeds would be
    // offered on a sheet it can write nothing into.
    if (catalog.feeds !== undefined) {
      throw new Error(`${id} catalog "${catalog.id}" holds creatures, so it feeds no list`);
    }
    if (!combat) {
      throw new Error(`${id} catalog "${catalog.id}" holds creatures, which need a combat block to be written in`);
    }
    const entries = catalogEntryList(catalog, catalogSources);
    // An asset this check cannot read is assertRulesetCatalogs' rejection to make, with a better
    // message, so this reads only what is actually there.
    if (entries === null) continue;
    for (const entry of entries) {
      const where = `${id} catalog "${catalog.id}" entry "${entry?.id}"`;
      const creature = entry?.creature;
      if (!creature) throw new Error(`${where} carries no creature, and this catalog holds creatures`);
      if (entry.rows !== undefined) throw new Error(`${where} has both rows and a creature`);
      if (entry.mechanics !== undefined) {
        throw new Error(`${where} says what it does in its own actions, so it carries no mechanics`);
      }
      count += 1;
      if (!tiers.has(creature.tier))
        throw new Error(`${where} names unknown threat tier ${JSON.stringify(creature.tier)}`);
      // The three numbers a fight cannot be built without. The Engine requires all of them (health a
      // whole number from 1, or dice; defense a whole number from 0; a whole initiative modifier), and
      // nothing on the combat path would stand in for a missing one.
      const health = creature.health;
      const healthIsNumber = Number.isInteger(health) && health >= 1;
      const healthIsDice = health !== null && typeof health === "object" && typeof health.dice === "string";
      if (!healthIsNumber && !healthIsDice) {
        throw new Error(`${where} needs health: a whole number from 1, or dice, not ${JSON.stringify(health)}`);
      }
      if (!Number.isInteger(creature.defense) || creature.defense < 0) {
        throw new Error(`${where} needs a defense: a whole number from 0, not ${JSON.stringify(creature.defense)}`);
      }
      if (!Number.isInteger(creature.initiativeModifier)) {
        throw new Error(
          `${where} needs an initiativeModifier: a whole number, not ${JSON.stringify(creature.initiativeModifier)}`,
        );
      }
      // Health written as dice is thrown when the fight is created, so dice nobody can throw would
      // build an opponent with no hit points at all.
      const healthDice = typeof creature.health === "object" ? creature.health?.dice : undefined;
      if (healthDice !== undefined && !RULESET_CATALOG_DICE_PATTERN.test(healthDice)) {
        throw new Error(`${where} has health dice ${JSON.stringify(healthDice)} nobody can throw`);
      }
      for (const ability of Object.keys(creature.abilities ?? {})) {
        if (!names.abilities.has(ability)) throw new Error(`${where} names unknown ability ${JSON.stringify(ability)}`);
      }
      for (const save of Object.keys(creature.saves ?? {})) {
        if (!names.saves.has(save)) throw new Error(`${where} names unknown save ${JSON.stringify(save)}`);
      }
      for (const key of ["resist", "vulnerable", "immune"]) {
        for (const type of creature[key] ?? []) {
          if (types && !types.has(String(type).trim().toLowerCase())) {
            throw new Error(`${where} is ${key} to unknown damage type ${JSON.stringify(type)}`);
          }
        }
      }
      for (const condition of creature.conditionImmunities ?? []) {
        if (!names.conditions.has(condition)) {
          throw new Error(`${where} is immune to unknown condition ${JSON.stringify(condition)}`);
        }
      }
      // How far it walks, in the ruleset's own distance unit. Read only by a fight with a board,
      // and legal without one, exactly as the Engine has it.
      if (creature.speed !== undefined) {
        if (!Number.isFinite(creature.speed) || creature.speed < 0 || creature.speed > RULESET_DISTANCE_MAX) {
          throw new Error(`${where} has a speed of ${JSON.stringify(creature.speed)}, not a distance from 0`);
        }
      }
      if ((creature.traits ?? []).length > RULESET_CREATURE_MAX_TRAITS) {
        throw new Error(
          `${where} carries ${creature.traits.length} traits, over the ${RULESET_CREATURE_MAX_TRAITS} limit`,
        );
      }
      const actions = creature.actions;
      if (!Array.isArray(actions) || actions.length === 0 || actions.length > RULESET_CREATURE_MAX_ACTIONS) {
        throw new Error(`${where} carries 1 to ${RULESET_CREATURE_MAX_ACTIONS} actions, not ${actions?.length}`);
      }
      const byId = new Map();
      for (const action of actions) {
        if (byId.has(action?.id)) throw new Error(`${where} repeats the action id ${JSON.stringify(action.id)}`);
        byId.set(action?.id, action);
      }
      if (creature.signaturePoints === undefined && actions.some((action) => action.signature)) {
        throw new Error(`${where} buys an action with points but declares no signaturePoints`);
      }
      for (const action of actions) {
        const at = `${where} action "${action.id}"`;
        if (!budgets.has(action.budget))
          throw new Error(`${at} spends unknown budget ${JSON.stringify(action.budget)}`);
        if (action.damage?.type && types && !types.has(String(action.damage.type).trim().toLowerCase())) {
          throw new Error(`${at} deals unknown damage type ${JSON.stringify(action.damage.type)}`);
        }
        if (action.damage?.dice !== undefined && !RULESET_CATALOG_DICE_PATTERN.test(action.damage.dice)) {
          throw new Error(`${at} rolls ${JSON.stringify(action.damage.dice)}, which is not dice a table has`);
        }
        if (action.save && !names.saves.has(action.save.save)) {
          throw new Error(`${at} forces unknown save ${JSON.stringify(action.save.save)}`);
        }
        if (action.save && action.saveDifficulty !== undefined) {
          throw new Error(`${at} has a save of its own, and that save's difficulty is what a save-ends uses`);
        }
        // How far this one reaches and how far it carries, in the ruleset's own unit. Both have
        // been legal since 1.27 and need no `distance` beside them: a ruleset without a board
        // simply never reads them. What DOES need 1.28 is a range written as a pair, which an
        // older Engine refuses along with the whole catalog file that holds it.
        const reachOf = (value, what) => {
          if (!Number.isFinite(value) || value < 0 || value > RULESET_DISTANCE_MAX) {
            throw new Error(`${at} has a ${what} of ${JSON.stringify(value)}, not a distance from 0`);
          }
        };
        if (action.reach !== undefined) reachOf(action.reach, "reach");
        if (typeof action.range === "number") reachOf(action.range, "range");
        else if (action.range !== undefined) {
          if (!action.range || typeof action.range !== "object" || Array.isArray(action.range)) {
            throw new Error(`${at} has a range of ${JSON.stringify(action.range)}, not a distance or a pair`);
          }
          const api = RULESET_POSITIONS_MIN_CAPABILITY_API;
          if (!meetsCapabilityApi(manifest, api)) {
            throw new Error(
              `${at} writes its range as a pair and must declare capability API ${api.major}.${api.minor} or newer`,
            );
          }
          reachOf(action.range.normal, "range");
          if (action.range.long !== undefined) {
            reachOf(action.range.long, "long range");
            if (action.range.long < action.range.normal) {
              throw new Error(`${at} has a long range below its ordinary one`);
            }
          }
        }
        // The shape it lands in, in the ruleset's own unit. A new key in a strict file, so an older
        // Engine refuses the whole catalog file that holds it, exactly as it does a range pair.
        if (action.area !== undefined) {
          const area = action.area;
          if (!area || typeof area !== "object" || Array.isArray(area)) {
            throw new Error(`${at} has an area of ${JSON.stringify(area)}, not a shape`);
          }
          const api = RULESET_POSITIONS_MIN_CAPABILITY_API;
          if (!meetsCapabilityApi(manifest, api)) {
            throw new Error(
              `${at} lands in a shape and must declare capability API ${api.major}.${api.minor} or newer`,
            );
          }
          if (!RULESET_AREA_SHAPES.includes(area.shape)) {
            throw new Error(
              `${at} lands in the shape ${JSON.stringify(area.shape)}, which is not one the Engine draws`,
            );
          }
          if (!Number.isFinite(area.size) || area.size <= 0 || area.size > RULESET_DISTANCE_MAX) {
            throw new Error(`${at} has an area of ${JSON.stringify(area.size)}, not a size above 0`);
          }
          if (area.friendlyFire !== undefined && typeof area.friendlyFire !== "boolean") {
            throw new Error(`${at} says friendlyFire is ${JSON.stringify(area.friendlyFire)}, not true or false`);
          }
        }
        const applies = action.applies ?? [];
        if (applies.length > RULESET_CREATURE_MAX_APPLIES) {
          throw new Error(`${at} applies ${applies.length} conditions, over the ${RULESET_CREATURE_MAX_APPLIES} limit`);
        }
        for (const entryApplies of applies) {
          if (!names.conditions.has(entryApplies?.condition)) {
            throw new Error(`${at} applies unknown condition ${JSON.stringify(entryApplies?.condition)}`);
          }
          if (entryApplies.duration === "until-save" && !entryApplies.saveEnds) {
            throw new Error(`${at} applies "${entryApplies.condition}" until a save it does not name`);
          }
          if (entryApplies.saveEnds && !names.saves.has(entryApplies.saveEnds.save)) {
            throw new Error(
              `${at} ends "${entryApplies.condition}" on unknown save ${JSON.stringify(entryApplies.saveEnds.save)}`,
            );
          }
        }
        // A save with nothing to be rolled against is a save everybody passes.
        if (
          !action.save &&
          action.saveDifficulty === undefined &&
          applies.some((entryApplies) => entryApplies.saveEnds)
        ) {
          throw new Error(`${at} ends a condition on a save with no difficulty to roll against`);
        }
        if (!action.sequence) continue;
        // A sequence is a container: anything else on it would be a second thing the one budget did,
        // the shape it might land in included. The actions it names carry their own.
        for (const key of ["toHit", "autoHit", "damage", "save", "saveDifficulty", "applies", "targetCount", "area"]) {
          if (action[key] !== undefined) throw new Error(`${at} is a sequence, so it carries no ${key} of its own`);
        }
        if (action.sequence.length === 0 || action.sequence.length > RULESET_CREATURE_MAX_SEQUENCE) {
          throw new Error(`${at} names 1 to ${RULESET_CREATURE_MAX_SEQUENCE} steps, not ${action.sequence.length}`);
        }
        for (const step of action.sequence) {
          const named = byId.get(step?.action);
          if (!named) throw new Error(`${at} names unknown action ${JSON.stringify(step?.action)}`);
          if (named.id === action.id) throw new Error(`${at} names itself`);
          if (named.sequence) throw new Error(`${at} names "${step.action}", and a sequence cannot name another`);
          // Bought with points while somebody else is acting, so a sequence, which is paid for with a
          // budget on the creature's own turn, cannot hold it. The Engine refuses the same.
          if (named.signature) {
            throw new Error(`${at} names "${step.action}", which is bought with points, so a sequence cannot name it`);
          }
          // `times` may be left out (the Engine reads that as once). Written, it is a whole number
          // from 1 to 10, which is the Engine's own bound and no stricter.
          if (step.times !== undefined && (!Number.isInteger(step.times) || step.times < 1 || step.times > 10)) {
            throw new Error(`${at} repeats "${step.action}" ${JSON.stringify(step.times)} times, not 1 to 10`);
          }
        }
      }
    }
  }
  return count;
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
