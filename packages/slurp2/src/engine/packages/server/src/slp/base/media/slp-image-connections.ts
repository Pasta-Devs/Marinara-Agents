import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";

const KEY = "slurp2.image-connections";
const LEGACY_KEY = "noodle.noodler-image-connections";
export const SLURP_IMAGE_CONNECTIONS_KEY = KEY;
export const LEGACY_SLP_CREATOR_IMAGE_CONNECTIONS_KEY = LEGACY_KEY;

export type SlpCreatorImageConnections = {
  defaultConnectionId: string | null;
  creatorConnectionIds: Record<string, string>;
  creatorStyleProfileIds: Record<string, string>;
};

const defaults = (): SlpCreatorImageConnections => ({
  defaultConnectionId: null,
  creatorConnectionIds: {},
  creatorStyleProfileIds: {},
});

export async function getCreatorImageConnections(db: DB): Promise<SlpCreatorImageConnections> {
  const storage = createAppSettingsStorage(db);
  const raw = (await storage.get(KEY)) ?? (await storage.get(LEGACY_KEY));
  if (!raw) return defaults();
  try {
    const value = JSON.parse(raw) as Partial<SlpCreatorImageConnections>;
    const result = {
      defaultConnectionId: typeof value.defaultConnectionId === "string" ? value.defaultConnectionId : null,
      creatorConnectionIds:
        value.creatorConnectionIds && typeof value.creatorConnectionIds === "object"
          ? Object.fromEntries(
              Object.entries(value.creatorConnectionIds).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]),
              ),
            )
          : {},
      creatorStyleProfileIds:
        value.creatorStyleProfileIds && typeof value.creatorStyleProfileIds === "object"
          ? Object.fromEntries(
              Object.entries(value.creatorStyleProfileIds).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]),
              ),
            )
          : {},
    };
    if (!(await storage.get(KEY))) await storage.set(KEY, JSON.stringify(result));
    return result;
  } catch {
    return defaults();
  }
}

export async function saveCreatorImageConnections(db: DB, value: SlpCreatorImageConnections): Promise<void> {
  await createAppSettingsStorage(db).set(KEY, JSON.stringify(value));
}

export async function clearCreatorImageConnections(db: DB): Promise<void> {
  const storage = createAppSettingsStorage(db);
  await storage.remove(KEY);
  await storage.remove(LEGACY_KEY);
}

// The settings row holds one JSON blob, so a read-modify-write from two concurrent
// PATCHes loses the earlier one. Engine runs one process, so chaining the updates is
// enough. ponytail: in-process queue; needs a row lock if this ever runs multi-process.
let updateQueue: Promise<unknown> = Promise.resolve();

export async function updateCreatorImageConnections(
  db: DB,
  mutate: (current: SlpCreatorImageConnections) => SlpCreatorImageConnections,
): Promise<SlpCreatorImageConnections> {
  const run = updateQueue.then(async () => {
    const next = mutate(await getCreatorImageConnections(db));
    await saveCreatorImageConnections(db, next);
    return next;
  });
  updateQueue = run.catch(() => undefined);
  return run;
}

export async function resolveCreatorImageConnectionId(db: DB, creatorId: string): Promise<string | null> {
  const value = await getCreatorImageConnections(db);
  return value.creatorConnectionIds[creatorId] ?? value.defaultConnectionId;
}

export async function resolveCreatorImageStyleProfileId(db: DB, creatorId: string): Promise<string | null> {
  const value = await getCreatorImageConnections(db);
  return value.creatorStyleProfileIds[creatorId] ?? null;
}
