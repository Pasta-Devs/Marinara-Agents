import { createHash } from "node:crypto";
import type {
  SlpAccount,
  SlpAppearanceProfile,
  SlpAppearanceProfileMode,
  SlpCreatorSourceSnapshot,
} from "../../../../../shared/src/slp/slp-social.types.js";

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
    sourceAppearance: source.appearance,
    description: source.description,
  };
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

/** A candidate must cite source text verbatim, or come from an attached avatar. */
export function parseSlpAppearanceCandidate(content: string, sourceText: string, avatarAvailable: boolean) {
  const match = /\{[\s\S]*\}/u.exec(content);
  if (!match) return null;
  try {
    const value: unknown = JSON.parse(match[0]);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const text = typeof row.appearance === "string" ? row.appearance.trim().slice(0, 2000) : "";
    const quote = typeof row.evidence === "string" ? row.evidence.trim() : "";
    if (
      !text ||
      (quote && !sourceText.toLocaleLowerCase().includes(quote.toLocaleLowerCase())) ||
      (!quote && !avatarAvailable)
    )
      return null;
    const hasVisualEvidence =
      /\b(?:hair|eyes?|skin|face|scar|tattoo|freckles?|build|height|tall|short|body|adult|horns?|wings?|fur|ears?|nose|cheeks?|beard|glasses)\b/iu.test(
        quote,
      );
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
    if (!avatarAvailable && !sharedVisualWord) return null;
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
