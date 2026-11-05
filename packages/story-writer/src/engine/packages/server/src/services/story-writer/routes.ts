// ──────────────────────────────────────────────
// Story Writer: REST routes under /api/story-writer (the table is in the client's lib/story-writer/model.ts)
// ──────────────────────────────────────────────
import { StoryWriterError, type StoryStore } from "./story-store.js";

// Structural slices of Fastify: the host hands privileged routes a collector with get/post/put/patch/delete only.
export interface StoryWriterRequest {
  params: unknown;
  body: unknown;
  method?: string;
  url?: string;
}

export interface StoryWriterReply {
  status(code: number): StoryWriterReply;
  send(payload: unknown): StoryWriterReply;
}

type RouteHandler = (request: StoryWriterRequest, reply: StoryWriterReply) => Promise<unknown>;

interface RouteRegistrar {
  (path: string, handler: RouteHandler): void;
  (path: string, options: { bodyLimit: number }, handler: RouteHandler): void;
}

export interface StoryWriterRouter {
  get: RouteRegistrar;
  post: RouteRegistrar;
  patch: RouteRegistrar;
  delete: RouteRegistrar;
}

export interface StoryWriterLogger {
  error(error: unknown, message: string, ...args: unknown[]): void;
}

// A long chapter is up to 400,000 characters; JSON escaping and multi-byte text need room above that.
const WRITE = { bodyLimit: 4 * 1024 * 1024 };

function field(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export function storyWriterRoutes(store: StoryStore, logger: StoryWriterLogger) {
  // The store validates every id and body; known failures go out as { error }, anything else is logged and hidden.
  const handle =
    (run: (request: StoryWriterRequest) => Promise<unknown>): RouteHandler =>
    async (request, reply) => {
      try {
        return await run(request);
      } catch (error) {
        if (error instanceof StoryWriterError) return reply.status(error.statusCode).send({ error: error.message });
        logger.error(error, "Story Writer request failed: %s %s", request.method ?? "", request.url ?? "");
        return reply.status(500).send({ error: "Story Writer could not complete the request." });
      }
    };
  const storyId = (request: StoryWriterRequest) => field(request.params, "storyId");
  const chapterId = (request: StoryWriterRequest) => field(request.params, "chapterId");

  return async (router: StoryWriterRouter) => {
    router.get(
      "/preferences",
      handle(() => store.getPreferences()),
    );
    router.patch(
      "/preferences",
      WRITE,
      handle((request) => store.patchPreferences(request.body)),
    );
    router.get(
      "/stories",
      handle(() => store.listStories()),
    );
    router.post(
      "/stories",
      WRITE,
      handle((request) => store.createStory(field(request.body, "settings"))),
    );
    router.get(
      "/stories/:storyId",
      handle((request) => store.getStory(storyId(request))),
    );
    router.patch(
      "/stories/:storyId",
      WRITE,
      handle((request) => store.patchStorySettings(storyId(request), field(request.body, "settings"))),
    );
    router.post(
      "/stories/:storyId/duplicate",
      WRITE,
      handle((request) => store.duplicateStory(storyId(request))),
    );
    router.delete(
      "/stories/:storyId",
      handle((request) => store.deleteStory(storyId(request))),
    );
    router.post(
      "/stories/:storyId/chapters",
      WRITE,
      handle((request) => store.createChapter(storyId(request), request.body)),
    );
    router.patch(
      "/stories/:storyId/chapters/:chapterId",
      WRITE,
      handle((request) => store.patchChapter(storyId(request), chapterId(request), request.body)),
    );
    router.delete(
      "/stories/:storyId/chapters/:chapterId",
      handle((request) => store.deleteChapter(storyId(request), chapterId(request))),
    );
  };
}
