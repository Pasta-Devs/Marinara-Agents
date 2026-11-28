import assert from "node:assert/strict";

import {
  ltmLinkRelationSchema,
  ltmNoteTypeSchema,
} from "../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.js";
import {
  BACKGROUND_RELATIONS,
  buildGraph,
  defaultFocus,
  LAYOUT_MAX_ITERATIONS,
  LAYOUT_SIZE,
  layoutGraph,
  neighbourhood,
  nodeAtPoint,
  NODE_FAMILY,
  pinchView,
  RELATION_FAMILY,
  RELATION_LINE,
  subjectPeopleLinker,
  visibleEdges,
  type GraphNoteInput,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/vault/graph-layout.js";

type Relation = GraphNoteInput["links"][number]["relation"];
const note = (
  id: string,
  type: GraphNoteInput["type"],
  links: Array<[string, Relation]> = [],
  extra: Partial<GraphNoteInput> = {},
): GraphNoteInput => ({
  id,
  type,
  status: "active",
  links: links.map(([target, relation]) => ({ target, relation })),
  ...extra,
});

// A new relation or note type must be placed before it ships: every one maps to a family (provenance aside).
for (const relation of ltmLinkRelationSchema.options) {
  if (relation === "extracted_from") {
    assert.equal(relation in RELATION_FAMILY, false, "provenance is not a relation family");
    continue;
  }
  assert.ok(RELATION_FAMILY[relation], `relation ${relation} has a family`);
  assert.ok(RELATION_LINE[relation], `relation ${relation} has a line style`);
}
for (const type of ltmNoteTypeSchema.options) {
  if (type !== "source") assert.ok(NODE_FAMILY[type], `note type ${type} has a family`);
}
for (const relation of BACKGROUND_RELATIONS) assert.ok(ltmLinkRelationSchema.options.includes(relation));

// extracted_from is provenance, so it is neither an edge nor a degree.
const sourceLinked = [
  note("src_1", "source"),
  note("tl_a", "timeline_event", [["src_1", "extracted_from"]]),
  note("tl_b", "timeline_event", [["tl_a", "caused_by"]]),
];
let graph = buildGraph(sourceLinked, { showSources: true });
assert.deepEqual(
  graph.edges.map((edge) => edge.relation),
  ["caused_by"],
  "extracted_from draws no edge",
);
assert.equal(graph.nodes.find((node) => node.id === "src_1")!.degree, 0, "provenance adds no degree");
assert.equal(
  buildGraph(sourceLinked).nodes.some((node) => node.type === "source"),
  false,
  "Sources chip is off by default",
);

// Background relations show only for the pointed-at or focused memory.
const withBackground = [
  note("ch_mira", "character"),
  note("pl_inn", "world"),
  note("tl_a", "timeline_event", [
    ["ch_mira", "involves"],
    ["pl_inn", "occurred_in"],
  ]),
  note("tl_b", "timeline_event", [["tl_a", "caused_by"]]),
];
graph = buildGraph(withBackground);
assert.deepEqual(
  visibleEdges(graph, new Set()).map((edge) => edge.relation),
  ["caused_by"],
  "background hidden",
);
assert.deepEqual(
  visibleEdges(graph, new Set(["tl_a"]))
    .map((edge) => edge.relation)
    .sort(),
  ["caused_by", "involves", "occurred_in"],
  "background shown for the focused memory",
);
assert.deepEqual(
  visibleEdges(graph, new Set(["ch_mira"]))
    .map((edge) => edge.relation)
    .sort(),
  ["caused_by", "involves"],
  "background shown for the pointed-at memory only",
);

// Two-hop neighbourhood follows links in both directions.
const chain = [
  note("a", "timeline_event", [["b", "caused_by"]]),
  note("b", "timeline_event", [["c", "caused_by"]]),
  note("c", "timeline_event", [["d", "caused_by"]]),
  note("d", "timeline_event"),
  note("e", "timeline_event"),
];
graph = buildGraph(chain);
assert.deepEqual([...neighbourhood(graph, "b", 2)].sort(), ["a", "b", "c", "d"], "two hops around b");
assert.deepEqual([...neighbourhood(graph, "a", 1)].sort(), ["a", "b"], "one hop from the end");
assert.deepEqual([...neighbourhood(graph, "zzz", 2)], [], "an unknown memory has no neighbourhood");

// A shared character does not widen Focus past the first hop, and an edge to a missing node cannot break the layout.
const shared = buildGraph([
  note("ch_mira", "character"),
  note("tl_a", "timeline_event", [["ch_mira", "involves"]]),
  note("tl_b", "timeline_event", [["ch_mira", "involves"]]),
]);
assert.deepEqual([...neighbourhood(shared, "tl_a", 2)].sort(), ["ch_mira", "tl_a"], "background links stop at one hop");
assert.deepEqual(
  [...neighbourhood(shared, "ch_mira", 1)].sort(),
  ["ch_mira", "tl_a", "tl_b"],
  "the character itself sees both",
);
const dangling = layoutGraph({
  nodes: buildGraph([note("a", "timeline_event")]).nodes,
  edges: [{ source: "a", target: "gone", relation: "caused_by", family: "story", background: false }],
});
assert.ok(
  [...dangling.positions.values()].every(({ x, y }) => Number.isFinite(x + y)),
  "a dangling edge is ignored",
);

// defaultFocus: selected memory, then most links (ties by id), then none.
assert.equal(defaultFocus(graph, "e"), "e", "the selected memory wins even without links");
assert.equal(defaultFocus(graph, null), "b", "most links, ties by id (b and c both have 2)");
assert.equal(defaultFocus(graph, "gone"), "b", "a selection that is not in the graph is ignored");
assert.equal(defaultFocus(buildGraph([note("x", "world"), note("y", "tone")]), null), null, "no links gives none");
assert.equal(defaultFocus(buildGraph([]), null), null, "empty vault gives none");

// Filters: importance, archived, family.
const mixed: GraphNoteInput[] = [
  note("minor", "world", [["major", "evidenced_by"]], { sections: { facts: { importance: "minor" } } }),
  note("major", "character", [], { sections: { facts: { importance: "minor" }, state: { importance: "major" } } }),
  note("plain", "thread"),
  { ...note("old", "timeline_event"), status: "archived" },
];
assert.deepEqual(
  buildGraph(mixed).nodes.map((node) => node.id),
  ["minor", "major", "plain"],
  "archived is off by default",
);
assert.equal(buildGraph(mixed, { showArchived: true }).nodes.length, 4);
assert.deepEqual(
  buildGraph(mixed, { importance: "hide-minor" }).nodes.map((node) => node.id),
  ["major", "plain"],
);
assert.deepEqual(
  buildGraph(mixed, { importance: "major-up" }).nodes.map((node) => node.id),
  ["major"],
);
assert.deepEqual(
  buildGraph(mixed, { hiddenFamilies: new Set(["world"]) }).edges,
  [],
  "hiding a family removes its nodes and their lines",
);

// The layout is deterministic and respects its iteration cap.
const small = buildGraph(chain);
const first = layoutGraph(small, 7);
const second = layoutGraph(small, 7);
assert.deepEqual([...first.positions], [...second.positions], "same seed gives the same positions");
assert.notDeepEqual([...first.positions], [...layoutGraph(small, 8).positions], "another seed lays out differently");
assert.ok([...first.positions.values()].every(({ x, y }) => Number.isFinite(x + y)));

// A hub with many unlinked memories spreads out round the middle instead of pinning a row of them along the edges.
{
  const crowd = buildGraph([
    note("ch_hub", "character"),
    ...Array.from({ length: 60 }, (_, i) =>
      note(`tl_${String(i).padStart(2, "0")}`, "timeline_event", i < 20 ? [["ch_hub", "caused_by"]] : []),
    ),
  ]);
  const points = [...layoutGraph(crowd).positions.values()];
  const onEdge = points.filter(({ x, y }) => [x, y].some((value) => value === 0 || value === LAYOUT_SIZE));
  assert.equal(onEdge.length, 0, "no memory is pinned to the layout box");
  const xs = points.map(({ x }) => x);
  const span = Math.max(...xs) - Math.min(...xs);
  assert.ok(
    span > LAYOUT_SIZE * 0.5 && span < LAYOUT_SIZE * 2,
    `the layout keeps about LAYOUT_SIZE across, got ${span}`,
  );
  let closest = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      closest = Math.min(closest, Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y));
    }
  }
  assert.ok(closest > 30, `no two memories stack, closest pair ${closest}`);
}
assert.equal(layoutGraph(buildGraph([])).positions.size, 0, "an empty graph lays out");

