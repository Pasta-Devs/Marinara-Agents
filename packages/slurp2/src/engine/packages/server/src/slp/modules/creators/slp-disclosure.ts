import type {
  SlpCreatorManagedStageProfile,
  SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpDiscoveryGender } from "../discovery/slp-discovery-profile.js";

type SlurpManagedStageProfile = SlpCreatorManagedStageProfile & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};

/**
 * The disclosure a Creator actually gets. Slurp offers only Open and Hinted; the shared type still
 * carries `secret`, so a stored or submitted Secret Creator becomes Hinted, the closest tier that
 * still keeps the source name and handle protected.
 */
export function slurpDisclosureMode<T extends SlpIdentityDisclosure | null | undefined>(mode: T) {
  return (mode === "secret" ? "hinted" : mode) as T extends "secret" ? "hinted" : T;
}

const DISCLOSURE_RANK: Record<SlpIdentityDisclosure, number> = {
  secret: 0,
  hinted: 1,
  open: 2,
};

// Explicit allow-list: the audience projection names every field it exposes, so a
// new field on SlpCreatorManagedStageProfile is private until it is added here.
const AUDIENCE_FIELDS = [
  "id",
  "handle",
  "displayName",
  "bio",
  "avatarUrl",
  "avatarCrop",
  "bannerUrl",
  "gender",
  "tags",
  "disclosureMode",
  "stagePersonality",
  "autoPosting",
  "fanActivity",
  "createdAt",
  "updatedAt",
] as const;

export type NoodlerAudienceProfile = Pick<
  SlurpManagedStageProfile,
  (typeof AUDIENCE_FIELDS)[number] | "slurpSourceAccountId" | "publicIdentity"
>;

export function isNoodlerDisclosureDowngrade(current: SlpIdentityDisclosure, next: SlpIdentityDisclosure): boolean {
  return DISCLOSURE_RANK[next] < DISCLOSURE_RANK[current];
}

export function projectNoodlerAudienceProfile(profile: SlurpManagedStageProfile): NoodlerAudienceProfile {
  const open = profile.disclosureMode === "open";
  return {
    ...(Object.fromEntries(AUDIENCE_FIELDS.map((field) => [field, profile[field]])) as Pick<
      SlurpManagedStageProfile,
      (typeof AUDIENCE_FIELDS)[number]
    >),
    slurpSourceAccountId: open ? profile.slurpSourceAccountId : null,
    publicIdentity: open ? profile.publicIdentity : null,
  };
}

export type NoodlerDisclosureReviewReason = {
  // Stable code so callers can match a reason without parsing its English label.
  code: "published_posts" | "published_media" | "creator_avatar" | "creator_banner" | "prepared_posts";
  count: number;
  label: string;
};

export function noodlerDisclosureReviewReasons(input: {
  currentMode: SlpIdentityDisclosure;
  nextMode: SlpIdentityDisclosure;
  postCount: number;
  mediaCount: number;
  hasAvatar: boolean;
  hasBanner: boolean;
  preparedPostCount: number;
}): NoodlerDisclosureReviewReason[] {
  if (!isNoodlerDisclosureDowngrade(input.currentMode, input.nextMode)) return [];
  const plural = (count: number) => (count === 1 ? "" : "s");
  return [
    ...(input.postCount > 0
      ? [
          {
            code: "published_posts" as const,
            count: input.postCount,
            label: `${input.postCount} published post${plural(input.postCount)}`,
          },
        ]
      : []),
    ...(input.mediaCount > 0
      ? [
          {
            code: "published_media" as const,
            count: input.mediaCount,
            label: `${input.mediaCount} published media item${plural(input.mediaCount)}`,
          },
        ]
      : []),
    ...(input.hasAvatar ? [{ code: "creator_avatar" as const, count: 1, label: "the current creator avatar" }] : []),
    ...(input.hasBanner ? [{ code: "creator_banner" as const, count: 1, label: "the current creator banner" }] : []),
    ...(input.preparedPostCount > 0
      ? [
          {
            code: "prepared_posts" as const,
            count: input.preparedPostCount,
            label: `${input.preparedPostCount} prepared automatic post${plural(input.preparedPostCount)}`,
          },
        ]
      : []),
  ];
}
