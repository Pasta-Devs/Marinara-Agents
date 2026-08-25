import type { NoodlerCreatorReplyResult } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { tryNoodlerAccountOperation } from "./slurp-account-operation-lock.js";
import { generateNoodlerCreatorReply } from "./slurp-reply-generation.service.js";

export async function generateAndApplyNoodlerCreatorReply(
  db: DB,
  input: {
    postId: string;
    parentInteractionId: string;
    viewerPersonaId: string;
    viewerActorAccountId: string;
    debugMode?: boolean;
  },
): Promise<NoodlerCreatorReplyResult> {
  const noodle = createSlurpStorage(db);
  const releaseClaim = async (claimId: string) => {
    try {
      await noodle.releaseNoodlerCreatorReplyClaim(claimId);
    } catch (releaseError) {
      logger.error(releaseError, "[noodler-reply] Failed to release the creator reply claim %s", claimId);
    }
  };
  const post = await noodle.getNoodlerPostById(input.postId);
  if (!post) return { status: "ineligible" };

  const locked = await tryNoodlerAccountOperation(post.authorAccountId, async () => {
    const settings = await noodle.getSettings();
    const connections = createConnectionsStorage(db);
    const connection = settings.generationConnectionId
      ? await connections.getWithKey(settings.generationConnectionId)
      : await connections.getDefaultForAgents();
    if (!connection) return { status: "connection_not_found" } as const;
    const claim = await noodle.claimNoodlerCreatorReply(
      post.authorAccountId,
      post.id,
      input.parentInteractionId,
      input.viewerPersonaId,
      input.viewerActorAccountId,
    );
    if (claim.status !== "claimed") return claim;
    let content: string;
    try {
      content = await generateNoodlerCreatorReply({
        db,
        creator: claim.creator,
        viewer: claim.viewer,
        post: claim.post,
        parent: claim.parent,
        connection,
        debugMode: input.debugMode,
      });
    } catch (error) {
      await releaseClaim(claim.claimId);
      throw error;
    }
    const interaction = await noodle.finalizeNoodlerCreatorReplyClaim(claim.claimId, content);
    if (!interaction) {
      await releaseClaim(claim.claimId);
      throw new Error("Failed to persist the generated NoodleR creator reply.");
    }
    return { status: "generated", interaction } as const;
  });
  return locked.acquired ? locked.value : { status: "busy" };
}