const big: GraphNoteInput[] = Array.from({ length: 500 }, (_, i) =>
  note(
    `n${String(i).padStart(3, "0")}`,
    "timeline_event",
    i > 0 ? [[`n${String(Math.floor(i / 2)).padStart(3, "0")}`, "caused_by"]] : [],
  ),
);
const started = Date.now();
const large = layoutGraph(buildGraph(big), 1, 10_000);
assert.equal(large.positions.size, 500);
assert.equal(large.iterations, LAYOUT_MAX_ITERATIONS, "the iteration count is capped");
assert.ok(Date.now() - started < 15_000, "500 nodes finish in reasonable time");

// A relationship gets an `involves` line to the character memory for each subject it names, with nothing stored:
// active over archived, no duplicate of a stored link, a subject without a character memory skipped.
{
  const person = (id: string, key: string, status: GraphNoteInput["status"] = "active") => ({
    ...note(id, "character", [], { status }),
    subjects: [{ key }],
  });
  const people = subjectPeopleLinker([
    person("char_mira_old", "mira", "archived"),
    person("char_mira", "mira"),
    person("char_kael", "kael"),
  ]);
  const pair = {
    ...note("rel", "relationship", [["char_kael", "involves"]]),
    subjects: [{ key: "mira" }, { key: "kael" }, { key: "nobody" }],
  };
  const linked = people(pair);
  assert.deepEqual(
    linked.links.map((link) => `${link.relation}:${link.target}`),
    ["involves:char_kael", "involves:char_mira"],
    "the missing person is added once, the active memory wins, an unknown subject is skipped",
  );
  assert.deepEqual(pair.links, [{ target: "char_kael", relation: "involves" }], "the stored note is not changed");
  const thread = { ...note("thread", "thread"), subjects: [{ key: "mira" }] };
  assert.equal(people(thread), thread, "only relationships get people lines");
  const edges = buildGraph([person("char_mira", "mira"), person("char_kael", "kael"), linked]).edges;
  assert.deepEqual(
    edges.map((edge) => `${edge.source}>${edge.target}:${edge.relation}:${edge.background}`),
    ["rel>char_kael:involves:true", "rel>char_mira:involves:true"],
    "the derived links draw as People background lines",
  );
}

