import type { APIProvider } from "@marinara-engine/shared";
import type { SlpWardrobeLook } from "../../../../../shared/src/slp/slp-wardrobe.js";
import type { DB } from "../../../db/connection.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import {
  resolveStoredChatOptions,
  resolveStoredMaxTokens,
} from "../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { createSlurpPostProvider, completeSlurpWithHost } from "../../base/host/slp-generation-integrations.js";
import { slpSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import {
  buildSlpWardrobeImportMessages,
  parseSlpWardrobeImportDrafts,
} from "../../modules/creators/slp-wardrobe-import.js";

export {
  buildSlpWardrobeImportMessages,
  parseSlpWardrobeImportDrafts,
} from "../../modules/creators/slp-wardrobe-import.js";

export async function previewSlpWardrobeImport(
  db: DB,
  input: {
    connection: NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;
    sourceLabel: string;
    sourceText: string;
    existing: readonly SlpWardrobeLook[];
  },
) {
  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = createSlurpPostProvider({
    connection: input.connection,
    fallbackConnection,
    admissionMode: { kind: "foreground" },
  });
  const response = await completeSlurpWithHost(
    provider,
    buildSlpWardrobeImportMessages(input.sourceLabel, input.sourceText),
    {
      model: input.connection.model,
      maxTokens: clampGenerationMaxOutputTokens({
        provider: input.connection.provider as APIProvider,
        model: input.connection.model,
        maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, 2_048),
        maxTokensOverride: input.connection.maxTokensOverride,
      }),
      ...slpSamplingOptions(
        resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
        { temperature: 0.2, topP: 0.8 },
      ),
      stream: false,
    },
  );
  return parseSlpWardrobeImportDrafts(response.content ?? "", input.existing);
}
