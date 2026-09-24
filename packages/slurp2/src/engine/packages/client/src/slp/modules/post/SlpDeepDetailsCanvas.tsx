import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { SlpFlowGraph, SlpFlowNode } from "./slp-deep-details-flow";
import { ModelChip, SlpFlowNodeBody } from "./SlpDeepDetailsFlow";
import { StepStatus } from "./SlpDeepDetailsParts";

const NODE_W = 260;
const NODE_H = 164;
const GAP_X = 72;
const GAP_Y = 64;
const PAD = 28;
const ZOOMS = [0.5, 0.65, 0.8, 1, 1.2];
const DEFAULT_ZOOM = 3;

type Box = { x: number; y: number };

const isMain = (node: SlpFlowNode) => node.kind === "step" || node.kind === "model";

/**
 * Three bands, top to bottom: the data sources, the values resolved from them (stacked over the
 * step they feed), and the main line of steps from left to right.
 */
function layout(graph: SlpFlowGraph) {
  const main = graph.nodes.filter(isMain);
  const sources = graph.nodes.filter((node) => node.kind === "source");
  const inputsAbove = new Map<number, number>();
  for (const node of graph.nodes) {
    if (node.kind === "input") inputsAbove.set(node.column, (inputsAbove.get(node.column) ?? 0) + 1);
  }
  const inputRows = Math.max(0, ...inputsAbove.values());
  const sourceBand = sources.length > 0 ? NODE_H + GAP_Y * 2 : 0;
  const mainY = PAD + sourceBand + inputRows * (NODE_H + GAP_Y);
  const width = PAD * 2 + Math.max(main.length, sources.length) * (NODE_W + GAP_X) - GAP_X;
  const boxes = new Map<string, Box>();
  main.forEach((node, index) => boxes.set(node.id, { x: PAD + index * (NODE_W + GAP_X), y: mainY }));
  // Sources spread across the full width so their arrows fan out rather than bunch at the left.
  const spread = sources.length > 1 ? (width - PAD * 2 - NODE_W) / (sources.length - 1) : 0;
  sources.forEach((node, index) => boxes.set(node.id, { x: PAD + index * spread, y: PAD }));
  const stacked = new Map<number, number>();
  for (const node of graph.nodes) {
    if (node.kind !== "input") continue;
    // A resolved value sits over the first main step in its column.
    const anchor = main.find((entry) => entry.column === node.column);
    const x = anchor ? boxes.get(anchor.id)!.x : PAD;
    const level = (stacked.get(node.column) ?? 0) + 1;
    stacked.set(node.column, level);
    boxes.set(node.id, { x, y: mainY - level * (NODE_H + GAP_Y) });
  }
  return { boxes, width, height: mainY + NODE_H + PAD };
}

function edgePath(from: Box, to: Box, fromNode: SlpFlowNode) {
  if (fromNode.kind === "input" || fromNode.kind === "source") {
    // Down from the source's bottom into the top of the step it feeds.
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H;
    const x2 = to.x + NODE_W / 2 + (to.x === from.x ? 0 : -NODE_W / 4);
    const y2 = to.y;
    const bend = Math.max(28, (y2 - y1) / 2);
    return {
      d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
      mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
    };
  }
  const x1 = from.x + NODE_W;
  const y = from.y + NODE_H / 2;
  return { d: `M ${x1} ${y} L ${to.x} ${y}`, mid: { x: (x1 + to.x) / 2, y } };
}

/** A label that stays legible over lines and the grid: text on its own surface. */
function EdgeLabel({ x, y, text }: { x: number; y: number; text: string }) {
  const width = text.length * 6.6 + 16;
  return (
    <g>
      <rect
        x={x - width / 2}
        y={y - 11}
        width={width}
        height={22}
        rx={11}
        fill="var(--slurp-surface-raised)"
        stroke="var(--slurp-outline)"
      />
      <text x={x} y={y + 4} textAnchor="middle" fill="var(--foreground)" fontSize={12}>
        {text}
      </text>
    </g>
  );
}

