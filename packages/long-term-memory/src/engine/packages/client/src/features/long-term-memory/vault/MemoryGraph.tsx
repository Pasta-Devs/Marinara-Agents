import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  Clock,
  FileText,
  ExternalLink,
  Film,
  Focus,
  GitBranch,
  Globe,
  LocateFixed,
  Maximize,
  Minimize,
  Minus,
  Network,
  Palette,
  Plus,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { LtmImportance, LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { lastInjectionQueryOptions } from "../api";
import { lastInjectionNoteIds } from "../LastInjectionSummary";
import { labelKeys, localizedLabel } from "../display-labels";
import { selectLtmPluralForm, useLtmTranslation } from "../localization";
import { Button, Chip, EmptyState, lockedActionProps } from "../shared-controls";
import { LinkedMemories } from "./LinkedMemories";
import {
  GRAPH_FAMILIES,
  NODE_FAMILY,
  RELATION_LINE,
  buildGraph,
  defaultFocus,
  layoutGraph,
  nodeAtPoint,
  pinchView,
  subjectPeopleLinker,
  neighbourhood,
  visibleEdges,
  type Graph,
  type GraphEdge,
  type GraphFamily,
  type GraphNode,
  type GraphPoint,
  type GraphView,
  type ImportanceFilter,
} from "./graph-layout";

/**
 * The Vault's Graph view: one memory and the memories linked to it (Focus), or every memory (Whole Vault), on an
 * SVG canvas with pan, zoom and Fit. The Vault hands in the notes its list already shows; `graph-layout.ts` does the
 * filtering and the layout, so this file is only the canvas, the one filter row and the empty states.
 */

const FOCUS_HOPS = 2;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4;
const FIT_MAX_ZOOM = 2;
const FIT_PADDING = 60;
const LABEL_LIMIT = 30;
/**
 * Past this many shown memories a label appears for a character that is not minor, a recalled memory, the Focus anchor,
 * the pointed-at or open memory and their neighbours, or for every memory once zoomed in to `LABEL_ZOOM`.
 */
const LABEL_ALL_LIMIT = 40;
const LABEL_ZOOM = 1.45;
/** Text and line widths are in screen pixels: the canvas scales its contents, so each is divided by the zoom. */
const NODE_LABEL_SIZE = 11;
const LINK_LABEL_SIZE = 10.5;
/** A link name is dropped on a memory with more links than this when the line is plain context. */
const LINK_NAMES_LIMIT = 10;
/** Links the card lists before "N more". */
const CARD_LINK_ROWS = 6;
/** A tap on empty canvas this close to a memory (screen pixels across) picks it: a tiny zoomed-out dot stays tappable. */
const TAP_TARGET = 44;
/** A press that moves less than this (screen pixels) is still a tap, not a pan. */
const TAP_SLOP = 8;
const ARROW_ID = "ltm-graph-arrow";
const ARROW_LIT_ID = "ltm-graph-arrow-lit";

const NODE_ICONS: Record<GraphNode["type"], LucideIcon> = {
  character: User,
  relationship: Users,
  timeline_event: Clock,
  scene: Film,
  thread: GitBranch,
  world: Globe,
  tone: Palette,
  source: FileText,
};

const IMPORTANCE_RADIUS: Record<LtmImportance, number> = { critical: 15, major: 12, moderate: 9.5, minor: 7.5 };
const nodeRadius = (node: GraphNode) => IMPORTANCE_RADIUS[node.importance] + (node.type === "character" ? 3 : 0);
/**
 * A memory's size on screen follows the zoom only between these two. Zoomed out past the first it stops shrinking: a
 * fitted phone canvas sits near 0.3, where full-scale discs were 2 to 5 px dots under full-size labels. Zoomed in past
 * the second it stops growing, so zooming in moves crowded memories apart instead of blowing them up over each other.
 */
const NODE_MIN_ZOOM = 0.6;
const NODE_MAX_ZOOM = 1.3;
/** A memory's size on screen at zoom `k`, as a multiple of its layout size. */
const nodeScreenScale = (k: number) => Math.min(NODE_MAX_ZOOM, Math.max(NODE_MIN_ZOOM, k));
/** How much bigger or smaller than its layout size a memory draws inside the zoomed canvas at zoom `k`. */
const nodeScale = (k: number) => nodeScreenScale(k) / k;

/**
 * The four family colours, the canvas and its lines are the approved mock-up's own values (light, with the Engine's
 * dark theme overriding them), not host-token mixes: the families must stay apart in both themes. They live in a
 * `<style>` block, since a package class the Engine does not ship would not apply. The icons carry the kind too.
 */
const GRAPH_STYLE = `
[data-ltm-graph] {
  --ltm-graph-people: #952c46;
  --ltm-graph-story: #c8741d;
  --ltm-graph-threads: #7b69c6;
  --ltm-graph-world: #16a56e;
  --ltm-graph-source: #606078;
  --ltm-graph-check: #16a56e;
  --ltm-graph-canvas: color-mix(in srgb, var(--background) 94%, var(--primary) 2%);
  --ltm-graph-grid-dot: color-mix(in srgb, var(--foreground) 12%, transparent);
  --ltm-graph-surface: #ffffff;
  --ltm-graph-edge: color-mix(in srgb, var(--foreground) 22%, transparent);
  --ltm-graph-edge-strong: color-mix(in srgb, var(--foreground) 48%, transparent);
  --ltm-graph-ink: var(--foreground);
  --ltm-graph-ink-on: var(--background);
  --ltm-graph-divider: color-mix(in srgb, var(--primary) 13%, transparent);
  --ltm-graph-overlay-shadow: 0 10px 30px -12px rgb(26 16 37 / 0.35), 0 2px 6px -2px rgb(26 16 37 / 0.18);
}
[data-theme="dark"] [data-ltm-graph] {
  --ltm-graph-people: #af4d80;
  --ltm-graph-story: #bb6802;
  --ltm-graph-threads: #8c7bda;
  --ltm-graph-source: #8888a0;
  --ltm-graph-canvas: #0a0818;
  --ltm-graph-surface: #121022;
  --ltm-graph-overlay-shadow: 0 12px 32px -10px rgb(0 0 0 / 0.7), 0 2px 8px -2px rgb(0 0 0 / 0.5);
}
[data-ltm-graph-canvas] {
  height: clamp(26rem, 62vh, 40rem);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background-color: var(--ltm-graph-canvas);
  background-image: radial-gradient(var(--ltm-graph-grid-dot) 1px, transparent 1.2px);
  background-size: 22px 22px;
}
[data-ltm-graph-divider] {
  align-self: center;
  width: 1px;
  height: 1.25rem;
  background: var(--ltm-graph-divider);
}
[data-ltm-graph-count] {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--muted-foreground);
}
[data-ltm-graph-ring-mark] {
  display: inline-block;
  flex: none;
  width: 0.75rem;
  height: 0.75rem;
  border: 2px dashed var(--primary);
  border-radius: 9999px;
}
[data-ltm-graph-banner] {
  position: absolute;
  top: 0.6rem;
  left: 50%;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.375rem 0.625rem;
  max-width: calc(100% - 7rem);
  padding: 0.375rem 0.5rem 0.375rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--card);
  box-shadow: var(--ltm-graph-overlay-shadow);
  font-size: 0.8125rem;
  transform: translateX(-50%);
}
[data-ltm-graph-zoom] {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  z-index: 1;
  display: grid;
  gap: 0.25rem;
}
[data-ltm-graph-zoom] > * {
  box-shadow: var(--ltm-graph-overlay-shadow);
}
[data-ltm-graph-meta] {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  padding: 0 0.25rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
[data-ltm-graph-card] {
  position: absolute;
  right: 0.6rem;
  bottom: 0.6rem;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: 20rem;
  max-height: calc(100% - 1.2rem);
  padding: 0.875rem;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--card);
  box-shadow: var(--ltm-graph-overlay-shadow);
}
[data-ltm-graph-has-banner] [data-ltm-graph-card] {
  max-height: calc(100% - 4.25rem);
}
[data-ltm-graph] .mari-chrome-control {
  font-size: 0.8125rem;
}
[data-ltm-graph-card-title] {
  min-width: 0;
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
[data-ltm-graph-card-title]:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 0.25rem;
}
[data-ltm-graph-links] {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--ltm-graph-divider);
  border-radius: 0.5rem;
}
[data-ltm-graph-link-row] {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 2.5rem;
  padding: 0.25rem 0.625rem;
  border-top: 1px solid var(--ltm-graph-divider);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
[data-ltm-graph-link-row]:first-child {
  border-top: 0;
}
[data-ltm-graph-link-row]:hover {
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
}
[data-ltm-graph-link-row]:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 0.125rem var(--primary);
}
[data-ltm-graph-link-rel] {
  flex: none;
  width: 6.5rem;
  font-size: 0.6875rem;
  color: var(--muted-foreground);
}
[data-ltm-graph-link-title] {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-ltm-graph-link-more] {
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted-foreground);
}
@media (max-width: 52rem) {
  [data-ltm-graph-card],
  [data-ltm-graph-has-banner] [data-ltm-graph-card] {
    right: 0.5rem;
    bottom: 0.5rem;
    left: 0.5rem;
    width: auto;
    /* A sheet over the lower part only: the memory it names moves into the space above, and its links scroll. */
    max-height: min(42%, 20rem);
  }
  /* A swipe on the canvas pans the graph, so leave some page above and below it to scroll by. */
  [data-ltm-graph-canvas] {
    height: min(60svh, 34rem);
  }
  [data-ltm-graph-divider] {
    display: none;
  }
  [data-ltm-graph-banner] {
    right: 3rem;
    left: 0.5rem;
    justify-content: flex-start;
    max-width: none;
    transform: none;
  }
}
/* At phone width the filters are one row you swipe sideways, not several lines of chips above the canvas. */
@media (max-width: 40rem) {
  [data-ltm-graph-filters],
  [data-ltm-graph-importance] {
    flex-wrap: nowrap;
  }
  [data-ltm-graph-filters] {
    margin-block: -0.25rem;
    padding-block: 0.25rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  [data-ltm-graph-filters] > * {
    flex: none;
  }
}
/* Pointing at a memory dims the ones it is not linked to. A rule, so only the linked memories are redrawn. */
[data-ltm-graph-pointing] [data-ltm-graph-node]:not([data-ltm-graph-near]) {
  opacity: 0.2;
}
/* Full screen: the filters, the canvas and the status line fill the screen, and the canvas takes every row left. */
[data-ltm-graph-expanded] {
  position: fixed;
  inset: 0;
  z-index: 1000;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: max(0.75rem, env(safe-area-inset-top, 0px)) max(0.75rem, env(safe-area-inset-right, 0px))
    max(0.75rem, env(safe-area-inset-bottom, 0px)) max(0.75rem, env(safe-area-inset-left, 0px));
  overflow: hidden;
  overscroll-behavior: contain;
  background: var(--background);
}
[data-ltm-graph-expanded] [data-ltm-graph-canvas] {
  height: auto;
  min-height: 0;
}
`;

const familyColour = (family: GraphFamily | "source") => `var(--ltm-graph-${family})`;

type View = GraphView;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/** Whether focus came from the keyboard rather than a click or tap. */
const keyboardFocus = (element: Element) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

/** What a memory on the canvas does when pressed, pointed at, focused or keyed. One object for the graph's life. */
type NodeActions = {
  register: (id: string, element: SVGGElement | null) => void;
  hover: (id: string | null, from?: string) => void;
  focus: (id: string, keyboard: boolean) => void;
  blur: (id: string) => void;
  open: (id: string) => void;
  focusHere: (id: string) => void;
  keyDown: (event: React.KeyboardEvent, id: string) => void;
};

type GraphNodeViewProps = {
  node: GraphNode;
  title: string;
  ariaLabel: string;
  conflict: boolean;
  recalled: boolean;
  /** Linked to the pointed-at memory (or is it), so the hover rule leaves it at full strength. */
  near: boolean;
  lit: boolean;
  selected: boolean;
  ringed: boolean;
  keyed: boolean;
  tabbable: boolean;
  showLabel: boolean;
  actions: NodeActions;
};

/**
 * One memory on the canvas. Memoised, and it carries neither its place nor its zoom-held size (the graph writes those
 * two transforms itself), so a pan or a zoom redraws no memory and a hover redraws only the ones it lights: with a few
 * hundred memories shown, redrawing them all on every pointer move was the lag.
 */
const GraphNodeView = memo(function GraphNodeView({
  node,
  title,
  ariaLabel,
  conflict,
  recalled,
  near,
  lit,
  selected,
  ringed,
  keyed,
  tabbable,
  showLabel,
  actions,
}: GraphNodeViewProps) {
  const radius = nodeRadius(node);
  const Icon = NODE_ICONS[node.type];
  const colour = familyColour(node.family);
  return (
    <g
      ref={(element) => actions.register(node.id, element)}
      role="button"
      tabIndex={tabbable ? 0 : -1}
      aria-label={ariaLabel}
      opacity={node.status === "archived" ? 0.5 : 1}
      style={{ cursor: "pointer", outline: "none" }}
      data-ltm-graph-node={node.id}
      data-ltm-graph-near={near || undefined}
      data-ltm-graph-used={recalled || undefined}
      // A finger has no hover: a tap would dim the rest for a moment.
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") actions.hover(node.id);
      }}
      onPointerLeave={() => actions.hover(null, node.id)}
      // A click or tap focuses the node too; only keyboard focus lights it up and dims the rest.
      onFocus={(event) => actions.focus(node.id, keyboardFocus(event.currentTarget))}
      onBlur={() => actions.blur(node.id)}
      onClick={() => actions.open(node.id)}
      onDoubleClick={() => actions.focusHere(node.id)}
      onKeyDown={(event) => actions.keyDown(event, node.id)}
    >
      {recalled ? (
        <circle
          data-ltm-graph-recalled-ring
          r={radius + 6}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.6}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {ringed || keyed ? (
        <circle
          r={radius + 3.5}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={keyed ? 3 : 2.5}
          vectorEffect="non-scaling-stroke"
          data-ltm-graph-selected-ring
        />
      ) : null}
      <circle
        r={radius}
        fill={
          node.status === "resolved"
            ? "var(--ltm-graph-surface)"
            : `color-mix(in srgb, ${colour} 20%, var(--ltm-graph-surface))`
        }
        stroke={colour}
        strokeWidth={2}
        strokeDasharray={node.status === "resolved" ? "3 2" : undefined}
        vectorEffect="non-scaling-stroke"
        data-ltm-graph-disc
      />
      <Icon
        aria-hidden="true"
        x={-radius * 0.575}
        y={-radius * 0.575}
        width={radius * 1.15}
        height={radius * 1.15}
        stroke={colour}
      />
      {conflict ? (
        <g transform={`translate(${radius * 0.8} ${-radius * 0.8})`} aria-hidden="true" data-ltm-graph-conflict>
          <circle r={5.5} fill="var(--ltm-graph-ink)" />
          <text
            y={0.4}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fontWeight={800}
            fill="var(--ltm-graph-ink-on)"
          >
            !
          </text>
        </g>
      ) : null}
      {node.status === "resolved" ? (
        <g transform={`translate(${radius * 0.8} ${radius * 0.8})`} aria-hidden="true" data-ltm-graph-check>
          <circle r={5.5} fill="var(--ltm-graph-check)" />
          <path
            d="M-2.4 0 l1.6 1.6 l3.2 -3.2"
            fill="none"
            stroke="#fff"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : null}
      {showLabel ? (
        <text
          y={14}
          textAnchor="middle"
          fontSize={NODE_LABEL_SIZE}
          fontWeight={lit || selected ? 650 : undefined}
          fill="var(--foreground)"
          stroke="var(--ltm-graph-canvas)"
          strokeWidth={4}
          strokeLinejoin="round"
          paintOrder="stroke"
          pointerEvents="none"
          data-ltm-graph-label
        >
          {title}
        </text>
      ) : null}
    </g>
  );
});

export type MemoryGraphProps = {
  /** The chat the Vault was opened from; its last reply feeds the Recalled chip. Without one the chip stays off. */
  chatId?: string | null;
  /** The notes the List would show for this place and search, sources and archived included. */
  notes: readonly LtmNote[];
  /** Every memory the host knows, for resolving a relationship's people. */
  lookupNotes: readonly LtmNote[];
  /** The notes are the tour's made-up example, not the user's memories; the Graph says so. */
  example?: boolean;
  /** The memory open in the editor; the Graph opens on it. */
  selectedId: string | null;
  titleOf: (note: LtmNote | undefined) => string;
  typeLabel: (type: string) => string;
  relationLabel: (relation: string) => string;
  /** A memory's name as the editor's Linked memories rows show it. */
  memoryLabel: (note: LtmNote | undefined) => string;
  onOpenInEditor: (noteId: string) => void;
  /** Opens the editor on the memory with its Linked memories section ready. */
  onOpenLinks: (noteId: string) => void;
};

export function MemoryGraph({
  chatId,
  notes: storedNotes,
  lookupNotes: storedLookupNotes,
  example,
  selectedId,
  titleOf,
  typeLabel,
  relationLabel,
  memoryLabel,
  onOpenInEditor,
  onOpenLinks,
}: MemoryGraphProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const [whole, setWhole] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hiddenFamilies, setHiddenFamilies] = useState<ReadonlySet<GraphFamily>>(() => new Set());
  const [importance, setImportance] = useState<ImportanceFilter>("all");
  const [showSources, setShowSources] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showRecalled, setShowRecalled] = useState(false);
  const [focusPick, setFocusPick] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [keyId, setKeyId] = useState<string | null>(null);
  const [tabStop, setTabStop] = useState<string | null>(null);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 800, h: 520 });

  // A state ref, so the size is measured whenever the canvas appears (the Graph can open on an empty state).
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Set when the full-screen button toggles: the graph moves in the page, so its button takes focus back. */
  const refocusExpand = useRef(false);
  const cardTitleRef = useRef<HTMLHeadingElement>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const cardRef = useRef<HTMLElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  /** Set by a card row: centre the memory it names even when it is already in view. */
  const centreCard = useRef(false);
  // The pointers down on the canvas (screen points), and whether this press has moved past a tap: one pointer pans,
  // two pinch. A press may start on a memory; it only opens the card if it never moved.
  const pointers = useRef(new Map<number, GraphPoint>());
  const press = useRef({ start: { x: 0, y: 0 }, moved: false });

  // A relationship's people come from its subject fields as well as its stored links, so its lines need no save.
  const withPeople = useMemo(() => subjectPeopleLinker(storedLookupNotes), [storedLookupNotes]);
  const notes = useMemo(() => storedNotes.map(withPeople), [storedNotes, withPeople]);
  const lookupNotes = useMemo(() => storedLookupNotes.map(withPeople), [storedLookupNotes, withPeople]);
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const lookupById = useMemo(() => new Map(lookupNotes.map((note) => [note.id, note])), [lookupNotes]);
  const graph = useMemo(
    () => buildGraph(notes, { showSources, showArchived, importance, hiddenFamilies }),
    [notes, showSources, showArchived, importance, hiddenFamilies],
  );
  const lastInjection = useQuery(lastInjectionQueryOptions(chatId));
  // A failed refetch keeps the old data in the cache, but the panel shows the error, so the Graph rings nothing either.
  const recalledReady = Boolean(lastInjection.data) && !lastInjection.isError;
  const recalledOn = showRecalled && recalledReady;
  const recalledIds = useMemo(
    () => new Set(lastInjectionNoteIds(lastInjection.isError ? undefined : lastInjection.data)),
    [lastInjection.data, lastInjection.isError],
  );
  const nodesById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph]);
  const focusId = useMemo(
    () => (focusPick && nodesById.has(focusPick) ? focusPick : defaultFocus(graph, selectedId)),
    [focusPick, nodesById, graph, selectedId],
  );

  const shown = useMemo<Graph>(() => {
    if (whole || !focusId) return graph;
    const ids = neighbourhood(graph, focusId, FOCUS_HOPS);
    return {
      nodes: graph.nodes.filter((node) => ids.has(node.id)),
      edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    };
  }, [graph, whole, focusId]);
  const positions = useMemo(() => layoutGraph(shown).positions, [shown]);
  const shownIds = useMemo(() => new Set(shown.nodes.map((node) => node.id)), [shown]);
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (from: string, to: string) => map.set(from, (map.get(from) ?? new Set()).add(to));
    for (const edge of shown.edges) {
      add(edge.source, edge.target);
      add(edge.target, edge.source);
    }
    return map;
  }, [shown]);

  // One selection ring: the open card's memory, else (in Focus) the anchor. Whole Vault has no anchor to ring.
  const selectedNodeId = cardId ?? (whole ? null : focusId);
  const pointId = hoverId ?? keyId;
  const highlighted = useMemo(
    () => new Set([focusId, pointId, cardId].filter((id): id is string => Boolean(id))),
    [focusId, pointId, cardId],
  );
  const drawnEdges = useMemo(() => visibleEdges(shown, highlighted), [shown, highlighted]);
  const pointNear = useMemo(() => {
    if (!pointId) return null;
    return new Set([pointId, ...(adjacency.get(pointId) ?? [])]);
  }, [pointId, adjacency]);
  // The pointed-at memory, else the open card's: its lines turn dark and are named, and its label and its
  // neighbours' labels show. Only the pointed-at memory dims the rest.
  const activeId = pointId ?? cardId;
  const activeNear = useMemo(() => {
    if (!activeId) return null;
    return new Set([activeId, ...(adjacency.get(activeId) ?? [])]);
  }, [activeId, adjacency]);

  // A card or tab stop that left the graph (a filter hid it) is dropped.
  const card = cardId && nodesById.has(cardId) ? notesById.get(cardId) : undefined;
  const activeTabStop =
    tabStop && shown.nodes.some((node) => node.id === tabStop)
      ? tabStop
      : focusId && shown.nodes.some((node) => node.id === focusId)
        ? focusId
        : (shown.nodes[0]?.id ?? null);

  // The old Focus follows the editor's selection when the List picks another memory.
  useEffect(() => {
    setFocusPick(null);
  }, [selectedId]);

  useLayoutEffect(() => {
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = Math.round(wrap.clientWidth);
      const h = Math.round(wrap.clientHeight);
      if (w > 0 && h > 0) setSize((current) => (current.w === w && current.h === h ? current : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [wrap]);

  const fit = useCallback(() => {
    const points = [...positions.values()];
    if (!points.length) return;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const k = Math.min(
      FIT_MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(size.w / (maxX - minX + 2 * FIT_PADDING), size.h / (maxY - minY + 2 * FIT_PADDING))),
    );
    setView({ k, x: size.w / 2 - ((minX + maxX) / 2) * k, y: size.h / 2 - ((minY + maxY) / 2) * k });
  }, [positions, size.w, size.h]);
  // Fit again when the memories shown or the canvas size change, not on every refetch (that would undo a pan).
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const shownKey = shown.nodes.map((node) => node.id).join("|");
  useEffect(() => fitRef.current(), [shownKey, size.w, size.h]);

  const zoomAt = useCallback(
    (factor: number, px = size.w / 2, py = size.h / 2) =>
      setView((current) => {
        const k = clampZoom(current.k * factor);
        const ratio = k / current.k;
        return { k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
      }),
    [size.w, size.h],
  );
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // `wrap` is the canvas element: the listener moves when the canvas does (an empty state, full screen).
  }, [zoomAt, wrap]);

  /** A pointer's position on the canvas, in screen pixels from its top-left corner. */
  const screenPoint = (event: { clientX: number; clientY: number }): GraphPoint => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };
  /** The memory a tap beside a small dot meant: the nearest one within half a finger's width. */
  const nodeAt = (event: { clientX: number; clientY: number }) =>
    nodeAtPoint(
      positions,
      (id) => {
        const node = nodesById.get(id);
        return node ? nodeRadius(node) * nodeScale(view.k) : 0;
      },
      view,
      screenPoint(event),
      TAP_TARGET,
    );

  useEffect(() => {
    if (cardId && card) cardTitleRef.current?.focus({ preventScroll: true });
  }, [cardId]);

  // Full screen draws the graph straight under the page body (no panel around it can clip or transform it), asks the
  // browser for real full screen where it allows one (iPhone does not, so there it fills the window), and stops the
  // page behind it scrolling. Leaving the browser's full screen (Esc, the back gesture) leaves the graph's too.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (refocusExpand.current) {
      refocusExpand.current = false;
      root?.querySelector<HTMLElement>("[data-ltm-graph-expand]")?.focus({ preventScroll: true });
    }
    if (!expanded || !root) return;
    const page = document.documentElement;
    const overflow = page.style.overflow;
    page.style.overflow = "hidden";
    // Still inside the press's user activation, which the browser asks for.
    if (document.fullscreenEnabled) root.requestFullscreen().catch(() => undefined);
    const onChange = () => {
      if (document.fullscreenElement) return;
      refocusExpand.current = true;
      setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      page.style.overflow = overflow;
      if (document.fullscreenElement === root) document.exitFullscreen().catch(() => undefined);
    };
  }, [expanded]);
  const toggleExpanded = () => {
    refocusExpand.current = true;
    setExpanded((value) => !value);
  };

  const focusNode = (id: string) => {
    setTabStop(id);
    const point = positions.get(id);
    if (point) {
      // Bring a node the arrows reached back into view.
      setView((current) => {
        const sx = point.x * current.k + current.x;
        const sy = point.y * current.k + current.y;
        const margin = 32;
        const dx = sx < margin ? margin - sx : sx > size.w - margin ? size.w - margin - sx : 0;
        const dy = sy < margin ? margin - sy : sy > size.h - margin ? size.h - margin - sy : 0;
        return dx || dy ? { ...current, x: current.x + dx, y: current.y + dy } : current;
      });
    }
    nodeRefs.current.get(id)?.focus({ preventScroll: true });
  };

  /** The memory the arrow points to: a linked one first, else the nearest one that way, so every node is reachable. */
  const step = (from: string, dx: number, dy: number): string | null => {
    const origin = positions.get(from);
    if (!origin) return null;
    const best = (ids: Iterable<string>) => {
      let found: string | null = null;
      let bestScore = -Infinity;
      for (const id of ids) {
        const point: GraphPoint | undefined = positions.get(id);
        if (id === from || !point) continue;
        const distance = Math.hypot(point.x - origin.x, point.y - origin.y) || 1;
        const cosine = ((point.x - origin.x) * dx + (point.y - origin.y) * dy) / distance;
        if (cosine < 0.3) continue;
        const score = cosine - distance / 1000;
        if (score > bestScore) {
          bestScore = score;
          found = id;
        }
      }
      return found;
    };
    return best(adjacency.get(from) ?? []) ?? best(positions.keys());
  };

  const onNodeKeyDown = (event: React.KeyboardEvent, id: string) => {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = arrows[event.key];
    if (direction) {
      event.preventDefault();
      const next = step(id, direction[0], direction[1]);
      if (next) focusNode(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setCardId(id);
    }
  };
  const onNodeKeyDownRef = useRef(onNodeKeyDown);
  onNodeKeyDownRef.current = onNodeKeyDown;
  const nodeActions = useMemo<NodeActions>(
    () => ({
      register: (id, element) => {
        if (element) nodeRefs.current.set(id, element);
        else nodeRefs.current.delete(id);
      },
      hover: (id, from) => setHoverId((current) => (id === null && current !== from ? current : id)),
      focus: (id, keyboard) => {
        if (keyboard) setKeyId(id);
        setTabStop(id);
      },
      blur: (id) => setKeyId((current) => (current === id ? null : current)),
      open: (id) => setCardId(id),
      focusHere: (id) => {
        setFocusPick(id);
        setWhole(false);
      },
      keyDown: (event, id) => onNodeKeyDownRef.current(event, id),
    }),
    [],
  );
  const onRootKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (cardId && card) {
      event.stopPropagation();
      const back = cardId;
      setCardId(null);
      requestAnimationFrame(() => nodeRefs.current.get(back)?.focus({ preventScroll: true }));
    } else if (expanded) {
      event.stopPropagation();
      toggleExpanded();
    }
  };

  const toggleFamily = (family: GraphFamily) =>
    setHiddenFamilies((current) => {
      const next = new Set(current);
      if (!next.delete(family)) next.add(family);
      return next;
    });
  const resetFilters = () => {
    setHiddenFamilies(new Set());
    setImportance("all");
  };

  const familyLabel: Record<GraphFamily, string> = {
    people: localizeUi("ui.longTermMemory.memorygraph.familyPeople"),
    story: localizeUi("ui.longTermMemory.memorygraph.familyStory"),
    threads: localizeUi("ui.longTermMemory.memorygraph.familyThreads"),
    world: localizeUi("ui.longTermMemory.memorygraph.familyWorld"),
  };
  const importanceOptions: Array<[ImportanceFilter, string]> = [
    ["all", localizeUi("ui.longTermMemory.memorygraph.importanceAll")],
    ["hide-minor", localizeUi("ui.longTermMemory.memorygraph.importanceHideMinor")],
    ["major-up", localizeUi("ui.longTermMemory.memorygraph.importanceMajorUp")],
  ];
  // Memories in the current scope, before these chips filter: a family counts its own non-source memories (archived
  // ones only while Archived is on), Sources and Archived count theirs.
  const counts = useMemo(() => {
    const family = new Map<GraphFamily, number>();
    let sources = 0;
    let archived = 0;
    for (const note of notes) {
      if (note.status === "archived") archived += 1;
      if (note.type === "source") {
        sources += 1;
        continue;
      }
      if (note.status === "archived" && !showArchived) continue;
      const own = NODE_FAMILY[note.type];
      family.set(own, (family.get(own) ?? 0) + 1);
    }
    return { family, sources, archived };
  }, [notes, showArchived]);

  /** "Between" names a relationship's own two people; every other line uses its relation's name. */
  const edgeLabel = (edge: GraphEdge) =>
    edge.relation === "involves" &&
    nodesById.get(edge.source)?.type === "relationship" &&
    nodesById.get(edge.target)?.type === "character"
      ? localizeUi("ui.longTermMemory.memorygraph.between")
      : relationLabel(edge.relation);

  const focusNote = focusId ? notesById.get(focusId) : undefined;
  const noLinksAtAll = graph.nodes.length > 0 && graph.edges.length === 0;
  const focusAlone = !whole && focusId !== null && (nodesById.get(focusId)?.degree ?? 0) === 0;
  const openLinksTarget = focusId ?? graph.nodes[0]?.id ?? null;
  const linkMemoriesButton = openLinksTarget ? (
    <Button
      onClick={() => {
        setExpanded(false);
        onOpenLinks(openLinksTarget);
      }}
      data-ltm-graph-link-memories
    >
      {localizeUi("ui.longTermMemory.memorygraph.linkMemories")}
    </Button>
  ) : null;

  const empty =
    notes.length === 0 ? (
      <EmptyState>{localizeUi("ui.longTermMemory.memorygraph.emptyNone")}</EmptyState>
    ) : graph.nodes.length === 0 ? (
      <div className="flex flex-col items-start gap-2">
        <EmptyState>{localizeUi("ui.longTermMemory.memorygraph.emptyFiltered")}</EmptyState>
        <Button onClick={resetFilters}>{localizeUi("ui.longTermMemory.memorygraph.resetFilters")}</Button>
      </div>
    ) : noLinksAtAll || focusAlone ? (
      <div className="flex flex-col items-start gap-2" data-ltm-graph-empty>
        <EmptyState>
          {noLinksAtAll
            ? localizeUi("ui.longTermMemory.memorygraph.emptyNoLinksInVault")
            : localizeUi("ui.longTermMemory.memorygraph.emptyNoLinks")}
        </EmptyState>
        <div className="flex flex-wrap items-center gap-2 px-3">{linkMemoriesButton}</div>
      </div>
    ) : null;

  // The card lives on the canvas: when an empty state replaces the canvas it closes rather than reappearing later.
  const isEmpty = empty !== null;
  useEffect(() => {
    if (isEmpty) setCardId(null);
  }, [isEmpty]);

  const openInEditor = (id: string) => {
    setExpanded(false);
    onOpenInEditor(id);
  };
  const focusHere = (id: string) => {
    setFocusPick(id);
    setWhole(false);
  };
  // The card lists the links the way the editor does. A linked memory the canvas shows becomes the card; one it does
  // not show (a filter or the two-hop window hides it) opens in the editor.
  const openLinked = (id: string) => {
    if (!shownIds.has(id)) return openInEditor(id);
    centreCard.current = true;
    setCardId(id);
  };
  const closeCard = () => {
    const back = cardId;
    setCardId(null);
    if (back) requestAnimationFrame(() => nodeRefs.current.get(back)?.focus({ preventScroll: true }));
  };
  // The open card's memory stays in sight: one under the card (or under the banner) moves into the free space, and
  // the memory a card row named is centred there. The wide card sits at the side, clear of the canvas centre; the
  // phone card is a sheet across the bottom, so the memory goes in the space above it.
  useLayoutEffect(() => {
    const centre = centreCard.current;
    centreCard.current = false;
    const element = cardRef.current;
    const point = cardId ? positions.get(cardId) : undefined;
    const node = cardId ? nodesById.get(cardId) : undefined;
    if (!element || !point || !node) return;
    const banner = bannerRef.current;
    const top = banner ? banner.offsetTop + banner.offsetHeight : 0;
    const sheet = element.offsetLeft < size.w / 4;
    const target = { x: size.w / 2, y: sheet ? (top + element.offsetTop) / 2 : size.h / 2 };
    setView((current) => {
      const sx = point.x * current.k + current.x;
      const sy = point.y * current.k + current.y;
      const margin = nodeRadius(node) * nodeScreenScale(current.k) + 8;
      const hidden =
        (sx > element.offsetLeft - margin && sy > element.offsetTop - margin) || (sheet && sy < top + margin);
      if (!centre && !hidden) return current;
      return { ...current, x: target.x - point.x * current.k, y: target.y - point.y * current.k };
    });
    // Only when a card opens: a later pan or layout change must not pull the memory back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);
  const cardNode = card ? nodesById.get(card.id) : undefined;
  const cardExcerpt = card
    ? (Object.values(card.sections)
        .map((section) => section.text.trim())
        .find(Boolean)
        ?.split(/\n+/)[0] ?? "")
    : "";
  const kindIcon = (note: LtmNote) => {
    const Icon = NODE_ICONS[note.type];
    const family = note.type === "source" ? "source" : NODE_FAMILY[note.type];
    return <Icon aria-hidden="true" size={14} style={{ flex: "none", color: familyColour(family) }} />;
  };
  const cardIncoming = card ? lookupNotes.filter((note) => note.links.some((link) => link.target === card.id)) : [];

  const labelEveryNode = shown.nodes.length <= LABEL_ALL_LIMIT || view.k >= LABEL_ZOOM;
  /** One line's look, after the mock-up: neutral by default, strong for cause and payoff, dark when highlighted. */
  const lineLook = useCallback(
    (edge: GraphEdge, lit: boolean) => {
      const participant =
        edge.relation === "involves" &&
        nodesById.get(edge.source)?.type === "relationship" &&
        nodesById.get(edge.target)?.type === "character";
      if (participant) {
        return {
          stroke: lit ? "var(--ltm-graph-people)" : "color-mix(in srgb, var(--ltm-graph-people) 55%, transparent)",
          width: 2.6,
          dash: undefined,
          arrow: false,
          plain: false,
        };
      }
      const kind = RELATION_LINE[edge.relation] ?? "context";
      const strong = kind === "cause" || kind === "payoff";
      return {
        stroke: lit ? "var(--ltm-graph-ink)" : strong ? "var(--ltm-graph-edge-strong)" : "var(--ltm-graph-edge)",
        width: strong ? 1.4 : 1.1,
        dash: kind === "payoff" ? "6 4" : kind === "provenance" ? "1.5 3.5" : undefined,
        arrow: strong,
        plain: kind === "context",
      };
    },
    [nodesById],
  );
  const activeEdges = activeId ? drawnEdges.filter((edge) => edge.source === activeId || edge.target === activeId) : [];
  const memoryCount = shown.nodes.length;
  const linkCount = shown.edges.length;
  const plural = (count: number, one: string, other: string) =>
    localizeUi(selectLtmPluralForm(locale, count) === "one" ? one : other, { count });

  // The lines and the memories are drawn once per change to what they show: a pan or a zoom reuses both, since the
  // canvas group carries the view and the two custom properties carry the zoom-held sizes.
  const edgeScale = nodeScale(view.k);
  const edgeLayer = useMemo(
    () =>
      drawnEdges.map((edge) => {
        const from = positions.get(edge.source);
        const to = positions.get(edge.target);
        const fromNode = nodesById.get(edge.source);
        const toNode = nodesById.get(edge.target);
        if (!from || !to || !fromNode || !toNode) return null;
        const lit = activeId !== null && (edge.source === activeId || edge.target === activeId);
        const look = lineLook(edge, lit);
        // The line stops at each disc's rim, so an arrowhead lands on the memory it points to.
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy) || 1;
        const gapFrom = (nodeRadius(fromNode) + 2) * edgeScale;
        const gapTo = (nodeRadius(toNode) + 2) * edgeScale;
        return (
          <line
            key={`${edge.source}|${edge.target}|${edge.relation}`}
            x1={from.x + (dx / length) * gapFrom}
            y1={from.y + (dy / length) * gapFrom}
            x2={to.x - (dx / length) * gapTo}
            y2={to.y - (dy / length) * gapTo}
            stroke={look.stroke}
            strokeWidth={look.width}
            strokeDasharray={look.dash}
            vectorEffect="non-scaling-stroke"
            opacity={pointId && !(edge.source === pointId || edge.target === pointId) ? 0.12 : 1}
            markerEnd={look.arrow && length > gapFrom + gapTo ? `url(#${lit ? ARROW_LIT_ID : ARROW_ID})` : undefined}
            data-ltm-graph-edge={edge.relation}
          />
        );
      }),
    [drawnEdges, positions, nodesById, activeId, pointId, edgeScale, lineLook],
  );
  const nodeLayer = useMemo(
    () =>
      shown.nodes.map((node) => {
        if (!positions.has(node.id)) return null;
        const note = notesById.get(node.id);
        const title = titleOf(note);
        const recalled = recalledOn && recalledIds.has(node.id);
        const lit = activeNear?.has(node.id) ?? false;
        const selected = node.id === cardId;
        return (
          <GraphNodeView
            key={node.id}
            node={node}
            title={title.length > LABEL_LIMIT ? `${title.slice(0, LABEL_LIMIT - 1)}…` : title}
            ariaLabel={localizeUi(
              recalled ? "ui.longTermMemory.memorygraph.nodeLabelRecalled" : "ui.longTermMemory.memorygraph.nodeLabel",
              { title, type: typeLabel(node.type) },
            )}
            conflict={note?.conflicts?.some((conflict) => conflict.resolution === "pending") ?? false}
            recalled={recalled}
            near={pointNear?.has(node.id) ?? false}
            lit={lit}
            selected={selected}
            ringed={node.id === selectedNodeId}
            keyed={node.id === keyId}
            tabbable={node.id === activeTabStop}
            showLabel={
              labelEveryNode ||
              (node.type === "character" && node.importance !== "minor") ||
              node.id === focusId ||
              recalled ||
              selected ||
              lit
            }
            actions={nodeActions}
          />
        );
      }),
    [
      shown,
      positions,
      notesById,
      titleOf,
      typeLabel,
      localizeUi,
      recalledOn,
      recalledIds,
      activeNear,
      pointNear,
      cardId,
      focusId,
      selectedNodeId,
      keyId,
      activeTabStop,
      labelEveryNode,
      nodeActions,
    ],
  );

  // Each memory's place and zoom-held size, and its label's screen-pixel size, written straight to the two elements:
  // a zoom step then costs one attribute per memory, not a redraw of each. A memory is scaled about its centre, so
  // its rings, icon, badges and label keep their proportions.
  const labelScale = 1 / nodeScreenScale(view.k);
  useLayoutEffect(() => {
    const write = (element: Element, value: string) => {
      if (element.getAttribute("transform") !== value) element.setAttribute("transform", value);
    };
    for (const [id, element] of nodeRefs.current) {
      const point = positions.get(id);
      const node = nodesById.get(id);
      if (!point || !node) continue;
      write(element, `translate(${point.x} ${point.y}) scale(${edgeScale})`);
      const label = element.querySelector("[data-ltm-graph-label]");
      if (label) write(label, `translate(0 ${nodeRadius(node)}) scale(${labelScale})`);
    }
  }, [nodeLayer, positions, nodesById, edgeScale, labelScale]);

  const content = (
    <div
      ref={rootRef}
      className="grid min-w-0 gap-3"
      data-ltm-graph
      data-ltm-graph-example={example || undefined}
      data-ltm-graph-expanded={expanded || undefined}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? localizeUi("ui.longTermMemory.memorygraph.canvas") : undefined}
      onKeyDown={onRootKeyDown}
    >
      <style>{GRAPH_STYLE}</style>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label={localizeUi("ui.longTermMemory.memorygraph.filters")}
        data-ltm-graph-filters
      >
        {example ? (
          <span className="text-xs font-medium text-[var(--muted-foreground)]" data-ltm-graph-example-tag>
            {localizeUi("ui.longTermMemory.tour.example.tag")}
          </span>
        ) : null}
        <Button
          chip
          className="whitespace-nowrap"
          aria-pressed={whole}
          onClick={() => setWhole((value) => !value)}
          data-ltm-graph-whole
        >
          {localizeUi("ui.longTermMemory.memorygraph.wholeVault")}
        </Button>
        <span aria-hidden="true" data-ltm-graph-divider />
        {GRAPH_FAMILIES.map((family) => (
          <Button
            chip
            className="whitespace-nowrap"
            key={family}
            aria-pressed={!hiddenFamilies.has(family)}
            onClick={() => toggleFamily(family)}
            data-ltm-graph-family={family}
          >
            <span
              aria-hidden="true"
              className="inline-block shrink-0 rounded-full"
              style={{
                width: "0.75rem",
                height: "0.75rem",
                background: familyColour(family),
                ...(hiddenFamilies.has(family)
                  ? { background: "transparent", boxShadow: `inset 0 0 0 2px ${familyColour(family)}`, opacity: 0.62 }
                  : null),
              }}
            />
            {familyLabel[family]}
            <span data-ltm-graph-count>{counts.family.get(family) ?? 0}</span>
          </Button>
        ))}
        <span aria-hidden="true" data-ltm-graph-divider />
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={localizeUi("ui.longTermMemory.memorygraph.importance")}
          data-ltm-graph-importance
        >
          {importanceOptions.map(([value, label]) => (
            <Button
              chip
              className="whitespace-nowrap"
              key={value}
              aria-pressed={importance === value}
              onClick={() => setImportance(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <span aria-hidden="true" data-ltm-graph-divider />
        <Button
          chip
          className="whitespace-nowrap"
          aria-pressed={showSources}
          onClick={() => setShowSources((value) => !value)}
          data-ltm-graph-sources
        >
          <FileText aria-hidden="true" size={14} style={{ color: familyColour("source") }} />
          {localizeUi("ui.longTermMemory.memorygraph.sources")}
          <span data-ltm-graph-count>{counts.sources}</span>
        </Button>
        <Button
          chip
          className="whitespace-nowrap"
          aria-pressed={showArchived}
          onClick={() => setShowArchived((value) => !value)}
          data-ltm-graph-archived
        >
          <Archive aria-hidden="true" size={14} />
          {localizeUi("ui.longTermMemory.memorygraph.archived")}
          <span data-ltm-graph-count>{counts.archived}</span>
        </Button>
        <Button
          chip
          className="whitespace-nowrap"
          {...lockedActionProps(!recalledReady)}
          aria-pressed={recalledOn}
          title={
            !chatId
              ? localizeUi("ui.longTermMemory.memorygraph.recalledHint")
              : lastInjection.isError
                ? localizeUi("ui.longTermMemory.lastinjectionsummary.lastInjectionUnavailable")
                : undefined
          }
          onClick={() => {
            if (recalledReady) setShowRecalled((value) => !value);
          }}
          data-ltm-graph-recalled
        >
          <span aria-hidden="true" data-ltm-graph-ring-mark />
          {localizeUi("ui.longTermMemory.memorygraph.recalled")}
        </Button>
      </div>

      {empty ?? (
        <>
          <div
            ref={setWrap}
            className="relative min-w-0 overflow-hidden"
            data-ltm-graph-canvas
            data-ltm-graph-has-banner={(!whole && Boolean(focusNote)) || undefined}
          >
            {!whole && focusNote ? (
              <div ref={bannerRef} data-ltm-graph-banner style={{ backdropFilter: "blur(8px)" }}>
                <span>
                  {localizeUi("ui.longTermMemory.memorygraph.linkedTo")}{" "}
                  <strong className="font-semibold text-[var(--foreground)]">{titleOf(focusNote)}</strong>
                </span>
                <Button chip onClick={() => setWhole(true)} data-ltm-graph-show-everything>
                  <X aria-hidden="true" size={12} />
                  {localizeUi("ui.longTermMemory.memorygraph.showEverything")}
                </Button>
              </div>
            ) : null}
            <svg
              ref={svgRef}
              width={size.w}
              height={size.h}
              viewBox={`0 0 ${size.w} ${size.h}`}
              role="group"
              aria-label={localizeUi("ui.longTermMemory.memorygraph.canvas")}
              style={{
                display: "block",
                touchAction: "none",
                cursor: press.current.moved && pointers.current.size ? "grabbing" : "grab",
              }}
              onPointerDown={(event) => {
                if (event.pointerType === "mouse" && event.button !== 0) return;
                const point = screenPoint(event);
                pointers.current.set(event.pointerId, point);
                // A second finger makes this press a pinch, never a tap.
                if (pointers.current.size === 1) press.current = { start: point, moved: false };
                else press.current.moved = true;
              }}
              onPointerMove={(event) => {
                const last = pointers.current.get(event.pointerId);
                if (!last) return;
                const point = screenPoint(event);
                if (pointers.current.size === 1) {
                  if (!press.current.moved) {
                    const start = press.current.start;
                    if (Math.hypot(point.x - start.x, point.y - start.y) < TAP_SLOP) return;
                    press.current.moved = true;
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                  }
                  pointers.current.set(event.pointerId, point);
                  setView((value) => ({ ...value, x: value.x + point.x - last.x, y: value.y + point.y - last.y }));
                  return;
                }
                const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
                pointers.current.set(event.pointerId, point);
                if (other && pointers.current.size === 2)
                  setView((value) => pinchView(value, [last, other], [point, other], MIN_ZOOM, MAX_ZOOM));
              }}
              onPointerUp={(event) => {
                pointers.current.delete(event.pointerId);
              }}
              onPointerCancel={(event) => {
                pointers.current.delete(event.pointerId);
              }}
              // A press that panned or pinched is not a tap on the memory it started on.
              onClickCapture={(event) => {
                if (press.current.moved) event.stopPropagation();
              }}
              onDoubleClickCapture={(event) => {
                if (press.current.moved) event.stopPropagation();
              }}
              onClick={(event) => {
                if ((event.target as Element).closest("[data-ltm-graph-node]")) return;
                const near = nodeAt(event);
                if (near) setCardId(near);
                else setCardId(null);
              }}
              onDoubleClick={(event) => {
                if ((event.target as Element).closest("[data-ltm-graph-node]")) return;
                const near = nodeAt(event);
                if (near) focusHere(near);
              }}
            >
              <defs>
                {[
                  [ARROW_ID, "var(--ltm-graph-edge-strong)"],
                  [ARROW_LIT_ID, "var(--ltm-graph-ink)"],
                ].map(([id, fill]) => (
                  <marker
                    key={id}
                    id={id}
                    viewBox="0 0 10 10"
                    refX={9}
                    refY={5}
                    markerWidth={8 / view.k}
                    markerHeight={8 / view.k}
                    orient="auto-start-reverse"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M0 0 L10 5 L0 10 z" fill={fill} />
                  </marker>
                ))}
              </defs>
              <g
                transform={`translate(${view.x} ${view.y}) scale(${view.k})`}
                data-ltm-graph-pointing={pointId ? "" : undefined}
              >
                {edgeLayer}
                {nodeLayer}
                {activeEdges.map((edge) => {
                  const from = positions.get(edge.source);
                  const to = positions.get(edge.target);
                  if (!from || !to) return null;
                  // A memory with many plain context lines would name them all on top of each other.
                  if (activeEdges.length > LINK_NAMES_LIMIT && lineLook(edge, true).plain) return null;
                  return (
                    <text
                      key={`${edge.source}|${edge.target}|${edge.relation}`}
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={LINK_LABEL_SIZE / view.k}
                      fontWeight={600}
                      fill="var(--foreground)"
                      stroke="var(--ltm-graph-canvas)"
                      strokeWidth={3.5 / view.k}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      pointerEvents="none"
                      data-ltm-graph-edge-label
                    >
                      {edgeLabel(edge)}
                    </text>
                  );
                })}
              </g>
            </svg>
            <div data-ltm-graph-zoom>
              <Button
                icon
                aria-label={localizeUi("ui.longTermMemory.memorygraph.zoomIn")}
                title={localizeUi("ui.longTermMemory.memorygraph.zoomIn")}
                onClick={() => zoomAt(1.25)}
              >
                <Plus aria-hidden="true" size={14} />
              </Button>
              <Button
                icon
                aria-label={localizeUi("ui.longTermMemory.memorygraph.zoomOut")}
                title={localizeUi("ui.longTermMemory.memorygraph.zoomOut")}
                onClick={() => zoomAt(0.8)}
              >
                <Minus aria-hidden="true" size={14} />
              </Button>
              <Button
                icon
                aria-label={localizeUi("ui.longTermMemory.memorygraph.fit")}
                title={localizeUi("ui.longTermMemory.memorygraph.fit")}
                onClick={fit}
                data-ltm-graph-fit
              >
                <LocateFixed aria-hidden="true" size={14} />
              </Button>
              <Button
                icon
                aria-label={localizeUi(
                  expanded
                    ? "ui.longTermMemory.memorygraph.exitFullScreen"
                    : "ui.longTermMemory.memorygraph.fullScreen",
                )}
                title={localizeUi(
                  expanded
                    ? "ui.longTermMemory.memorygraph.exitFullScreen"
                    : "ui.longTermMemory.memorygraph.fullScreen",
                )}
                onClick={toggleExpanded}
                data-ltm-graph-expand
              >
                {expanded ? <Minimize aria-hidden="true" size={14} /> : <Maximize aria-hidden="true" size={14} />}
              </Button>
            </div>
            {card && cardNode ? (
              <aside
                ref={cardRef}
                aria-label={titleOf(card)}
                style={{ backdropFilter: "blur(12px)" }}
                data-ltm-graph-card
              >
                <div className="flex items-start gap-2">
                  <h3 ref={cardTitleRef} tabIndex={-1} className="flex-1" data-ltm-graph-card-title>
                    {titleOf(card)}
                  </h3>
                  <Button
                    chip
                    icon
                    aria-label={localizeUi("ui.longTermMemory.memorygraph.closeCard")}
                    title={localizeUi("ui.longTermMemory.memorygraph.closeCard")}
                    onClick={closeCard}
                    data-ltm-graph-card-close
                  >
                    <X aria-hidden="true" size={12} />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1" data-ltm-graph-card-chips>
                  <Chip tone="neutral" className="inline-flex items-center gap-1 text-xs">
                    {kindIcon(card)}
                    {typeLabel(card.type)}
                  </Chip>
                  {card.status !== "active" ? (
                    <Chip tone="neutral" className="text-xs">
                      {localizedLabel(card.status, localizeUi, labelKeys.status)}
                    </Chip>
                  ) : null}
                  {card.type !== "source" ? (
                    <Chip tone="neutral" className="text-xs">
                      {localizedLabel(cardNode.importance, localizeUi, labelKeys.importance)}
                    </Chip>
                  ) : null}
                  {recalledReady && recalledIds.has(card.id) ? (
                    <Chip tone="neutral" className="text-xs" data-ltm-graph-card-used>
                      {localizeUi("ui.longTermMemory.memorygraph.recalled")}
                    </Chip>
                  ) : null}
                </div>
                {cardExcerpt ? (
                  <p className="text-sm" style={{ overflowWrap: "anywhere" }}>
                    {cardExcerpt.length > 180 ? `${cardExcerpt.slice(0, 180).trimEnd()}…` : cardExcerpt}
                  </p>
                ) : null}
                <div className="grid gap-2" data-ltm-graph-card-links>
                  <LinkedMemories
                    outgoing={card.links.filter((link) => link.relation !== "extracted_from")}
                    extractedFrom={card.links.filter((link) => link.relation === "extracted_from")}
                    incoming={cardIncoming}
                    notesById={lookupById}
                    memoryLabel={memoryLabel}
                    relationLabel={relationLabel}
                    onOpen={openLinked}
                    rows={{
                      selfId: card.id,
                      limit: CARD_LINK_ROWS,
                      icon: kindIcon,
                      onMore: () => {
                        setExpanded(false);
                        onOpenLinks(card.id);
                      },
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!whole && card.id === focusId ? (
                    <Button chip onClick={() => setWhole(true)} data-ltm-graph-show-everything-card>
                      <Network aria-hidden="true" size={12} />
                      {localizeUi("ui.longTermMemory.memorygraph.showEverything")}
                    </Button>
                  ) : (
                    <Button chip onClick={() => focusHere(card.id)} data-ltm-graph-focus-here>
                      <Focus aria-hidden="true" size={12} />
                      {localizeUi("ui.longTermMemory.memorygraph.focusHere")}
                    </Button>
                  )}
                  <Button chip onClick={() => openInEditor(card.id)} data-ltm-graph-open-editor>
                    <ExternalLink aria-hidden="true" size={12} />
                    {localizeUi("ui.longTermMemory.memorygraph.openInEditor")}
                  </Button>
                </div>
              </aside>
            ) : null}
          </div>
          <div data-ltm-graph-meta>
            <p>{localizeUi("ui.longTermMemory.memorygraph.hint")}</p>
            <p data-ltm-graph-status>
              {plural(
                memoryCount,
                "ui.longTermMemory.memorygraph.memoriesCountOne",
                "ui.longTermMemory.memorygraph.memoriesCountOther",
              )}
              {" · "}
              {plural(
                linkCount,
                "ui.longTermMemory.memorygraph.linksCountOne",
                "ui.longTermMemory.memorygraph.linksCountOther",
              )}
              {recalledOn
                ? ` · ${localizeUi("ui.longTermMemory.memorygraph.recalledCount", { count: [...recalledIds].filter((id) => shownIds.has(id)).length })}`
                : null}
            </p>
          </div>
        </>
      )}
    </div>
  );
  return expanded ? createPortal(content, document.body) : content;
}
