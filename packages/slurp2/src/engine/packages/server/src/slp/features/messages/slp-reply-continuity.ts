import { listSlurpContinuityFor } from "../../data/continuity/slp-continuity-storage.js";
import { recallSlurpMemories, slurpRecallPersonaId } from "../../data/creators/slp-ltm-recall.js";
import { slurpContinuityInstruction } from "../../modules/continuity/slp-continuity-prompt.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpMessagePromptInput } from "./slp-message-prompt-input.js";

/**
 * What a DM reply already knows: the Creator's approved notes plus this thread's private ones
 * (`slurpContinuityReadable` fences other threads), and what Long-Term Memory remembers that fits the
 * fan's last message. The player's persona is added to the recall only when its own page is open, so a
 * hinted or concealed page is never tied to its memories. Empty when there is nothing to say.
 */
export async function slurpReplyContinuity(
  input: Pick<SlurpMessagePromptInput, "db" | "creator" | "threadId" | "history" | "viewer">,
  recall: Pick<Parameters<typeof recallSlurpMemories>[0], "settings" | "source" | "disclosureMode"> & {
    viewerPage: Pick<SlpAccount, "settings"> | null;
    fanVoice: unknown;
  },
): Promise<string> {
  const { lines: memories } = await recallSlurpMemories({
    ...recall,
    // A tip or picture has no words: ask about the last thing the fan actually said.
    queryText:
      input.history.findLast((message) => message.role === "viewer" && message.content.trim())?.content ??
      input.creator.displayName,
    personaId: slurpRecallPersonaId(input.viewer, recall.viewerPage, recall.fanVoice),
  });
  const ledger = input.threadId
    ? await listSlurpContinuityFor(input.db, input.creator.id, "fan_thread", {
        at: new Date(),
        threadId: input.threadId,
        limit: 20,
      }).catch(() => ({ facts: [], events: [] }))
    : { facts: [], events: [] };
  return slurpContinuityInstruction({ ...ledger, threadId: input.threadId, memories });
}
