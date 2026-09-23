import type {
  SlpAppearanceProfile,
  SlpAppearanceProfileMode,
  SlpCreatorSourceSnapshot,
} from "../../../../../shared/src/slp/slp-social.types.js";

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
  sourceRevisionToken: string,
): SlpAppearanceEvidence {
  return {
    sourceEntityId: source.publicHandle || source.publicDisplayName,
    sourceRevisionToken,
    sourceAppearance: source.appearance,
    description: source.description,
  };
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

  const profile = input.profile;
  if (profile?.text.trim()) {
    return {
      text: profile.text.trim(),
      profile,
      needsReview: profile.status === "needs_review",
      missing: false,
    };
  }

  const sourceAppearance = clean(input.evidence?.sourceAppearance);
  if (sourceAppearance) {
    return { text: sourceAppearance, profile: null, needsReview: false, missing: false };
  }

  return { text: null, profile: null, needsReview: false, missing: true };
}

export function shouldAutoAcceptSlpAppearance(
  mode: SlpAppearanceProfileMode,
  confidence: SlpAppearanceProfile["confidence"],
): boolean {
  return mode === "always" || (mode === "high_confidence" && confidence === "high");
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
