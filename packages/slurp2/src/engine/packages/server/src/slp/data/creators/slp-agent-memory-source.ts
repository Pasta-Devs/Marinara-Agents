/**
 * What the player's trackers know about a Creator, for the flavour brief: the Character Tracker,
 * World State and Persona Stats rows the Engine keeps per chat. Read-only, behind the
 * `flavourFromAgents` setting. Nothing is written anywhere.
 *
 * The trackers have no documented read contract: they write into the Engine's game-state table, read
 * here with the Engine's own schema and query, as Slurp already reads chats (the package holds
 * `chat-read`). A missing Agent, an old chat, or any failure means no lines, never a failed post.
 * Long-Term Memory's memories come through its recall service instead (`slp-ltm-recall.ts`).
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createChatsStorage } from "../../../services/storage/chats.storage.js";
import { and, desc, eq } from "../../../db/file-query.js";
import { gameStateSnapshots } from "../../../db/schema/game-state.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpLatelyLine } from "../../modules/creators/slp-creator-flavour.js";

/** A tracker row older than this is not "lately" any more. */
const FRESH_DAYS = 30;
const LINE_MAX = 160;

const text = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "");
const short = (value: string) => (value.length > LINE_MAX ? `${value.slice(0, LINE_MAX - 1).trim()}…` : value);
const list = (value: unknown): unknown[] => {
  try {
    const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** The newest chat this character or persona is in, if it was active lately. */
async function latestChat(db: DB, source: Pick<SlpAccount, "kind" | "entityId">, at: Date) {
  const chats = await createChatsStorage(db).list();
  const chat = chats.find((row) =>
    source.kind === "persona"
      ? row.personaId === source.entityId
      : list(row.characterIds).some((id) => id === source.entityId),
  );
  if (!chat || at.getTime() - Date.parse(String(chat.updatedAt)) > FRESH_DAYS * 24 * 60 * 60 * 1000) return null;
  return chat;
}

/** Character Tracker (mood, outfit, look) and World State (weather) for a character's newest chat. */
async function trackerLines(
  db: DB,
  source: Pick<SlpAccount, "kind" | "entityId">,
  at: Date,
): Promise<SlurpLatelyLine[]> {
  const chat = await latestChat(db, source, at);
  if (!chat) return [];
  // The accepted state of the chat, as the Engine's own game-state storage reads it.
  const [latest] = await db
    .select()
    .from(gameStateSnapshots)
    .where(and(eq(gameStateSnapshots.chatId, chat.id), eq(gameStateSnapshots.committed, 1)))
    .orderBy(desc(gameStateSnapshots.createdAt))
    .limit(1);
  const snapshot = record(latest);
  const lines: SlurpLatelyLine[] = [];
  if (source.kind === "character") {
    const self = record(
      list(snapshot.presentCharacters).find((entry) => record(entry).characterId === source.entityId),
    );
    const outfit = text(self.outfit);
    const mood = text(self.mood);
    const look = text(self.appearance);
    if (outfit) lines.push({ kind: "outfit", text: short(`Lately you have been wearing ${outfit}.`) });
    if (mood) lines.push({ kind: "mood", text: short(`You have been feeling ${mood.toLocaleLowerCase()} lately.`) });
    if (look) lines.push({ kind: "look", text: short(`How you look lately: ${look}.`) });
  } else {
    // Persona Stats: a bar running low is something a person feels; a full one is not news.
    for (const stat of list(snapshot.personaStats).map(record)) {
      const name = text(stat.name);
      const value = Number(stat.value);
      const max = Number(stat.max) || 100;
      if (name && Number.isFinite(value) && value / max < 0.3)
        lines.push({ kind: "stat", text: short(`You are running low on ${name.toLocaleLowerCase()} lately.`) });
    }
  }
  const weather = text(snapshot.weather);
  if (weather) lines.push({ kind: "weather", text: short(`The weather where you are lately: ${weather}.`) });
  return lines;
}

export async function readSlurpAgentMemoryLines(
  db: DB,
  source: Pick<SlpAccount, "kind" | "entityId"> | null,
  at = new Date(),
): Promise<SlurpLatelyLine[]> {
  if (!source) return [];
  try {
    return await trackerLines(db, source, at);
  } catch (error) {
    logger.warn(error, "[slurp] Could not read tracker state for the flavour brief");
    return [];
  }
}
