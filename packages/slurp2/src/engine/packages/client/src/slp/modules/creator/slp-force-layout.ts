/**
 * A tiny force layout for the People map: people push each other apart, ties pull them together, a
 * soft pull keeps the map centered. Pure and deterministic; the component runs `slpForceStep` once
 * per frame while `alpha` cools, so the map settles fluidly and new people glide into place.
 *
 * ponytail: O(n²) repulsion per step. Fine for the few dozen people a map shows; use a quadtree
 * (Barnes-Hut) past a few hundred.
 */
export type SlpForceNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Held by a finger: stays exactly here and drags its ties along. */
  pinned?: boolean;
};
export type SlpForceLink = { a: string; b: string; /** Rest length. */ length: number };

const CHARGE = 1400;
const SPRING = 0.08;
const GRAVITY = 0.015;
const DAMPING = 0.55;
/** Below this the map has settled and the loop stops. */
export const SLP_FORCE_REST = 0.01;
export const SLP_FORCE_COOLING = 0.035;

/** Same id, same small offset: two people never start on the same spot. */
export function slpForceJitter(id: string): { x: number; y: number } {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  const angle = ((hash >>> 0) % 360) * (Math.PI / 180);
  return { x: Math.cos(angle) * 24, y: Math.sin(angle) * 24 };
}

/**
 * Keeps the people already placed where they are, and puts new ones next to the first placed
 * neighbor (or near the middle), so opening someone grows the map from them.
 */
export function slpForceSeed(
  previous: ReadonlyMap<string, SlpForceNode>,
  ids: readonly string[],
  neighbors: (id: string) => readonly string[],
): SlpForceNode[] {
  return ids.map((id) => {
    const kept = previous.get(id);
    if (kept) return { ...kept };
    const anchor = neighbors(id)
      .map((other) => previous.get(other))
      .find(Boolean);
    const jitter = slpForceJitter(id);
    return { id, x: (anchor?.x ?? 0) + jitter.x, y: (anchor?.y ?? 0) + jitter.y, vx: 0, vy: 0 };
  });
}

/** One step at temperature `alpha` (1 hot → 0 settled). Returns new nodes; the input is untouched. */
export function slpForceStep(nodes: readonly SlpForceNode[], links: readonly SlpForceLink[], alpha: number) {
  const next = nodes.map((node) => ({ ...node }));
  const byId = new Map(next.map((node) => [node.id, node]));
  for (let i = 0; i < next.length; i += 1)
    for (let j = i + 1; j < next.length; j += 1) {
      const a = next[i]!;
      const b = next[j]!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      if (dx === 0 && dy === 0) ({ x: dx, y: dy } = slpForceJitter(`${a.id}|${b.id}`));
      const distance2 = Math.max(dx * dx + dy * dy, 25);
      const force = (CHARGE * alpha) / distance2;
      const distance = Math.sqrt(distance2);
      a.vx -= (dx / distance) * force;
      a.vy -= (dy / distance) * force;
      b.vx += (dx / distance) * force;
      b.vy += (dy / distance) * force;
    }
  for (const link of links) {
    const a = byId.get(link.a);
    const b = byId.get(link.b);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const pull = (distance - link.length) * SPRING * alpha;
    a.vx += (dx / distance) * pull;
    a.vy += (dy / distance) * pull;
    b.vx -= (dx / distance) * pull;
    b.vy -= (dy / distance) * pull;
  }
  for (const node of next) {
    if (node.pinned) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx = (node.vx - node.x * GRAVITY * alpha) * DAMPING;
    node.vy = (node.vy - node.y * GRAVITY * alpha) * DAMPING;
    node.x += node.vx;
    node.y += node.vy;
  }
  return next;
}

/** A square box around everyone, with room for avatars and names, never smaller than `min`. */
export function slpForceBox(nodes: readonly SlpForceNode[], pad = 44, min = 220) {
  if (!nodes.length) return { x: -min / 2, y: -min / 2, size: min };
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const size = Math.max(min, maxX - minX + pad * 2, maxY - minY + pad * 2);
  return { x: (minX + maxX) / 2 - size / 2, y: (minY + maxY) / 2 - size / 2, size };
}
