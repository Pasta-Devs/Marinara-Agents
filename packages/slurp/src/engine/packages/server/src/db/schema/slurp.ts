import { fileTable, text } from "../file-schema.js";

export const slurpViewers = fileTable(
  "slurp_viewers",
  {
    id: text("id").primaryKey(),
    personaId: text("persona_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  { uniqueBy: [["personaId"]] },
);

export const slurpCreators = fileTable(
  "slurp_creators",
  {
    id: text("id").primaryKey(),
    sourceKind: text("source_kind").notNull(),
    sourceEntityId: text("source_entity_id").notNull(),
    sourceStatus: text("source_status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  { uniqueBy: [["sourceKind", "sourceEntityId"]] },
);
