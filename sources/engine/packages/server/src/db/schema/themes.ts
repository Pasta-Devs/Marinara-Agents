// ──────────────────────────────────────────────
// Schema: Synced Custom Themes
// ──────────────────────────────────────────────
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const customThemes = sqliteTable("custom_themes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  css: text("css").notNull().default(""),
  installedAt: text("installed_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isActive: text("is_active").notNull().default("false"),
});
