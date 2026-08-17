import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";

const KEY = "slurp.image-connections";
const LEGACY_KEY = "noodle.noodler-image-connections";

export type NoodlerImageConnections = {
  defaultConnectionId: string | null;
  creatorConnectionIds: Record<string, string>;
};

const defaults = (): NoodlerImageConnections => ({ defaultConnectionId: null, creatorConnectionIds: {} });

export async function getNoodlerImageConnections(db: DB): Promise<NoodlerImageConnections> {
  const storage = createAppSettingsStorage(db);
  const raw = (await storage.get(KEY)) ?? (await storage.get(LEGACY_KEY));
  if (!raw) return defaults();
  try {
    const value = JSON.parse(raw) as Partial<NoodlerImageConnections>;
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
    };
    if (!(await storage.get(KEY))) await storage.set(KEY, JSON.stringify(result));
    return result;
  } catch {
    return defaults();
  }
}

export async function saveNoodlerImageConnections(db: DB, value: NoodlerImageConnections): Promise<void> {
  await createAppSettingsStorage(db).set(KEY, JSON.stringify(value));
}

// The settings row holds one JSON blob, so a read-modify-write from two concurrent
// PATCHes loses the earlier one. Engine runs one process, so chaining the updates is
// enough. ponytail: in-process queue; needs a row lock if this ever runs multi-process.
let updateQueue: Promise<unknown> = Promise.resolve();

export async function updateNoodlerImageConnections(
  db: DB,
  mutate: (current: NoodlerImageConnections) => NoodlerImageConnections,
): Promise<NoodlerImageConnections> {
  const run = updateQueue.then(async () => {
    const next = mutate(await getNoodlerImageConnections(db));
    await saveNoodlerImageConnections(db, next);
    return next;
  });
  updateQueue = run.catch(() => undefined);
  return run;
}

export async function resolveNoodlerImageConnectionId(db: DB, creatorId: string): Promise<string | null> {
  const value = await getNoodlerImageConnections(db);
  return value.creatorConnectionIds[creatorId] ?? value.defaultConnectionId;
}