// Pinch zoom keeps the point under the fingers still and clamps the zoom; a tap picks the nearest memory within reach.
{
  const view = { k: 0.5, x: 10, y: 20 };
  const spread = pinchView(
    view,
    [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ],
    [
      { x: 50, y: 100 },
      { x: 250, y: 100 },
    ],
    0.12,
    4,
  );
  assert.equal(spread.k, 1, "fingers twice as far apart zoom in twice");
  // The layout point under the midpoint (150, 100) before stays under it after.
  assert.deepEqual(
    { x: (150 - spread.x) / spread.k, y: (100 - spread.y) / spread.k },
    { x: (150 - view.x) / view.k, y: (100 - view.y) / view.k },
  );
  const moved = pinchView(
    view,
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    [
      { x: 30, y: 40 },
      { x: 40, y: 40 },
    ],
    0.12,
    4,
  );
  assert.deepEqual(moved, { k: 0.5, x: 40, y: 60 }, "two fingers moving together pan");
  const capped = pinchView(
    view,
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    0.12,
    4,
  );
  assert.equal(capped.k, 4, "the zoom is clamped");

  const positions = new Map([
    ["near", { x: 100, y: 100 }],
    ["far", { x: 160, y: 100 }],
  ]);
  const radius = () => 10;
  const zoomedOut = { k: 0.3, x: 0, y: 0 }; // near shows at (30, 30), far at (48, 30), each disc 3 px across.
  assert.equal(nodeAtPoint(positions, radius, zoomedOut, { x: 50, y: 30 }, 44), "far", "the nearest one wins");
  assert.equal(
    nodeAtPoint(positions, radius, zoomedOut, { x: 30, y: 50 }, 44),
    "near",
    "a 44 px reach round a tiny disc",
  );
  assert.equal(nodeAtPoint(positions, radius, zoomedOut, { x: 30, y: 60 }, 44), null, "past the reach is empty space");
  assert.equal(
    nodeAtPoint(positions, radius, { k: 4, x: 0, y: 0 }, { x: 400, y: 435 }, 44),
    "near",
    "a disc bigger than the reach counts whole",
  );
}

console.log("long-term-memory graph layout OK");
