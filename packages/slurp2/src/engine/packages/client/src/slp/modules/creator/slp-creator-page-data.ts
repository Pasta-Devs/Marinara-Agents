import type { SlpCreatorPageCollageLayout } from "../../../../../shared/src/slp/slp-creator-page.js";

/**
 * What a Creator's Page fills in from real data: which pictures a collage shows, who is in the
 * People block, and the facts line. Pure, so the rules are testable without React.
 */

/** A picture the viewer may see whole. */
export type SlpPagePicture = {
  postId: string;
  imageUrl: string;
  likeCount: number;
  createdAt: string;
  shootId: string | null;
};
/** A locked post's teaser: the blurred crop the server cut, never the whole picture. */
export type SlpPageTeaser = { postId: string; imageUrl: string };
export type SlpPageTile = { postId: string; imageUrl: string; locked: boolean };

export const SLP_PAGE_COLLAGE_SIZE: Record<SlpCreatorPageCollageLayout, number> = {
  bento: 6,
  mood: 6,
  polaroid: 4,
  film: 6,
};

/**
 * The tiles of one collage. Hand-picked posts keep their order and drop the ones that are gone. An
 * empty pick is the Creator's best recent work, chosen again on every render so the Page stays
 * alive: most liked first, one picture per shoot, newest breaking ties, and one locked teaser last
 * when there is one, because a Page is also a shop window.
 */
export function pickSlpCollageTiles(input: {
  postIds: readonly string[];
  layout: SlpCreatorPageCollageLayout;
  pictures: readonly SlpPagePicture[];
  teasers: readonly SlpPageTeaser[];
}): SlpPageTile[] {
  const size = SLP_PAGE_COLLAGE_SIZE[input.layout];
  if (input.postIds.length) {
    const pictureById = new Map(input.pictures.map((picture) => [picture.postId, picture]));
    const teaserById = new Map(input.teasers.map((teaser) => [teaser.postId, teaser]));
    return input.postIds
      .flatMap((postId) => {
        const picture = pictureById.get(postId);
        if (picture) return [{ postId, imageUrl: picture.imageUrl, locked: false }];
        const teaser = teaserById.get(postId);
        return teaser ? [{ postId, imageUrl: teaser.imageUrl, locked: true }] : [];
      })
      .slice(0, size);
  }
  const shoots = new Set<string>();
  const best = [...input.pictures]
    .sort((a, b) => b.likeCount - a.likeCount || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((picture) => {
      if (!picture.shootId) return true;
      if (shoots.has(picture.shootId)) return false;
      shoots.add(picture.shootId);
      return true;
    });
  const teaser = input.teasers[0];
  const open = best
    .slice(0, teaser && best.length >= 2 ? size - 1 : size)
    .map((picture) => ({ postId: picture.postId, imageUrl: picture.imageUrl, locked: false }));
  return teaser && open.length >= 2
    ? [...open, { postId: teaser.postId, imageUrl: teaser.imageUrl, locked: true }]
    : open;
}

export type SlpPagePersonRelation =
  "partner" | "dating" | "family" | "bestie" | "roommate" | "collab" | "friend" | "coworker" | "rival";
export type SlpPagePerson = { id: string; name: string; avatarUrl: string | null; relation: SlpPagePersonRelation };

/** The parts of the ties view the People block reads (structural, so this module needs no feature import). */
export type SlpPageTies = {
  creators: { id: string; name: string; avatarUrl: string | null; couplePage?: boolean }[];
  couples: { aId: string; bId: string; moreIds?: string[]; stage: string; ending: string | null }[];
  collabs: { hostId: string; partnerId: string; status: string }[];
  rivalries: { fromId: string; toId: string; stage: string }[];
  /** Drama bonds; older servers send none. Exes stay off a public page. */
  bonds?: { aId: string; bId: string; kind: string; level: number; endedAt: string | null }[];
};

const PEOPLE_MAX = 6;

/**
 * Partner first, then family, best friends and roommates, collab partners, friends, coworkers, then a live
 * rivalry. Each person once, at their closest tie.
 */
export function slpPagePeople(creatorId: string, ties: SlpPageTies | null | undefined): SlpPagePerson[] {
  if (!ties) return [];
  const byId = new Map(ties.creators.filter((creator) => !creator.couplePage).map((creator) => [creator.id, creator]));
  const out = new Map<string, SlpPagePerson>();
  const add = (id: string, relation: SlpPagePersonRelation) => {
    const creator = byId.get(id);
    if (!creator || id === creatorId || out.has(id)) return;
    out.set(id, { id, name: creator.name, avatarUrl: creator.avatarUrl, relation });
  };
  for (const couple of ties.couples) {
    if (couple.ending || couple.stage === "split") continue;
    // Polyamory (0.3.5): everyone else in their couple is a partner.
    const members = [couple.aId, couple.bId, ...(couple.moreIds ?? [])];
    if (members.includes(creatorId))
      for (const other of members)
        // A crush is nothing official yet, so it is not on the page; dating is dating.
        if (other !== creatorId && couple.stage !== "sparks")
          add(other, couple.stage === "dating" ? "dating" : "partner");
  }
  const bonds = (ties.bonds ?? []).filter((bond) => bond.endedAt === null);
  const bonded = (kinds: readonly string[], minLevel: number, relation: SlpPagePersonRelation) => {
    for (const bond of bonds) {
      if (!kinds.includes(bond.kind) || bond.level < minLevel) continue;
      const other = bond.aId === creatorId ? bond.bId : bond.bId === creatorId ? bond.aId : null;
      if (other) add(other, relation);
    }
  };
  bonded(["family"], 0, "family");
  bonded(["friend"], 3, "bestie");
  bonded(["roommate"], 0, "roommate");
  for (const collab of ties.collabs) {
    if (collab.status !== "posted" && collab.status !== "planned" && collab.status !== "agreed") continue;
    const other =
      collab.hostId === creatorId ? collab.partnerId : collab.partnerId === creatorId ? collab.hostId : null;
    if (other) add(other, "collab");
  }
  bonded(["friend"], 1, "friend");
  bonded(["coworker"], 0, "coworker");
  for (const rivalry of ties.rivalries) {
    if (rivalry.stage !== "shade" && rivalry.stage !== "feud") continue;
    const other = rivalry.fromId === creatorId ? rivalry.toId : rivalry.toId === creatorId ? rivalry.fromId : null;
    if (other) add(other, "rival");
  }
  return [...out.values()].slice(0, PEOPLE_MAX);
}

const WEEK_MS = 7 * 24 * 60 * 60_000;

/**
 * Posts a week over the last four weeks, or over the account's life when it is younger. Null for
 * a Creator under a week old, where a rate would be a guess.
 */
export function slpPagePostsPerWeek(input: {
  postDates: readonly string[];
  createdAt: string;
  now: number;
}): number | null {
  const created = Date.parse(input.createdAt);
  const age = Number.isNaN(created) ? 4 * WEEK_MS : input.now - created;
  if (age < WEEK_MS) return null;
  const span = Math.min(age, 4 * WEEK_MS);
  const recent = input.postDates.filter((date) => {
    const at = Date.parse(date);
    return !Number.isNaN(at) && input.now - at <= span;
  }).length;
  return Math.round((recent / (span / WEEK_MS)) * 10) / 10;
}
