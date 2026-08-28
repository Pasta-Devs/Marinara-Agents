function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1]?.trim() || trimmed;
}

/** Select only the visual prompt that can be sent to an image provider. */
export function selectNoodleImageProviderPrompt(input: {
  rewrittenPrompt: string | null | undefined;
  rawPrompt: string;
  privateContext?: ReadonlyArray<string | null | undefined>;
}): string {
  const rewrittenPrompt = input.rewrittenPrompt?.trim();
  if (!rewrittenPrompt) return input.rawPrompt;

  const normalizedPrompt = rewrittenPrompt.toLocaleLowerCase().replace(/\s+/gu, " ");
  const hasInternalMarker =
    /(?:^|[\n<])\s*(?:user[ _]image[ _]instructions|image[ _]prompting[ _]instructions|generation[ _]guidance|personality|character[ _]image[ _]preferences|character[ _]context|art[ _]style[ _]guidance|post[ _]text)\s*[:>]/iu.test(
      rewrittenPrompt,
    );
  const copiesPrivateContext = input.privateContext?.some((value) => {
    const normalizedValue = value?.trim().toLocaleLowerCase().replace(/\s+/gu, " ");
    return normalizedValue && normalizedValue.length > 1 && normalizedPrompt.includes(normalizedValue);
  });

  return hasInternalMarker || copiesPrivateContext ? input.rawPrompt : rewrittenPrompt;
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
