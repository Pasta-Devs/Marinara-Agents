import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveIllustratorPromptRuntime } from "../generation/illustrator-prompt-runtime.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { loadPrompt, NOODLE_IMAGE_INTERPRET } from "../prompt-overrides/index.js";

const MAX_REWRITTEN_PROMPT_LENGTH = 12_000;
const MAX_INSTRUCTIONS_LENGTH = 5_000;

function parseRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  const text = value
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Rewrite a Noodle image prompt with connection instructions and art-style guidance. */
export async function rewriteNoodleImagePrompt(input: {
  db: DB;
  prompt: string;
  instructions?: string;
  characterContext?: string;
  styleGuidance?: string;
}): Promise<string | null> {
  const instructions = input.instructions?.trim().replace(/\s+/g, " ").slice(0, MAX_INSTRUCTIONS_LENGTH) || "";
  const prompt = input.prompt.trim().slice(0, MAX_REWRITTEN_PROMPT_LENGTH);
  if ((!instructions && !input.styleGuidance?.trim()) || !prompt) return null;
  const characterContext = input.characterContext?.trim().slice(0, 8_000) || "No additional character context was provided.";
  const styleGuidance = input.styleGuidance?.trim().slice(0, 5_000) || "";

  try {
    const connections = createConnectionsStorage(input.db);
    const interpretationInstruction = await loadPrompt(
      createPromptOverridesStorage(input.db),
      NOODLE_IMAGE_INTERPRET,
      {},
    );
    const textConnection =
      (await connections.getDefaultForAgents()) ??
      (await connections.getFallbackForAgents());
    if (!textConnection) return null;

    const runtime = await resolveIllustratorPromptRuntime({
      chatMetadata: {},
      defaultConnection: textConnection,
      defaultConnectionId: textConnection.id,
      connections,
      resolveBaseUrl,
    });
    const result = await runtime.provider.chatComplete(
      [
        {
          role: "system",
          content: [
            "You are an image prompt editor.",
            interpretationInstruction,
            "Preserve the original subject, identity, action, setting, and visual facts unless the instructions explicitly change them.",
            "Use the character context to preserve appearance and personality, but do not add characters who are not in the original prompt.",
            styleGuidance
              ? "Apply the supplied art-style guidance when the original prompt does not specify a style. Preserve an explicitly requested style in the original prompt or user instructions."
              : "",
            "Treat the user's instructions as guidance, not text to copy into the image prompt.",
            "Return valid JSON only: {\"prompt\":\"provider-ready image prompt\"}.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "<original_image_prompt>",
            prompt,
            "</original_image_prompt>",
            "<character_context>",
            characterContext,
            "</character_context>",
            ...(instructions ? ["<image_prompting_instructions>", instructions, "</image_prompting_instructions>"] : []),
            ...(styleGuidance ? ["<art_style_guidance>", styleGuidance, "</art_style_guidance>"] : []),
          ].join("\n"),
        },
      ],
      {
        model: runtime.model,
        ...(runtime.suppressModelParameters ? {} : { temperature: 0.3, maxTokens: 2_048 }),
        suppressModelParameters: runtime.suppressModelParameters,
        enableCaching: runtime.enableCaching,
        anthropicExtendedCacheTtl: runtime.anthropicExtendedCacheTtl,
      },
    );
    const parsed = parseRecord(result.content);
    const rewritten = typeof parsed.prompt === "string"
      ? parsed.prompt.trim().slice(0, MAX_REWRITTEN_PROMPT_LENGTH)
      : "";
    return rewritten || null;
  } catch (error) {
    logger.warn(error, "[noodle] Image prompt instruction rewrite failed; using the original prompt");
    return null;
  }
}
