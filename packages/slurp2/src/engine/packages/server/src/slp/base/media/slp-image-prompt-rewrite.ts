import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { resolveIllustratorPromptRuntime } from "../../../services/generation/illustrator-prompt-runtime.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { loadPrompt, NOODLE_IMAGE_INTERPRET } from "../../../services/prompt-overrides/index.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "../prompting/slp-prompt-blocks.js";
import type { SlurpVisualBrief } from "./slp-visual-brief.js";
import { slurpVisualBriefPolicyText, slurpVisualBriefText } from "./slp-visual-brief.js";
import { resolveSlurpTextConnection } from "../identity/slp-connection.js";

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
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Rewrite a Noodle image prompt with connection instructions and art-style guidance. */
export async function rewriteSlpImagePrompt(input: {
  db: DB;
  prompt: string;
  postContent?: string;
  visualBrief?: SlurpVisualBrief;
  interpretationInstruction?: string;
  instructions?: string;
  characterContext?: string;
  styleGuidance?: string;
  promptBlocks?: SlurpPromptBlockOverrides;
  /**
   * Slurp's own generation connection. Without it the rewrite ran on the Engine's agent default,
   * which could be a reasoning model that spent the whole token budget thinking and returned
   * nothing — every picture fell back, while the connection the player chose for Slurp sat unused.
   */
  connectionId?: string | null;
}): Promise<string | null> {
  const instructions = input.instructions?.trim().replace(/\s+/g, " ").slice(0, MAX_INSTRUCTIONS_LENGTH) || "";
  const prompt = input.prompt.trim().slice(0, MAX_REWRITTEN_PROMPT_LENGTH);
  if ((!instructions && !input.characterContext?.trim() && !input.styleGuidance?.trim()) || !prompt) return null;
  const characterContext =
    input.characterContext?.trim().slice(0, 8_000) || "No additional character context was provided.";
  const postContext = input.postContent?.trim().slice(0, 4_000) || "No post caption was provided.";
  const visualBrief = input.visualBrief
    ? slurpVisualBriefText(input.visualBrief)
    : "No typed visual brief was provided.";
  const visualPolicy = input.visualBrief ? slurpVisualBriefPolicyText(input.visualBrief) : "";
  const styleGuidance = input.styleGuidance?.trim().slice(0, 5_000) || "";

  try {
    const connections = createConnectionsStorage(input.db);
    const interpretationInstruction =
      input.interpretationInstruction?.trim() ||
      (await loadPrompt(createPromptOverridesStorage(input.db), NOODLE_IMAGE_INTERPRET, {}));
    const textConnection = await resolveSlurpTextConnection(connections, input.connectionId);
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
          content: composeSlurpPromptBlocks(
            "imageInterpretation",
            [
              { id: "task", kind: "editable", text: "You are an image prompt editor." },
              { id: "style", kind: "editable", text: interpretationInstruction },
              {
                id: "safety",
                kind: "required",
                text: "Preserve the original subject, identity, action, setting, and visual facts unless the instructions explicitly change them. Use the character context to preserve appearance and personality, but do not add characters who are not in the original prompt.",
              },
              {
                id: "output",
                kind: "required",
                text: [
                  "Order the result: first any leading quality or style tag block from the original prompt, verbatim and in the same order; then the character's appearance, copied word for word from the character context and written only once; then the scene: outfit, pose, expression, action, setting, lighting, camera, and mood.",
                  "Never add, remove, reword, or reorder quality, score, safety, resolution, or artist tags.",
                  'Never copy labels or field names such as "Appearance:", "Personality:", or "Style:" into the image prompt.',
                  "When the original prompt is comma-separated tags, write the whole result as comma-separated tags.",
                  styleGuidance
                    ? "Apply the supplied art-style guidance when the original prompt does not specify a style. Preserve an explicitly requested style in the original prompt or user instructions."
                    : "",
                  "Treat the user's instructions as guidance, not text to copy into the image prompt.",
                  "The post context describes the same moment. Preserve its action and setting when they are present in the draft. A caption can be a hook, so do not copy its wording or force every caption detail into the image.",
                  "Do not increase the sexual intensity. Keep an ordinary or non-sexual post ordinary and non-sexual. Add nudity, explicit anatomy, or sexual activity only when the original prompt or an explicit trusted instruction already requires it.",
                  visualPolicy,
                  'Return valid JSON only: {"prompt":"provider-ready image prompt"}.',
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
              { id: "draft", kind: "context", text: "" },
            ],
            input.promptBlocks,
          ),
        },
        {
          role: "user",
          content: [
            "<original_image_prompt>",
            prompt,
            "</original_image_prompt>",
            "<post_context>",
            postContext,
            "</post_context>",
            "<visual_brief>",
            visualBrief,
            "</visual_brief>",
            "<character_context>",
            characterContext,
            "</character_context>",
            ...(instructions
              ? ["<image_prompting_instructions>", instructions, "</image_prompting_instructions>"]
              : []),
            ...(styleGuidance ? ["<art_style_guidance>", styleGuidance, "</art_style_guidance>"] : []),
          ].join("\n"),
        },
      ],
      {
        model: runtime.model,
        // Headroom for reasoning connections: 2048 was spent entirely on thinking, with no answer.
        ...(runtime.suppressModelParameters ? {} : { temperature: 0.3, maxTokens: 4_096 }),
        suppressModelParameters: runtime.suppressModelParameters,
        enableCaching: runtime.enableCaching,
        anthropicExtendedCacheTtl: runtime.anthropicExtendedCacheTtl,
      },
    );
    const parsed = parseRecord(result.content);
    // The default interpretation instruction says "return only the prompt", so a model that obeys it
    // answers in plain text. That is a usable prompt, not a failure.
    const plain = typeof result.content === "string" && !result.content.includes("{") ? result.content.trim() : "";
    const rewritten = (typeof parsed.prompt === "string" ? parsed.prompt.trim() : plain).slice(
      0,
      MAX_REWRITTEN_PROMPT_LENGTH,
    );
    if (!rewritten) logger.warn("[slurp] Image prompt rewrite returned no prompt (empty or truncated answer)");
    return rewritten || null;
  } catch (error) {
    logger.warn(error, "[slurp] Image prompt instruction rewrite failed; using the original prompt");
    return null;
  }
}
