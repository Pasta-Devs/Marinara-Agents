// The scene art and audio of a forged Otome Forge world (M2b): the story fixture's world with an image connection, an
// image client that counts paid calls, a chapter and beats written straight into the store, and the art and audio
// routes on a fake router.
import assert from "node:assert/strict";
import type {
  Beat,
  Chapter,
  ImageSettings,
} from "../../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import type {
  GeneratedImage,
  ImageClient,
  ImageRequest,
  SceneRequest,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/image-client.ts";
import type {
  OtomeReply,
  RegisterRoutes,
  RouteDeps,
  RouteHandler,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  beatId,
  chapterId,
  runDocTarget,
  worldId,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeWorld } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import type { OtomeStore } from "../../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { KAI, MIR, at, storyWorld } from "./otome-forge-story.ts";

export const PNG = "iVBORw0KGgo=";
export const KEY = "main-1";

export interface PaidCall {
  method: "generateImage" | "generateBannerArt" | "generatePortrait";
  request: ImageRequest & Partial<SceneRequest>;
}

/**
 * An image client that counts every paid call. `before(call, n)` runs before the n-th paid call answers (1-based):
 * throw to fail it, or change the world to race it.
 */
export function fakeImages({ before }: { before?: (call: PaidCall, n: number) => void | Promise<void> } = {}) {
  const paid: PaidCall[] = [];
  const uploads: Array<{ name: string; prompt: string }> = [];
  const deleted: string[] = [];
  const pay = async (call: PaidCall) => {
    paid.push(call);
    await before?.(call, paid.length);
  };
  const generated = (request: ImageRequest): GeneratedImage => ({
    mime: "image/png",
    ext: ".png",
    base64: PNG,
    width: request.width,
    height: request.height,
    prompt: request.prompt,
    sentPrompt: request.prompt,
    overrideTook: true,
  });
  const upload = (name: string, prompt: string) => {
    uploads.push({ name, prompt });
    const id = `img${uploads.length}`;
    return { id, url: `/api/global-gallery/file/${id}.png` };
  };
  const images: ImageClient = {
    async generatePortrait(request) {
      await pay({ method: "generatePortrait", request });
      return upload(request.name, request.prompt);
    },
    async generateBannerArt(request) {
      await pay({ method: "generateBannerArt", request });
      return upload(request.name, request.prompt);
    },
    async generateImage(request) {
      await pay({ method: "generateImage", request });
      return generated(request);
    },
    uploadToGallery: async ({ name, prompt }) => upload(name, prompt),
    styleProfile: async () => ({ styleText: "", positiveTags: "", negativeTags: "" }),
    deleteGalleryImage: async (id) => (deleted.push(id), true),
    characterCard: async () => null,
    personaAvatar: async () => "",
    cardAvatarImage: async (path) => (path.startsWith("/api/") ? { mime: "image/png", base64: PNG } : null),
  };
  return { images, paid, uploads, deleted };
}

/** The routes `register` adds, on a fake router; `call` answers like Fastify ({status, body}). */
export function routesOf(register: RegisterRoutes, deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  register(
    {
      get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
    },
    deps,
  );
  return async (method: "GET" | "POST", path: string, body: object = {}) => {
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
        params: { run: runKey },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

/** The story fixture's world with `images` set (an image connection by default) and the fake image client. */
export async function artWorld({
  runKey,
  images: settings = {},
  before,
  replies = [],
}: {
  runKey: string;
  images?: Partial<ImageSettings>;
  before?: (call: PaidCall, n: number) => void | Promise<void>;
  replies?: Parameters<typeof storyWorld>[0]["replies"];
}) {
  const world = await storyWorld({ runKey, replies });
  await setImages(world.store, world.runId, { connectionId: "conn-image", ...settings });
  const fake = fakeImages({ before });
  const deps: RouteDeps = { ...world.deps, images: fake.images };
  return { ...world, ...fake, deps };
}

export async function setImages(store: OtomeStore, runId: string, images: Partial<ImageSettings>) {
  await store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => ({
    ...current,
    images: { ...current.images, ...images },
  }));
}

/** Chapter 1, led by Kai, with `nodes` nodes (node 1 may hold a CG). */
export async function seedChapter(store: OtomeStore, runId: string, nodes = 3): Promise<Chapter> {
  const chapter: Chapter = {
    key: KEY,
    kind: "main",
    number: 1,
    lead: KAI,
    foil: MIR,
    title: "The Dark Quay",
    tags: [],
    summary: "The lights fail.",
    nodes: Array.from({ length: nodes }, (_, i) => ({
      i,
      kind: "beat" as const,
      guide: `Node ${i}.`,
      cast: [KAI],
      ...(i === 1 ? { cg: true } : {}),
    })),
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "conn-text",
  };
  await store.mutateDoc(runDocTarget("chapter", chapterId(runId, KEY)), normalizeChapter, () => chapter);
  return chapter;
}

/** A written beat `i` of chapter 1: Kai speaks a cold line in the Lamp Room; `changes` override any field. */
export function beat(i: number, changes: Partial<Beat> = {}): Beat {
  return {
    key: KEY,
    i,
    kind: "beat",
    places: [{ name: "The Lamp Room", tags: "lighthouse interior, great lens, no humans" }],
    segments: [
      { speaker: "", text: "The lamp hisses.", place: "The Lamp Room" },
      { speaker: "Kai", text: "You came back.", expression: "cold" },
      { speaker: "Ines", text: "Someone had to." },
    ],
    choices: [],
    choiceCanon: {},
    effects: {},
    applied: {},
    musicMood: "tense",
    readThrough: 0,
    written: { at: `2026-10-28T10:0${i}:00.000Z`, connectionId: "conn-text", model: "fake-model" },
    rewrites: 0,
    ...changes,
  };
}

/** Saves `value` as beat `value.i` of chapter 1, replacing what is stored. */
export async function saveBeat(store: OtomeStore, runId: string, value: Beat): Promise<Beat> {
  return (await store.mutateDoc(runDocTarget("beat", beatId(runId, KEY, value.i)), normalizeBeat, () => value))!;
}

export const readStoredBeat = async (store: OtomeStore, runId: string, i: number) =>
  store.readDoc(beatId(runId, KEY, i), normalizeBeat);

/** Waits until `condition` holds (background paints settle on their own schedule), or fails after `ms`. */
export async function until(condition: () => boolean | Promise<boolean>, what: string, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > ms) assert.fail(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
