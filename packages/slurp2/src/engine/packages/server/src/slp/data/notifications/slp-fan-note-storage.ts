/**
 * The player's answer to a fan's note (docs: "fan messages to your page are notes"): a heart, and one
 * reply at most. Kept beside the notification it answers, by that event's id, in one small settings
 * document; the newest `KEEP` answers stay, like the notification stream keeps its newest events.
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";

const KEY = "slurp2.fan-notes";
const KEEP = 300;

export type SlurpFanNoteAnswer = { hearted: boolean; reply: string | null; at: string };

async function readAll(db: DB): Promise<Record<string, SlurpFanNoteAnswer>> {
  const raw = await createAppSettingsStorage(db).get(KEY);
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, SlurpFanNoteAnswer>)
      : {};
  } catch {
    return {};
  }
}

export async function readSlurpFanNoteAnswers(
  db: DB,
  eventIds: readonly string[],
): Promise<Map<string, SlurpFanNoteAnswer>> {
  if (!eventIds.length) return new Map();
  const all = await readAll(db);
  return new Map(eventIds.flatMap((id) => (all[id] ? [[id, all[id]] as const] : [])));
}

let queue: Promise<unknown> = Promise.resolve();

/** Heart it, or reply once. "replied": there is a reply already, and there is only one. */
export function answerSlurpFanNote(
  db: DB,
  eventId: string,
  answer: { heart?: boolean; reply?: string },
): Promise<SlurpFanNoteAnswer | "replied"> {
  const run = queue.then(async () => {
    const all = await readAll(db);
    const current = all[eventId] ?? { hearted: false, reply: null, at: new Date().toISOString() };
    if (answer.reply && current.reply) return "replied" as const;
    const next: SlurpFanNoteAnswer = {
      hearted: current.hearted || answer.heart === true,
      reply: current.reply ?? answer.reply ?? null,
      at: new Date().toISOString(),
    };
    const kept = Object.entries({ ...all, [eventId]: next })
      .sort(([, left], [, right]) => right.at.localeCompare(left.at))
      .slice(0, KEEP);
    await createAppSettingsStorage(db).set(KEY, JSON.stringify(Object.fromEntries(kept)));
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}
