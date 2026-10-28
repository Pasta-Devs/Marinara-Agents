// ──────────────────────────────────────────────
// Otome Forge: document ids
// ──────────────────────────────────────────────
// `capability_documents.id` is one primary key shared by every package, and Gacha Forge already stores an unprefixed
// `index`. Every Otome id therefore starts with `otome-forge:`; the store refuses any other id. A run's documents are
// `${runId}:<kind>:...`, so the kit modules that build ids as `${runId}:unit:` keep the prefix on their own.
import { randomInt } from "node:crypto";

export const OTOME_FORGE_PACKAGE_ID = "otome-forge";
export const ID_PREFIX = `${OTOME_FORGE_PACKAGE_ID}:`;
export const INDEX_ID = `${ID_PREFIX}index`;
/** The `{id, kind, name}` mutateDoc creates the index with. */
export const INDEX_TARGET = { id: INDEX_ID, kind: "index", name: "Otome Forge" };

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const RUN_KEY = /^r-[0-9a-z]{1,12}-[0-9a-z]{6}$/;
const LI_ID = /^li-([a-z0-9]+(?:-[a-z0-9]+)*)-[0-9a-z]{4}$/;
const SLUG_MAX = 16;

function token(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) value += ALPHABET[randomInt(ALPHABET.length)];
  return value;
}

/** True for a document id this package may read or write. */
export function isOtomeId(id: unknown): id is string {
  return typeof id === "string" && id.length > ID_PREFIX.length && id.startsWith(ID_PREFIX);
}

/** `r-<Date.now base36>-<6 [a-z0-9]>`: the run key the routes take as `:run`. */
export function newRunKey(now = Date.now()): string {
  return `r-${Math.max(0, Math.trunc(now)).toString(36)}-${token(6)}`;
}

export function isRunKey(value: unknown): value is string {
  return typeof value === "string" && RUN_KEY.test(value);
}

/** The run id R that prefixes every document of the run. Throws on anything but a run key. */
export function runIdOf(runKey: string): string {
  if (!isRunKey(runKey)) throw new RangeError(`Not an Otome Forge run key: ${JSON.stringify(runKey).slice(0, 40)}`);
  return `${ID_PREFIX}${runKey}`;
}

/** Lower-case ASCII letters and digits joined by single hyphens, at most 16 characters; "x" when nothing is left. */
export function nameSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
  return slug || "x";
}

/** `li-<name slug ≤16>-<4 [a-z0-9]>`, different from every id in `taken` (two LIs may share a name). */
export function newLiId(name: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const slug = nameSlug(name);
  for (;;) {
    const id = `li-${slug}-${token(4)}`;
    if (!used.has(id)) return id;
  }
}

export function isLiId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const slug = LI_ID.exec(value)?.[1];
  return slug !== undefined && slug.length <= SLUG_MAX;
}

// ── A run's documents (M1). Kinds: "world", "player", "unit", "state". ──

/** `${R}:world`: premise, mystery, web, content, images, connections and forge steps. */
export const worldId = (runId: string) => `${runId}:world`;
/** `${R}:player`: the protagonist. */
export const playerId = (runId: string) => `${runId}:player`;
/** `${R}:unit:${li}`: a love interest and his bible (the id shape the kit modules build). */
export const unitId = (runId: string, li: string) => `${runId}:unit:${li}`;
/** `${R}:state`: Starlight and each LI's points and stage. */
export const stateId = (runId: string) => `${runId}:state`;

/** Every kind a run's documents have. Deleting a run removes each; a milestone that adds a kind adds it here. */
export const RUN_DOC_KINDS = ["world", "player", "unit", "state"] as const;
export type RunDocKind = (typeof RUN_DOC_KINDS)[number];
/** The `{id, kind, name}` mutateDoc creates a run document with. */
export const runDocTarget = (kind: RunDocKind, id: string) => ({ id, kind, name: `Otome Forge ${kind}` });
