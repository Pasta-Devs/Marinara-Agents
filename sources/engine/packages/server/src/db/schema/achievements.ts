import { fileTable, text } from "../file-schema.js";

export const achievementUnlocks = fileTable("achievement_unlocks", {
  id: text("id").primaryKey(),
  unlockedAt: text("unlocked_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
