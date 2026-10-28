/**
 * The player's steering for one Creator, kept beside the Creator rather than in its account row.
 *
 * Not in the account settings on purpose: a prepared post's fingerprint includes the account's
 * `updatedAt`, so using up an idea would mark every other prepared post stale and rewrite it.
 * Steering reaches the next post that is written; posts already prepared keep theirs.
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { newId } from "../../../utils/id-generator.js";
import {
  normalizeSlpCreatorSteering,
  SLP_STEERING_NUDGES_MAX,
  SLP_STEERING_PACE_FACTOR,
  type SlpCreatorNudge,
  type SlpCreatorSteering,
  type SlpSteeringSupportNote,
} from "../../../../../shared/src/slp/slp-creator-steering.js";

export const slurpSteeringKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.steering`;

export async function readSlurpCreatorSteering(db: DB, creatorAccountId: string): Promise<SlpCreatorSteering> {
  const raw = await createAppSettingsStorage(db).get(slurpSteeringKey(creatorAccountId));
  try {
    return normalizeSlpCreatorSteering(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSlpCreatorSteering(null);
  }
}

async function write(db: DB, creatorAccountId: string, steering: SlpCreatorSteering): Promise<SlpCreatorSteering> {
  const next = normalizeSlpCreatorSteering(steering);
  await createAppSettingsStorage(db).set(slurpSteeringKey(creatorAccountId), JSON.stringify(next));
  return next;
}

/**
 * Change the life fields and the pace. The ideas list has its own calls, so a save never drops one.
 * The player changing a field Support set replaces Support's note: there is nothing left to undo.
 */
export async function patchSlurpCreatorSteering(
  db: DB,
  creatorAccountId: string,
  patch: Partial<Omit<SlpCreatorSteering, "nudges" | "support">>,
  options: { keepSupportNote?: boolean } = {},
): Promise<SlpCreatorSteering> {
  const current = await readSlurpCreatorSteering(db, creatorAccountId);
  const touchesNote = ["mood", "focus", "push", "avoid"].some((key) => key in patch);
  return write(db, creatorAccountId, {
    ...current,
    ...patch,
    nudges: current.nudges,
    support: options.keepSupportNote || !touchesNote ? current.support : null,
  });
}

/** What the last talk with Slurp Support changed, for the note in Creator tools. */
export async function noteSlurpSupportChange(
  db: DB,
  creatorAccountId: string,
  note: SlpSteeringSupportNote | null,
): Promise<SlpCreatorSteering> {
  const current = await readSlurpCreatorSteering(db, creatorAccountId);
  return write(db, creatorAccountId, { ...current, support: note });
}

/** Queue an idea. The oldest goes first; a full list refuses rather than dropping one. */
export async function addSlurpCreatorNudge(
  db: DB,
  creatorAccountId: string,
  input: { text: string; story: boolean },
  at = new Date(),
): Promise<SlpCreatorSteering | null> {
  const current = await readSlurpCreatorSteering(db, creatorAccountId);
  if (current.nudges.length >= SLP_STEERING_NUDGES_MAX) return null;
  const nudge: SlpCreatorNudge = { id: newId(), text: input.text, story: input.story, createdAt: at.toISOString() };
  return write(db, creatorAccountId, { ...current, nudges: [...current.nudges, nudge] });
}

export async function removeSlurpCreatorNudge(
  db: DB,
  creatorAccountId: string,
  nudgeId: string,
): Promise<SlpCreatorSteering> {
  const current = await readSlurpCreatorSteering(db, creatorAccountId);
  return write(db, creatorAccountId, {
    ...current,
    nudges: current.nudges.filter((nudge) => nudge.id !== nudgeId),
  });
}

/** The share of the usual posting rate the player set for this Creator; 1 when nothing is set. */
export async function readSlurpCreatorPaceFactor(db: DB, creatorAccountId: string): Promise<number> {
  const steering = await readSlurpCreatorSteering(db, creatorAccountId).catch(() => null);
  return SLP_STEERING_PACE_FACTOR[steering?.pace ?? "usual"];
}
