/**
 * What a character has been doing on Slurp, handed to an ordinary Engine chat with them.
 *
 * Noodle carries its timeline into chats from activity digests. Slurp never writes those, so this
 * reads the real records instead: the character's own posts, and everything between them and the
 * persona in this chat — messages, commissions, a subscription, tips.
 *
 * Two switches must both be on. The chat opts in (`slurp2ActivityContextEnabled`, off unless the
 * player turns it on), and the chat's mode is one of the carryover modes in Slurp settings. What a
 * fan is paying for never travels: a locked post is named, not quoted, and a locked message is a note.
 */
import type { DB } from "../../../db/connection.js";
import { wrapContent } from "../../../services/prompt/format-engine.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { sinceHoursIso } from "../../modules/creators/slp-public-support.js";

type WrapFormat = "xml" | "markdown" | "none";

/** The part of the Engine's prompt-context request this reads. Older Engines send no wrapFormat. */
export type SlurpChatContextRequest = {
  chatMeta?: Record<string, unknown> | null;
  mode: string;
  targetCharacterIds?: string[];
  personaId?: string | null;
  wrapFormat?: WrapFormat;
};

export type SlurpChatContextEntry = { at: string; line: string };

const SLURP_CHAT_CONTEXT_SECTION = "Recent Slurp Activity";
// Same chars/4 estimate and 8k-token ceiling as Noodle's carryover block.
const SLURP_CHAT_CONTEXT_CHARACTER_BUDGET = 8192 * 4;
const SLURP_CHAT_CONTEXT_LINE_LIMIT = 600;
// Sorts after every ISO timestamp, so a standing fact counts as the newest entry.
const SLURP_STANDING_FACT_AT = "9999";

/** Keep the newest entries that fit, then render them oldest first. */
export function buildSlurpChatContextBlock(
  entries: readonly SlurpChatContextEntry[],
  maxItems: number,
  wrapFormat: WrapFormat,
): string | null {
  const newestFirst = entries
    .filter((entry) => entry.line.trim())
    .slice()
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, Math.max(0, Math.floor(maxItems)));
  const kept: SlurpChatContextEntry[] = [];
  let length = 0;
  for (const entry of newestFirst) {
    const line = `- ${entry.line.trim().slice(0, SLURP_CHAT_CONTEXT_LINE_LIMIT)}`;
    if (length + line.length + 1 > SLURP_CHAT_CONTEXT_CHARACTER_BUDGET) break;
    kept.push({ at: entry.at, line });
    length += line.length + 1;
  }
  if (kept.length === 0) return null;
  return wrapContent(
    kept
      .reverse()
      .map((entry) => entry.line)
      .join("\n"),
    SLURP_CHAT_CONTEXT_SECTION,
    wrapFormat,
  );
}

export async function buildSlurpChatContext(db: DB, request: SlurpChatContextRequest): Promise<string | null> {
  if (request.chatMeta?.slurp2ActivityContextEnabled !== true) return null;
  const slurp = createSlurpStorage(db);
  const settings = await slurp.getSettings();
  if (!(settings.carryoverModes as readonly string[]).includes(request.mode)) return null;
  const characterIds = new Set(request.targetCharacterIds ?? []);
  if (characterIds.size === 0) return null;

  const creators = (await slurp.listNoodlerAccounts({ includeHidden: true })).filter(
    (account) => account.sourceKind === "character" && characterIds.has(account.sourceEntityId),
  );
  if (creators.length === 0) return null;

  const since = sinceHoursIso(settings.carryoverHours);
  const entries: SlurpChatContextEntry[] = [];
  const postsByCreator = await slurp.listNoodlerPostsByAccounts(
    creators.map((creator) => creator.id),
    settings.carryoverMaxItems,
    // The block keeps only the newest carryoverMaxItems entries overall, so reading more is waste.
    { since, maxRows: settings.carryoverMaxItems },
  );
  for (const creator of creators) {
    for (const post of postsByCreator.get(creator.id) ?? []) {
      if (post.createdAt <= since) continue;
      entries.push({
        at: post.createdAt,
        line:
          post.access === "locked"
            ? `${creator.displayName} posted a paid post on Slurp${post.title ? `: "${post.title}"` : ""}.`
            : `${creator.displayName} posted on Slurp: ${post.title ? `${post.title} — ` : ""}${post.content}`,
      });
    }
  }

  const persona = request.personaId ? await slurp.getViewer(request.personaId) : null;
  if (persona) {
    const messages = createSlurpMessagesStorage(db);
    const subscribed = new Set(
      (await slurp.listSubscriptionsForViewer(persona.id)).map((entry) => entry.creatorAccountId),
    );
    for (const creator of creators) {
      if (subscribed.has(creator.id)) {
        // A standing fact rather than an event, so it is never cut first.
        entries.push({
          at: SLURP_STANDING_FACT_AT,
          line: `${persona.displayName} subscribes to ${creator.displayName} on Slurp.`,
        });
      }
      const thread = await messages.getThread(persona.id, creator.id);
      if (!thread) continue;
      const [threadMessages, commissions] = await Promise.all([
        messages.listMessages(thread.id, Math.max(settings.carryoverMaxItems, 10)),
        messages.listCommissionsForThread(thread.id, since, settings.carryoverMaxItems),
      ]);
      for (const message of threadMessages) {
        if (message.createdAt <= since) continue;
        const from = message.role === "creator" ? creator.displayName : persona.displayName;
        const to = message.role === "creator" ? persona.displayName : creator.displayName;
        const line =
          message.kind === "tip"
            ? `${from} tipped ${to} ${message.price} coins on Slurp.`
            : message.kind === "ppv"
              ? `${from} sent ${to} locked content for ${message.price} coins on Slurp (${message.unlockedAt ? "unlocked" : "still locked"}).`
              : message.content.trim()
                ? `${from} messaged ${to} on Slurp: ${message.content}`
                : message.imageUrl
                  ? `${from} sent ${to} a picture on Slurp.`
                  : "";
        entries.push({ at: message.createdAt, line });
      }
      for (const commission of commissions) {
        if (commission.updatedAt <= since) continue;
        entries.push({
          at: commission.updatedAt,
          line: `${persona.displayName} commissioned ${creator.displayName} on Slurp for ${commission.price} coins (${commission.state.replaceAll("_", " ")}): ${commission.brief}`,
        });
      }
    }
  }
  return buildSlurpChatContextBlock(entries, settings.carryoverMaxItems, request.wrapFormat ?? "xml");
}
