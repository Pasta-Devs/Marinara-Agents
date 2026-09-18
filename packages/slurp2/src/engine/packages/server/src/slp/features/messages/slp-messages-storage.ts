import type { DB } from "../../../db/connection.js";
import { createSlurpMessagesStorageFacet } from "./slp-messages-storage-facet.js";
import type { SlurpMessagesCoreFactory } from "./slp-messages-storage-context.js";
export type {
  SlurpCommission,
  SlurpMessage,
  SlurpSendResult,
  SlurpThread,
  SlurpThreadView,
} from "./slp-messages-storage-types.js";
export { SLURP_LONGTERM_NOTE_LIMIT, SLURP_WORKING_NOTE_LIMIT } from "../../../services/slurp/slurp-thread-notes.js";
export function createSlurpMessagesStorage(db: DB, createCore?: SlurpMessagesCoreFactory) {
  return createSlurpMessagesStorageFacet(
    db,
    createCore ??
      (() => {
        throw new Error("Slurp core storage factory is required");
      }),
  );
}
