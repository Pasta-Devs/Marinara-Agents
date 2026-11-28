import type {
  LtmImportance,
  LtmLink,
  LtmNoteType,
  LtmStatus,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";

/**
 * Pure model and layout for the Memory Vault's Graph view. No DOM and no React, so the regression runs without a
 * browser. The Vault hands in the notes its list already shows (same scope and search); this module applies the
 * Graph's own filter row and lays the result out.
 */

export type GraphLinkRelation = LtmLink["relation"];

/** The four colour families of the filter row. A node takes its family from its type. */
export type GraphFamily = "people" | "story" | "threads" | "world";

export const GRAPH_FAMILIES: readonly GraphFamily[] = ["people", "story", "threads", "world"];

export const NODE_FAMILY: Record<Exclude<LtmNoteType, "source">, GraphFamily> = {
  character: "people",
  relationship: "people",
  timeline_event: "story",
  scene: "story",
  thread: "threads",
  world: "world",
  tone: "world",
};

/**
 * The family each relation belongs to (the colour of its line). Typed over every relation except provenance, so a new
 * relation type fails to compile here and in the regression until it is placed.
 */
export const RELATION_FAMILY: Record<Exclude<GraphLinkRelation, "extracted_from">, GraphFamily> = {
  affects_relationship: "people",
  affects_character: "people",
  involves: "people",
  caused_by: "story",
  triggered_by: "story",
  occurred_in: "story",
  resolved_in: "threads",
  blocks: "threads",
  planted_in: "threads",
  paid_off_in: "threads",
  evidenced_by: "world",
};

/**
 * How a relation's line is drawn, after the approved mock-up: a `cause` line has an arrowhead, a `payoff` line is also
 * dashed, `provenance` is dotted and `context` (who, where, what changed) is the plain line. A relationship's line to
 * its own people is drawn as a fifth, People-coloured kind by the canvas, which knows both ends' types. Typed like
 * `RELATION_FAMILY`, so a new relation fails to compile until it is placed.
 */
export type GraphLineKind = "cause" | "payoff" | "provenance" | "context";

export const RELATION_LINE: Record<Exclude<GraphLinkRelation, "extracted_from">, GraphLineKind> = {
  caused_by: "cause",
  triggered_by: "cause",
  planted_in: "payoff",
  paid_off_in: "payoff",
  resolved_in: "payoff",
  blocks: "payoff",
  evidenced_by: "provenance",
  involves: "context",
  affects_character: "context",
  affects_relationship: "context",
  occurred_in: "context",
};

/** Context lines (who, where, what changed). Drawn only for the pointed-at or focused memory, so the canvas stays readable. */
export const BACKGROUND_RELATIONS: ReadonlySet<GraphLinkRelation> = new Set<GraphLinkRelation>([
  "involves",
  "occurred_in",
  "affects_relationship",
  "affects_character",
]);

/** `extracted_from` records where a memory came from; it is provenance, not a relation between memories. */
export function isGraphRelation(relation: GraphLinkRelation): relation is Exclude<GraphLinkRelation, "extracted_from"> {
  return relation !== "extracted_from";
}

export type ImportanceFilter = "all" | "hide-minor" | "major-up";

const IMPORTANCE_RANK: Record<LtmImportance, number> = { minor: 0, moderate: 1, major: 2, critical: 3 };
const FILTER_MIN_RANK: Record<ImportanceFilter, number> = { all: 0, "hide-minor": 1, "major-up": 2 };

/** The note shape the graph reads: a structural subset of the Vault's note, so tests need no full fixtures. */
export type GraphNoteInput = {
  id: string;
  type: LtmNoteType;
  status: LtmStatus;
  links: readonly Pick<LtmLink, "target" | "relation" | "aspect">[];
  sections?: Readonly<Record<string, { importance?: LtmImportance } | undefined>>;
};

export type GraphNode = {
  id: string;
  type: LtmNoteType;
  family: GraphFamily | "source";
  status: LtmStatus;
  importance: LtmImportance;
  /** Links to or from other memories in the graph, provenance excluded. */
  degree: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  relation: Exclude<GraphLinkRelation, "extracted_from">;
  family: GraphFamily;
  background: boolean;
  aspect?: string;
};

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type GraphOptions = {
  showSources?: boolean;
  showArchived?: boolean;
  importance?: ImportanceFilter;
  hiddenFamilies?: ReadonlySet<GraphFamily>;
};

/** A note's importance is its highest section importance; a note that states none is moderate, as in the editor. */
export function noteImportance(note: Pick<GraphNoteInput, "sections">): LtmImportance {
  let best: LtmImportance | null = null;
  for (const section of Object.values(note.sections ?? {})) {
    const value = section?.importance;
    if (value && (best === null || IMPORTANCE_RANK[value] > IMPORTANCE_RANK[best])) best = value;
  }
  return best ?? "moderate";
}

export function buildGraph(notes: readonly GraphNoteInput[], options: GraphOptions = {}): Graph {
  const minRank = FILTER_MIN_RANK[options.importance ?? "all"];
  const kept = new Map<string, GraphNode>();
  for (const note of notes) {
    if (note.type === "source" && !options.showSources) continue;
    if (note.status === "archived" && !options.showArchived) continue;
    const family = note.type === "source" ? "source" : NODE_FAMILY[note.type];
    if (family !== "source" && options.hiddenFamilies?.has(family)) continue;
    const importance = noteImportance(note);
    if (IMPORTANCE_RANK[importance] < minRank) continue;
    kept.set(note.id, { id: note.id, type: note.type, family, status: note.status, importance, degree: 0 });
  }

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const note of notes) {
    if (!kept.has(note.id)) continue;
    for (const link of note.links) {
      if (!isGraphRelation(link.relation) || link.target === note.id || !kept.has(link.target)) continue;
      const key = `${note.id}\u0000${link.target}\u0000${link.relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        source: note.id,
        target: link.target,
        relation: link.relation,
        family: RELATION_FAMILY[link.relation],
        background: BACKGROUND_RELATIONS.has(link.relation),
        ...(link.aspect ? { aspect: link.aspect } : {}),
      });
    }
  }
  for (const edge of edges) {
    kept.get(edge.source)!.degree += 1;
    kept.get(edge.target)!.degree += 1;
  }
  return { nodes: [...kept.values()], edges };
}

/** The lines to draw. Background lines appear only for the memory pointed at or focused (Declutter is always on). */
export function visibleEdges(graph: Graph, highlightedIds: ReadonlySet<string>): GraphEdge[] {
  return graph.edges.filter(
    (edge) => !edge.background || highlightedIds.has(edge.source) || highlightedIds.has(edge.target),
  );
}

/**
 * Ids within `hops` links of `id` in either direction, the memory itself included. Background links (a shared
 * character or place) count only on the first hop: past it they would pull in every memory that mentions the same
 * character, and their lines are not drawn there. Empty when `id` is not in the graph.
 */
export function neighbourhood(graph: Graph, id: string, hops: number): Set<string> {
  const known = new Set(graph.nodes.map((node) => node.id));
  if (!known.has(id)) return new Set();
  const adjacent = new Map<string, Array<{ id: string; background: boolean }>>();
  const add = (from: string, to: string, background: boolean) => {
    const list = adjacent.get(from) ?? [];
    list.push({ id: to, background });
    adjacent.set(from, list);
  };
  for (const edge of graph.edges) {
    add(edge.source, edge.target, edge.background);
    add(edge.target, edge.source, edge.background);
  }
  const reached = new Set([id]);
  let frontier = [id];
  for (let depth = 0; depth < hops && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const other of adjacent.get(current) ?? []) {
        if (reached.has(other.id) || (other.background && depth > 0)) continue;
        reached.add(other.id);
        next.push(other.id);
      }
    }
    frontier = next;
  }
  return reached;
}

/**
 * Where Focus mode starts: the Vault's selected memory, else the most-linked memory (ties by id), else none. Fewer
 * than half of a real vault's memories carry a link beyond provenance, so the Graph opens on one memory, not on all.
 */
export function defaultFocus(graph: Graph, selectedId: string | null | undefined): string | null {
  if (selectedId && graph.nodes.some((node) => node.id === selectedId)) return selectedId;
  let best: GraphNode | null = null;
  for (const node of graph.nodes) {
    if (node.degree === 0) continue;
    if (!best || node.degree > best.degree || (node.degree === best.degree && node.id < best.id)) best = node;
  }
  return best?.id ?? null;
}

export type GraphPoint = { x: number; y: number };

/** The canvas's pan and zoom: a layout point p shows at `p * k + (x, y)` on screen. */
export type GraphView = { k: number; x: number; y: number };

/**
 * The view after two fingers move from `before` to `after` (screen points): the zoom follows their spread, clamped to
 * `[minZoom, maxZoom]`, and the layout point under their midpoint stays under it.
 */
export function pinchView(
  view: GraphView,
  before: readonly [GraphPoint, GraphPoint],
  after: readonly [GraphPoint, GraphPoint],
  minZoom: number,
  maxZoom: number,
): GraphView {
  const spread = (pair: readonly [GraphPoint, GraphPoint]) =>
    Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) || 1;
  const middle = (pair: readonly [GraphPoint, GraphPoint]) => ({
    x: (pair[0].x + pair[1].x) / 2,
    y: (pair[0].y + pair[1].y) / 2,
  });
  const k = Math.min(maxZoom, Math.max(minZoom, view.k * (spread(after) / spread(before))));
  const from = middle(before);
  const to = middle(after);
  return { k, x: to.x - ((from.x - view.x) / view.k) * k, y: to.y - ((from.y - view.y) / view.k) * k };
}

/**
 * The memory a tap at a screen point picks: the nearest one whose disc, or a circle `minHit` screen pixels across
 * round its centre, holds the point. Null when none does.
 */
export function nodeAtPoint(
  positions: ReadonlyMap<string, GraphPoint>,
  radiusOf: (id: string) => number,
  view: GraphView,
  point: GraphPoint,
  minHit: number,
): string | null {
  let found: string | null = null;
  let nearest = Infinity;
  for (const [id, position] of positions) {
    const distance = Math.hypot(position.x * view.k + view.x - point.x, position.y * view.k + view.y - point.y);
    if (distance <= Math.max(radiusOf(id) * view.k, minHit / 2) && distance < nearest) {
      nearest = distance;
      found = id;
    }
  }
  return found;
}

export const LAYOUT_SIZE = 1000;
export const LAYOUT_MAX_ITERATIONS = 300;

export type LayoutResult = { positions: Map<string, GraphPoint>; iterations: number };

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded force layout: the same graph and seed always give the same positions. Nodes start in id order on a jittered
 * circle, repel each other, are pulled together along edges and cool over a fixed number of steps.
 *
 * ponytail: O(n^2) repulsion per step on the main thread, comfortable to about 500 visible nodes. Past that, move the
 * loop into a worker or swap in a spatial-index layout library; Focus mode and the family filters keep real vaults
 * well under the ceiling.
 */
export function layoutGraph(graph: Graph, seed = 1, iterations = LAYOUT_MAX_ITERATIONS): LayoutResult {
  const steps = Math.max(0, Math.min(Math.floor(iterations), LAYOUT_MAX_ITERATIONS));
  const ids = graph.nodes.map((node) => node.id).sort();
  const count = ids.length;
  const random = seededRandom(seed);
  const index = new Map(ids.map((id, position) => [id, position]));
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  const radius = LAYOUT_SIZE * 0.35;
  for (let i = 0; i < count; i += 1) {
    const angle = (2 * Math.PI * i) / Math.max(count, 1);
    xs[i] = LAYOUT_SIZE / 2 + radius * Math.cos(angle) + (random() - 0.5) * 20;
    ys[i] = LAYOUT_SIZE / 2 + radius * Math.sin(angle) + (random() - 0.5) * 20;
  }
  const pairs: Array<readonly [number, number]> = [];
  for (const edge of graph.edges) {
    const a = index.get(edge.source);
    const b = index.get(edge.target);
    if (a !== undefined && b !== undefined) pairs.push([a, b]);
  }

  const ideal = count > 0 ? Math.sqrt((LAYOUT_SIZE * LAYOUT_SIZE) / count) * 0.8 : 1;
  const dx = new Float64Array(count);
  const dy = new Float64Array(count);
  for (let step = 0; step < steps; step += 1) {
    dx.fill(0);
    dy.fill(0);
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        let vx = xs[i]! - xs[j]!;
        let vy = ys[i]! - ys[j]!;
        let distance = Math.hypot(vx, vy);
        if (distance < 0.01) {
          vx = (random() - 0.5) * 0.1;
          vy = (random() - 0.5) * 0.1;
          distance = 0.01;
        }
        const push = (ideal * ideal) / distance;
        dx[i]! += (vx / distance) * push;
        dy[i]! += (vy / distance) * push;
        dx[j]! -= (vx / distance) * push;
        dy[j]! -= (vy / distance) * push;
      }
    }
    for (const [a, b] of pairs) {
      const vx = xs[a]! - xs[b]!;
      const vy = ys[a]! - ys[b]!;
      const distance = Math.max(Math.hypot(vx, vy), 0.01);
      const pull = (distance * distance) / ideal;
      dx[a]! -= (vx / distance) * pull;
      dy[a]! -= (vy / distance) * pull;
      dx[b]! += (vx / distance) * pull;
      dy[b]! += (vy / distance) * pull;
    }
    const temperature = (LAYOUT_SIZE / 10) * (1 - step / steps);
    for (let i = 0; i < count; i += 1) {
      // A pull to the centre that grows with distance holds the layout near LAYOUT_SIZE across. No wall: clamping to
      // the box pinned most memories in a row along its edges, and the view fits whatever bounds the layout ends with.
      dx[i]! += LAYOUT_SIZE / 2 - xs[i]!;
      dy[i]! += LAYOUT_SIZE / 2 - ys[i]!;
      const length = Math.max(Math.hypot(dx[i]!, dy[i]!), 0.01);
      const move = Math.min(length, temperature);
      xs[i] = xs[i]! + (dx[i]! / length) * move;
      ys[i] = ys[i]! + (dy[i]! / length) * move;
    }
  }
  const positions = new Map<string, GraphPoint>();
  ids.forEach((id, position) => positions.set(id, { x: xs[position]!, y: ys[position]! }));
  return { positions, iterations: steps };
}

/** The note shape `subjectPeopleLinker` reads. */
export type SubjectLinkNote = {
  id: string;
  type: LtmNoteType;
  status: LtmStatus;
  links: readonly Pick<LtmLink, "target" | "relation">[];
  subjects?: ReadonlyArray<{ key: string }> | undefined;
};

/**
 * A relationship names its people in its subject fields, and extraction or the editor rarely store a link to their
 * character memories as well. The returned function gives a relationship its stored links plus an `involves` link to
 * the character memory standing for each subject it names, so the Graph draws its "Between" lines with nothing to save.
 * Display only: nothing is written, and recall ignores `involves`. Unarchived character memories win over archived
 * ones and ties go to the lowest id; a subject with no character memory gets no line, and other notes come back as is.
 */
export function subjectPeopleLinker(
  candidates: Iterable<Pick<SubjectLinkNote, "id" | "type" | "status" | "subjects">>,
): <T extends SubjectLinkNote>(note: T) => T {
  const characters = [...candidates]
    .filter((candidate) => candidate.type === "character")
    .sort(
      (left, right) =>
        Number(left.status === "archived") - Number(right.status === "archived") || (left.id < right.id ? -1 : 1),
    );
  const byKey = new Map<string, string>();
  for (const character of characters) {
    for (const own of character.subjects ?? []) if (!byKey.has(own.key)) byKey.set(own.key, character.id);
  }
  return (note) => {
    if (note.type !== "relationship") return note;
    const targets: string[] = [];
    for (const subject of note.subjects ?? []) {
      const target = byKey.get(subject.key);
      if (!target || target === note.id || targets.includes(target)) continue;
      if (note.links.some((link) => link.target === target && link.relation === "involves")) continue;
      targets.push(target);
    }
    if (targets.length === 0) return note;
    return { ...note, links: [...note.links, ...targets.map((target) => ({ target, relation: "involves" as const }))] };
  };
}
