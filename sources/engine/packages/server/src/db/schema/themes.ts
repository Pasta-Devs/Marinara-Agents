// ──────────────────────────────────────────────
// Schema: Synced Custom Themes
// ──────────────────────────────────────────────
import { fileTable, text } from "../file-schema.js";

export const customThemes = fileTable("custom_themes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  css: text("css").notNull().default(""),
  installedAt: text("installed_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isActive: text("is_active").notNull().default("false"),
});
