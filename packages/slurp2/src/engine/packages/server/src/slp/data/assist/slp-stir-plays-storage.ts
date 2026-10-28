/**
 * The plays ledger (Stir, W): what the player made happen, newest first, with what one Undo needs.
 * One app setting, capped: it is a short memory for "In play", the Undo toast and Pulse, not history.
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import type { SlpStirPlay } from "../../../../../shared/src/slp/slp-stir.js";

export const SLURP_STIR_PLAYS_KEY = "slurp2.stir-plays";
const KEEP = 40;

/** A stored play: the public record plus the Undo data, which never leaves the server. */
export type SlurpStoredStirPlay = SlpStirPlay & { undo: unknown[] };

// ponytail: an in-process queue, like the ties document; plays are one tap at a time.
let queue: Promise<unknown> = Promise.resolve();

export async function readSlurpStirPlays(db: DB): Promise<SlurpStoredStirPlay[]> {
  const raw = await createAppSettingsStorage(db).get(SLURP_STIR_PLAYS_KEY);
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is SlurpStoredStirPlay =>
            Boolean(entry) && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** Read, change, write, one at a time. */
export function mutateSlurpStirPlays<T>(
  db: DB,
  change: (plays: SlurpStoredStirPlay[]) => { plays: SlurpStoredStirPlay[]; result: T },
): Promise<T> {
  const run = queue.then(async () => {
    const next = change(await readSlurpStirPlays(db));
    await createAppSettingsStorage(db).set(SLURP_STIR_PLAYS_KEY, JSON.stringify(next.plays.slice(0, KEEP)));
    return next.result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Suggestions the player put away (the Stir tab's "Not now"): id → until when. */
export const SLURP_STIR_DISMISSED_KEY = "slurp2.stir-dismissed";
const DISMISS_DAYS = 3;

async function readDismissed(db: DB): Promise<Record<string, string>> {
  try {
    const parsed = JSON.parse((await createAppSettingsStorage(db).get(SLURP_STIR_DISMISSED_KEY)) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The suggestion ids still put away now. */
export async function readSlurpStirDismissed(db: DB, at = new Date()): Promise<Set<string>> {
  const now = at.toISOString();
  return new Set(Object.entries(await readDismissed(db)).flatMap(([id, until]) => (until > now ? [id] : [])));
}

/** Put one suggestion away for a few days; expired entries are dropped on the way. */
export async function dismissSlurpStirSuggestion(db: DB, id: string, at = new Date()): Promise<void> {
  const now = at.toISOString();
  const kept = Object.entries(await readDismissed(db)).filter(([, until]) => until > now);
  const until = new Date(at.getTime() + DISMISS_DAYS * 86_400_000).toISOString();
  await createAppSettingsStorage(db).set(
    SLURP_STIR_DISMISSED_KEY,
    JSON.stringify(Object.fromEntries([...kept.slice(-100), [id, until]])),
  );
}
