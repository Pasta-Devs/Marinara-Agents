/**
 * Reading and writing the post guidance blob. The shape and the precedence rules live in
 * `slurp-post-guidance.ts`, which stays free of the database so they can be tested.
 *
 * One blob under the `slurp2.` namespace, exactly like `slurp-image-connections.ts`, so the backup
 * export picks the key up without being told about it.
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  sanitizeSlurpPostGuidance,
  selectSlurpCreatorMenu,
  selectSlurpPostGuidance,
  type SlurpPostAccess,
  type SlurpPostGuidance,
} from "../../modules/feed/slp-post-guidance.js";

const KEY = "slurp2.post-guidance";
export const SLURP_POST_GUIDANCE_KEY = KEY;

const defaults = (): SlurpPostGuidance => ({ defaults: { public: "", locked: "" }, creators: {} });

export async function getSlurpPostGuidance(db: DB): Promise<SlurpPostGuidance> {
  const raw = await createAppSettingsStorage(db).get(KEY);
  if (!raw) return defaults();
  try {
    return sanitizeSlurpPostGuidance(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export async function saveSlurpPostGuidance(db: DB, value: SlurpPostGuidance): Promise<void> {
  await createAppSettingsStorage(db).set(KEY, JSON.stringify(sanitizeSlurpPostGuidance(value)));
}

export async function clearSlurpPostGuidance(db: DB): Promise<void> {
  await createAppSettingsStorage(db).remove(KEY);
}

// One JSON blob behind two concurrent PATCHes loses the earlier write, exactly as in
// slurp-image-connections.ts. ponytail: in-process queue; needs a row lock if Engine ever runs
// more than one process.
let updateQueue: Promise<unknown> = Promise.resolve();

export async function updateSlurpPostGuidance(
  db: DB,
  mutate: (current: SlurpPostGuidance) => SlurpPostGuidance,
): Promise<SlurpPostGuidance> {
  const run = updateQueue.then(async () => {
    const next = sanitizeSlurpPostGuidance(mutate(await getSlurpPostGuidance(db)));
    await saveSlurpPostGuidance(db, next);
    return next;
  });
  updateQueue = run.catch(() => undefined);
  return run;
}

export async function resolveSlurpPostGuidance(db: DB, creatorId: string, access: SlurpPostAccess): Promise<string> {
  return selectSlurpPostGuidance(await getSlurpPostGuidance(db), creatorId, access);
}

export async function resolveSlurpCreatorMenu(db: DB, creatorId: string): Promise<string> {
  return selectSlurpCreatorMenu(await getSlurpPostGuidance(db), creatorId);
}
