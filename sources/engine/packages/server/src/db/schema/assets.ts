// ──────────────────────────────────────────────
// Schema: Assets (Backgrounds, Sprites)
// ──────────────────────────────────────────────
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  /** "background" | "sprite" */
  type: text("type", { enum: ["background", "sprite"] }).notNull(),
  /** For sprites: which character this belongs to */
  characterId: text("character_id"),
  /** For sprites: the expression name (happy, sad, neutral, etc.) */
  expression: text("expression"),
  /** Display name */
  name: text("name").notNull(),
  /** File path relative to data directory */
  filePath: text("file_path").notNull(),
  createdAt: text("created_at").notNull(),
});
