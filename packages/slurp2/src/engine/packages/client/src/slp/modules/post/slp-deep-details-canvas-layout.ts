// Deep details canvas geometry (04 §9): cards on a grid, arrows routed through the gaps between
// them. Pure, so the "no arrow crosses a card" rule has a regression of its own.
import type { SlpFlowGraph, SlpFlowNode } from "./slp-deep-details-flow";

export const SLP_FLOW_NODE_W = 220;
export const SLP_FLOW_NODE_H = 168;
const NODE_W = SLP_FLOW_NODE_W;
const NODE_H = SLP_FLOW_NODE_H;
const GAP_X = 56;
const GAP_Y = 64;
const PAD = 40;

// Parallel lanes in one gap sit this far apart, so two arrows never share a line.
const LANE_SPACING = 6;

export type Box = { x: number; y: number; row: number; col: number };

export const isSlpFlowMain = (node: SlpFlowNode) => node.kind === "step" || node.kind === "model";
const isMain = isSlpFlowMain;

/** How many card columns fit in `width` pixels at 100 %, so the diagram opens with nothing cut off. */
export function slpFlowCanvasColumns(width: number) {
  return Math.max(2, Math.floor((width - PAD * 2 + GAP_X) / (NODE_W + GAP_X)));
}

/**
 * A grid, top to bottom: the data sources, then the steps in bands of `maxCols`, left to right,
 * each step with the values resolved for it stacked above it. Every card sits in a cell, so the
 * gaps between columns and rows stay free for arrows.
 */
export function layoutSlpFlowCanvas(graph: SlpFlowGraph, maxCols = Number.POSITIVE_INFINITY) {
  const main = graph.nodes.filter(isMain);
  const sources = graph.nodes.filter((node) => node.kind === "source");
  const cols = Math.max(1, Math.min(maxCols, Math.max(main.length, 1)));
  const at = (col: number, row: number): Box => ({
    x: PAD + col * (NODE_W + GAP_X),
    y: PAD + row * (NODE_H + GAP_Y),
    row,
    col,
  });
  const boxes = new Map<string, Box>();
  // Sources fill the top rows, spread over the columns so their arrows fan out.
  const sourceRows = Math.ceil(sources.length / cols);
  sources.forEach((node, index) => {
    const row = Math.floor(index / cols);
    const inRow = Math.min(cols, sources.length - row * cols);
    const slot = index % cols;
    boxes.set(node.id, at(inRow > 1 ? Math.round((slot * (cols - 1)) / (inRow - 1)) : 0, row));
  });
  const inputs = graph.nodes.filter((node) => node.kind === "input");
  const inputsOf = (column: number) => inputs.filter((node) => node.column === column);
  let row = sourceRows;
  for (let start = 0; start < main.length; start += cols) {
    const band = main.slice(start, start + cols);
    const above = Math.max(0, ...band.map((node) => inputsOf(node.column).length));
    const mainRow = row + above;
    band.forEach((node, index) => {
      boxes.set(node.id, at(index, mainRow));
      // A resolved value sits over the step it feeds, nearest first.
      inputsOf(node.column).forEach((input, level) => boxes.set(input.id, at(index, mainRow - level - 1)));
    });
    row = mainRow + 1;
  }
  // Values whose step is missing still get a place, under everything.
  for (const node of graph.nodes) if (!boxes.has(node.id)) boxes.set(node.id, at(0, row++));
  return {
    boxes,
    width: PAD * 2 + cols * (NODE_W + GAP_X) - GAP_X,
    // One spare gap under the last row for an arrow that runs under its own row.
    height: PAD * 2 + row * (NODE_H + GAP_Y) - GAP_Y + GAP_Y / 2,
  };
}

/**
 * Orthogonal routing: arrows leave a card downwards, run along the gap under its row, drop through
 * the gap left of the target's column, and enter the target from above. Cards sit only in cells, so
 * no arrow crosses a card. `lane` shifts the arrow inside its gaps; `slot` spreads the arrows that
 * enter one card across its top edge.
 */
export function routeSlpFlowEdge(
  from: Box,
  to: Box,
  lane: number,
  slot: { index: number; count: number },
): { d: string; label: { x: number; y: number } } {
  if (from.row === to.row) {
    const y = from.y + NODE_H / 2;
    if (to.col === from.col + 1) {
      return { d: `M ${from.x + NODE_W} ${y} H ${to.x}`, label: { x: (from.x + NODE_W + to.x) / 2, y } };
    }
    // Not neighbours: under the row, then back up into the target.
    const under = from.y + NODE_H + GAP_Y / 2 + lane;
    const x1 = from.x + NODE_W / 2;
    const x2 = to.x + NODE_W / 2;
    return {
      d: `M ${x1} ${from.y + NODE_H} V ${under} H ${x2} V ${to.y + NODE_H}`,
      label: { x: (x1 + x2) / 2, y: under },
    };
  }
  const exitX = from.x + NODE_W / 2 + lane;
  const entryX = to.x + (NODE_W * (slot.index + 1)) / (slot.count + 1);
  const below = from.y + NODE_H + GAP_Y / 2 + lane;
  const label = { x: entryX, y: to.y - GAP_Y / 4 };
  if (to.row === from.row + 1) {
    return { d: `M ${exitX} ${from.y + NODE_H} V ${below} H ${entryX} V ${to.y}`, label };
  }
  const gutter = to.x - GAP_X / 2 + lane;
  const above = to.y - GAP_Y / 2 + lane;
  return {
    d: `M ${exitX} ${from.y + NODE_H} V ${below} H ${gutter} V ${above} H ${entryX} V ${to.y}`,
    label,
  };
}

/** Every edge's path. Each card that sends arrows gets its own lane; a card's incoming arrows share its top. */
export function routeSlpFlowGraph(graph: SlpFlowGraph, boxes: Map<string, Box>) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const senders = [...new Set(graph.edges.map((edge) => edge.from))].filter((id) => {
    const node = byId.get(id);
    return node && !isMain(node);
  });
  // Four lanes either side of the middle one, which the main line keeps for itself.
  const laneOf = (id: string) => {
    const index = senders.indexOf(id);
    return index < 0 ? 0 : ((index % 4) - 1.5) * LANE_SPACING;
  };
  const routes = new Map<SlpFlowGraph["edges"][number], ReturnType<typeof routeSlpFlowEdge>>();
  for (const edge of graph.edges) {
    const from = boxes.get(edge.from);
    const to = boxes.get(edge.to);
    if (!from || !to) continue;
    const into = graph.edges
      .filter((entry) => entry.to === edge.to && boxes.get(entry.from)?.row !== to.row)
      .sort((a, b) => (boxes.get(a.from)?.x ?? 0) - (boxes.get(b.from)?.x ?? 0));
    routes.set(
      edge,
      routeSlpFlowEdge(from, to, laneOf(edge.from), {
        index: Math.max(0, into.indexOf(edge)),
        count: Math.max(1, into.length),
      }),
    );
  }
  return routes;
}
