/**
 * Keep the sign-up chat as the new Creator's first DM thread with the player's persona, or with
 * Slurp Support when Support signed them up.
 *
 * The Creator opens the thread (no request fee), and only an empty thread takes the transcript, so
 * pressing twice or keeping a chat for an older Creator never scrambles a real conversation.
 */
import type { SlpSceneKeepRequest } from "../../../../../shared/src/slp/slp-scene.js";
import type { DB } from "../../../db/connection.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../data/slp-storage.js";
import { slpSceneThreadMessages } from "../../modules/onboarding/slp-scene-thread.js";
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";
import { updateSlurpSupportDesk } from "../../data/creators/slp-support-desk-storage.js";
import { slpDeskSeed } from "../../../../../shared/src/slp/slp-support-desk.js";

export async function keepSlpSceneTranscript(
  db: DB,
  request: SlpSceneKeepRequest,
): Promise<{ status: "kept"; threadId: string } | { status: "missing" | "skipped" }> {
  const creator = await createSlurpStorage(db).getNoodlerAccountById(request.creatorAccountId);
  if (!creator) return { status: "missing" };
  const messages = createSlurpMessagesStorage(db);
  // A Support sign-up goes into Slurp Support's own thread with the Creator, which every persona
  // shares (`slp-support.ts`). A persona's own Creator has no DM thread with that persona; openThread
  // says not_found.
  const viewerAccountId = request.preset === "support" ? SLURP_SUPPORT_ACCOUNT_ID : request.viewerPersonaId;
  const opened = await messages.openThread(viewerAccountId, creator.id, "creator", "waive");
  if (opened.status !== "ok") return { status: "skipped" };
  if ((await messages.listMessages(opened.thread.id, 1)).length > 0) return { status: "skipped" };
  const kept = slpSceneThreadMessages({ ...request, now: new Date() });
  if (!kept.length) return { status: "skipped" };
  for (const message of kept) {
    await messages.appendMessage(opened.thread.id, {
      senderAccountId: message.role === "creator" ? creator.id : viewerAccountId,
      ...message,
    });
  }
  // Support signed them up: the case file starts with the sign-up, and a little warmer (docs/SUPPORT-DESK.md).
  if (request.preset === "support")
    await updateSlurpSupportDesk(db, creator.id, (desk) => slpDeskSeed(desk, { signedUpBySupport: true }));
  return { status: "kept", threadId: opened.thread.id };
}
