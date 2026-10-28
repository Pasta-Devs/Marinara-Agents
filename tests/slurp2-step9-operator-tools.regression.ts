/** Redesign step 9 (operator tools): Deep details summary + canvas routing, image context, report sheet, share rows. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  layoutSlpFlowCanvas,
  routeSlpFlowGraph,
  SLP_FLOW_NODE_H,
  SLP_FLOW_NODE_W,
  slpFlowCanvasColumns,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-deep-details-canvas-layout.ts";
import type {
  SlpFlowGraph,
  SlpFlowNode,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/post/slp-deep-details-flow.ts";

const slp = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/client/src/slp");
const src = (path: string) => readFileSync(join(slp, path), "utf8");
const en = JSON.parse(src("locales/en.json")) as Record<string, string>;

// 1. Canvas: a graph shaped like a real post (sources, values stacked over their steps, 11 steps).
const node = (id: string, kind: SlpFlowNode["kind"], column: number): SlpFlowNode => ({
  id,
  kind,
  lane: column < 4 ? "text" : "image",
  title: id,
  status: "done",
  model: null,
  inputs: [],
  outputs: [],
  what: "",
  why: "",
  details: [],
  column,
});
const steps = Array.from({ length: 11 }, (_, index) => node(`s${index}`, index % 3 ? "step" : "model", index));
const values = [node("v0a", "input", 0), node("v0b", "input", 0), node("v5a", "input", 5), node("v5b", "input", 5)];
const sources = ["creator", "memory", "card", "prompts", "slurp", "engine"].map((id) => node(id, "source", 0));
const graph: SlpFlowGraph = {
  nodes: [...sources, ...values, ...steps],
  edges: [
    ...steps.slice(1).map((step, index) => ({ from: steps[index]!.id, to: step.id, label: null })),
    { from: "v0a", to: "s0", label: "weights" },
    { from: "v0b", to: "s0", label: "why now" },
    { from: "v5a", to: "s5", label: "look" },
    { from: "v5b", to: "s6", label: "style" },
    { from: "v5a", to: "s7", label: "character context" },
    ...["creator", "memory"].map((from) => ({ from, to: "v0a", label: "x" })),
    ...["creator", "card"].map((from) => ({ from, to: "v5a", label: "x" })),
    ...["prompts", "slurp", "engine"].flatMap((from) => ["s2", "s5", "s9"].map((to) => ({ from, to, label: "x" }))),
  ],
};

type Rect = { x: number; y: number };
/** Axis-aligned segments of an "M x y V … H …" path. */
function segments(d: string) {
  const tokens = d.trim().split(/\s+/u);
  assert.equal(tokens[0], "M", `path starts with a move: ${d}`);
  let x = Number(tokens[1]);
  let y = Number(tokens[2]);
  const out: [number, number, number, number][] = [];
  for (let index = 3; index < tokens.length; index += 2) {
    const value = Number(tokens[index + 1]);
    assert.ok(tokens[index] === "H" || tokens[index] === "V", `only straight runs: ${d}`);
    const next = tokens[index] === "H" ? [value, y] : [x, value];
    out.push([x, y, next[0]!, next[1]!]);
    [x, y] = next as [number, number];
  }
  return out;
}
/** True when the segment runs through the inside of the card (touching its edge is fine). */
function crosses([x1, y1, x2, y2]: [number, number, number, number], box: Rect) {
  const [left, right, top, bottom] = [box.x, box.x + SLP_FLOW_NODE_W, box.y, box.y + SLP_FLOW_NODE_H];
  const [minX, maxX, minY, maxY] = [Math.min(x1, x2), Math.max(x1, x2), Math.min(y1, y2), Math.max(y1, y2)];
  return (
    minX < right &&
    maxX > left &&
    minY < bottom &&
    maxY > top &&
    (x1 === x2 ? x1 > left && x1 < right : y1 > top && y1 < bottom)
  );
}

