// ──────────────────────────────────────────────
// Schema: API Connection Folders
// ──────────────────────────────────────────────
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const apiConnectionFolders = sqliteTable("api_connection_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  collapsed: text("collapsed").notNull().default("false"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
