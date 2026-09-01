function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1]?.trim() || trimmed;
}

// User-authored image guidance is meant to shape the picture, so a short entry — an "Image
// generation instructions" field reading `anime style` — appears verbatim in any prompt that honours
// it. Matching those rejected every correctly rewritten prompt and sent the styleless draft instead,
// so guidance only counts as leaked once it arrives as a copied prose block.
// ponytail: length floor, not a structural check. If guidance ever leaks as a short value, give the
// callers a labelled block and extend `hasInternalMarker` rather than lowering this.
const MIN_GUIDANCE_BLOCK_LENGTH = 40;

/** Select only the visual prompt that can be sent to an image provider. */
export function selectNoodleImageProviderPrompt(input: {
  rewrittenPrompt: string | null | undefined;
  rawPrompt: string;
  /** Never belongs in a visual prompt at any length, so it is matched whole. */
  privateContext?: ReadonlyArray<string | null | undefined>;
  /** Authored to steer the image, so only a copied block counts as a leak. */
  guidanceContext?: ReadonlyArray<string | null | undefined>;
}): string {
  const rewrittenPrompt = input.rewrittenPrompt?.trim();
  if (!rewrittenPrompt) return input.rawPrompt;

  const normalizedPrompt = rewrittenPrompt.toLocaleLowerCase().replace(/\s+/gu, " ");
  const hasInternalMarker =
    /(?:^|[\n<])\s*(?:user[ _]image[ _]instructions|image[ _]prompting[ _]instructions|generation[ _]guidance|personality|character[ _]image[ _]preferences|character[ _]context|art[ _]style[ _]guidance|post[ _]text)\s*[:>]/iu.test(
      rewrittenPrompt,
    );
  const copies = (values: ReadonlyArray<string | null | undefined> | undefined, minLength: number) =>
    values?.some((value) => {
      const normalizedValue = value?.trim().toLocaleLowerCase().replace(/\s+/gu, " ");
      return normalizedValue && normalizedValue.length >= minLength && normalizedPrompt.includes(normalizedValue);
    });

  const copiesPrivateContext = copies(input.privateContext, 2);
  const copiesGuidance = copies(input.guidanceContext, MIN_GUIDANCE_BLOCK_LENGTH);

  return hasInternalMarker || copiesPrivateContext || copiesGuidance ? input.rawPrompt : rewrittenPrompt;
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
