import {
  compileImagePrompt,
  DEFAULT_IMAGE_STYLE_PROFILES,
  resolveImageStyleGuidanceText,
  type CompileImagePromptInput,
} from "@marinara-engine/shared";

// The built-in Auto profile's Style text asks a prompt writer to infer a style, so it is never words
// for the image model (Pasta-Devs/Marinara-Engine#7342). Style text a user writes into Auto or a copy
// of it still applies. The vendored shared compiler predates that Engine fix, so Noodle applies it here.
const AUTO_STYLE_INSTRUCTION =
  DEFAULT_IMAGE_STYLE_PROFILES.find((profile) => profile.id === "auto")?.styleText.trim() ?? "";

/**
 * Compile a post image prompt so Style text meant for a prompt writer stays out of the words sent to
 * the image model (Pasta-Devs/Marinara-Agents#1278). `styleGuidance` is the Style text the rewrite
 * model gets as guidance, so `forRewrite` leaves it out of the prompt that model edits. `rewritePrompt`
 * is the source of that prompt when it differs from `input.prompt`, for example without the appearance
 * notes the rewrite model gets as context (Pasta-Devs/Marinara-Agents#1282). `literal` is sent when no
 * rewrite runs or it fails: it keeps a style profile's Style text, as the Engine does when no prompt
 * writer handled the style, but never the built-in Auto instruction.
 */
export function compileNoodleImagePrompts(input: CompileImagePromptInput, rewritePrompt = input.prompt) {
  const styled = compileImagePrompt(input);
  const styleGuidance = resolveImageStyleGuidanceText(input.styleProfiles, styled.profile.id);
  const autoInstruction =
    styled.profile.baseStyle === "auto" && styled.profile.styleText.trim() === AUTO_STYLE_INSTRUCTION;
  const literal = autoInstruction ? compileImagePrompt({ ...input, omitProfileStyleText: true }) : styled;
  const forRewrite =
    !styleGuidance && rewritePrompt === input.prompt
      ? literal
      : compileImagePrompt({
          ...input,
          prompt: rewritePrompt,
          omitProfileStyleText: Boolean(styleGuidance) || autoInstruction || input.omitProfileStyleText,
        });
  return { styleGuidance, literal, forRewrite };
}

/**
 * Remove each sentence of `guidance` that the rewrite model copied word for word into `text`
 * (Pasta-Devs/Marinara-Agents#1282). Only sentences with at least four words between commas count,
 * so a tag list such as "masterpiece, best quality" that a user wants in the prompt is never removed.
 * ponytail: package-owned copy of the Engine's `removeCopiedPromptGuidance`
 * (Pasta-Devs/Marinara-Engine#7357); the vendored shared dist is frozen, so keep the two in step.
 */
export function removeCopiedPromptGuidance(text: string, guidance: ReadonlyArray<string | null | undefined>): string {
  let result = text;
  for (const sentence of guidance.flatMap((value) => (value ?? "").split(/[.!?](?=\s|$)|\n+/u))) {
    const isProse = sentence.split(/[,;:]/u).some((part) => (part.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) >= 4);
    if (!isProse) continue;
    const words = sentence.match(/[\p{L}\p{N}]+/gu) ?? [];
    const copy = new RegExp(`(?<![\\p{L}\\p{N}])${words.join("[^\\p{L}\\p{N}]+")}(?![\\p{L}\\p{N}])[.!?]?`, "giu");
    result = result.replace(copy, "");
  }
  if (result === text) return text;
  return result
    .split("\n")
    .map((line) =>
      line
        .replace(/\s*[,;](?:\s*[,;])+/gu, ",")
        .replace(/^[\s,;]+|[\s,;]+$/gu, "")
        .replace(/ {2,}/gu, " "),
    )
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1]?.trim() || trimmed;
}

/**
 * Recover the visual idea when a weaker timeline model wraps imagePrompt in
 * JSON or repeats Marinara's legacy prompt-assembly labels inside the field.
 */
export function normalizeNoodleImagePrompt(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const candidate = stripCodeFence(value);

  if (candidate.startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      for (const key of ["imagePrompt", "image_prompt", "prompt", "draftPrompt"]) {
        const nested = parsed[key];
        if (typeof nested === "string" && nested.trim() && nested.trim() !== candidate) {
          return normalizeNoodleImagePrompt(nested);
        }
      }
      return null;
    } catch {
      // Keep the original text when it only happens to begin with a brace.
    }
  }

  const legacyMarker = /(?:^|\n)\s*(?:draft image idea|image prompt)\s*:\s*/iu.exec(candidate);
  if (legacyMarker?.index !== undefined) {
    const visualStart = legacyMarker.index + legacyMarker[0].length;
    const visualTail = candidate.slice(visualStart);
    const nextMetadata = visualTail.search(
      /\n\s*(?:user instructions|character appearance notes|post text|output only)\s*:/iu,
    );
    const recovered = (nextMetadata >= 0 ? visualTail.slice(0, nextMetadata) : visualTail).trim();
    if (recovered) return recovered;
  }

  return candidate;
}
