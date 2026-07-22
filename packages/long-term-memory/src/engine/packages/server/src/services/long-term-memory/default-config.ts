import type { LtmRetentionConfig } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export const DEFAULT_LTM_RETENTION_CONFIG: LtmRetentionConfig = {
  version: 1,
  auditWindowDays: 30,
  usageRetentionDays: 180,
  receiptRetentionDays: 180,
  eventRetentionDays: 180,
  incompleteGenerationRetentionDays: 30,
  quarantineRetentionDays: 90,
};
