// A forged Otome Forge world with Wish (M4): the art fixture's world (three love interests, an image connection and an
// image client that counts paid calls), the Wish routes on a fake router, P20 replies for each banner kind, and a
// seeded Math.random as in Gacha Forge's summon-rates regression.
import type { BannerKind } from "../../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/wish.ts";
import assert from "node:assert/strict";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  worldId,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { registerWishRoutes } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/wish.ts";
import { normalizeWorld } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import type { OtomeStore } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { artWorld } from "./otome-forge-art.ts";
import { KAI, MIR, SOL } from "./otome-forge-story.ts";

export { KAI, MIR, SOL };

/** GF's summon-rates generator: a linear congruential sequence in [0, 1). */
export function seeded(seed = 0x6f726765) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0), state / 2 ** 32);
}

const look = (name: string, outfitLine: string) => ({ name, outfitLine });

/** A valid P20 reply for `kind`; `featured` is whose banner it is (the 4★ looks of His Wardrobe go to others). */
export function bannerReply(kind: BannerKind, { featured = KAI, tag = "" }: { featured?: string; tag?: string } = {}) {
  const others = [KAI, MIR, SOL].filter((li) => li !== featured);
  const snapshots = [featured, others[0], others[1], featured, others[0], featured].map((li, i) => ({
    li,
    title: `Snapshot ${i + 1}${tag}`,
    text: `SNAPSHOT-${kind}-${i + 1}${tag}: the lamp hums while they share a late tea. Neither says what they mean.`,
  }));
  if (kind === "memories") {
    return {
      featured: {
        title: `Lantern Vigil${tag}`,
        premise: "A storm keeps them in the lamp room until dawn, with one blanket and an argument about the bell.",
        cgBrief: "The lamp room at night, rain on the glass, both of them wrapped in one blanket by the great lens.",
        cgCast: ["Kai", "Ines"],
      },
      four: [others[0], others[1], featured].map((li, i) => ({
        li,
        title: `Moment ${i + 1}${tag}`,
        premise: "A short walk on the quay after the lights come back.",
      })),
      snapshots,
    };
  }
  if (kind === "his-wardrobe") {
    return {
      featured: {
        title: `Harbour Night${tag}`,
        look: look("Harbour Night", "navy greatcoat, brass buttons, white gloves"),
      },
      four: [others[0], others[1], others[0]].map((li, i) => ({
        li,
        title: `Look ${i + 1}${tag}`,
        look: look(`Look ${i + 1}`, "linen shirt, rolled sleeves, leather boots"),
      })),
      snapshots,
    };
  }
  return {
    featured: {
      title: `Lantern Silk${tag}`,
      look: look("Lantern Silk", "deep blue silk dress, silver lantern earrings"),
    },
    four: [1, 2, 3].map((i) => ({ title: `Her look ${i}${tag}`, look: look(`Her look ${i}`, "wool coat, red scarf") })),
    snapshots,
  };
}

/** The Wish routes on a fake router; `call` answers like Fastify ({status, body}), with extra params (`li`). */
export function wishRoutes(deps: RouteDeps, runKey: string, active?: () => boolean) {
  const routes = new Map<string, RouteHandler>();
  registerWishRoutes(
    {
      get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
    },
    deps,
    { active },
  );
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

/** The art fixture's world with the Wish routes; `replies` are the model's, in order. */
export async function wishWorld(options: Parameters<typeof artWorld>[0]) {
  const t = await artWorld(options);
  return { ...t, call: wishRoutes(t.deps, options.runKey) };
}

/** Moves the world's creation `days` into the past, so today falls in a later rotation. */
export async function ageWorld(t: { store: OtomeStore; runId: string }, days: number) {
  return t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    createdAt: new Date(Date.now() - days * 86_400_000).toISOString(),
  }));
}

/** The three P20 replies one open makes for a fresh rotation, featuring `featured` (and His Wardrobe's LI for hers). */
export const rotationReplies = (featured = KAI, tag = "") =>
  (["memories", "his-wardrobe", "my-wardrobe"] as const).map((kind) =>
    JSON.stringify(bannerReply(kind, { featured, tag })),
  );
