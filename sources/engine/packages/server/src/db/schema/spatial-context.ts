// Schema: Hierarchical spatial context snapshots
import { integer, fileTable, text } from "../file-schema.js";

export const spatialContextSnapshots = fileTable("spatial_context_snapshots", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  /** Empty for the pre-message bootstrap state; otherwise references messages.id. */
  messageId: text("message_id").notNull().default(""),
  swipeIndex: integer("swipe_index").notNull().default(0),
  currentLocationId: text("current_location_id"),
  definitionRevision: integer("definition_revision").notNull(),
  source: text("source").notNull(),
  transitionCommandId: text("transition_command_id"),
  transitionPayloadHash: text("transition_payload_hash"),
  createdAt: text("created_at").notNull(),
});
