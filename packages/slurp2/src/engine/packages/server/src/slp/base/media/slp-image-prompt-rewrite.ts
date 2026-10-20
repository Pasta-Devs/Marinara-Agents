import type { APIProvider } from "@marinara-engine/shared";
import { resolveStoredMaxTokens } from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import type { DB } from "../../../db/connection.js";
import type { ChatMessage } from "../../../services/llm/base-provider.js";
import { logger } from "../../../lib/logger.js";
import { jsonishLooksTruncated, parseGameJsonish } from "../../../services/game/jsonish.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { resolveIllustratorPromptRuntime } from "../../../services/generation/illustrator-prompt-runtime.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { loadPrompt, NOODLE_IMAGE_INTERPRET } from "../../../services/prompt-overrides/index.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "../prompting/slp-prompt-blocks.js";
import type { SlurpVisualBrief } from "./slp-visual-brief.js";
import { slurpVisualBriefPolicyText, slurpVisualBriefText } from "./slp-visual-brief.js";
import { resolveSlurpTextConnection } from "../identity/slp-connection.js";
import { requireModelAnswer } from "../model/slp-model-answer.js";
import { claimSlurpModelBudget, type SlurpModelBudget } from "../model/slp-model-worker.js";

const MAX_REWRITTEN_PROMPT_LENGTH = 12_000;
const MAX_INSTRUCTIONS_LENGTH = 5_000;

/** The model's answer as a prompt, or why it is not one (for the fallback warning). */
function readRewrittenPrompt(value: unknown): { prompt: string } | { failure: string } {
  if (typeof value !== "string" || !value.trim()) {
    return {
      failure:
        "the model answered with an empty response (a reasoning model may have spent its whole output-token limit thinking; raise the connection's max tokens)",
    };
  }
  // The default interpretation instruction says "return only the prompt", so a model that obeys it
  // answers in plain text. That is a usable prompt, not a failure.
  if (!value.includes("{")) return { prompt: value.trim().slice(0, MAX_REWRITTEN_PROMPT_LENGTH) };
  // Engine's tolerant parser, as every other Slurp model call: a strict JSON.parse dropped answers
  // with a line break inside the prompt, a trailing comma, or prose around the fenced object. A cut
  // answer stays a failure, because the repair would send half a picture.
  if (jsonishLooksTruncated(value)) {
    return {
      failure: `the answer looks cut off after ${value.length} characters (raise the connection's max output tokens): ${preview(value, -120)}`,
    };
  }
  let parsed: unknown;
  try {
    parsed = parseGameJsonish(requireModelAnswer(value, "an image prompt rewrite"));
  } catch (error) {
    return {
      failure: `the answer is not valid JSON (${error instanceof Error ? error.message : String(error)}): ${preview(value, 160)}`,
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { failure: `the answer is JSON but not an object: ${preview(value, 160)}` };
  }
  const prompt = (parsed as Record<string, unknown>).prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return {
      failure: `the JSON answer has no "prompt" text (keys: ${Object.keys(parsed).join(", ") || "none"}): ${preview(value, 160)}`,
    };
  }
  return { prompt: prompt.trim().slice(0, MAX_REWRITTEN_PROMPT_LENGTH) };
}

