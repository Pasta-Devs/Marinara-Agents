/**
 * Pure planning for the Backstage Creator workshop. Routes own the I/O; everything that decides
 * what a job may propose, what counts as stale, and what an apply writes lives here so it can be
 * tested without a database or a model.
 */
import {
  normalizeSlurpDiscoveryTag,
  normalizeSlurpDiscoveryTags,
  type SlurpStageProfileInput,
} from "../../discovery/slp-discovery-profile.js";

export const SLURP_IMPROVEMENT_MODULES = [
  "profile",
  "tags",
  "art",
  "publishing",
  "posts",
  "audience",
  "stories",
  "messaging",
  "ads",
] as const;
export type SlurpImprovementModule = (typeof SLURP_IMPROVEMENT_MODULES)[number];
/** Lanes with a working generator. The rest are accepted by the schema but not yet produced. */
export const SLURP_AVAILABLE_IMPROVEMENT_MODULES: readonly SlurpImprovementModule[] = ["profile", "tags", "publishing"];

export type SlurpImprovementProfile = {
  id: string;
  displayName: string;
  handle: string;
  bio: string;
  stagePersonality: string;
  gender: SlurpStageProfileInput["gender"];
  tags: string[];
  disclosureMode: SlurpStageProfileInput["disclosureMode"] | null;
  avatarUrl?: string | null;
  autoPosting: { enabled: boolean };
};

export type SlurpImprovementProposalRow = {
  id: string;
  accountId: string;
  field: string;
  afterValue: string;
  sourceFingerprint: string;
};

/** Everything a proposal may change. A Creator edit to any of it makes older proposals stale. */
export function slurpImprovementSnapshot(profile: SlurpImprovementProfile): string {
  return JSON.stringify({
    displayName: profile.displayName,
    handle: profile.handle,
    bio: profile.bio,
    stagePersonality: profile.stagePersonality,
    gender: profile.gender ?? null,
    tags: profile.tags ?? [],
    autoPosting: profile.autoPosting.enabled,
  });
}

/** Deterministic checkup. Never calls a model. */
export function slurpCreatorReadiness(profile: SlurpImprovementProfile): string[] {
  return [
    ...(profile.bio.trim().length < 40 ? ["bio"] : []),
    ...(profile.stagePersonality.trim().length < 80 ? ["stagePersonality"] : []),
    ...(profile.tags.length < 3 ? ["tags"] : []),
    ...(!profile.avatarUrl ? ["art"] : []),
    ...(!profile.autoPosting.enabled ? ["publishing"] : []),
  ];
}

/** One stage-profile generation per Creator covers profile and tags; publishing is deterministic. */
export function slurpImprovementModelCalls(creators: number, modules: readonly string[]): number {
  return modules.includes("profile") || modules.includes("tags") ? creators : 0;
}

/** Fields the model draft may fill. Display name and handle only in rebrand mode. */
export function slurpImprovementDraftFields(modules: readonly string[], rebrand: boolean) {
  return [
    ...(modules.includes("profile") ? (["bio", "stagePersonality"] as const) : []),
    ...(modules.includes("profile") && rebrand ? (["displayName", "handle"] as const) : []),
    ...(modules.includes("tags") ? (["tags"] as const) : []),
  ];
}

export function slurpImprovementDraftProposals(
  profile: SlurpImprovementProfile,
  draft: Pick<SlurpStageProfileInput, "displayName" | "handle" | "bio" | "stagePersonality" | "tags">,
  modules: readonly string[],
  rebrand: boolean,
): Array<{ field: string; before: unknown; after: unknown }> {
  const proposals: Array<{ field: string; before: unknown; after: unknown }> = [];
  for (const field of slurpImprovementDraftFields(modules, rebrand)) {
    const after = field === "tags" ? normalizeSlurpDiscoveryTags(draft.tags) : draft[field];
    if (JSON.stringify(profile[field]) !== JSON.stringify(after))
      proposals.push({ field, before: profile[field], after });
  }
  if (modules.includes("publishing") && !profile.autoPosting.enabled) {
    proposals.push({ field: "autoPosting", before: false, after: true });
  }
  return proposals;
}

export function slurpStageProfileInput(profile: SlurpImprovementProfile): SlurpStageProfileInput {
  return {
    displayName: profile.displayName,
    handle: profile.handle,
    bio: profile.bio,
    stagePersonality: profile.stagePersonality,
    disclosureMode: profile.disclosureMode ?? "hinted",
    gender: profile.gender,
    tags: profile.tags,
  };
}

