import {
  GAME_STORYBOARD_IMAGE_BUILT_IN_PROMPT_TEMPLATES,
  GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_ID,
  normalizeAgentPromptTemplateOptions,
  type AgentPromptTemplateOption,
} from "@marinara-engine/shared";
import {
  GAME_SCENE_ILLUSTRATION,
  renderTemplate,
  type GameSceneIllustrationCtx,
} from "../prompt-overrides/index.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { logger } from "../../lib/logger.js";

const GAME_STORYBOARD_IMAGE_BUILT_IN_PROMPT_TEMPLATE_IDS = new Set(
  GAME_STORYBOARD_IMAGE_BUILT_IN_PROMPT_TEMPLATES.map((template) => template.id),
);

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ensureUniqueStoryboardImagePromptTemplateId(id: string, usedIds: Set<string>): string {
  const fallback = "custom-storyboard-image-prompt";
  const base =
    id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/(^-|-$)/g, "") || fallback;
  let candidate = base;
  let attempt = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${attempt}`;
    attempt++;
  }
  usedIds.add(candidate);
  return candidate;
}

export function normalizeGameStoryboardImagePromptTemplates(value: unknown): AgentPromptTemplateOption[] {
  const usedIds = new Set(GAME_STORYBOARD_IMAGE_BUILT_IN_PROMPT_TEMPLATE_IDS);
  return normalizeAgentPromptTemplateOptions(value)
    .map((template) => ({
      ...template,
      id: ensureUniqueStoryboardImagePromptTemplateId(template.id, usedIds),
    }))
    .slice(0, 20);
}

function renderSelectedStoryboardImagePrompt(
  template: AgentPromptTemplateOption | undefined,
  ctx: GameSceneIllustrationCtx,
): string {
  if (!template?.promptTemplate.trim()) return GAME_SCENE_ILLUSTRATION.defaultBuilder(ctx);
  const declared = GAME_SCENE_ILLUSTRATION.variables.map((variable) => variable.name);
  return renderTemplate(template.promptTemplate, ctx, declared);
}

async function loadStoredSceneIllustrationOverride(
  promptOverridesStorage: PromptOverridesStorage,
  ctx: GameSceneIllustrationCtx,
): Promise<string | null> {
  const declared = GAME_SCENE_ILLUSTRATION.variables.map((variable) => variable.name);
  try {
    const row = await promptOverridesStorage.get(GAME_SCENE_ILLUSTRATION.key);
    if (!row) return null;
    return row.enabled ? renderTemplate(row.template, ctx, declared) : null;
  } catch (error) {
    logger.warn(error, "[game-storyboard-image] Failed to load stored scene illustration override");
    return null;
  }
}

export async function loadGameStoryboardImagePrompt(args: {
  promptOverridesStorage?: PromptOverridesStorage;
  templateId?: string | null;
  customTemplates?: unknown;
  ctx: GameSceneIllustrationCtx;
}): Promise<string> {
  const options = [
    ...GAME_STORYBOARD_IMAGE_BUILT_IN_PROMPT_TEMPLATES,
    ...normalizeGameStoryboardImagePromptTemplates(args.customTemplates),
  ];
  const selectedId = readTrimmedString(args.templateId);
  const selectedTemplate = selectedId ? options.find((template) => template.id === selectedId) : undefined;

  if (selectedTemplate) return renderSelectedStoryboardImagePrompt(selectedTemplate, args.ctx);

  if (args.promptOverridesStorage) {
    const storedOverride = await loadStoredSceneIllustrationOverride(args.promptOverridesStorage, args.ctx);
    if (storedOverride) return storedOverride;
  }

  return renderSelectedStoryboardImagePrompt(
    options.find((template) => template.id === GAME_STORYBOARD_IMAGE_PROMPT_TEMPLATE_ID),
    args.ctx,
  );
}
