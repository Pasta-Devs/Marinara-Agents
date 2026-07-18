import type {
  LtmPoliciesConfig,
  LtmRetentionConfig,
  LtmRetrievalConfig,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export const DEFAULT_LTM_POLICIES: LtmPoliciesConfig = {
  version: 1,
  policies: [
    {
      type: "character",
      injection: "always_for_active_characters",
      sectionsAlways: ["core", "current_state"],
      sectionsOnRelevance: ["personality", "history", "secrets"],
    },
    {
      type: "relationship",
      injection: "on_relevance",
      sectionsAlways: [],
      sectionsOnRelevance: ["*"],
    },
    {
      type: "thread",
      injection: "on_relevance",
      sectionsAlways: [],
      sectionsOnRelevance: ["*"],
    },
  ],
};

export const DEFAULT_LTM_RETRIEVAL_CONFIG: LtmRetrievalConfig = {
  version: 1,
  maxChunks: 12,
  maxTokens: 2_048,
  semanticWeight: 0.6,
  lexicalWeight: 0.3,
  graphWeight: 0.1,
  keywordWeight: 0.2,
  maxMetadataCandidates: 256,
  maxDirectCandidates: 128,
  maxLexicalCandidates: 128,
  maxKeywordCandidates: 128,
  maxVectorCandidates: 256,
  maxGraphCandidates: 128,
  maxMandatoryCandidates: 128,
};

export const DEFAULT_LTM_RETENTION_CONFIG: LtmRetentionConfig = {
  version: 1,
  auditWindowDays: 30,
  usageRetentionDays: 180,
  receiptRetentionDays: 180,
  eventRetentionDays: 180,
  incompleteGenerationRetentionDays: 30,
  quarantineRetentionDays: 90,
};