/** A short one-line quote of the answer: the start, or with a negative length the end. */
function preview(content: string, length: number): string {
  const flat = content.replace(/\s+/gu, " ").trim();
  if (flat.length <= Math.abs(length)) return JSON.stringify(flat);
  return JSON.stringify(length < 0 ? `…${flat.slice(length)}` : `${flat.slice(0, length)}…`);
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
  /**
   * Slurp's viewpoint phrase for this picture ("selfie, arm extended toward the viewer …"). Kept word
   * for word: the rewrite used to write "facing the camera, static shot from a tripod", and weak image
   * models draw the camera and the tripod.
   */
  viewpoint?: string | null;
  /**
   * Slurp's AI budget: the rewrite is one call under "Image prompt enhancing". Over its daily limit,
   * or with the budget mode "Off", the picture goes out with the unenhanced draft. Absent (tests),
   * nothing is counted.
   */
  budget?: SlurpModelBudget;
  /**
   * The budget refused the call. That is the player's setting, not a failed rewrite: the caller
   * sends the draft as with enhancing off, uncapped and without a warning.
   */
  onBudgetSkip?: () => void;
  /** Why an attempted rewrite returned nothing, so the fallback warning can say what failed. */
  onFailure?: (reason: string) => void;
  /** Receives the connection, model, and chat actually sent, for the Creator-private Deep details. */
  onRequest?: (request: {
    connectionId: string;
    connectionName: string | null;
    model: string;
    messages: { role: string; content: string }[];
  }) => void;
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
    if (!textConnection) {
      input.onFailure?.(
        "no text connection: the Slurp generation connection, the agent default and the default connection are all unset or not text models",
      );
      return null;
    }
    if (input.budget && !(await claimSlurpModelBudget(input.db, input.budget, "image_prompt"))) {
      logger.info("[slurp] Image prompt enhancing is off or over its daily limit; sending the unenhanced draft");
      input.onBudgetSkip?.();
      return null;
    }

    const runtime = await resolveIllustratorPromptRuntime({
      chatMetadata: {},
      defaultConnection: textConnection,
      defaultConnectionId: textConnection.id,
      connections,
      resolveBaseUrl,
    });
    const messages: ChatMessage[] = [
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
                "Order the result: first any leading quality or style tag block from the original prompt, verbatim and in the same order; then the character's appearance, copied word for word from the character context and written only once; then the scene: outfit, pose, expression, action, setting, lighting, viewpoint, and mood.",
                input.viewpoint?.trim()
                  ? `Keep this viewpoint phrase word for word, once: "${input.viewpoint.trim()}".`
                  : "",
                `${input.viewpoint?.trim() ? "Outside that phrase, never" : "Never"} name a camera, phone, lens, tripod, timer, or photographer: image models draw every object they read. Write where the viewer is ("seen from slightly above", "looking at the viewer") instead.`,
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
          ...(instructions ? ["<image_prompting_instructions>", instructions, "</image_prompting_instructions>"] : []),
          ...(styleGuidance ? ["<art_style_guidance>", styleGuidance, "</art_style_guidance>"] : []),
        ].join("\n"),
      },
    ];
    input.onRequest?.({
      connectionId: runtime.connectionId,
      connectionName: runtime.connectionId === textConnection.id ? (textConnection.name ?? null) : null,
      model: String(runtime.model ?? ""),
      messages: messages.map((message) => ({ role: message.role, content: String(message.content) })),
    });
    // A larger max-tokens setting on the connection raises the default; a smaller one never starves the answer.
    const maxTokens = clampGenerationMaxOutputTokens({
      provider: textConnection.provider as APIProvider,
      model: textConnection.model,
      maxTokens: Math.max(resolveStoredMaxTokens(textConnection.defaultParameters, 4_096), 4_096),
      maxTokensOverride: textConnection.maxTokensOverride,
    });
    const result = await runtime.provider.chatComplete(messages, {
      model: runtime.model,
      // Headroom for reasoning connections: 2048 was spent entirely on thinking, with no answer.
      ...(runtime.suppressModelParameters ? {} : { temperature: 0.3, maxTokens }),
      suppressModelParameters: runtime.suppressModelParameters,
      enableCaching: runtime.enableCaching,
      anthropicExtendedCacheTtl: runtime.anthropicExtendedCacheTtl,
    });
    const answer = readRewrittenPrompt(result.content);
    if ("failure" in answer) {
      input.onFailure?.(
        `${answer.failure} [model ${String(runtime.model ?? "unknown")}, max output tokens ${runtime.suppressModelParameters ? "provider default" : maxTokens}]`,
      );
      return null;
    }
    return answer.prompt;
  } catch (error) {
    logger.warn(error, "[slurp] Image prompt instruction rewrite failed; using the original prompt");
    input.onFailure?.(`the request failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
