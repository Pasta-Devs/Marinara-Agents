import { basename } from "node:path";
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
/**
 * Splits a stored settings file into the part this version knows and the
 * top-level fields a newer version added, which the strict schema reports as
 * unrecognized. Removed legacy fields are dropped by the schema's preprocessor
 * and never count as unknown. Unknown fields are logged by name, once per file,
 * never with their values. Request bodies keep using the strict schema directly.
 */
export function splitUnknownLtmSettings(schema: z.ZodTypeAny, value: unknown, path: string) {
  const result = schema.safeParse(value);
  const keys = result.success
    ? []
    : result.error.issues.flatMap((issue) =>
        issue.code === "unrecognized_keys" && issue.path.length === 0 ? issue.keys : [],
      );
  if (!keys.length || !value || typeof value !== "object" || Array.isArray(value)) return { known: value, unknown: {} };
  const known: Record<string, unknown> = { ...value };
  const unknown: Record<string, unknown> = {};
  for (const key of keys) {
    unknown[key] = known[key];
    delete known[key];
  }
  const logKey = `${path}\n${keys.join("\n")}`;
  if (!loggedUnknownSettings.has(logKey)) {
    loggedUnknownSettings.add(logKey);
    logger.warn("[ltm] Ignoring settings this version does not know in %s: %s", basename(path), keys.join(", "));
  }
  return { known, unknown };
}
/** Reads a settings file leniently; a writer spreads `unknown` back into the file it saves. */
export async function readLtmSettingsFile<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  fallback: unknown,
) {
  const { known, unknown } = splitUnknownLtmSettings(schema, await readJsonFile<unknown>(path, fallback), path);
  return { settings: schema.parse(known), unknown };
}
export async function getLtmGlobalSettings(root = getLongTermMemoryRoot()) {
  const { settings } = await readLtmSettingsFile(ltmSettingsPath(root), ltmGlobalSettingsSchema, { version: 1 });
  return ltmResolvedGlobalSettingsSchema.parse({ ...DEFAULT_LTM_GLOBAL_SETTINGS, ...settings, version: 1 });
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
    const { known, unknown } = splitUnknownLtmSettings(
      ltmGlobalSettingsSchema,
      await readJsonFile<unknown>(path, { version: 1 }),
      path,
    );
    const merged = {
      ...(known && typeof known === "object" && !Array.isArray(known) ? known : {}),
      ...(input && typeof input === "object" && !Array.isArray(input) ? input : {}),
    };
    const parsed: LtmGlobalSettings = ltmGlobalSettingsSchema.parse(merged);
    // Fields from a newer version stay in the file so upgrading again restores them.
    await writeJsonAtomic(path, { ...unknown, ...parsed });
    return getLtmGlobalSettings(root);
  });
}
