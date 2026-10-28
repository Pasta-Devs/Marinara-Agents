import { Maximize2, Minus, Plus, X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { SlpFlowGraph, SlpFlowNode } from "./slp-deep-details-flow";
import { ModelChip, SlpFlowNodeBody } from "./SlpDeepDetailsFlow";
import { StepStatus } from "./SlpDeepDetailsParts";
import {
  isSlpFlowMain as isMain,
  layoutSlpFlowCanvas,
  routeSlpFlowGraph,
  SLP_FLOW_NODE_H as NODE_H,
  SLP_FLOW_NODE_W as NODE_W,
  slpFlowCanvasColumns,
} from "./slp-deep-details-canvas-layout";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 1.2;

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
          <p className="line-clamp-2 text-sm font-bold leading-5">{node.title}</p>
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
  const [selected, setSelected] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  // The steps wrap into as many columns as the panel shows at 100 %, so nothing opens cut off.
  const [available, setAvailable] = useState<number | null>(null);
  useLayoutEffect(() => {
    setAvailable(viewport.current?.clientWidth ?? null);
  }, []);
  const { boxes, width, height } = layoutSlpFlowCanvas(
    graph,
    available ? slpFlowCanvasColumns(available - 2) : undefined,
  );
  const [zoom, setZoom] = useState<number | null>(null);
  const fit = available ? Math.min(1, Math.max(MIN_ZOOM, (available - 2) / width)) : 1;
  const scale = zoom ?? fit;
  const zoomBy = (factor: number) =>
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(scale * factor * 100) / 100)));
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const routes = routeSlpFlowGraph(graph, boxes);
  const labelledInto = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.label && byId.get(edge.from)?.kind !== "source") {
      labelledInto.set(edge.to, (labelledInto.get(edge.to) ?? 0) + 1);
    }
  }
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
          Top: where data is kept. Below: the steps, left to right and on down the rows, each with the values taken for
          it stacked above it. Drag or scroll to move; choose a card to see its arrows, prompts, and results.
        </p>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <ZoomButton label="Zoom out" disabled={scale <= MIN_ZOOM} onClick={() => zoomBy(1 / ZOOM_STEP)}>
            <Minus size={15} aria-hidden="true" />
          </ZoomButton>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
          <ZoomButton label="Zoom in" disabled={scale >= MAX_ZOOM} onClick={() => zoomBy(ZOOM_STEP)}>
            <Plus size={15} aria-hidden="true" />
          </ZoomButton>
          <ZoomButton label="Fit to width" disabled={zoom === null} onClick={() => setZoom(null)}>
            <Maximize2 size={15} aria-hidden="true" />
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
        className="max-h-[60vh] cursor-grab overflow-auto overscroll-contain rounded-2xl bg-[var(--slurp-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] active:cursor-grabbing"
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
                const fromNode = byId.get(edge.from);
                const path = routes.get(edge);
                if (!fromNode || !path) return null;
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
                      strokeLinejoin="round"
                      markerEnd="url(#slp-flow-arrow)"
                    />
                    {/* Source arrows are many; their labels show only for the chosen card. A step fed by
                        more than two values would stack their labels, so there each shows when its value is chosen. */}
                    {edge.label &&
                      (fromNode.kind === "source"
                        ? active
                        : (labelledInto.get(edge.to) ?? 0) <= 2 || selected === edge.from) && (
                        <EdgeLabel x={path.label.x} y={path.label.y} text={edge.label} />
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
                        : "shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
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
        <article className="rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-highlight)]">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--noodle-divider)] px-4 py-3">
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
      className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)] hover:bg-[var(--accent)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
    >
      {children}
    </button>
  );
}
