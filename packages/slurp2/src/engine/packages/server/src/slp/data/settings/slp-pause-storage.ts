/** "Pause all", read fresh from the settings for a scheduler about to run a pass (`slp-pause.ts`). */
import type { DB } from "../../../db/connection.js";
import { slurpPaused } from "../../base/model/slp-pause.js";
import { createSlurpStorage } from "../slp-storage.js";

export async function slurpPausedNow(db: DB): Promise<boolean> {
  // The settings read keeps the flag in step (`getSettings`); a failed read keeps the last value.
  await createSlurpStorage(db)
    .getSettings()
    .catch(() => null);
  return slurpPaused();
}
