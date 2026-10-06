/**
 * Plan a roleplay scene from a DM thread (docs/SCENES.md): one model call, the plan the Engine runs.
 *
 * The player is present and pressed "Start a scene", so the call is not queued behind the background
 * budget, like the sign-up scene. Nothing is locked here: the Engine claims the thread only when the
 * player starts the planned scene.
 */
import type { APIProvider } from "@marinara-engine/shared";
import { jsonrepair } from "jsonrepair";
import type { SlpAccount } from "../../../../../../shared/src/slp/slp-social.types.js";
import { readSlpSceneLine, type SlpScenePlanResponse } from "../../../../../../shared/src/slp/slp-roleplay-scene.js";
import { isDebugAgentsEnabled } from "../../../../config/runtime-config.js";
import type { DB } from "../../../../db/connection.js";
import { logDebugOverride } from "../../../../lib/logger.js";
import { resolveBaseUrl } from "../../../../services/generation/connection-base-url.js";
import {
  resolveStoredChatOptions,
  resolveStoredMaxTokens,
} from "../../../../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../../../../services/generation/output-token-limits.js";
import { withConnectionFallbackProvider } from "../../../../services/llm/connection-fallback-provider.js";
import { createLLMProvider } from "../../../../services/llm/provider-registry.js";
import { createCharactersStorage } from "../../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../../services/storage/connections.storage.js";
import { requireModelAnswer } from "../../../base/model/slp-model-answer.js";
import { slpWithProviderRetry } from "../../../base/model/slp-provider-retry.js";
import { slpSamplingOptions } from "../../../base/prompting/slp-sampling-options.js";
import { listSlurpContinuityFor } from "../../../data/continuity/slp-continuity-storage.js";
import { resolveSlurpCreatorFlavour } from "../../../data/creators/slp-flavour-source.js";
import { resolveCreatorCharacterCanon } from "../../../data/creators/slp-source-resolve.js";
import { resolveSlurpCreatorMenu } from "../../../data/settings/slp-post-guidance-storage.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../../data/slp-storage.js";
import { slurpContinuityInstruction } from "../../../modules/continuity/slp-continuity-prompt.js";
import { describeSlurpRapport } from "../../../modules/messages/slp-rapport.js";
import { buildSlpScenePlanMessages, readSlpScenePlan } from "../../../modules/messages/slp-roleplay-scene-prompt.js";
import { slpSceneTranscript } from "../../../modules/messages/slp-roleplay-scene-rules.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/** A refusal the route turns into a status code; anything else is a 500. */
export class SlpScenePlanRefusal extends Error {
  constructor(
    readonly status: 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** The JSON object in an answer (fences and prose around it allowed); jsonrepair for loose quoting. */
function readAnswer(answer: string): unknown {
  const start = answer.indexOf("{");
  const end = answer.lastIndexOf("}");
  const body = start >= 0 && end > start ? answer.slice(start, end + 1) : answer;
  try {
    return JSON.parse(body);
  } catch {
    try {
      return JSON.parse(jsonrepair(body));
    } catch {
      return null;
    }
  }
}

export async function planSlpRoleplayScene(
  db: DB,
  input: {
    threadId: string;
    viewer: SlpAccount;
    idea: string;
    inviteMessageId?: string;
    connection: GenerationConnection;
  },
): Promise<SlpScenePlanResponse> {
  const slurp = createSlurpStorage(db);
  const messages = createSlurpMessagesStorage(db);
  const thread = await messages.getThreadById(input.threadId);
  if (!thread || thread.viewerAccountId !== input.viewer.id) throw new SlpScenePlanRefusal(404, "Thread not found");
  if (thread.state !== "active") throw new SlpScenePlanRefusal(409, "This conversation is closed.");
  if (thread.sceneChatId) throw new SlpScenePlanRefusal(409, "You are already in a scene together.");
  const creator = await slurp.getNoodlerAccountById(thread.creatorAccountId);
  const source = creator ? await slurp.resolveAccountSource(creator) : null;
  // The Engine casts Engine characters. A persona-backed Creator is the player's own page.
  if (!creator || source?.kind !== "character") throw new SlpScenePlanRefusal(409, "This Creator cannot do scenes.");

  const history = await messages.listMessages(thread.id, 40);
  const invite = input.inviteMessageId ? await messages.getMessageById(input.inviteMessageId) : null;
  const inviteLine = invite?.threadId === thread.id ? readSlpSceneLine(invite.metadata) : null;
  if (input.inviteMessageId && (inviteLine?.kind !== "invite" || inviteLine.state !== "open"))
    throw new SlpScenePlanRefusal(409, "That invite is no longer open.");
  const invitePitch = inviteLine?.kind === "invite" ? inviteLine.pitch : "";

  const disclosureMode = creator.settings.privacy.identityDisclosure ?? "open";
  const subscribed = (await slurp.listSubscriptionsForViewer(input.viewer.id)).some(
    (entry) => entry.creatorAccountId === creator.id,
  );
  const persona = await createCharactersStorage(db).getPersona(input.viewer.entityId);
  const continuity = await listSlurpContinuityFor(db, creator.id, "fan_thread", {
    at: new Date(),
    threadId: thread.id,
    limit: 20,
  })
    .then((ledger) => slurpContinuityInstruction({ ...ledger, threadId: thread.id }))
    .catch(() => "");
  const planMessages = buildSlpScenePlanMessages({
    creator: {
      stageName: creator.displayName,
      handle: creator.handle,
      bio: creator.bio ?? "",
      stageVoice: creator.settings.privacy.stagePersonality ?? "",
    },
    contentMenu: await resolveSlurpCreatorMenu(db, creator.id).catch(() => ""),
    flavourBrief: await resolveSlurpCreatorFlavour(db, {
      account: creator,
      source,
      disclosureMode,
      use: "dm",
      sequence: history.length,
      chat: { subscribed, player: true, seed: `${creator.id}:${input.viewer.id}`, with: "fan" },
      ownLines: history
        .filter((message) => message.role === "creator" && message.kind === "text")
        .map((message) => message.content)
        .reverse(),
    }).catch(() => ""),
    characterCanon: (await resolveCreatorCharacterCanon(db, source, disclosureMode).catch(() => "")) ?? "",
    relationship: [
      describeSlurpRapport(thread.rapport, input.viewer.displayName),
      subscribed ? `${input.viewer.displayName} subscribes to her.` : `${input.viewer.displayName} does not subscribe.`,
    ],
    continuity,
    fan: { name: input.viewer.displayName, description: String(persona?.description ?? "").slice(0, 1200) },
    transcript: slpSceneTranscript(history, { creator: creator.displayName, fan: input.viewer.displayName }),
    idea: invitePitch || input.idea,
    invitedByCreator: Boolean(invitePitch),
  });

  const debugMode = isDebugAgentsEnabled();
  logDebugOverride(debugMode, "[debug/slurp] Scene plan prompt:\n%s", JSON.stringify(planMessages, null, 2));
  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = slpWithProviderRetry(
    withConnectionFallbackProvider({
      primary: createLLMProvider(
        input.connection.provider,
        resolveBaseUrl(input.connection),
        input.connection.apiKey,
        input.connection.maxContext,
        input.connection.openrouterProvider,
        input.connection.maxTokensOverride,
        input.connection.claudeFastMode === "true",
        input.connection.treatAsLocalEndpoint === "true",
        input.connection.defaultParameters,
      ),
      primaryConnectionId: input.connection.id,
      fallbackConnection,
      fallbackBaseUrl: fallbackConnection ? resolveBaseUrl(fallbackConnection) : "",
      category: "main",
    }),
  );
  const response = await provider.chatComplete(planMessages, {
    model: input.connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, 4000),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    ...slpSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.9, topP: 0.95 },
    ),
    stream: false,
    debugMode,
  });
  // ponytail: no retry on an unusable answer; the player presses Rewrite. Add one if it fails often.
  const plan = readSlpScenePlan(readAnswer(requireModelAnswer(response.content ?? "", "the scene plan")));
  if (!plan) throw new Error("The scene plan got lost. Try again.");
  const { reach, lock, ...enginePlan } = plan;
  return {
    plan: { ...enginePlan, background: null, characterIds: [source.entityId] },
    settings: { reach, lock },
    // A scene she pitched is hers to open; one the fan asked for opens the same way, from her.
    initiatorCharacterId: invitePitch ? source.entityId : null,
    initiatorName: creator.displayName,
  };
}
