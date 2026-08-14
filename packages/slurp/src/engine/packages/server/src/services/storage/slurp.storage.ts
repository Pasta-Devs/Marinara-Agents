import type { DB } from "../../db/connection.js";
import { eq } from "../../db/file-query.js";
import { createAppSettingsStorage } from "./app-settings.storage.js";
import { newId, now } from "../../utils/id-generator.js";
import { slurpCreators, slurpViewers } from "../../db/schema/slurp.js";
import { createCharactersStorage } from "./characters.storage.js";

export type SlurpSourceKind = "character" | "persona";
export type SlurpSourceStatus = "active" | "paused_source_missing";
export type SlurpCreator = typeof slurpCreators.$inferSelect;
export type SlurpViewer = typeof slurpViewers.$inferSelect;

export type SlurpCreateCreatorInput = {
  sourceKind: SlurpSourceKind;
  sourceEntityId: string;
};

const sourceKinds = new Set<SlurpSourceKind>(["character", "persona"]);

export function createSlurpStorage(db: DB) {
  const characters = createCharactersStorage(db);
  createAppSettingsStorage(db);

  async function sourceExists(input: SlurpCreateCreatorInput) {
    if (input.sourceKind === "character") return Boolean(await characters.getById(input.sourceEntityId));
    return Boolean(await characters.getPersona(input.sourceEntityId));
  }

  async function refreshStatus(row: SlurpCreator): Promise<SlurpCreator> {
    const status: SlurpSourceStatus = (await sourceExists(row)) ? "active" : "paused_source_missing";
    if (row.sourceStatus === status) return row;
    await db.update(slurpCreators).set({ sourceStatus: status, updatedAt: now() }).where(eq(slurpCreators.id, row.id));
    return { ...row, sourceStatus: status };
  }

  return {
    async bootstrap() {
      const [creators, viewers] = await Promise.all([
        db.select().from(slurpCreators),
        db.select().from(slurpViewers),
      ]);
      return { creators: await Promise.all(creators.map(refreshStatus)), viewers, settings: {} };
    },
    async getViewer(personaId: string) {
      const rows = await db.select().from(slurpViewers).where(eq(slurpViewers.personaId, personaId));
      return rows[0] ?? null;
    },
    async ensureViewer(personaId: string) {
      const existing = await this.getViewer(personaId);
      if (existing) return existing;
      const row = { id: newId(), personaId, createdAt: now() };
      await db.insert(slurpViewers).values(row);
      return row;
    },
    async createCreator(input: SlurpCreateCreatorInput) {
      if (!sourceKinds.has(input.sourceKind) || !input.sourceEntityId.trim()) throw new Error("Invalid Slurp source");
      const existing = await db.select().from(slurpCreators).where(eq(slurpCreators.sourceEntityId, input.sourceEntityId));
      if (existing.some((row) => row.sourceKind === input.sourceKind)) throw new Error("Slurp source already exists");
      const timestamp = now();
      const row = { id: newId(), ...input, sourceStatus: (await sourceExists(input)) ? "active" as const : "paused_source_missing" as const, createdAt: timestamp, updatedAt: timestamp };
      await db.insert(slurpCreators).values(row);
      return row;
    },
  };
}
