/**
 * Saved sets of Slurp prompts. Ported from Noodle's prompt presets, but a Slurp preset holds the
 * two prompts Slurp edits in Settings — generation guidance and the image prompt — together, so
 * switching tone switches both.
 */
export const SLURP_PROMPT_PRESET_LIMIT = 20;
export const SLURP_PROMPT_PRESET_NAME_LIMIT = 60;
export const SLURP_PROMPT_PRESET_TEXT_LIMIT = 20_000;

export type SlurpPromptPreset = {
  name: string;
  generationGuidance: string;
  imageGenerationPrompt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Valid, unique by name (case-insensitive), within the limits. Invalid entries are dropped. */
export function sanitizeSlurpPromptPresets(value: unknown): SlurpPromptPreset[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const presets: SlurpPromptPreset[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === "string" ? item.name.trim().slice(0, SLURP_PROMPT_PRESET_NAME_LIMIT) : "";
    const generationGuidance =
      typeof item.generationGuidance === "string"
        ? item.generationGuidance.slice(0, SLURP_PROMPT_PRESET_TEXT_LIMIT)
        : "";
    const imageGenerationPrompt =
      typeof item.imageGenerationPrompt === "string"
        ? item.imageGenerationPrompt.slice(0, SLURP_PROMPT_PRESET_TEXT_LIMIT)
        : "";
    const normalized = name.toLocaleLowerCase();
    if (!name || (!generationGuidance.trim() && !imageGenerationPrompt.trim()) || seen.has(normalized)) continue;
    seen.add(normalized);
    presets.push({ name, generationGuidance, imageGenerationPrompt });
    if (presets.length >= SLURP_PROMPT_PRESET_LIMIT) break;
  }
  return presets;
}

/** Save a preset first in the list, replacing one with the same name. */
export function mergeSlurpPromptPreset(presets: unknown, preset: SlurpPromptPreset): SlurpPromptPreset[] {
  const name = preset.name.trim().toLocaleLowerCase();
  const others = sanitizeSlurpPromptPresets(presets).filter((item) => item.name.toLocaleLowerCase() !== name);
  return sanitizeSlurpPromptPresets([preset, ...others]);
}

export function exportSlurpPromptPresets(presets: SlurpPromptPreset[]) {
  return { marinaraSlurpPrompts: 1, presets };
}

/** Add imported presets after the existing ones. A clashing name gets a numbered suffix. */
export function importSlurpPromptPresets(
  presets: SlurpPromptPreset[],
  file: unknown,
): { presets: SlurpPromptPreset[]; imported: number } {
  if (!isRecord(file) || file.marinaraSlurpPrompts !== 1) return { presets, imported: 0 };
  const merged = [...presets];
  let imported = 0;
  for (const preset of sanitizeSlurpPromptPresets(file.presets)) {
    if (merged.length >= SLURP_PROMPT_PRESET_LIMIT) break;
    let name = preset.name;
    for (let suffix = 2; merged.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()); suffix++) {
      const suffixText = ` (${suffix})`;
      name = `${preset.name.slice(0, SLURP_PROMPT_PRESET_NAME_LIMIT - suffixText.length)}${suffixText}`;
    }
    merged.push({ ...preset, name });
    imported += 1;
  }
  return { presets: merged, imported };
}
