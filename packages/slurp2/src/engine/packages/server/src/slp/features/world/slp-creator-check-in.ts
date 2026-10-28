import { randomUUID } from "node:crypto";
import { slurpCreatorCheckIn } from "../../../../../shared/src/slp/slp-world.js";
import type { SlurpThread } from "../../data/messages/slp-messages-storage-types.js";
import type { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { slurpAllowsUnsolicitedText } from "../../modules/messages/slp-follow-up.js";
import { localDayKey } from "./slp-world-actions.js";
import { logger } from "../../../lib/logger.js";

/**
 * A chat that exists and went quiet: now and then the Creator writes first in it (G5). It goes
 * through the follow-up writer as an `opener`, so it is the full DM path inside the AI budget, and
 * the player writing first cancels it. Only the player's own personas read chats, so nobody else
 * gets one. True when one was planned.
 */
export async function planSlurpCreatorCheckIn(input: {
  messages: Pick<ReturnType<typeof createSlurpMessagesStorage>, "addScheduledFollowUps" | "listMessages">;
  /** Whether this member is one of the player's personas. */
  isPlayer: (memberId: string) => Promise<boolean>;
  creatorAccountId: string;
  tie: { memberId: string; stage: string };
  thread: SlurpThread;
  until: Date;
  /** A stable number in [0, 1) for one string (the world tick's own). */
  unit: (value: string) => number;
  /** Settings › Messaging "Stop after one unanswered text". */
  pauseUntilReply: boolean;
}): Promise<boolean> {
  const { thread, tie, until, unit } = input;
  if (thread.state !== "active" || (thread.coolUntil && thread.coolUntil > until.toISOString())) return false;
  const day = `${input.creatorAccountId}:${tie.memberId}:${localDayKey(until)}`;
  const reason = slurpCreatorCheckIn({
    stage: tie.stage,
    hoursQuiet: (until.getTime() - Date.parse(thread.lastMessageAt)) / 3_600_000,
    needsReply: thread.needsReply,
    pending: thread.scheduledFollowUps.length > 0,
    roll: unit(`check-in:${day}`),
    pick: unit(`check-in-why:${day}`),
  });
  if (!reason || !(await input.isPlayer(tie.memberId))) return false;
  // A blocked check-in is cancelled by the scheduler anyway, but only after it already claimed a
  // slot of the tick's opener budget (`SLURP_MAX_CREATOR_OPENERS_PER_TICK`). Checking here first
  // keeps a stuck, unanswered thread from starving every other Creator's opener, every tick.
  if (input.pauseUntilReply && !slurpAllowsUnsolicitedText(await input.messages.listMessages(thread.id, 60)))
    return false;
  const inMinutes = 5 + Math.floor(unit(`check-in-at:${thread.id}`) * 55);
  const planned = await input.messages
    .addScheduledFollowUps(thread.id, [
      {
        id: `followup-${randomUUID()}`,
        scheduledAt: new Date(until.getTime() + inMinutes * 60_000).toISOString(),
        type: "opener",
        reason,
        context: "",
      },
    ])
    .then(
      () => true,
      (error: unknown) => {
        logger.warn(error, "[slurp-world] Could not plan a Creator check-in");
        return false;
      },
    );
  return planned;
}