/** The canvas card: enough to read the diagram at a glance; the full record opens below. */
function CanvasCard({ node, step }: { node: SlpFlowNode; step: number | null }) {
  const facts = node.outputs.filter((row) => row.value).slice(0, 3);
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted-foreground)]">
            {node.kind === "source"
              ? "Data source"
              : `${step !== null ? `Step ${step}` : "Value"} · ${node.lane === "text" ? "Post" : "Picture"}`}
          </p>
          <p className="truncate text-sm font-bold">{node.title}</p>
        </div>
        <StepStatus status={node.status} />
      </div>
      {node.model && <ModelChip model={node.model} />}
      <dl className="min-h-0 space-y-0.5 overflow-hidden text-xs">
        {facts.map((row) => (
          <div key={row.label} className="truncate">
            <dt className="inline text-[var(--muted-foreground)]">{row.label}: </dt>
            <dd className="inline">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The same graph as the stepper, laid out as a diagram you can drag and zoom in every direction.
 * Choosing a card opens its full record, prompts included, under the diagram.
 */
export function SlpDeepDetailsCanvas({ graph }: { graph: SlpFlowGraph }) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [selected, setSelected] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const { boxes, width, height } = layout(graph);
  const scale = ZOOMS[zoom]!;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const stepOf = new Map(graph.nodes.filter(isMain).map((node, index) => [node.id, index + 1] as const));
  const selectedNode = selected ? byId.get(selected) : null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !viewport.current) return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.current.scrollLeft,
      top: viewport.current.scrollTop,
      moved: false,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || !viewport.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    start.moved = true;
    viewport.current.scrollLeft = start.left - dx;
    viewport.current.scrollTop = start.top - dy;
  };
  const endDrag = () => {
    // Cleared on the next tick so the click that ends a drag does not also select a card.
    setTimeout(() => (drag.current = null), 0);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted-foreground)]">
          Top: where data is kept. Middle: values taken from it. Bottom: the steps, left to right. Drag or scroll to
          move; choose a card to see its arrows, prompts, and results.
        </p>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <ZoomButton label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((value) => value - 1)}>
            <Minus size={15} aria-hidden="true" />
          </ZoomButton>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
          <ZoomButton
            label="Zoom in"
            disabled={zoom === ZOOMS.length - 1}
            onClick={() => setZoom((value) => value + 1)}
          >
            <Plus size={15} aria-hidden="true" />
          </ZoomButton>
          <ZoomButton label="Reset zoom" disabled={zoom === DEFAULT_ZOOM} onClick={() => setZoom(DEFAULT_ZOOM)}>
            <RotateCcw size={15} aria-hidden="true" />
          </ZoomButton>
        </div>
      </div>
      <div
        ref={viewport}
        tabIndex={0}
        aria-label="Generation diagram"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{
          backgroundImage: "radial-gradient(circle, var(--slurp-outline) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        className="h-[60vh] min-h-80 cursor-grab overflow-auto overscroll-contain rounded-2xl bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] active:cursor-grabbing"
      >
        <div style={{ width: width * scale, height: height * scale }} className="relative">
          <div
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
            className="absolute left-0 top-0"
          >
            <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
              <defs>
                <marker
                  id="slp-flow-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
                </marker>
              </defs>
              {graph.edges.map((edge) => {
                const from = boxes.get(edge.from);
                const to = boxes.get(edge.to);
                const fromNode = byId.get(edge.from);
                if (!from || !to || !fromNode) return null;
                const path = edgePath(from, to, fromNode);
                const active = selected === edge.from || selected === edge.to;
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={path.d}
                      fill="none"
                      stroke={active ? "var(--foreground)" : "var(--muted-foreground)"}
                      strokeWidth={active ? 2.5 : 1.75}
                      strokeDasharray={isMain(fromNode) ? undefined : "6 5"}
                      strokeOpacity={fromNode.kind === "source" && !active ? 0.45 : 1}
                      markerEnd="url(#slp-flow-arrow)"
                    />
                    {/* Source arrows are many; their labels show only for the chosen card. */}
                    {edge.label && (fromNode.kind !== "source" || active) && (
                      <EdgeLabel x={path.mid.x} y={path.mid.y} text={edge.label} />
                    )}
                  </g>
                );
              })}
            </svg>
            {graph.nodes.map((node) => {
              const box = boxes.get(node.id)!;
              const isSelected = selected === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (drag.current?.moved) return;
                    setSelected((value) => (value === node.id ? null : node.id));
                  }}
                  style={{ left: box.x, top: box.y, width: NODE_W, height: NODE_H }}
                  className={`absolute overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] text-start shadow-[var(--slurp-shadow-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${
                    isSelected
                      ? "ring-2 ring-[var(--foreground)]"
                      : !isMain(node)
                        ? "outline-dashed outline-1 -outline-offset-1 outline-[var(--muted-foreground)]"
                        : "ring-1 ring-inset ring-[var(--slurp-outline)]"
                  }`}
                >
                  <CanvasCard node={node} step={stepOf.get(node.id) ?? null} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {selectedNode ? (
        <article className="rounded-2xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--slurp-outline)] px-4 py-3">
            <h4 className="text-base font-bold">{selectedNode.title}</h4>
            <StepStatus status={selectedNode.status} />
            {selectedNode.model && <ModelChip model={selectedNode.model} />}
            <button
              type="button"
              aria-label="Close"
              onClick={() => setSelected(null)}
              className="ms-auto inline-flex size-9 items-center justify-center rounded-lg hover:bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <div className="p-4">
            <SlpFlowNodeBody node={selectedNode} />
          </div>
        </article>
      ) : (
        <p className="text-center text-xs text-[var(--muted-foreground)]">No card chosen.</p>
      )}
    </div>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-lg ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-surface-raised)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
    >
      {children}
    </button>
  );
}
