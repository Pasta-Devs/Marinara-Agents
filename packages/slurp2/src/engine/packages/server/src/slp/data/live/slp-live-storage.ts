import type { DB } from "../../../db/connection.js";
import { eq, isNull } from "../../../db/file-query.js";
import { slurpLiveShows } from "../../../db/schema/slurp.js";
import { isSlurpFileUniqueConstraintError } from "../../base/host/slp-file-errors.js";
import type { SlpLiveState } from "../../../../../shared/src/slp/slp-live.js";

export type SlurpLiveShow = {
  id: string;
  hostKind: "creator" | "player";
  hostId: string;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  state: SlpLiveState;
  watchedAt: string | null;
  createdAt: string;
};

/** Older live builds wrote rows without `state`; those shows never ran here, so they read as absent. */
function v3Rows(rows: unknown[]): SlurpLiveShow[] {
  return (rows as Record<string, unknown>[]).filter((row) => row.state != null).map(toShow);
}

function toShow(row: Record<string, unknown>): SlurpLiveShow {
  return { ...(row as Omit<SlurpLiveShow, "state">), state: JSON.parse(String(row.state)) as SlpLiveState };
}

export function createSlurpLiveStorage(db: DB) {
  return {
    async get(id: string): Promise<SlurpLiveShow | null> {
      const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
      return v3Rows(rows)[0] ?? null;
    },
    async listOpen(): Promise<SlurpLiveShow[]> {
      const rows = await db.select().from(slurpLiveShows).where(isNull(slurpLiveShows.endedAt));
      return v3Rows(rows);
    },
    async listForHost(hostId: string): Promise<SlurpLiveShow[]> {
      const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.hostId, hostId));
      return v3Rows(rows);
    },
    /** Insert once: the id carries the host and its schedule slot, so a second tick cannot start the same show. */
    async create(show: SlurpLiveShow): Promise<boolean> {
      try {
        await db.insert(slurpLiveShows).values({ ...show, state: JSON.stringify(show.state) });
        return true;
      } catch (error) {
        if (isSlurpFileUniqueConstraintError(error, "slurp2_live_shows", ["id"])) return false;
        throw error;
      }
    },
    async save(id: string, patch: Partial<Pick<SlurpLiveShow, "state" | "endedAt" | "watchedAt" | "endsAt">>) {
      const { state, ...rest } = patch;
      await db
        .update(slurpLiveShows)
        .set({ ...rest, ...(state ? { state: JSON.stringify(state) } : {}) })
        .where(eq(slurpLiveShows.id, id));
    },
  };
}
