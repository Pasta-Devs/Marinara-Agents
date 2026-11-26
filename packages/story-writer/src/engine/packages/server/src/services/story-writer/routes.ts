// ──────────────────────────────────────────────
// Story Writer: REST routes under /api/story-writer (the table is in the client's lib/story-writer/model.ts)
// ──────────────────────────────────────────────
import { randomUUID } from "node:crypto";
import {
  CLIENT_ID_PATTERN,
  GALLERY_REF_PREFIX,
  LIMITS,
  withPrefix,
  type StoryIllustration,
} from "../../../../client/src/lib/story-writer/model.js";
import { namesClothes, PICTURE_NEGATIVE_PROMPT, type IllustrationImages } from "./illustrations.js";
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
/** What Illustrate asks the image connection for: a portrait page, an SDXL size most providers take as it is. */
export const PICTURE_SIZE = { width: 896, height: 1152 };

function field(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/** An Illustrate request, checked before anything is painted. */
function readIllustrationCreate(body: unknown) {
  const connectionId = field(body, "connectionId");
  const prompt = field(body, "prompt");
  const paragraph = field(body, "paragraph");
  const anchor = field(body, "anchor");
  const replace = field(body, "replace");
  if (typeof connectionId !== "string" || !connectionId.trim() || connectionId.length > 200) {
    throw new StoryWriterError(400, "Choose an image connection first.");
  }
  if (typeof prompt !== "string" || !prompt.trim()) throw new StoryWriterError(400, "The picture prompt is empty.");
  if (prompt.length > LIMITS.picturePrompt) {
    throw new StoryWriterError(400, `The picture prompt can be at most ${LIMITS.picturePrompt} characters.`);
  }
  if (typeof paragraph !== "number" || !Number.isInteger(paragraph) || paragraph < 0) {
    throw new StoryWriterError(400, "The paragraph is invalid.");
  }
  if (replace !== undefined && (typeof replace !== "string" || !CLIENT_ID_PATTERN.test(replace))) {
    throw new StoryWriterError(400, "Picture id is invalid.");
  }
  return {
    connectionId: connectionId.trim(),
    prompt: prompt.trim(),
    paragraph,
    anchor: typeof anchor === "string" ? anchor.slice(0, LIMITS.illustrationAnchor) : "",
    replace: replace as string | undefined,
    debugMode: field(body, "debugMode") === true,
  };
}

const galleryId = (illustration: StoryIllustration | undefined) =>
  illustration?.image.startsWith(GALLERY_REF_PREFIX) ? illustration.image.slice(GALLERY_REF_PREFIX.length) : "";

export function storyWriterRoutes(store: StoryStore, logger: StoryWriterLogger, images: IllustrationImages) {
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

  // Paints, then stores: a picture the chapter cannot take any more (it was deleted or filled meanwhile, or the write
  // failed) is deleted again. The story's negative prefix goes before the picture's own negative prompt, and the
  // pictures of the cast the prompt names go with it unless the story turned them off.
  const illustrate = async (request: StoryWriterRequest) => {
    const input = readIllustrationCreate(request.body);
    const settings = await store.checkIllustration(storyId(request), chapterId(request), input.replace);
    let picture;
    try {
      const references = settings.pictureReferences ? await images.references(settings, input.prompt) : [];
      picture = await images.paint({
        connectionId: input.connectionId,
        prompt: input.prompt,
        negativePrompt: withPrefix(settings.pictureNegativePrefix, PICTURE_NEGATIVE_PROMPT),
        ...PICTURE_SIZE,
        debugMode: input.debugMode,
        ...(references.length ? { referenceImages: references } : {}),
        ...(references.length && namesClothes(input.prompt) ? { preferReferenceOutfit: false as const } : {}),
      });
    } catch (error) {
      logger.error(error, "Story Writer could not paint a picture");
      const reason = error instanceof Error && error.message ? ` ${error.message}` : "";
      throw new StoryWriterError(502, `The picture could not be painted.${reason}`);
    }
    const illustration: StoryIllustration = {
      id: `picture-${randomUUID()}`,
      image: `${GALLERY_REF_PREFIX}${picture.id}`,
      url: picture.url,
      prompt: input.prompt,
      width: picture.width,
      height: picture.height,
      paragraph: input.paragraph,
      anchor: input.anchor,
    };
    let saved;
    try {
      saved = await store.addIllustration(storyId(request), chapterId(request), illustration, input.replace);
    } catch (error) {
      // Nothing holds the new picture yet (and the Engine keeps it if a half-finished write does), so it goes again.
      await images.remove(picture.id);
      throw error;
    }
    // Illustrate again keeps the picture it replaced in the Global Gallery, as deleting a chapter or a story does.
    return { story: saved.story, chapter: saved.chapter };
  };

  const removeIllustration = async (request: StoryWriterRequest) => {
    const illustrationId = field(request.params, "illustrationId");
    const saved = await store.removeIllustration(storyId(request), chapterId(request), illustrationId);
    await images.remove(galleryId(saved.previous.find((item) => item.id === illustrationId)));
    return { story: saved.story, chapter: saved.chapter };
  };

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
    router.post("/stories/:storyId/chapters/:chapterId/illustrations", handle(illustrate));
    router.delete("/stories/:storyId/chapters/:chapterId/illustrations/:illustrationId", handle(removeIllustration));
  };
}
