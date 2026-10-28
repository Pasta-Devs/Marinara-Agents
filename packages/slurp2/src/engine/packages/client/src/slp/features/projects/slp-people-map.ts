/**
 * The People map's model (Drama, `docs/DRAMA.md`): every tie in the Studio view as one kind of edge.
 *
 * Pure. Couples, crushes, rivalries and collabs come from their own lists, friends, roommates,
 * coworkers and exes from bonds. A pair may have several edges (friends who also made a collab);
 * the map draws the strongest one, the list shows them all.
 */
import type {
  SlurpTiesBond,
  SlurpTiesCollab,
  SlurpTiesCouple,
  SlurpTiesRivalry,
  SlurpTiesView,
} from "./slp-ties-hooks";

export const SLP_PEOPLE_EDGE_KINDS = [
  "couple",
  "crush",
  "ex",
  "rival",
  "family",
  "roommate",
  "friend",
  "coworker",
  "collab",
] as const;
export type SlpPeopleEdgeKind = (typeof SLP_PEOPLE_EDGE_KINDS)[number];

export type SlpPeopleEdge = {
  id: string;
  kind: SlpPeopleEdgeKind;
  aId: string;
  bId: string;
  /** 0-3: how close (or, for a rivalry, how hot). */
  level: number;
  temperature: "warm" | "tense" | "cold";
  since: string;
  source:
    | { type: "bond"; bond: SlurpTiesBond }
    | { type: "couple"; couple: SlurpTiesCouple }
    | { type: "rival"; rivalry: SlurpTiesRivalry }
    | { type: "collab"; collab: SlurpTiesCollab };
};

const COUPLE_LEVEL = { sparks: 1, dating: 2, together: 3, rocky: 2, split: 1 } as const;
const RIVAL_LEVEL = { shade: 1, feud: 3, cooling: 1, over: 0 } as const;
/** A collab counts as a tie while it is open and for two weeks after it went up. */
const COLLAB_DAYS = 14;

const pairs = (ids: readonly string[]) => ids.flatMap((a, index) => ids.slice(index + 1).map((b) => [a, b] as const));
const key = (a: string, b: string) => [a, b].sort().join("|");

/** Every tie in the view as edges. `now` decides which collabs still count. */
export function slpPeopleEdges(view: SlurpTiesView, now = new Date()): SlpPeopleEdge[] {
  const bonds = (view.bonds ?? []).filter((bond) => bond.endedAt === null);
  const exBond = new Set(bonds.filter((bond) => bond.kind === "ex").map((bond) => key(bond.aId, bond.bId)));
  const edges: SlpPeopleEdge[] = bonds.map((bond) => ({
    id: `bond:${bond.id}`,
    kind: bond.kind,
    aId: bond.aId,
    bId: bond.bId,
    level: bond.level,
    temperature: bond.temperature,
    since: bond.since,
    source: { type: "bond", bond },
  }));
  for (const couple of view.couples) {
    const members = [couple.aId, couple.bId, ...(couple.moreIds ?? [])];
    // A breakup older than bonds has no ex bond yet: it still shows as exes.
    const ex = couple.stage === "split" && couple.ending === "breakup";
    if (couple.stage === "split" && !ex) continue;
    for (const [a, b] of pairs(members)) {
      if (ex && exBond.has(key(a, b))) continue;
      edges.push({
        id: `couple:${couple.id}:${key(a, b)}`,
        kind: ex ? "ex" : couple.stage === "sparks" ? "crush" : "couple",
        aId: a,
        bId: b,
        level: COUPLE_LEVEL[couple.stage],
        temperature: ex ? "cold" : couple.stage === "rocky" ? "tense" : "warm",
        since: couple.togetherAt ?? couple.startedAt,
        source: { type: "couple", couple },
      });
    }
  }
  for (const rivalry of view.rivalries)
    if (rivalry.stage !== "over")
      edges.push({
        id: `rival:${rivalry.id}`,
        kind: "rival",
        aId: rivalry.fromId,
        bId: rivalry.toId,
        level: RIVAL_LEVEL[rivalry.stage],
        temperature: "tense",
        since: rivalry.stageAt,
        source: { type: "rival", rivalry },
      });
  for (const collab of view.collabs) {
    const open = ["asked", "agreed", "planned"].includes(collab.status);
    const posted =
      collab.status === "posted" &&
      now.getTime() - Date.parse(collab.answeredAt ?? collab.askedAt) < COLLAB_DAYS * 86_400_000;
    if (open || posted)
      edges.push({
        id: `collab:${collab.id}`,
        kind: "collab",
        aId: collab.hostId,
        bId: collab.partnerId,
        level: 1,
        temperature: "warm",
        since: collab.askedAt,
        source: { type: "collab", collab },
      });
  }
  return edges;
}

const rank = (kind: SlpPeopleEdgeKind) => SLP_PEOPLE_EDGE_KINDS.indexOf(kind);

/**
 * One Creator's ties: for each other person, every edge between them, strongest kind first. Ordered
 * by that kind, then by how close, so the map groups partners, exes, rivals and friends together.
 */
export function slpEgoTies(edges: readonly SlpPeopleEdge[], centerId: string) {
  const byOther = new Map<string, SlpPeopleEdge[]>();
  for (const edge of edges) {
    const other = edge.aId === centerId ? edge.bId : edge.bId === centerId ? edge.aId : null;
    if (other) byOther.set(other, [...(byOther.get(other) ?? []), edge]);
  }
  return [...byOther.entries()]
    .map(([otherId, list]) => ({
      otherId,
      edges: [...list].sort((left, right) => rank(left.kind) - rank(right.kind) || right.level - left.level),
    }))
    .sort(
      (left, right) =>
        rank(left.edges[0]!.kind) - rank(right.edges[0]!.kind) ||
        right.edges[0]!.level - left.edges[0]!.level ||
        left.otherId.localeCompare(right.otherId),
    );
}

/** Who to show first: the Creator with the most ties (ties broken by id, so it does not jump). */
export function slpBusiestCreator(edges: readonly SlpPeopleEdge[], ids: readonly string[]): string | null {
  const count = new Map<string, number>();
  for (const edge of edges) for (const id of [edge.aId, edge.bId]) count.set(id, (count.get(id) ?? 0) + 1);
  return (
    [...ids].sort((left, right) => (count.get(right) ?? 0) - (count.get(left) ?? 0) || left.localeCompare(right))[0] ??
    null
  );
}

/**
 * The part of the network the map shows: everyone whose people are open, and those people. Between
 * two shown people only the strongest tie is drawn (also between two people nobody opened).
 */
export function slpPeopleGraph(edges: readonly SlpPeopleEdge[], openIds: readonly string[]) {
  const open = new Set(openIds);
  const ids = new Set(openIds);
  for (const edge of edges)
    if (open.has(edge.aId) || open.has(edge.bId)) {
      ids.add(edge.aId);
      ids.add(edge.bId);
    }
  const strongest = new Map<string, SlpPeopleEdge>();
  for (const edge of edges) {
    if (!ids.has(edge.aId) || !ids.has(edge.bId)) continue;
    const pair = [edge.aId, edge.bId].sort().join("|");
    const kept = strongest.get(pair);
    if (!kept || rank(edge.kind) < rank(kept.kind) || (edge.kind === kept.kind && edge.level > kept.level))
      strongest.set(pair, edge);
  }
  return { ids: [...ids], ties: [...strongest.values()] };
}
