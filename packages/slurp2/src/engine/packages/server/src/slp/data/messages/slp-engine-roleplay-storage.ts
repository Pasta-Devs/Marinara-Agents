/**
 * Which Creators the player is roleplaying with in an ordinary Engine chat right now. The Engine asks
 * for the Slurp carryover block (`slp-chat-context.ts`) every time it writes a reply in a chat with a
 * Creator's character, so that call marks the Creator as busy with the player. While busy, the Creator
 * writes nothing first on Slurp: the same quiet a Slurp scene gives, without the player starting one.
 */

/** How long after the last Engine reply the roleplay still counts as running. */
export const SLURP_ENGINE_ROLEPLAY_MS = 20 * 60_000;

// ponytail: process memory, so a server restart ends every busy window early; persist it if that matters.
const lastEngineReplyAt = new Map<string, number>();

export function markSlurpEngineRoleplay(creatorAccountId: string, at = Date.now()): void {
  lastEngineReplyAt.set(creatorAccountId, at);
}

/** Real clock on purpose: the Engine chat runs on the host's time, not Slurp's world clock. */
export function slurpInEngineRoleplay(creatorAccountId: string, now = Date.now()): boolean {
  const at = lastEngineReplyAt.get(creatorAccountId);
  return at !== undefined && now - at < SLURP_ENGINE_ROLEPLAY_MS;
}
