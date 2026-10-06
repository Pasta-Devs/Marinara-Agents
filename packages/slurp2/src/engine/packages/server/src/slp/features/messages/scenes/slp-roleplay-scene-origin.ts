/**
 * The DM thread as an Engine scene origin (capability API 1.66, docs/SCENES.md).
 *
 * The Engine asks for the thread's context, claims the thread when the scene starts and releases it
 * when the scene ends. Release writes what came back into the thread first and opens the lock last,
 * so a release that fails half way is simply delivered again and never loses the recap.
 */
import type { SceneOriginEnd, SceneOriginProvider } from "@marinara-engine/shared";
import type { DB } from "../../../../db/connection.js";
import { logger } from "../../../../lib/logger.js";
import { createChatsStorage } from "../../../../services/storage/chats.storage.js";
import {
  createSlurpContinuityFact,
  recordSlurpContinuityEvent,
  retractSlurpContinuitySource,
} from "../../../data/continuity/slp-continuity-storage.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../../data/slp-storage.js";
import {
  slpSceneAudienceScope,
  slpSceneRecapLine,
  slpSceneTranscript,
} from "../../../modules/messages/slp-roleplay-scene-rules.js";
import {
  readSlpSceneLine,
  readSlpSceneSettings,
  type SlpSceneReach,
} from "../../../../../../shared/src/slp/slp-roleplay-scene.js";
import { protectCreatorGeneratedIdentity, resolveNoodlerPublicIdentity } from "../../feed/slp-feed-contract.js";

/** The recap line's id: one per scene, so a repeated release finds it instead of writing a second. */
export const slpSceneRecapMessageId = (sceneChatId: string) => `scene-${sceneChatId}`;

export function createSlpSceneOriginProvider(db: DB): SceneOriginProvider {
  return {
    async getContext(threadId) {
      const slurp = createSlurpStorage(db);
      const messages = createSlurpMessagesStorage(db);
      const thread = await messages.getThreadById(threadId);
      if (!thread || thread.state !== "active") return null;
      const [creator, viewer] = await Promise.all([
        slurp.getNoodlerAccountById(thread.creatorAccountId),
        slurp.getViewer(thread.viewerAccountId).catch(() => null),
      ]);
      const source = creator ? await slurp.resolveAccountSource(creator) : null;
      // Only the player's own persona plays a scene, and only an Engine character can be cast.
      if (!creator || !viewer || source?.kind !== "character") return null;
      const settings = await slurp.getSettings();
      return {
        characterIds: [source.entityId],
        personaId: viewer.entityId,
        connectionId: settings.generationConnectionId ?? null,
        transcript: slpSceneTranscript(await messages.listMessages(thread.id, 40), {
          creator: creator.displayName,
          fan: viewer.displayName,
        }),
        notes: `On Slurp she is ${creator.displayName} (@${creator.handle}), a creator; ${viewer.displayName} knows her from her direct messages.`,
      };
    },
    async claim(threadId, scene) {
      const messages = createSlurpMessagesStorage(db);
      // A scene that does not lock (her settings say she stays on her phone) is admitted as it is.
      if (readSlpSceneSettings(scene.data).lock) {
        if (!(await messages.claimThreadScene(threadId, scene.sceneChatId))) return false;
      } else if ((await messages.getThreadById(threadId))?.state !== "active") return false;
      // Starting a scene answers the invite that is open in the thread.
      for (const message of await messages.listMessages(threadId, 40)) {
        const line = readSlpSceneLine(message.metadata);
        if (line?.kind === "invite" && line.state === "open")
          await messages.setSceneLine(message.id, { ...line, state: "accepted" });
      }
      return true;
    },
    async release(threadId, end) {
      await releaseSlpRoleplayScene(db, threadId, end);
    },
  };
}

/**
 * Bring a scene's outcome back into its thread, then open its lock. A locking scene that does not hold
 * the lock is ignored; a scene that never locked is told apart by its own line id.
 */