for (const cols of [2, 3, Number.POSITIVE_INFINITY]) {
  const { boxes, width } = layoutSlpFlowCanvas(graph, cols);
  assert.equal(boxes.size, graph.nodes.length, "every card has a place");
  const cells = new Set([...boxes.values()].map((box) => `${box.row}:${box.col}`));
  assert.equal(cells.size, boxes.size, `no two cards share a cell (${cols} columns)`);
  const routes = routeSlpFlowGraph(graph, boxes);
  assert.equal(routes.size, graph.edges.length, "every edge is drawn");
  for (const [edge, route] of routes) {
    for (const segment of segments(route.d)) {
      for (const [id, box] of boxes) {
        assert.ok(!crosses(segment, box), `${edge.from} → ${edge.to} runs through ${id} (${cols} columns): ${route.d}`);
      }
    }
    // An arrow into a card from above ends on its top edge.
    const to = boxes.get(edge.to)!;
    const end = segments(route.d).at(-1)!;
    assert.ok(
      end[3] === to.y || end[2] === to.x || end[3] === to.y + SLP_FLOW_NODE_H,
      `${edge.from} → ${edge.to} ends on the card`,
    );
  }
  if (Number.isFinite(cols)) assert.ok(width <= 40 * 2 + cols * (SLP_FLOW_NODE_W + 56), "width follows the columns");
}
// Fit-to-width: the columns chosen for a panel fit it at 100 % (desktop ~908 px, tablet ~690 px).
for (const panel of [908, 690, 1200]) {
  const { width } = layoutSlpFlowCanvas(graph, slpFlowCanvasColumns(panel));
  assert.ok(width <= panel, `${panel} px panel: the canvas (${width} px) opens with nothing cut off`);
}
assert.ok(slpFlowCanvasColumns(908) >= 3, "a desktop panel shows at least three columns");
const canvas = src("modules/post/SlpDeepDetailsCanvas.tsx");
assert.match(canvas, /line-clamp-2/u, "node titles wrap to two lines");
assert.doesNotMatch(canvas, /<p className="truncate text-sm font-bold">\{node\.title\}/u);
assert.match(canvas, /slpFlowCanvasColumns\(available/u, "the canvas fits the width on open");

// 2. Deep details on phones: summary first, one group of five rows, opaque panel, honest states.
const modal = src("modules/post/SlpDeepDetailsModal.tsx");
const summary = src("modules/post/SlpDeepDetailsSummary.tsx");
// M (user, 2026-09-28): the rows became the post's story and moved into one pure model
// (slp-deep-details-story.ts, own regression); the phone still opens on a short list of rows.
const story = src("modules/post/slp-deep-details-story.ts");
for (const title of ["Why it went up", "What happens", "The writing", "The picture", "Since it went up"]) {
  assert.ok(story.includes(`title: "${title}"`), `summary row "${title}"`);
}
assert.match(summary, /<details className="group">/u, "summary rows expand");
assert.match(modal, /wide && graph \? \["summary", "flow", "canvas", "data"\] : \["summary", "data"\]/u);
assert.match(modal, /background: "var\(--slurp-surface\)"/u, "the panel is opaque");
assert.match(modal, /<SlpSkeleton\s+shape="rows"/u, "skeleton while loading");
assert.match(
  modal,
  /waitText=\{retrying \? t\("ui\.slurp\.deepDetails\.retrying"/u,
  "Retrying… replaces Still connecting… during backoff",
);
assert.match(modal, /query\.failureCount > 0/u);
assert.equal(en["ui.slurp.deepDetails.retrying"], "Retrying…");
assert.match(modal, /<SlpErrorState/u);
assert.match(modal, /<SlpTimestamp value=\{data\.post\.createdAt\}/u, "the header uses the one Timestamp");
const parts = src("modules/post/SlpDeepDetailsParts.tsx");
assert.match(parts, /if \(status === "done"\) return null;/u, "Completed is not shown");
assert.match(parts, /formatFullTime\(value, i18next\.language\)/u, "one date format");
assert.match(parts, /formatSlpPercent\(percent \/ 100/u, "one rate format");
const flow = src("modules/post/slp-deep-details-flow.ts");
assert.doesNotMatch(flow, /textOnlyRate\} \/ 100/u, "no '/ 100' rates");
assert.doesNotMatch(flow, /`Started \$\{attempt\.startedAt\}`/u, "no raw ISO dates");
for (const file of [
  "SlpDeepDetailsModal.tsx",
  "SlpDeepDetailsFlow.tsx",
  "SlpDeepDetailsParts.tsx",
  "SlpDeepDetailsCanvas.tsx",
  "SlpDeepDetailsImageRuns.tsx",
  "SlpDeepDetailsSummary.tsx",
]) {
  assert.doesNotMatch(src(`modules/post/${file}`), /\buppercase\b/u, `${file}: no uppercase labels`);
}

// 3. Image context: a neutral disclosure with its own close, from the Creator tools group.
const card = src("modules/post/SlpPostCard.tsx");
const context = card.slice(card.indexOf("{imageContextOpen && hasImageContext && ("));
assert.match(
  context.slice(0, 600),
  /bg-\[color-mix\(in_srgb,var\(--slurp-text\)_6%,transparent\)\]/u,
  "neutral surface",
);
assert.doesNotMatch(context.slice(0, 600), /noodle-accent\)\/10/u, "not the error tint");
assert.match(context, /aria-expanded=\{imageContextExpanded\}/u);
assert.match(context, /onClick=\{\(\) => setImageContextOpen\(false\)\}/u, "own close");
assert.equal(en["ui.slurp.post.imageContextTitle"], "How this picture was made");
const menu = src("modules/post/SlpPostMenu.tsx");
const tools = menu.indexOf('ui.slurp.post.creatorTools"');
assert.ok(tools > 0 && menu.indexOf("ui.slurp.post.showImageContext") > tools, "image context sits in Creator tools");

// 4. Share rows: "Send in a chat" (off with a reason without a persona) and "Save as image"; no duplicate card download.
assert.match(menu, /disabled=\{!onShare\}/u);
assert.match(menu, /ui\.slurp\.post\.sendInChatNeedsPersona/u);
assert.match(menu, /ui\.slurp\.post\.saveImage/u);
assert.doesNotMatch(menu, /ui\.slurp\.post\.downloadCard/u, "the post card download is folded into Save as image");
assert.match(src("modules/chrome/SlpSheet.tsx"), /aria-describedby=\{hint \? hintId : undefined\}/u);

// 5. Report: nothing preselected, optional details, a reason under the disabled submit, a confirmation with Done.
const report = src("modules/post/SlpReportModal.tsx");
assert.match(report, /useState<SlpReportReason \| null>\(null\)/u);
assert.match(report, /ui\.slurp\.post\.reportDetailsOptional/u);
assert.match(report, /ui\.slurp\.post\.reportNeedsReason/u);
assert.match(report, /ui\.slurp\.post\.reportNeedsDetails/u);
assert.match(report, /footer=\{/u, "buttons sit in the sheet footer, not a sticky band inside the body");
assert.match(report, /ui\.slurp\.post\.reportDone/u);
for (const key of [
  "reportDetailsOptional",
  "reportNeedsReason",
  "reportNeedsDetails",
  "reportDone",
  "reportDuplicate",
  "reportWhatNext",
  "sendInChat",
  "sendInChatNeedsPersona",
  "saveImage",
  "imageContextClose",
]) {
  assert.ok(en[`ui.slurp.post.${key}`], `en.json has ui.slurp.post.${key}`);
}
assert.doesNotMatch(en["ui.slurp.post.reportWhatNext"]!, /simulat|fake|\bAI\b/u, "in-universe copy");

console.log("slurp2 step 9 operator tools regression passed");
