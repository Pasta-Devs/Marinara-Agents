/**
 * The Slurp Support desk record of one Creator (`shared/.../slp-support-desk.ts`), kept beside the
 * Creator like the steering and for the same reason: not in the account row, whose `updatedAt` is
 * part of every prepared post's fingerprint.
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { normalizeSlpSupportDesk, type SlpSupportDesk } from "../../../../../shared/src/slp/slp-support-desk.js";

export const slurpSupportDeskKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.desk`;

export async function readSlurpSupportDesk(db: DB, creatorAccountId: string): Promise<SlpSupportDesk> {
  const raw = await createAppSettingsStorage(db).get(slurpSupportDeskKey(creatorAccountId));
  try {
    return normalizeSlpSupportDesk(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSlpSupportDesk(null);
  }
}

export async function writeSlurpSupportDesk(
  db: DB,
  creatorAccountId: string,
  desk: SlpSupportDesk,
): Promise<SlpSupportDesk> {
  const next = normalizeSlpSupportDesk(desk);
  await createAppSettingsStorage(db).set(slurpSupportDeskKey(creatorAccountId), JSON.stringify(next));
  return next;
}

// ponytail: per-Creator promise chain; one process only, a row lock if the desk ever runs multi-process.
const chains = new Map<string, Promise<unknown>>();

/** Read, change and write one Creator's desk, one change at a time per Creator. */
export function updateSlurpSupportDesk(
  db: DB,
  creatorAccountId: string,
  change: (desk: SlpSupportDesk) => SlpSupportDesk | Promise<SlpSupportDesk>,
): Promise<SlpSupportDesk> {
  const previous = chains.get(creatorAccountId) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(async () =>
      writeSlurpSupportDesk(db, creatorAccountId, await change(await readSlurpSupportDesk(db, creatorAccountId))),
    );
  chains.set(creatorAccountId, run);
  const done = () => {
    if (chains.get(creatorAccountId) === run) chains.delete(creatorAccountId);
  };
  run.then(done, done);
  return run;
}
