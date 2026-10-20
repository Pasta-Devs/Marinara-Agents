import { createHash } from "node:crypto";
import type {
  SlpAccount,
  SlpAppearanceProfile,
  SlpAppearanceProfileMode,
  SlpCreatorSourceSnapshot,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { slpResolveCardMacros } from "../../base/prompting/slp-prompt-safety.js";

/** A Creator still points at its card when its public account has been removed or hidden. */
export function appearanceSourceAccount(account: SlpAccount, linkedAccount?: SlpAccount | null): SlpAccount {
  return linkedAccount ?? account;
}

export type SlpAppearanceEvidence = {
  sourceEntityId: string;
  sourceRevisionToken: string;
  sourceAppearance?: string | null;
  description?: string | null;
  avatarAvailable?: boolean;
};

export type SlpAppearanceResolution = {
  text: string | null;
  profile: SlpAppearanceProfile | null;
  needsReview: boolean;
  missing: boolean;
};

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function appearanceEvidenceFromSource(
  source: SlpCreatorSourceSnapshot,
  sourceEntityId: string,
): SlpAppearanceEvidence {
  return {
    sourceEntityId,
    sourceRevisionToken: appearanceSourceFingerprint(sourceEntityId, source),
    // The card's own appearance goes straight into picture prompts, so its macros are resolved here.
    sourceAppearance: slpResolveCardMacros(source.appearance, source.name),
    description: source.description,
  };
}

/**
 * The image tags a card keeps for image models (the Engine's "Image Appearance Override"), or "" when
 * the card has it switched off or empty. A character stores the flag as a boolean in `extensions`; a
 * persona row stores it as the text "true". Cut to the length a Creator appearance can hold, and
 * trimmed again after the cut: saving trims too, and the button hides only when both texts are equal.
 */
export function slpCardImageAppearance(card: { imageAppearanceEnabled?: unknown; imageAppearance?: unknown }): string {
  const enabled = card.imageAppearanceEnabled === true || card.imageAppearanceEnabled === "true";
  return enabled && typeof card.imageAppearance === "string"
    ? card.imageAppearance.trim().slice(0, 2000).trimEnd()
    : "";
}

/** Persisted cache keys must survive Engine restarts, unlike stage-draft HMAC tokens. */
export function appearanceSourceFingerprint(sourceEntityId: string, source: SlpCreatorSourceSnapshot): string {
  return createHash("sha256")
    .update(JSON.stringify([sourceEntityId, source.appearance, source.description, source.scenario, source.backstory]))
    .digest("hex");
}

export function resolveSlpAppearanceProfile(input: {
  stageAppearance?: string | null;
  profile?: SlpAppearanceProfile | null;
  evidence?: SlpAppearanceEvidence | null;
}): SlpAppearanceResolution {
  const stageAppearance = clean(input.stageAppearance);
  if (stageAppearance) {
    return { text: stageAppearance, profile: input.profile ?? null, needsReview: false, missing: false };
  }

  const sourceAppearance = clean(input.evidence?.sourceAppearance);
  if (sourceAppearance) {
    return { text: sourceAppearance, profile: null, needsReview: false, missing: false };
  }

  const profile = input.profile;
  if (profile?.text.trim()) {
    return {
      text: profile.text.trim(),
      profile,
      needsReview:
        profile.status === "needs_review" ||
        !input.evidence ||
        (input.evidence !== undefined &&
          input.evidence !== null &&
          (profile.sourceEntityId !== input.evidence.sourceEntityId ||
            profile.sourceRevisionToken !== input.evidence.sourceRevisionToken)),
      missing: false,
    };
  }

  return { text: null, profile: null, needsReview: false, missing: true };
}

export function shouldAutoAcceptSlpAppearance(
  mode: SlpAppearanceProfileMode,
  confidence: SlpAppearanceProfile["confidence"],
): boolean {
  return mode === "always" || (mode === "high_confidence" && confidence === "high");
}

/**
 * Words that describe a body: how a card says what somebody looks like. Shared by the evidence
 * check, the no-model fallback below, and the flavour brief (which must not cut such a sentence).
 */
export const SLP_BODY_WORDS =
  /\b(?:hair|eyes?|skin|face|scars?|tattoos?|freckles?|piercings?|build|height|tall|short|petite|curvy|slim|slender|muscular|stocky|body|adult|\d{2}[- ]year[- ]old|horns?|wings?|tails?|fur|furred|scales?|scaled|claws?|talons?|paws?|muzzle|snout|fangs?|ears?|nose|cheeks?|lips|beard|glasses|anthro|digitigrade|species)\b/iu;

/** Lower case, one space, straight quotes and hyphens: a model's copy of a quote differs in these. */
function comparable(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[\u201c\u201d]/gu, '"')
    .replace(/[\u2010-\u2014]/gu, "-")
    .replace(/\s+/gu, " ")
    .replace(/^["'\s]+|["'.,;:!?\s]+$/gu, "")
    .trim();
}

/**
 * A candidate must cite source text verbatim, or come from an attached avatar.
 *
 * A quote found in the card is the evidence when it is about the body. The old rule (the quote
 * must share a word of four letters or more with the appearance) rejected true quotes such as "is
 * a 23-year-old human woman goth e-girl": in the simulation one Creator got no pictures at all and
 * the extraction ran again for every post. A body quote without a shared word is now accepted, at
 * medium confidence; a quote about something else still supports nothing.
 */
export function parseSlpAppearanceCandidate(content: string, sourceText: string, avatarAvailable: boolean) {
  const match = /\{[\s\S]*\}/u.exec(content);
  if (!match) return null;
  try {
    const value: unknown = JSON.parse(match[0]);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const text = typeof row.appearance === "string" ? row.appearance.trim().slice(0, 2000) : "";
    const quote = typeof row.evidence === "string" ? row.evidence.trim() : "";
    if (!text || (quote && !comparable(sourceText).includes(comparable(quote))) || (!quote && !avatarAvailable))
      return null;
    const hasVisualEvidence = SLP_BODY_WORDS.test(comparable(quote));
    const stopWords = new Set(["with", "from", "that", "this", "have", "their", "person", "woman", "man"]);
    const sharedVisualWord = quote
      .toLocaleLowerCase()
      .match(/\p{L}{2,}/gu)
      ?.some(
        (word) =>
          (!/^[a-z]+$/u.test(word) || word.length >= 4) &&
          !stopWords.has(word) &&
          text.toLocaleLowerCase().includes(word),
      );
    // A quote about something else ("enjoys long walks") supports no look at all.
    if (!avatarAvailable && !sharedVisualWord && !hasVisualEvidence) return null;
    return {
      text,
      confidence:
        row.confidence === "high" && quote.length >= 24 && hasVisualEvidence && sharedVisualWord
          ? ("high" as const)
          : ("medium" as const),
      source: quote ? ("description" as const) : ("avatar" as const),
    };
  } catch {
    return null;
  }
}

const FALLBACK_LOOK_MAX = 600;

/**
 * The card's own words about the body, for when the extraction call fails or answers nothing
 * usable. A picture of the Creator as their card describes them beats no picture at all. Falls
 * back to the card's opening when no sentence names the body.
 */
export function slpAppearanceFallback(sourceText: string): string | null {
  const sentences = sourceText
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.replace(/\s+/gu, " ").trim())
    .filter((sentence) => sentence.length >= 8 && !/\{\{\s*user\s*\}\}/iu.test(sentence));
  const body = sentences.filter((sentence) => SLP_BODY_WORDS.test(sentence));
  const picked: string[] = [];
  let length = 0;
  for (const sentence of body.length ? body : sentences.slice(0, 2)) {
    if (picked.length > 0 && length + sentence.length > FALLBACK_LOOK_MAX) break;
    picked.push(sentence);
    length += sentence.length + 1;
  }
  const text = picked.join(" ").slice(0, 2000).trim();
  return text || null;
}

export function createSlpAppearanceProfile(input: {
  text: string;
  source: SlpAppearanceProfile["source"];
  sourceEntityId: string;
  sourceRevisionToken: string;
  confidence: SlpAppearanceProfile["confidence"];
  accepted: boolean;
  now: string;
}): SlpAppearanceProfile {
  return {
    text: input.text.trim().slice(0, 2000),
    source: input.source,
    sourceEntityId: input.sourceEntityId,
    sourceRevisionToken: input.sourceRevisionToken,
    confidence: input.confidence,
    status: input.accepted ? "accepted" : "needs_review",
    generatedAt: input.now,
    acceptedAt: input.accepted ? input.now : null,
  };
}
