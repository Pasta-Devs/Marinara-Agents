import type { DB } from "../../../db/connection.js";
import { tolerateMissingTables } from "../../base/host/slp-host-tables.js";
import { createSlurpMessagesContext, type SlurpMessagesCoreFactory } from "./slp-messages-storage-context.js";
import { createMessagesStorageBase } from "./slp-messages-storage-base.js";
import { createMessagesStorageConversation } from "./slp-messages-storage-conversation.js";
import { createMessagesStorageCommissions } from "./slp-messages-storage-commissions.js";
import { createMessagesStorageActions } from "./slp-messages-storage-actions.js";
import { createMessagesStorageFollowUps } from "./slp-messages-storage-follow-ups.js";
export function createSlurpMessagesStorageFacet(db: DB, createCore: SlurpMessagesCoreFactory) {
  const context = createSlurpMessagesContext(db, createCore);
  const storage = Object.assign(
    {},
    createMessagesStorageBase(context),
    createMessagesStorageConversation(context),
    createMessagesStorageCommissions(context),
    createMessagesStorageActions(context),
    createMessagesStorageFollowUps(context),
  );
  context.storage = storage;
  return tolerateMissingTables(storage, {
    getThreadById: () => null,
    getThread: () => null,
    getMessageById: () => null,
    getCommission: () => null,
    listMessages: () => [],
    listThreadsForCreators: () => [],
    listThreadsForViewer: () => [],
    listCommissionsForThread: () => [],
    listOpenCommissionsForCreator: () => [],
    listAutomatedBriefCommissions: () => [],
    listThreadsAwaitingReply: () => [],
    rapportFactsFor: () => ({}),
    claimReply: () => ({ status: "busy" as const }),
    appendReplyBatch: () => null,
    claimScheduledFollowUp: () => false,
  });
}
