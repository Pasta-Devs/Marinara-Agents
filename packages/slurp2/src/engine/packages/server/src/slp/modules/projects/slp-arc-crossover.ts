import {
  SlurpProject,
  SLURP_CROSSOVER_MAX_CREATORS,
  isSlurpCrossover,
  SlurpArcHistoryEntry,
  DAY_MS,
  hash,
  clampText,
  slurpArcNextPending,
} from "./slp-project.js";

/** A participant's stand-in for a crossover stored in another Creator's list. */
export type SlurpCrossoverRef = { crossoverOf: { ownerCreatorId: string; projectId: string } };

export function readSlurpCrossoverRef(value: unknown): SlurpCrossoverRef["crossoverOf"] | null {
  const ref = value && typeof value === "object" ? (value as { crossoverOf?: unknown }).crossoverOf : null;
  if (!ref || typeof ref !== "object") return null;
  const ownerCreatorId = clampText((ref as Record<string, unknown>).ownerCreatorId, 128);
  const projectId = clampText((ref as Record<string, unknown>).projectId, 128);
  return ownerCreatorId && projectId ? { ownerCreatorId, projectId } : null;
}

/** One participant's view: their own profile proposal in the top-level fields. */
export function slurpCrossoverView(project: SlurpProject, creatorId: string): SlurpProject {
  if (!isSlurpCrossover(project)) return project;
  const own = project.profiles[creatorId];
  return { ...project, pendingProfile: own?.pendingProfile ?? null, previousProfile: own?.previousProfile ?? null };
}

/** A new arc turned into a crossover: every participant gets the first chapter's proposal. */
export function slurpCrossoverStart(project: SlurpProject, creatorIds: readonly string[]): SlurpProject {
  const ids = [...new Set(creatorIds)].slice(0, SLURP_CROSSOVER_MAX_CREATORS);
  if (ids.length < 2) return project;
  return {
    ...project,
    creatorIds: ids,
    profiles: Object.fromEntries(
      ids.map((id) => [id, { pendingProfile: project.pendingProfile, previousProfile: null }]),
    ),
    pendingProfile: null,
    previousProfile: null,
  };
}

/**
 * Write one participant's edited view back onto the stored record. The actor's proposal is what the
 * view says; every other participant gets the proposal the same move makes for them (a new chapter's
 * change, or a revert of what they applied), so proposals stay per participant.
 */
export function slurpCrossoverMerge(
  stored: SlurpProject,
  view: SlurpProject,
  creatorId: string,
  at: Date,
): SlurpProject {
  if (!isSlurpCrossover(stored)) return view;
  const { partnerNames: _names, ...rest } = view;
  const stamp = at.toISOString();
  const profiles = Object.fromEntries(
    stored.creatorIds.map((id) => {
      if (id === creatorId) return [id, { pendingProfile: view.pendingProfile, previousProfile: view.previousProfile }];
      const before = slurpCrossoverView(stored, id);
      const pendingProfile = slurpArcNextPending(
        before,
        { ...rest, pendingProfile: before.pendingProfile, previousProfile: before.previousProfile },
        stamp,
      );
      return [id, { pendingProfile, previousProfile: before.previousProfile }];
    }),
  );
  return { ...rest, creatorIds: stored.creatorIds, profiles, pendingProfile: null, previousProfile: null };
}

/** A participant leaves (their Creator was deleted). Below two, it is a normal arc of whoever is left. */
export function slurpCrossoverLeave(project: SlurpProject, creatorId: string): SlurpProject {
  if (!project.creatorIds.includes(creatorId)) return project;
  const creatorIds = project.creatorIds.filter((id) => id !== creatorId);
  const { [creatorId]: _gone, ...profiles } = project.profiles;
  if (creatorIds.length >= 2) return { ...project, creatorIds, profiles };
  const last = profiles[creatorIds[0] ?? ""];
  return {
    ...project,
    creatorIds: [],
    profiles: {},
    pendingProfile: last?.pendingProfile ?? null,
    previousProfile: last?.previousProfile ?? null,
  };
}

/**
 * The partner for an automatic crossover, or null. About one roll in four, seeded on the Creator and
 * the day like the arc roll itself. A partner shares a tag or already has a relationship (a follow or
 * subscription either way) and passed the caller's eligibility checks.
 */
export function slurpCrossoverPartner(input: {
  creatorAccountId: string;
  at: Date;
  creatorTags: readonly string[];
  candidates: readonly { id: string; tags: readonly string[]; related: boolean; eligible: boolean }[];
  /** Creators the player paired with this one as collab partners. Preferred over tag matches. */
  collabIds?: readonly string[];
}): string | null {
  const day = Math.floor(input.at.getTime() / DAY_MS);
  if (hash(`${input.creatorAccountId}:${day}:crossover`) % 4 !== 0) return null;
  const tags = new Set(input.creatorTags.map((tag) => tag.toLocaleLowerCase()));
  const paired = input.candidates
    .filter((candidate) => candidate.eligible && input.collabIds?.includes(candidate.id))
    .map((candidate) => candidate.id)
    .sort();
  if (paired.length) return paired[hash(`${input.creatorAccountId}:${day}:partner`) % paired.length]!;
  const fits = input.candidates
    .filter(
      (candidate) =>
        candidate.eligible &&
        candidate.id !== input.creatorAccountId &&
        (candidate.related || candidate.tags.some((tag) => tags.has(tag.toLocaleLowerCase()))),
    )
    .map((candidate) => candidate.id)
    .sort();
  return fits.length ? fits[hash(`${input.creatorAccountId}:${day}:partner`) % fits.length]! : null;
}

/**
 * The timeline's crossover part for one viewer: the partners the viewer may see, and history posts
 * only from participants they may see. A hidden participant is left out entirely.
 */
export function slurpCrossoverForViewer(
  project: SlurpProject,
  selfId: string,
  visible: (creatorId: string) => boolean,
): { partnerIds: string[]; history: SlurpArcHistoryEntry[] } {
  const hidden = new Set(project.creatorIds.filter((id) => id !== selfId && !visible(id)));
  return {
    partnerIds: project.creatorIds.filter((id) => id !== selfId && !hidden.has(id)),
    history: hidden.size
      ? project.history.map((entry) => {
          const postIds = entry.postIds.filter((postId) => !hidden.has(entry.authors?.[postId] ?? ""));
          const authors = Object.fromEntries(Object.entries(entry.authors ?? {}).filter(([, id]) => !hidden.has(id)));
          return { ...entry, postIds, authors };
        })
      : project.history,
  };
}
