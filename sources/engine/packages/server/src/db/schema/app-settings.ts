// ──────────────────────────────────────────────
// Schema: Synced App Settings (key/value)
// ──────────────────────────────────────────────
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
