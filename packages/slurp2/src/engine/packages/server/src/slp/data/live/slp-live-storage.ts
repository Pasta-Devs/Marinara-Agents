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

function toShow(row: Record<string, unknown>): SlurpLiveShow {
  return { ...(row as Omit<SlurpLiveShow, "state">), state: JSON.parse(String(row.state)) as SlpLiveState };
}

export function createSlurpLiveStorage(db: DB) {
  return {
    async get(id: string): Promise<SlurpLiveShow | null> {
      const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.id, id));
      return rows[0] ? toShow(rows[0] as Record<string, unknown>) : null;
    },
    async listOpen(): Promise<SlurpLiveShow[]> {
      const rows = await db.select().from(slurpLiveShows).where(isNull(slurpLiveShows.endedAt));
      return rows.map((row) => toShow(row as Record<string, unknown>));
    },
    async listForHost(hostId: string): Promise<SlurpLiveShow[]> {
      const rows = await db.select().from(slurpLiveShows).where(eq(slurpLiveShows.hostId, hostId));
      return rows.map((row) => toShow(row as Record<string, unknown>));
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
