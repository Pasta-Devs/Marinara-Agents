// ──────────────────────────────────────────────
// Schema: Prompt Overrides
//
// User-supplied templates that replace hardcoded
// prompt builders. One row per registered key.
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const promptOverrides = fileTable("prompt_overrides", {
  key: text("key").primaryKey(),
  template: text("template").notNull(),
  enabled: integer("enabled").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
