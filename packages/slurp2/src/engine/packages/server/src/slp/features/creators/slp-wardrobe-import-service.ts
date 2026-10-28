import type { APIProvider } from "@marinara-engine/shared";
import type { SlpWardrobeLook } from "../../../../../shared/src/slp/slp-wardrobe.js";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
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

const wardrobeFillTried = new Set<string>();

/**
 * The Creator's looks; an empty closet is filled once from the card first. An empty closet left
 * every outfit to the model, and prod Creators wore the same clothes for weeks.
 * ponytail: one try per Creator per server start; store the attempt if that costs too many calls.
 */
export async function ensureSlurpCreatorWardrobe(
  db: DB,
  input: {
    accountId: string;
    displayName: string;
    connection: Parameters<typeof previewSlpWardrobeImport>[1]["connection"];
    sourceText: string | null | undefined;
  },
): Promise<SlpWardrobeLook[]> {
  const noodle = createSlurpStorage(db);
  const looks = await noodle.listWardrobeLooks(input.accountId).catch(() => []);
  if (looks.length || !input.sourceText || wardrobeFillTried.has(input.accountId)) return looks;
  if (await noodle.hasWardrobeRecord(input.accountId).catch(() => true)) return looks;
  wardrobeFillTried.add(input.accountId);
  try {
    const drafts = await previewSlpWardrobeImport(db, {
      connection: input.connection,
      sourceLabel: `Linked character: ${input.displayName}`,
      sourceText: input.sourceText,
      existing: [],
    });
    if (!drafts.length) return looks;
    return await noodle.createWardrobeLooks(
      input.accountId,
      drafts.map(({ evidence: _evidence, ...look }) => look),
      { kind: "character" },
    );
  } catch (error) {
    logger.warn(error, "[slurp-wardrobe] Could not fill the wardrobe from the card");
    return looks;
  }
}
