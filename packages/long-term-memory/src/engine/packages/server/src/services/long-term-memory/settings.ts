import { basename } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { z } from "zod";
import {
  DEFAULT_LTM_GLOBAL_SETTINGS,
  ltmGlobalSettingsSchema,
  ltmResolvedGlobalSettingsSchema,
  type LtmGlobalSettings,
  type LtmResolvedGlobalSettings,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./persistence/atomic-json.js";
import { logger } from "./package-runtime.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./persistence/paths.js";
import { withLtmVaultLock } from "./persistence/vault-lock.js";
export const ltmSettingsPath = (root = getLongTermMemoryRoot()) =>
  safeJoin(getLongTermMemoryDirectories(root).config, "settings.json");
const loggedUnknownSettings = new Set<string>();
type LtmSettingsPath = (string | number)[];
const isSettingsRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const settingsValueAt = (value: unknown, path: LtmSettingsPath) =>
  path.reduce<unknown>(
    (node, key) => (node && typeof node === "object" ? (node as Record<string | number, unknown>)[key] : undefined),
    value,
  );
// zod 3 names an enum miss `invalid_enum_value`; zod 4 names it `invalid_value`, as it does a literal miss, and also
// for a value that is not a string (zod 3 calls that `invalid_type`), so only a string counts as a newer option. The
// top-level `version` literal must still fail the parse.
const isUnknownEnumValue = (code: string, path: LtmSettingsPath, value: unknown) =>
  path.length > 0 &&
  (code === "invalid_enum_value" ||
    (code === "invalid_value" && typeof value === "string" && !(path.length === 1 && path[0] === "version")));
/**
 * Splits a stored settings file into the part this version knows and what a newer
 * version wrote: fields this version does not have, at any depth, enum values it does
 * not have (a new option or mode), and values outside this version's range (a raised
 * maximum or longer text). Those are removed so the field falls back to its default; a
 * list keeps its other entries. A wrong type or a different `version` still fails the
 * parse. Removed legacy fields are dropped by the schema's preprocessor and never count.
 * Names are logged once per file, never values. Request bodies keep using the strict
 * schema directly.
 */
export function splitUnknownLtmSettings(schema: z.ZodTypeAny, value: unknown, path: string) {
  const raw: Record<string, unknown> = isSettingsRecord(value) ? value : {};
  if (!isSettingsRecord(value)) return { known: value, unknown: {}, newer: [] as LtmSettingsPath[], raw };
  const known: Record<string, unknown> = structuredClone(value);
  const unknown: Record<string, unknown> = {};
  const newer: LtmSettingsPath[] = [];
  // Each pass removes what the last parse reported; a removal can only expose issues below it.
  // Range issues wait for a pass with nothing else to remove, so a list first loses its newer entries.
  for (let pass = 0; pass < 4; pass += 1) {
    const result = schema.safeParse(known);
    if (result.success) break;
    let changed = false;
    const dropped = new Map<string, { list: LtmSettingsPath; indexes: Set<number> }>();
    const remove = (issuePath: LtmSettingsPath) => {
      const parent = settingsValueAt(known, issuePath.slice(0, -1));
      const key = issuePath[issuePath.length - 1]!;
      if (Array.isArray(parent) && typeof key === "number" && key < parent.length) {
        const list = issuePath.slice(0, -1);
        const id = list.join(".");
        if (!dropped.has(id)) dropped.set(id, { list, indexes: new Set<number>() });
        dropped.get(id)!.indexes.add(key);
      } else if (isSettingsRecord(parent) && key in parent) delete parent[key];
      else return;
      newer.push(issuePath);
      changed = true;
    };
    // A list over its maximum reports only that, not its entries, so an entry this version does not know
    // is found by checking each one alone.
    const unknownEntries = (list: LtmSettingsPath) => {
      const entries = settingsValueAt(known, list);
      if (!Array.isArray(entries)) return [];
      return entries.flatMap((entry, index) => {
        const probe = structuredClone(known);
        (settingsValueAt(probe, list.slice(0, -1)) as Record<string | number, unknown>)[list[list.length - 1]!] = [
          entry,
        ];
        const alone = schema.safeParse(probe);
        return !alone.success &&
          alone.error.issues.some(
            (issue) =>
              isUnknownEnumValue(issue.code, issue.path as LtmSettingsPath, entry) &&
              issue.path.join(".") === [...list, 0].join("."),
          )
          ? [index]
          : [];
      });
    };
    const outOfRange: LtmSettingsPath[] = [];
    // zod 4 also reports a range issue for a value of the wrong type (a string for a list); the type error decides.
    const wrongType = new Set(
      result.error.issues.filter((issue) => issue.code === "invalid_type").map((issue) => issue.path.join(".")),
    );
    for (const issue of result.error.issues) {
      const code: string = issue.code;
      const issuePath = issue.path as LtmSettingsPath;
      if (code === "unrecognized_keys") {
        const parent = settingsValueAt(known, issuePath);
        if (!isSettingsRecord(parent)) continue;
        for (const key of (issue as { keys?: string[] }).keys ?? []) {
          if (issuePath.length === 0) unknown[key] = parent[key];
          else newer.push([...issuePath, key]);
          delete parent[key];
          changed = true;
        }
      } else if (isUnknownEnumValue(code, issuePath, settingsValueAt(known, issuePath))) remove(issuePath);
      else if (
        (code === "too_big" || code === "too_small") &&
        issuePath.length > 0 &&
        !wrongType.has(issuePath.join("."))
      )
        outOfRange.push(issuePath);
    }
    if (!changed) {
      for (const list of outOfRange) for (const index of unknownEntries(list)) remove([...list, index]);
      if (!changed) outOfRange.forEach(remove);
    }
    for (const { list, indexes } of dropped.values()) {
      const parent = settingsValueAt(known, list.slice(0, -1)) as Record<string | number, unknown>;
      const key = list[list.length - 1]!;
      if (!Array.isArray(parent?.[key])) continue;
      const kept = (parent[key] as unknown[]).filter((_, index) => !indexes.has(index));
      // A list left with nothing this version knows falls back to its default.
      if (kept.length) parent[key] = kept;
      else delete parent[key];
    }
    if (!changed) break;
  }
  const names = [...new Set([...Object.keys(unknown), ...newer.map((entry) => entry.join("."))])];
  const logKey = `${path}\n${names.join("\n")}`;
  if (names.length && !loggedUnknownSettings.has(logKey)) {
    loggedUnknownSettings.add(logKey);
    logger.warn("[ltm] Ignoring settings this version does not know in %s: %s", basename(path), names.join(", "));
  }
  return { known, unknown, newer, raw };
}
export type LtmSettingsRead = Pick<ReturnType<typeof splitUnknownLtmSettings>, "unknown" | "newer" | "raw">;
/**
 * What a writer saves: `saved`, plus what a newer version wrote that this save did not
 * change, so the file keeps it for that version. A request field equal to what readers
 * were shown (`shown`) is unchanged: the Settings page sends its whole form. A newer
 * value inside a list comes back with its whole top-level field; elsewhere it comes back
 * at its own key.
 */
export function withNewerLtmSettings(saved: object, read: LtmSettingsRead, request: unknown = {}, shown: object = {}) {
  const output: Record<string, unknown> = structuredClone({ ...read.unknown, ...saved });
  const requested = isSettingsRecord(request) ? request : {};
  for (const entry of read.newer) {
    const field = entry[0] as string;
    if (!(field in requested) || isDeepStrictEqual(requested[field], (shown as Record<string, unknown>)[field])) {
      output[field] = structuredClone(read.raw[field]);
      continue;
    }
    if (entry.some((key) => typeof key === "number")) continue;
    const parent = settingsValueAt(output, entry.slice(0, -1));
    const key = entry[entry.length - 1] as string;
    if (isSettingsRecord(parent) && !(key in parent)) parent[key] = structuredClone(settingsValueAt(read.raw, entry));
  }
  return output;
}
/** Reads a settings file leniently; a writer saves through `withNewerLtmSettings`. */
export async function readLtmSettingsFile<T>(path: string, schema: z.ZodType<T, any, any>, fallback: unknown) {
  const value = await readJsonFile<unknown>(path, fallback);
  const { known, ...read } = splitUnknownLtmSettings(schema, value, path);
  const parsed = schema.safeParse(known);
  // A fallback that leaves the file invalid (a required field, a cross-field rule) is not
  // applied, and the error names what the file holds, such as a value over this version's limit.
  return { settings: parsed.success ? parsed.data : schema.parse(value), ...read };
}
const resolveLtmGlobalSettings = (settings: LtmGlobalSettings) =>
  ltmResolvedGlobalSettingsSchema.parse({ ...DEFAULT_LTM_GLOBAL_SETTINGS, ...settings, version: 1 });
export async function getLtmGlobalSettings(root = getLongTermMemoryRoot()) {
  const { settings } = await readLtmSettingsFile(ltmSettingsPath(root), ltmGlobalSettingsSchema, { version: 1 });
  return resolveLtmGlobalSettings(settings);
}
/**
 * Custom stop words that may filter generated keywords. Returns none while the
 * "filter generated" setting is off, so the list then only blocks triggering.
 */
export function ltmGeneratedStopWords(settings: LtmResolvedGlobalSettings) {
  return settings.longTermMemoryStopWordsFilterGenerated ? settings.longTermMemoryStopWords : [];
}
export async function updateLtmGlobalSettings(input: unknown, root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const path = ltmSettingsPath(root);
    const { known, ...read } = splitUnknownLtmSettings(
      ltmGlobalSettingsSchema,
      await readJsonFile<unknown>(path, { version: 1 }),
      path,
    );
    const merged = {
      ...(known && typeof known === "object" && !Array.isArray(known) ? known : {}),
      ...(input && typeof input === "object" && !Array.isArray(input) ? input : {}),
    };
    const parsed: LtmGlobalSettings = ltmGlobalSettingsSchema.parse(merged);
    const loaded = ltmGlobalSettingsSchema.safeParse(known);
    const shown = loaded.success ? resolveLtmGlobalSettings(loaded.data) : undefined;
    // Fields from a newer version stay in the file so upgrading again restores them. The page
    // saves the stop words it shows lowercased and without repeats.
    await writeJsonAtomic(
      path,
      withNewerLtmSettings(
        parsed,
        read,
        input,
        shown
          ? {
              ...shown,
              longTermMemoryStopWords: [...new Set(shown.longTermMemoryStopWords.map((word) => word.toLowerCase()))],
            }
          : {},
      ),
    );
    return getLtmGlobalSettings(root);
  });
}
