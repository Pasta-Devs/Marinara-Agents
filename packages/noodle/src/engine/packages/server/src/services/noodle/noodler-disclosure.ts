import type {
  NoodleIdentityDisclosure,
  NoodlerManagedStageProfile,
} from "@marinara-engine/shared";

const DISCLOSURE_RANK: Record<NoodleIdentityDisclosure, number> = {
  secret: 0,
  hinted: 1,
  open: 2,
};

export type NoodlerAudienceProfile = Omit<
  NoodlerManagedStageProfile,
  "access" | "sourceStatus" | "publicIdentity"
> & {
  publicIdentity: NoodlerManagedStageProfile["publicIdentity"];
};

export function isNoodlerDisclosureDowngrade(
  current: NoodleIdentityDisclosure,
  next: NoodleIdentityDisclosure,
): boolean {
  return DISCLOSURE_RANK[next] < DISCLOSURE_RANK[current];
}

export function projectNoodlerAudienceProfile(
  profile: NoodlerManagedStageProfile,
): NoodlerAudienceProfile {
  const {
    access: _access,
    sourceStatus: _sourceStatus,
    publicIdentity,
    ...audienceProfile
  } = profile;
  const open = profile.disclosureMode === "open";
  return {
    ...audienceProfile,
    noodleAccountId: open ? profile.noodleAccountId : null,
    publicIdentity: open ? publicIdentity : null,
  };
}

export function noodlerDisclosureReviewReasons(input: {
  currentMode: NoodleIdentityDisclosure;
  nextMode: NoodleIdentityDisclosure;
  postCount: number;
  mediaCount: number;
  hasAvatar: boolean;
  preparedPostCount: number;
}): string[] {
  if (!isNoodlerDisclosureDowngrade(input.currentMode, input.nextMode)) return [];
  return [
    ...(input.postCount > 0
      ? [`${input.postCount} published post${input.postCount === 1 ? "" : "s"}`]
      : []),
    ...(input.mediaCount > 0
      ? [`${input.mediaCount} published media item${input.mediaCount === 1 ? "" : "s"}`]
      : []),
    ...(input.hasAvatar ? ["the current creator avatar"] : []),
    ...(input.preparedPostCount > 0
      ? [`${input.preparedPostCount} prepared automatic post${input.preparedPostCount === 1 ? "" : "s"}`]
      : []),
  ];
}
