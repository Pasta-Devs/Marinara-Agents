import type {
  NoodleIdentityDisclosure,
  NoodlerManagedStageProfile,
} from "@marinara-engine/shared";

const DISCLOSURE_RANK: Record<NoodleIdentityDisclosure, number> = {
  secret: 0,
  hinted: 1,
  open: 2,
};

// Explicit allow-list: the audience projection names every field it exposes, so a
// new field on NoodlerManagedStageProfile is private until it is added here.
const AUDIENCE_FIELDS = [
  "id",
  "handle",
  "displayName",
  "bio",
  "avatarUrl",
  "avatarCrop",
  "bannerUrl",
  "disclosureMode",
  "stagePersonality",
  "autoPosting",
  "fanActivity",
  "createdAt",
  "updatedAt",
] as const;

export type NoodlerAudienceProfile = Pick<
  NoodlerManagedStageProfile,
  (typeof AUDIENCE_FIELDS)[number] | "noodleAccountId" | "publicIdentity"
>;

export function isNoodlerDisclosureDowngrade(
  current: NoodleIdentityDisclosure,
  next: NoodleIdentityDisclosure,
): boolean {
  return DISCLOSURE_RANK[next] < DISCLOSURE_RANK[current];
}

export function projectNoodlerAudienceProfile(
  profile: NoodlerManagedStageProfile,
): NoodlerAudienceProfile {
  const open = profile.disclosureMode === "open";
  return {
    ...(Object.fromEntries(
      AUDIENCE_FIELDS.map((field) => [field, profile[field]]),
    ) as Pick<NoodlerManagedStageProfile, (typeof AUDIENCE_FIELDS)[number]>),
    noodleAccountId: open ? profile.noodleAccountId : null,
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
  currentMode: NoodleIdentityDisclosure;
  nextMode: NoodleIdentityDisclosure;
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
      ? [{
          code: "published_posts" as const,
          count: input.postCount,
          label: `${input.postCount} published post${plural(input.postCount)}`,
        }]
      : []),
    ...(input.mediaCount > 0
      ? [{
          code: "published_media" as const,
          count: input.mediaCount,
          label: `${input.mediaCount} published media item${plural(input.mediaCount)}`,
        }]
      : []),
    ...(input.hasAvatar
      ? [{ code: "creator_avatar" as const, count: 1, label: "the current creator avatar" }]
      : []),
    ...(input.hasBanner
      ? [{ code: "creator_banner" as const, count: 1, label: "the current creator banner" }]
      : []),
    ...(input.preparedPostCount > 0
      ? [{
          code: "prepared_posts" as const,
          count: input.preparedPostCount,
          label: `${input.preparedPostCount} prepared automatic post${plural(input.preparedPostCount)}`,
        }]
      : []),
  ];
}
