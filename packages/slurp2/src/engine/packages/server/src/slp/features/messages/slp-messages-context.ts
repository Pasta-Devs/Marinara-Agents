import { createSlurpPopulationStorage } from "../audience/slp-audience-contract.js";
import type { SlurpMessagesStorage } from "./slp-messages-contract.js";
import { resolveSlurpCreatorAvailability } from "../../../services/slurp/slurp-creator-schedule-context.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import type { FastifyInstance } from "fastify";

/** Storage handles and access checks shared by every message route. Created once per mount. */
export function createSlpMessagesContext(
  app: FastifyInstance,
  slurp: SlpMessagesStorageDependencies["slurp"],
  messages: SlpMessagesStorageDependencies["messages"],
) {
  const population = createSlurpPopulationStorage(app.db);

  const creatorPresence = async (
    creator: NonNullable<Awaited<ReturnType<typeof slurp.getNoodlerAccountById>>>,
    threadId?: string,
  ) => {
    const threadMessages = threadId ? await messages.listMessages(threadId) : [];
    const latestMessage = threadMessages
      .filter((message) => message.role === "creator")
      .reduce<string | null>(
        (latest, message) => (!latest || message.createdAt > latest ? message.createdAt : latest),
        null,
      );
    const latestPost = await slurp.getNoodlerLatestPublishedPost(creator.id);
    const source = await slurp.resolveAccountSource(creator);
    let availability = source
      ? await resolveSlurpCreatorAvailability(
          createCharactersStorage(app.db),
          source,
          undefined,
          new Date(),
          latestPost?.createdAt ?? null,
          await slurp.getSettings(),
        )
      : { online: true, activity: null, minutesUntilOnline: 0 };

    // Check if this specific thread has extended online availability
    if (threadId) {
      const thread = await messages.getThreadById(threadId);
      if (thread?.extendedOnlineUntil && thread.extendedOnlineUntil > new Date().toISOString()) {
        availability = { online: true, activity: "chatting", minutesUntilOnline: 0 };
      }
    }

    return {
      creatorLastActiveAt: latestPost?.createdAt ?? null,
      creatorLastMessageAt: latestMessage,
      creatorAutoPosting: Boolean(creator.settings.scheduler.autoPosting?.enabled),
      creatorAvailability: availability,
    };
  };

  /** Every route needs the same "is this a real persona" gate, so it lives in one helper. */
  const requireViewer = async (personaId: string) => slurp.getViewer(personaId);

  /**
   * The messages of a thread as this side is allowed to see them.
   *
   * A pay-per-view message the fan has not unlocked must not travel over the wire at all;
   * hiding it in the client would still hand the text to anyone reading the response. The
   * Creator side always sees what they wrote.
   */
  const visibleMessages = async (threadId: string, side: "viewer" | "creator") =>
    (await messages.listMessages(threadId)).map((message) =>
      side === "viewer" && message.kind === "ppv" && !message.unlockedAt
        ? {
            ...message,
            content: "",
            imageUrl: null,
            metadata: { ...message.metadata, imagePrompt: undefined, imageDescription: undefined },
          }
        : side === "viewer" && message.kind === "post_preview" && message.metadata.previewLocked === true
          ? {
              ...message,
              content: "",
              imageUrl: null,
              metadata: { ...message.metadata, content: "", imageUrl: null },
            }
          : message,
    );

  /**
   * Re-read a thread and enrich it, so every response carries the same joined shape.
   *
   * `side` defaults to the fan, which is the safe default: their copy has the rapport score, the
   * mood, the notes and the strike count stripped. Every thread response goes through here, so a
   * new endpoint cannot leak the simulation's internals by forgetting to.
   */
  const freshView = async (threadId: string, side: "viewer" | "creator" = "viewer") => {
    const thread = await messages.getThreadById(threadId);
    if (!thread) return null;
    const view = await messages.viewThread(thread);
    return side === "creator" ? view : { ...view, ...messages.forViewer(thread) };
  };

  /**
   * A creator the viewer owns. The creator-side routes are gated on this: a player must not be
   * able to accept requests or read the rapport panel for somebody else's creator.
   */
  const ownsCreator = async (personaId: string, creatorAccountId: string) => {
    const creator = await slurp.getNoodlerAccountById(creatorAccountId);
    return Boolean(creator && creator.sourceKind === "persona" && creator.sourceEntityId === personaId);
  };

  return { slurp, messages, population, creatorPresence, requireViewer, visibleMessages, freshView, ownsCreator };
}

export type SlpMessagesContext = ReturnType<typeof createSlpMessagesContext>;

export type SlpMessagesStorageDependencies = {
  slurp: Record<string, any>;
  messages: SlurpMessagesStorage;
};
