import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Avatar } from "../../base/chrome/SlpChrome";
import { cn } from "../../../lib/utils";
import {
  SLP_FORCE_COOLING,
  SLP_FORCE_REST,
  slpForceBox,
  slpForceSeed,
  slpForceStep,
  type SlpForceNode,
} from "./slp-force-layout";

export type SlpGraphPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Their people are shown on the map. */
  open: boolean;
  /** The one whose ties the list below shows. */
  selected: boolean;
};
export type SlpGraphTie = {
  a: string;
  b: string;
  /** A theme color (`var(--…)`) for the line. */
  color: string;
  /** 0-3: closer ties are shorter and thicker. */
  closeness: number;
  dash?: "tense" | "cold";
};

type Box = { x: number; y: number; size: number };
const DRAG_PX = 6;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The People map (Drama): everyone whose people are open, and those people, as one living network.
 * Ties pull people together and everyone pushes apart, so the map settles on its own and new people
 * glide in from whoever opened them. Drag anyone to move them; tap to open or select. Plain SVG lines
 * under real buttons, so every person is focusable; reduced motion settles at once.
 */
export function SlpPeopleGraph({
  people,
  ties,
  onTap,
  label,
}: {
  people: SlpGraphPerson[];
  ties: SlpGraphTie[];
  onTap: (id: string) => void;
  /** The map's name for screen readers. */
  label: string;
}) {
  const positions = useRef(new Map<string, SlpForceNode>());
  const alpha = useRef(1);
  const shown = useRef<Box | null>(null);
  const frozen = useRef<Box | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const [, setFrame] = useState(0);

  const links = useMemo(() => ties.map((tie) => ({ a: tie.a, b: tie.b, length: 150 - tie.closeness * 18 })), [ties]);
  // The running animation reads the ties of the latest render, not of the render that started it.
  const linksRef = useRef(links);
  linksRef.current = links;
  const shape = `${people.map((person) => person.id).join(",")}|${ties.map((tie) => `${tie.a}-${tie.b}`).join(",")}`;

  const run = () => {
    if (raf.current !== null) return;
    const tick = () => {
      let nodes = [...positions.current.values()];
      for (let step = 0; step < 2; step += 1) nodes = slpForceStep(nodes, linksRef.current, alpha.current);
      positions.current = new Map(nodes.map((node) => [node.id, node]));
      if (!drag.current?.moved) alpha.current *= 1 - SLP_FORCE_COOLING;
      setFrame((frame) => frame + 1);
      // Keep going until people rest and the view has caught up with them.
      const aim = frozen.current ?? slpForceBox(nodes);
      const view = shown.current;
      const easing =
        view !== null && Math.abs(view.x - aim.x) + Math.abs(view.y - aim.y) + Math.abs(view.size - aim.size) > 1;
      raf.current =
        alpha.current > SLP_FORCE_REST || drag.current?.moved || easing ? requestAnimationFrame(tick) : null;
    };
    raf.current = requestAnimationFrame(tick);
  };

  // A new person or tie: keep everyone where they are, place newcomers by their ties, heat up again.
  useEffect(() => {
    const neighbors = (id: string) => ties.flatMap((tie) => (tie.a === id ? [tie.b] : tie.b === id ? [tie.a] : []));
    const seeded = slpForceSeed(
      positions.current,
      people.map((person) => person.id),
      neighbors,
    );
    positions.current = new Map(seeded.map((node) => [node.id, node]));
    alpha.current = Math.max(alpha.current, 0.8);
    if (reducedMotion()) {
      let nodes = seeded;
      for (let step = 0; step < 300 && alpha.current > SLP_FORCE_REST; step += 1) {
        nodes = slpForceStep(nodes, links, alpha.current);
        alpha.current *= 1 - SLP_FORCE_COOLING;
      }
      positions.current = new Map(nodes.map((node) => [node.id, node]));
      shown.current = null;
      setFrame((frame) => frame + 1);
    } else run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shape` is the identity of people and ties
  }, [shape]);
  useEffect(() => () => void (raf.current !== null && cancelAnimationFrame(raf.current)), []);

  // The view eases toward a box around everyone, and holds still while a finger drags.
  const nodes = [...positions.current.values()];
  const target = frozen.current ?? slpForceBox(nodes);
  const last = shown.current;
  const box: Box =
    last && !reducedMotion()
      ? {
          x: last.x + (target.x - last.x) * 0.2,
          y: last.y + (target.y - last.y) * 0.2,
          size: last.size + (target.size - last.size) * 0.2,
        }
      : target;
  shown.current = box;
  const scale = box.size / 300;
  const toPercent = (node: SlpForceNode) => ({
    left: `${((node.x - box.x) / box.size) * 100}%`,
    top: `${((node.y - box.y) / box.size) * 100}%`,
  });

  const world = (event: PointerEvent) => {
    const rect = container.current!.getBoundingClientRect();
    return {
      x: box.x + ((event.clientX - rect.left) / rect.width) * box.size,
      y: box.y + ((event.clientY - rect.top) / rect.height) * box.size,
    };
  };
  const onDown = (id: string) => (event: PointerEvent<HTMLButtonElement>) => {
    drag.current = { id, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_PX) return;
    if (!current.moved) frozen.current = box;
    current.moved = true;
    const node = positions.current.get(current.id);
    if (!node) return;
    const at = world(event);
    positions.current.set(current.id, { ...node, x: at.x, y: at.y, vx: 0, vy: 0, pinned: true });
    alpha.current = Math.max(alpha.current, 0.3);
    run();
  };
  const onUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) return;
    suppressClick.current = true;
    frozen.current = null;
    const node = positions.current.get(current.id);
    if (node) positions.current.set(current.id, { ...node, pinned: false });
    run();
  };

  return (
    <div
      ref={container}
      role="group"
      aria-label={label}
      className="relative mx-auto w-full overflow-hidden"
      style={{ maxWidth: "34rem", aspectRatio: "1 / 1" }}
    >
      <svg
        viewBox={`${box.x} ${box.y} ${box.size} ${box.size}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {ties.map((tie) => {
          const a = positions.current.get(tie.a);
          const b = positions.current.get(tie.b);
          if (!a || !b) return null;
          const dash = tie.dash === "tense" ? [6, 4] : tie.dash === "cold" ? [1.5, 4] : null;
          return (
            <line
              key={`${tie.a}-${tie.b}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={tie.color}
              strokeWidth={(1.2 + tie.closeness * 0.8) * scale}
              strokeDasharray={dash ? dash.map((part) => part * scale).join(" ") : undefined}
              strokeLinecap="round"
              opacity={tie.dash === "cold" ? 0.65 : 0.9}
            />
          );
        })}
      </svg>
      {people.map((person) => {
        const node = positions.current.get(person.id);
        if (!node) return null;
        return (
          <button
            key={person.id}
            type="button"
            aria-pressed={person.selected}
            aria-label={person.name}
            onPointerDown={onDown(person.id)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              onTap(person.id);
            }}
            className="absolute flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            style={{
              ...toPercent(node),
              transform: `translate(-50%, ${person.open ? "-22px" : "-16px"})`,
              touchAction: "none",
              zIndex: person.selected ? 3 : person.open ? 2 : 1,
            }}
          >
            <span
              className="rounded-full"
              style={{
                boxShadow: person.selected
                  ? "0 0 0 3px var(--noodle-accent)"
                  : person.open
                    ? "0 0 0 2px var(--noodle-accent)"
                    : "0 0 0 2px var(--noodle-divider)",
              }}
            >
              <Avatar
                account={{ displayName: person.name, avatarUrl: person.avatarUrl }}
                size={person.open ? "md" : "sm"}
              />
            </span>
            <span
              className={cn(
                "block truncate rounded-full bg-[var(--slurp-surface-raised)] px-1.5 text-center text-[11px] leading-4",
                person.selected ? "font-semibold text-[var(--slurp-text)]" : "text-[var(--slurp-muted)]",
              )}
              style={{ maxWidth: "6rem" }}
            >
              {person.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
