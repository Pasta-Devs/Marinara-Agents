import {
  DEFAULT_LTM_EXTRACTION_EXISTING_NOTE_MAX_CHUNKS,
  DEFAULT_LTM_EXTRACTION_EXISTING_NOTE_MAX_TOKENS,
  DEFAULT_LTM_EXTRACTION_MAX_EXISTING_NOTE_TOKENS,
  DEFAULT_LTM_EXTRACTION_MAX_SOURCE_TOKENS,
  DEFAULT_LTM_EXTRACTION_MAX_TOKENS,
  DEFAULT_LTM_EXTRACTION_PROMPT,
  DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE,
  DEFAULT_LTM_EXTRACTION_REASONING_EFFORT,
  DEFAULT_LTM_EXTRACTION_TEMPERATURE,
  DEFAULT_LTM_EXTRACTION_VERBOSITY,
} from "../../../../shared/src/features/agents/long-term-memory/constants.js";
import {
  ltmExtractionSettingsPatchSchema,
  ltmExtractionSettingsSchema,
  ltmResolvedExtractionSettingsSchema,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { withLtmVaultLock } from "./vault-lock.js";
export const DEFAULT_LTM_EXTRACTION_CONFIG = ltmResolvedExtractionSettingsSchema.parse({
  version: 1,
  connectionId: null,
  systemPrompt: DEFAULT_LTM_EXTRACTION_PROMPT,
  reasoningEffort: DEFAULT_LTM_EXTRACTION_REASONING_EFFORT,
  verbosity: DEFAULT_LTM_EXTRACTION_VERBOSITY,
  maxOutputTokens: DEFAULT_LTM_EXTRACTION_MAX_TOKENS,
  temperature: DEFAULT_LTM_EXTRACTION_TEMPERATURE,
  maxSourceTokens: DEFAULT_LTM_EXTRACTION_MAX_SOURCE_TOKENS,
  maxExistingNoteTokens: DEFAULT_LTM_EXTRACTION_MAX_EXISTING_NOTE_TOKENS,
  existingNoteMaxChunks: DEFAULT_LTM_EXTRACTION_EXISTING_NOTE_MAX_CHUNKS,
  existingNoteMaxTokens: DEFAULT_LTM_EXTRACTION_EXISTING_NOTE_MAX_TOKENS,
  promptTemplates: [],
  activePromptTemplateId: null,
  activePromptTemplateIdsByMode: {},
  aiKeywordExtraction: false,
  useExtractionAgentOnGameMode: false,
});
export const ltmExtractionConfigPath = (root = getLongTermMemoryRoot()) =>
  safeJoin(getLongTermMemoryDirectories(root).config, "extraction.json");
export async function getLtmExtractionConfig(root = getLongTermMemoryRoot(), mode?: string) {
  const parsed = ltmExtractionSettingsSchema.parse(
    await readJsonFile<unknown>(ltmExtractionConfigPath(root), { version: 1 }),
  );
  const resolved = ltmResolvedExtractionSettingsSchema.parse({
    ...DEFAULT_LTM_EXTRACTION_CONFIG,
    ...parsed,
    version: 1,
  });
  if (!mode) return resolved;
  const templateId =
    resolved.activePromptTemplateIdsByMode[mode as keyof typeof resolved.activePromptTemplateIdsByMode];
  if (templateId) {
    const template = resolved.promptTemplates.find((t) => t.id === templateId);
    if (template)
      return {
        ...resolved,
        systemPrompt: template.prompt,
        activePromptTemplateId: templateId,
      };
  }
  const fallbackPrompt =
    DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE[mode as keyof typeof DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE] ??
    DEFAULT_LTM_EXTRACTION_PROMPT;
  return {
    ...resolved,
    systemPrompt: fallbackPrompt,
    activePromptTemplateId: null,
  };
}
export async function updateLtmExtractionConfig(input: unknown, root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const stored = ltmExtractionSettingsSchema.parse(
      await readJsonFile<unknown>(ltmExtractionConfigPath(root), {
        version: 1,
      }),
    );
    const patch = ltmExtractionSettingsPatchSchema.parse(input ?? {});
    const activePromptTemplateIdsByMode = {
      ...(stored.activePromptTemplateIdsByMode ?? {}),
      ...(patch.activePromptTemplateIdsByMode ?? {}),
    };
    const merged = ltmExtractionSettingsSchema.parse({
      ...stored,
      ...patch,
      version: 1,
      activePromptTemplateIdsByMode,
    });
    // Persist a complete validated configuration so omitted patch fields are never lost.
    const resolved = ltmResolvedExtractionSettingsSchema.parse({
      ...DEFAULT_LTM_EXTRACTION_CONFIG,
      ...merged,
      version: 1,
    });
    const { systemPrompt: _systemPrompt, activePromptTemplateId: _activePromptTemplateId, ...persisted } = resolved;
    await writeJsonAtomic(ltmExtractionConfigPath(root), ltmExtractionSettingsSchema.parse(persisted));
    return getLtmExtractionConfig(root);
  });
}
