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
 *
 * Next to the events, standing facts say where things stand: the story the character is living on
 * Slurp, their love life, the player's place with them, and what the continuity ledger lets a chat
 * with this player read (`slurpContinuityReadable`, the `fan_thread` surface of their thread).
 */
import type { DB } from "../../../db/connection.js";
import { wrapContent } from "../../../services/prompt/format-engine.js";
import { createChatsStorage } from "../../../services/storage/chats.storage.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { sinceHoursIso } from "../../modules/creators/slp-public-support.js";
import { readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import { slurpCoupleOf } from "../../modules/projects/slp-creator-couples.js";
import { slurpChatBridgeCoupleLine, slurpChatBridgeLoveLines } from "../../modules/projects/slp-couple-lines.js";
import { slurpRunsItself } from "../projects/slp-projects-contract.js";
import { slurpArcLifeLine } from "../../modules/projects/slp-arc-progress.js";
import { slurpChatBridgeRapportLine } from "../../modules/messages/slp-rapport.js";
import { listSlurpContinuityFor } from "../../data/continuity/slp-continuity-storage.js";
import { SLURP_CONTINUITY_FACT_LABELS } from "../../modules/continuity/slp-continuity-prompt.js";

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
// Sorts after every ISO timestamp, so a standing fact counts as the newest entry. Within standing
// facts the higher rank survives a tight item cap: who they are to each other comes first.
const SLURP_STANDING = {
  ledger: "9999-1",
  life: "9999-2",
  rapport: "9999-3",
  subscription: "9999-4",
  couple: "9999-5",
};
// Ledger facts per character: a chat carries what is current, not the whole ledger.
const SLURP_CHAT_CONTEXT_FACTS = 5;

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

const readJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/**
 * How far carryover reaches: of the Engine chats in a carryover mode that include one of these
 * characters, how many have "Include Slurp activity" on. The second switch lives in each chat, so
 * Settings counts it rather than leaving the player to guess why nothing arrives.
 */
export function slurpCarryoverReach(
  chats: readonly { mode: string; characterIds: unknown; metadata: unknown }[],
  characterIds: ReadonlySet<string>,
  modes: readonly string[],
): { on: number; off: number } {
  let on = 0;
  let off = 0;
  for (const chat of chats) {
    if (!modes.includes(chat.mode)) continue;
    const ids = readJson(chat.characterIds);
    if (!Array.isArray(ids) || !ids.some((id) => typeof id === "string" && characterIds.has(id))) continue;
    const metadata = readJson(chat.metadata) as { slurp2ActivityContextEnabled?: unknown } | null;
    if (metadata?.slurp2ActivityContextEnabled === true) on += 1;
    else off += 1;
  }
  return { on, off };
}

/** `slurpCarryoverReach` over every chat and every character-made Creator. */
export async function readSlurpCarryoverReach(db: DB): Promise<{ on: number; off: number }> {
  const slurp = createSlurpStorage(db);
  const settings = await slurp.getSettings();
  const characterIds = new Set(
    (await slurp.listNoodlerAccounts({ includeHidden: true }))
      .filter((account) => account.sourceKind === "character")
      .map((account) => account.sourceEntityId),
  );
  if (characterIds.size === 0 || settings.carryoverModes.length === 0) return { on: 0, off: 0 };
  return slurpCarryoverReach(await createChatsStorage(db).list(), characterIds, settings.carryoverModes);
}

export async function buildSlurpChatContext(db: DB, request: SlurpChatContextRequest): Promise<string | null> {
  if (request.chatMeta?.slurp2ActivityContextEnabled !== true) return null;
  const slurp = createSlurpStorage(db);
  const settings = await slurp.getSettings();
  if (!(settings.carryoverModes as readonly string[]).includes(request.mode)) return null;
  const characterIds = new Set(request.targetCharacterIds ?? []);
  if (characterIds.size === 0) return null;

  const accounts = await slurp.listNoodlerAccounts({ includeHidden: true });
  const creators = accounts.filter(
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
  const page = persona
    ? await slurp.getSlurpAccountForEntity("persona", request.personaId!, "creator").catch(() => null)
    : null;
  // Best-effort, like every standing fact below: a record that cannot be read never costs the chat
  // its Slurp context.
  const { couples } = await readSlurpCreatorTiesDocument(db).catch(() => ({ couples: [] }));
  const names = new Map(accounts.map((account) => [account.id, account.displayName]));
  // Every page the player runs, not only this persona's: those couples are the player's own business.
  const playerIds = new Set(accounts.filter((account) => !slurpRunsItself(account)).map((account) => account.id));
  for (const creator of creators) {
    const story = slurpArcLifeLine(await slurp.listProjects(creator.id).catch(() => []));
    if (story)
      entries.push({ at: SLURP_STANDING.life, line: `${creator.displayName}'s ongoing story on Slurp: ${story}.` });
    for (const line of slurpChatBridgeLoveLines(couples, creator.id, {
      her: creator.displayName,
      names,
      playerIds,
    }))
      entries.push({ at: SLURP_STANDING.life, line });
  }

  if (persona) {
    // The persona's own page may be with one of these characters: a standing fact, never cut first.
    for (const creator of creators) {
      const line = slurpChatBridgeCoupleLine(page ? slurpCoupleOf(couples, creator.id, page.id) : null, {
        her: creator.displayName,
        herGender: creator.settings.profile.gender,
        you: persona.displayName,
        at: new Date(),
      });
      if (line) entries.push({ at: SLURP_STANDING.couple, line });
    }
    const messages = createSlurpMessagesStorage(db);
    const subscribed = new Set(
      (await slurp.listSubscriptionsForViewer(persona.id)).map((entry) => entry.creatorAccountId),
    );
    for (const creator of creators) {
      if (subscribed.has(creator.id)) {
        // A standing fact rather than an event, so it is never cut first.
        entries.push({
          at: SLURP_STANDING.subscription,
          line: `${persona.displayName} subscribes to ${creator.displayName} on Slurp.`,
        });
      }
      const thread = await messages.getThread(persona.id, creator.id);
      await pushLedgerFacts(db, entries, creator, thread?.id ?? null, persona.displayName);
      if (!thread) continue;
      const standing = slurpChatBridgeRapportLine(thread.rapport, {
        her: creator.displayName,
        you: persona.displayName,
      });
      if (standing) entries.push({ at: SLURP_STANDING.rapport, line: standing });
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
  } else {
    for (const creator of creators) await pushLedgerFacts(db, entries, creator, null, null);
  }
  return buildSlurpChatContextBlock(entries, settings.carryoverMaxItems, request.wrapFormat ?? "xml");
}

/**
 * What the ledger lets this chat read about one character. Without a thread only the character's
 * own facts qualify; a thread adds what belongs to that player alone, marked as theirs.
 */
async function pushLedgerFacts(
  db: DB,
  entries: SlurpChatContextEntry[],
  creator: { id: string; displayName: string },
  threadId: string | null,
  you: string | null,
): Promise<void> {
  const { facts } = await listSlurpContinuityFor(db, creator.id, "fan_thread", {
    at: new Date(),
    threadId,
    limit: SLURP_CHAT_CONTEXT_FACTS,
  }).catch(() => ({ facts: [] }));
  for (const fact of facts) {
    const label = SLURP_CONTINUITY_FACT_LABELS[fact.factType] ?? fact.factType;
    const own = you && threadId && fact.threadId === threadId ? ` (with ${you})` : "";
    entries.push({
      at: SLURP_STANDING.ledger,
      line: `${creator.displayName} remembers from Slurp — ${label}${own}: ${fact.text.replace(/\s+/gu, " ").trim()}`,
    });
  }
}
