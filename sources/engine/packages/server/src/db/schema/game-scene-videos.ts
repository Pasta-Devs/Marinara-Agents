import { fileTable, text, integer } from "../file-schema.js";
import { chats } from "./chats.js";

export const gameSceneVideos = fileTable("game_scene_videos", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  sourceIllustrationTag: text("source_illustration_tag"),
  sourceIllustrationPath: text("source_illustration_path"),
  prompt: text("prompt").notNull().default(""),
  provider: text("provider").notNull().default(""),
  model: text("model").notNull().default(""),
  durationSeconds: integer("duration_seconds").notNull().default(10),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  createdAt: text("created_at").notNull(),
});
