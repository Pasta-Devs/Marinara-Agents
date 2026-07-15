// ──────────────────────────────────────────────
// Schema: Conversation Calls
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";
import { chats } from "./chats.js";

export const conversationCallSessions = fileTable("conversation_call_sessions", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["ringing", "active", "ended", "declined", "missed"] }).notNull(),
  mode: text("mode", { enum: ["audio", "video"] })
    .notNull()
    .default("audio"),
  initiator: text("initiator", { enum: ["user", "character"] }).notNull(),
  initiatorCharacterId: text("initiator_character_id"),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  summary: text("summary"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const conversationCallMessages = fileTable("conversation_call_messages", {
  id: text("id").primaryKey(),
  callId: text("call_id")
    .notNull()
    .references(() => conversationCallSessions.id, { onDelete: "cascade" }),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system", "narrator"] }).notNull(),
  characterId: text("character_id"),
  participantKind: text("participant_kind", { enum: ["user", "character"] }).notNull(),
  kind: text("kind", { enum: ["speech", "text", "system", "command", "soundboard"] }).notNull(),
  content: text("content").notNull().default(""),
  extra: text("extra").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const conversationCallSounds = fileTable("conversation_call_sounds", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  filePath: text("file_path"),
  mimeType: text("mime_type").notNull().default("audio/mpeg"),
  durationMs: integer("duration_ms"),
  builtIn: text("built_in").notNull().default("false"),
  createdAt: text("created_at").notNull(),
});
