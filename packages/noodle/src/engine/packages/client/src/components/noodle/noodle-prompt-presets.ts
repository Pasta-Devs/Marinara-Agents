export const NOODLE_PROMPT_PRESET_KEY = "noodle.timelineBase";
export const NOODLE_PROMPT_PRESET_LIMIT = 20;
export const NOODLE_PROMPT_PRESET_NAME_LIMIT = 60;
export const NOODLE_PROMPT_PRESET_TEMPLATE_LIMIT = 20_000;

export type NoodlePromptPreset = {
  name: string;
  key: typeof NOODLE_PROMPT_PRESET_KEY;
  template: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeNoodlePromptPresets(value: unknown): NoodlePromptPreset[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const presets: NoodlePromptPreset[] = [];
  for (const item of value) {
    if (!isRecord(item) || item.key !== NOODLE_PROMPT_PRESET_KEY) continue;
    const name = typeof item.name === "string" ? item.name.trim().slice(0, NOODLE_PROMPT_PRESET_NAME_LIMIT) : "";
    const template =
      typeof item.template === "string" ? item.template.trim().slice(0, NOODLE_PROMPT_PRESET_TEMPLATE_LIMIT) : "";
    const normalized = name.toLocaleLowerCase();
    if (!name || !template || seen.has(normalized)) continue;
    seen.add(normalized);
    presets.push({ name, key: NOODLE_PROMPT_PRESET_KEY, template });
    if (presets.length >= NOODLE_PROMPT_PRESET_LIMIT) break;
  }
  return presets;
}

export function mergeNoodlePromptPreset(
  presets: unknown,
  input: Pick<NoodlePromptPreset, "name" | "template">,
): NoodlePromptPreset[] {
  const current = sanitizeNoodlePromptPresets(presets);
  const name = input.name.trim().slice(0, NOODLE_PROMPT_PRESET_NAME_LIMIT);
  const template = input.template.trim().slice(0, NOODLE_PROMPT_PRESET_TEMPLATE_LIMIT);
  if (!name || !template) return current;
  const withoutName = current.filter((preset) => preset.name.toLocaleLowerCase() !== name.toLocaleLowerCase());
  return sanitizeNoodlePromptPresets([{ name, key: NOODLE_PROMPT_PRESET_KEY, template }, ...withoutName]);
}

export function parseNoodlePromptPresetImport(value: unknown): NoodlePromptPreset[] {
  if (!isRecord(value) || value.marinaraNoodlePrompts !== 1) return [];
  return sanitizeNoodlePromptPresets(value.presets);
}
