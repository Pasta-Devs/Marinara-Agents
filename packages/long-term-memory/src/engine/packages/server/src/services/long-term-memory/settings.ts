import {
  DEFAULT_LTM_GLOBAL_SETTINGS,
  ltmGlobalSettingsSchema,
  ltmResolvedGlobalSettingsSchema,
  type LtmGlobalSettings,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { withLtmVaultLock } from "./vault-lock.js";
export const ltmSettingsPath = (root = getLongTermMemoryRoot()) =>
  safeJoin(getLongTermMemoryDirectories(root).config, "settings.json");
export async function getLtmGlobalSettings(root = getLongTermMemoryRoot()) {
  const value = ltmGlobalSettingsSchema.parse(await readJsonFile<unknown>(ltmSettingsPath(root), { version: 1 }));
  return ltmResolvedGlobalSettingsSchema.parse({ ...DEFAULT_LTM_GLOBAL_SETTINGS, ...value, version: 1 });
}
export async function updateLtmGlobalSettings(input: unknown, root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const existing = await readJsonFile<Record<string, unknown>>(ltmSettingsPath(root), { version: 1 });
    const merged = {
      ...(existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}),
      ...(input && typeof input === "object" && !Array.isArray(input) ? input : {}),
    };
    const parsed: LtmGlobalSettings = ltmGlobalSettingsSchema.parse(merged);
    await writeJsonAtomic(ltmSettingsPath(root), parsed);
    return getLtmGlobalSettings(root);
  });
}