export type SlurpImprovementApplyPlan = {
  stale: string[];
  rejected: string[];
  updates: Array<{ accountId: string; stageProfile: SlurpStageProfileInput; autoPosting?: boolean }>;
  discoveryTags: Array<{ tag: string; group: string }>;
  createdTags: string[];
};

/**
 * Decide the whole apply before any write. Stale proposals block the apply; protected fields
 * (disclosure, pricing, ownership, source identity, and name/handle outside rebrand) are rejected.
 * Tags new to the catalog are created in the same plan that assigns them.
 */
export function planSlurpImprovementApply(input: {
  profiles: readonly SlurpImprovementProfile[];
  proposals: readonly SlurpImprovementProposalRow[];
  rebrand: boolean;
  discoveryTags: ReadonlyArray<{ tag: string; group: string }>;
}): SlurpImprovementApplyPlan {
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const stale = input.proposals
    .filter((proposal) => {
      const profile = profileById.get(proposal.accountId);
      return !profile || slurpImprovementSnapshot(profile) !== proposal.sourceFingerprint;
    })
    .map((proposal) => proposal.id);
  const allowed = new Set([
    "bio",
    "stagePersonality",
    "tags",
    "autoPosting",
    ...(input.rebrand ? ["displayName", "handle"] : []),
  ]);
  const rejected: string[] = [];
  const discoveryTags = input.discoveryTags.map((entry) => ({ ...entry }));
  const known = new Set(discoveryTags.map((entry) => normalizeSlurpDiscoveryTag(entry.tag).toLocaleLowerCase()));
  const createdTags: string[] = [];
  const updates = new Map<string, SlurpImprovementApplyPlan["updates"][number]>();
  if (stale.length) return { stale, rejected, updates: [], discoveryTags, createdTags };
  for (const proposal of input.proposals) {
    if (!allowed.has(proposal.field)) {
      rejected.push(proposal.id);
      continue;
    }
    const profile = profileById.get(proposal.accountId)!;
    const update = updates.get(profile.id) ?? { accountId: profile.id, stageProfile: slurpStageProfileInput(profile) };
    const after: unknown = JSON.parse(proposal.afterValue);
    if (proposal.field === "autoPosting") {
      if (after !== true) rejected.push(proposal.id);
      else update.autoPosting = true;
    } else if (proposal.field === "tags") {
      update.stageProfile.tags = normalizeSlurpDiscoveryTags(after);
    } else if (typeof after === "string" && after.trim()) {
      update.stageProfile[proposal.field as "bio" | "stagePersonality" | "displayName" | "handle"] = after;
    } else {
      rejected.push(proposal.id);
      continue;
    }
    updates.set(profile.id, update);
  }
  for (const update of updates.values()) {
    for (const tag of update.stageProfile.tags) {
      const key = tag.toLocaleLowerCase();
      if (known.has(key)) continue;
      known.add(key);
      discoveryTags.push({ tag, group: "AI suggestions" });
      createdTags.push(tag);
    }
  }
  return { stale, rejected, updates: [...updates.values()], discoveryTags, createdTags };
}

/** Re-queue only the failed Creators, keeping every successful proposal in place. */
export function planSlurpImprovementRetry(accountIds: readonly string[], failedAccountIds: readonly string[]) {
  const failed = new Set(failedAccountIds);
  const retry = accountIds.filter((id) => failed.has(id));
  return {
    accountIds: [...accountIds.filter((id) => !failed.has(id)), ...retry],
    completed: accountIds.length - retry.length,
  };
}

/** Finished workshop rows older than the cutoff. Active jobs and their proposals are never selected. */
export function selectUnusedSlurpImprovementRows(
  jobs: ReadonlyArray<{ id: string; status: string; updatedAt: string }>,
  proposals: ReadonlyArray<{ id: string; jobId: string; status: string; updatedAt: string }>,
  cutoff: number,
) {
  const active = new Set(jobs.filter((job) => ["queued", "running"].includes(job.status)).map((job) => job.id));
  const jobIds = new Set(
    jobs
      .filter((job) => ["completed", "failed", "cancelled"].includes(job.status) && Date.parse(job.updatedAt) < cutoff)
      .map((job) => job.id),
  );
  return {
    improvementJobIds: [...jobIds],
    improvementProposalIds: proposals
      .filter(
        (proposal) =>
          jobIds.has(proposal.jobId) ||
          (!active.has(proposal.jobId) &&
            ["applied", "dismissed", "stale", "error"].includes(proposal.status) &&
            Date.parse(proposal.updatedAt) < cutoff),
      )
      .map((proposal) => proposal.id),
  };
}
