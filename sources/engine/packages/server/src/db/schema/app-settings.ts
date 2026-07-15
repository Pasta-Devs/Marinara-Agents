// ──────────────────────────────────────────────
// Schema: Synced App Settings (key/value)
// ──────────────────────────────────────────────
import { fileTable, text } from "../file-schema.js";

export const appSettings = fileTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
