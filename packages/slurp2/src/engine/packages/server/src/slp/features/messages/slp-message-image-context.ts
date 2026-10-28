/**
 * The pictures a DM reply sees, as text: the thread's own pictures and the Creator's recent posts.
 * Split out of `slp-message-generation-service.ts` (size cap); the rules are unchanged.
 */
import type { DB } from "../../../db/connection.js";
import { prepareSlurpPostImageContexts, slurpImageCaptioning } from "../../base/media/slp-post-image-context.js";
import { createSlurpMessagesStorage, createSlurpStorage, type SlurpMessage } from "../../data/slp-storage.js";
import type { SlurpSettings } from "../../modules/settings/slp-settings.js";

/** What the storage lists for a Creator: drafts included, filtered out below. */
type PostRows = Awaited<ReturnType<ReturnType<typeof createSlurpStorage>["listNoodlerPostsByAccount"]>>;

export function slurpDmImageContexts(
  input: {
    db: DB;
    connection: Parameters<typeof slurpImageCaptioning>[2];
    debugMode?: boolean;
    history: readonly SlurpMessage[];
  },
  settings: Pick<SlurpSettings, "imageContextConnectionId" | "imageContextMode" | "imageCaptionPrompt">,
  recentPostRows: PostRows,
  limits: { historyTurns: number; recentPosts: number },
): Promise<Map<string, string>> {
  // Pictures reach the model through the one image context setting: the thread's own pictures, and
  // the Creator's recent posts a fan is likely to mention. The creator is one side of this thread,
  // so a locked picture in it is theirs to see. Recent posts use stored prompts and saved
  // descriptions only, so a reply never pays for vision across the whole feed, and a locked post
  // stays out like its text does. A failed description costs the picture its context, never the reply.
  return slurpImageCaptioning(
    input.db,
    settings.imageContextConnectionId,
    input.connection,
    settings.imageCaptionPrompt,
  )
    .then(async (captioning) => {
      const messageStore = createSlurpMessagesStorage(input.db);
      const [threadImages, postImages] = await Promise.all([
        prepareSlurpPostImageContexts({
          posts: input.history
            .slice(-limits.historyTurns)
            .filter((message) => message.imageUrl)
            .map((message) => ({
              id: message.id,
              access: "public" as const,
              imageUrl: message.imageUrl,
              imagePrompt: typeof message.metadata.imagePrompt === "string" ? message.metadata.imagePrompt : null,
              metadata: message.metadata,
              createdAt: message.createdAt,
            })),
          mode: settings.imageContextMode,
          captioning,
          allowLocked: true,
          debugMode: input.debugMode,
          onDescribed: (message, description, source) =>
            messageStore.setMessageImageDescription(message.id, description, source),
        }),
        prepareSlurpPostImageContexts({
          posts: recentPostRows.filter((post) => post.access !== "draft").slice(0, limits.recentPosts),
          mode: "imagePrompt",
          captioning,
        }),
      ]);
      return new Map([...postImages, ...threadImages]);
    })
    .catch(() => new Map<string, string>());
}