export async function releaseSlpRoleplayScene(db: DB, threadId: string, end: SceneOriginEnd): Promise<void> {
  const slurp = createSlurpStorage(db);
  const messages = createSlurpMessagesStorage(db);
  const settings = readSlpSceneSettings(end.data);
  const thread = await messages.getThreadById(threadId);
  if (!thread || (settings.lock && thread.sceneChatId !== end.sceneChatId)) return;
  const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
  const lineId = slpSceneRecapMessageId(end.sceneChatId);
  if (creator && !(await messages.getMessageById(lineId))) {
    if (end.kind === "concluded" && settings.reach !== "none") {
      // The recap is written by the Engine from the character card: a concealed Creator's real name
      // must not reach her Slurp thread through it.
      const disclosureMode = creator.settings.privacy.identityDisclosure ?? "open";
      const publicIdentity = await resolveNoodlerPublicIdentity(db, creator);
      const summary = protectCreatorGeneratedIdentity(end.summary, disclosureMode, publicIdentity) ?? "";
      const reach: SlpSceneReach = settings.reach;
      const scene = slpSceneRecapLine({
        sceneChatId: end.sceneChatId,
        title: (await createChatsStorage(db).getById(end.sceneChatId))?.name ?? "",
        summary,
        reach,
      });
      await messages.appendMessage(thread.id, {
        id: lineId,
        senderAccountId: creator.id,
        role: "creator",
        kind: "system",
        content: summary,
        metadata: { scene },
        preserveReplyObligation: true,
      });
      await recordSlurpContinuityEvent(db, {
        sourceKind: "roleplay",
        sourceEntityId: end.sceneChatId,
        creatorAccountId: creator.id,
        eventType: "scene_played",
        source: "roleplay",
        realityScope: "roleplay",
        audienceScope: "thread_private",
        threadId: thread.id,
        payload: { sceneChatId: end.sceneChatId, rating: end.rating, reach },
        fingerprint: `scene:${end.sceneChatId}`,
        contribution: "system",
        occurredAt: new Date(),
      });
      await writeSlpSceneFact(db, {
        creatorAccountId: creator.id,
        threadId: thread.id,
        sceneChatId: end.sceneChatId,
        title: scene.kind === "recap" ? scene.title : "",
        summary,
        reach,
      });
    } else {
      await messages.appendMessage(thread.id, {
        id: lineId,
        senderAccountId: creator.id,
        role: "creator",
        kind: "system",
        content: "",
        // Concluded but kept out of Slurp: the thread only notes that it happened.
        metadata: { scene: { kind: "ended", sceneChatId: end.sceneChatId, outcome: end.kind } },
        preserveReplyObligation: true,
      });
    }
  }
  if (settings.lock) await messages.releaseThreadScene(thread.id, end.sceneChatId);
}

/**
 * The fact the Creator remembers, at the reach the player allowed. Choosing a reach is the explicit
 * promotion the ledger asks for: the record is `slurp` reality, so her prompts can read it, and its
 * audience decides where. A changed reach retracts the old fact and writes the new one.
 */
export async function writeSlpSceneFact(
  db: DB,
  input: {
    creatorAccountId: string;
    threadId: string;
    sceneChatId: string;
    title: string;
    summary: string;
    reach: SlpSceneReach;
  },
): Promise<void> {
  const sourceHash = `scene:${input.sceneChatId}`;
  await retractSlurpContinuitySource(db, input.creatorAccountId, sourceHash);
  if (input.reach === "none") return;
  const text =
    input.reach === "hint"
      ? `She met one of her fans in person recently${input.title ? ` (${input.title})` : ""}. She may allude to it, but never gives details or says who.`
      : `A scene with this fan${input.title ? `, "${input.title}"` : ""}: ${input.summary}`;
  const fact = await createSlurpContinuityFact(db, {
    sourceKind: "roleplay",
    sourceEntityId: input.sceneChatId,
    creatorAccountId: input.creatorAccountId,
    factType: "relationship",
    subject: input.title || "scene",
    text,
    audienceScope: slpSceneAudienceScope(input.reach),
    realityScope: "slurp",
    threadId: input.threadId,
    salience: 0.8,
    source: "roleplay",
    sourceHash,
    contribution: "system",
  });
  if (!fact) logger.warn({ sceneChatId: input.sceneChatId }, "[slurp] Scene recap fact was empty");
}

/**
 * Settle a lock whose release never arrived (Slurp was off or updating when the scene ended). The
 * scene chat says how it ended: a concluded scene keeps its recap, a missing one was deleted.
 * Returns whether the thread is still in a running scene.
 */
export async function reconcileSlpThreadScene(
  db: DB,
  thread: { id: string; sceneChatId: string | null },
): Promise<boolean> {
  if (!thread.sceneChatId) return false;
  const sceneChatId = thread.sceneChatId;
  const chat = await createChatsStorage(db).getById(sceneChatId);
  const meta = readChatMetadata(chat?.metadata);
  if (chat && meta.sceneStatus === "active") return true;
  const characterIds = Array.isArray(chat?.characterIds)
    ? chat.characterIds.map(String)
    : readJsonArray(chat?.characterIds);
  const data =
    meta.scenePackageData && typeof meta.scenePackageData === "object"
      ? (meta.scenePackageData as Record<string, unknown>)
      : null;
  await releaseSlpRoleplayScene(
    db,
    thread.id,
    chat && meta.sceneStatus === "concluded" && typeof meta.sceneSummary === "string"
      ? {
          data,
          kind: "concluded",
          sceneChatId,
          summary: meta.sceneSummary,
          description: typeof meta.sceneDescription === "string" ? meta.sceneDescription : null,
          scenario: typeof meta.sceneScenario === "string" ? meta.sceneScenario : null,
          rating: meta.sceneRating === "sfw" ? "sfw" : "nsfw",
          characterIds,
        }
      : { data, kind: chat ? "abandoned" : "deleted", sceneChatId },
  );
  return false;
}

function readChatMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
