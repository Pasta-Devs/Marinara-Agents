import {
  noodleStageProfileDraftResponseSchema,
  type APIProvider,
  type NoodleIdentityDisclosure,
  type NoodleStageProfileDraftRequest,
  type NoodleStageProfileInput,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { modelAnswerForCorrection, requireModelAnswer } from "./slurp-model-answer.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { noodleResponseFormat } from "./slurp-response-format.js";
import {
  buildNoodlerPublicIdentity,
  protectNoodlerGeneratedIdentity,
  stageProfileContainsPublicIdentity,
} from "./slurp-generation.service.js";
import { resolveNoodlerSourceSnapshot } from "./slurp-source-resolve.js";
import { normalizeNoodlerStageProfileDraft } from "./slurp-stage-profile-normalize.js";
import { noodlerConcealedSourceText, noodlerSourceText } from "./slurp-prompt-safety.js";
import { createNoodlerSourceRevisionToken } from "./slurp-source-revision.js";

/** Used only when a source card carries no usable prose, so the model still gets a starting point. */
const CONCEALED_SOURCE_FALLBACK_BRIEF = "General temperament and creative interests from the source profile.";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

function disclosureRules(mode: NoodleIdentityDisclosure, publicIdentity: { displayName: string; handle: string }) {
  if (mode === "open")
    return `This is the same public creator. Use exactly ${publicIdentity.displayName} as displayName and ${publicIdentity.handle} as handle. Write a concise social profile bio that summarizes the linked source. Preserve a direct bio edit from the current draft. Do not invent a stage identity.`;
  if (mode === "hinted")
    return "Create the same person behind a different stage name and handle, as an open secret. Preserve species, body, age range, unusual anatomy, scars, missing or unusual features, clothing preferences, voice, interests, and recurring visual traits. Preserve indirect clues that regular followers may recognize. Never use the exact public name or handle, and never copy canonical biography sentences.";
  return "The same person behind an anonymous alias, taking real care not to be traced. Use a different display name and handle. Keep their body, voice, humour, interests, and everyday life fully intact — this person is specific, not vague. Withhold only the linkable details: the public name and handle, the face and any one-of-a-kind marker such as species traits, unusual anatomy, or a signature scar or outfit, plus named people, employer, city, and any canonical event that could be looked up.";
}

export function buildNoodlerStageProfileDraftMessages(input: {
  request: Pick<NoodleStageProfileDraftRequest, "disclosureMode" | "guidance" | "currentDraft">;
  publicAccount: { displayName: string; handle: string; bio: string };
  source: {
    data: string | ({ name?: unknown } & Record<string, unknown>);
  } | null;
}): ChatMessage[] {
  const identity = buildNoodlerPublicIdentity(input.publicAccount, input.source);
  const protectedDraft = input.request.currentDraft
    ? Object.fromEntries(
        Object.entries(input.request.currentDraft).map(([key, value]) => [
          key,
          typeof value === "string"
            ? (protectNoodlerGeneratedIdentity(value, input.request.disclosureMode, identity) ?? "")
            : value,
        ]),
      )
    : null;
  const sourceDetails = input.source
    ? noodlerSourceText(input.source.data)
    : "General temperament and creative interests from the source profile.";
  const hintedBrief = input.request.disclosureMode === "hinted";
  const rawSourceContext =
    input.request.disclosureMode === "secret"
      ? [
          "# Anonymous alias brief",
          "This is the same person as the source, running a page they do not want traced back to them. They are not a different person and not a vaguer one.",
          "Keep them fully themselves: same body, same voice, same humour, same tastes, same everyday life. An anonymous creator is specific and vivid, because their body and personality are the page.",
          "Withhold only what would link them: the source name and handle, the face and any one-of-a-kind marker, named people, employer, and city, and any canonical event someone could look up.",
          noodlerConcealedSourceText(input.source?.data) || CONCEALED_SOURCE_FALLBACK_BRIEF,
        ].join("\n")
      : hintedBrief
        ? [
            "# Open-secret inspiration brief",
            "The stage identity is the same person as the source. Carry over look, vibe, interests, and daily life so a regular follower can recognize them.",
            "Never use the source name or handle, and never copy four or more consecutive words from the text below. Rewrite everything in the stage voice.",
            noodlerConcealedSourceText(input.source?.data) || CONCEALED_SOURCE_FALLBACK_BRIEF,
          ].join("\n")
        : [
            "# Source character or persona",
            `Public name: ${input.publicAccount.displayName}`,
            `Public handle: @${input.publicAccount.handle}`,
            `Public bio: ${input.publicAccount.bio || "No bio provided."}`,
            sourceDetails,
          ].join("\n");
  const sourceContext =
    input.request.disclosureMode === "open"
      ? rawSourceContext
      : rawSourceContext
          .split("\n")
          .map((line) => protectNoodlerGeneratedIdentity(line, input.request.disclosureMode, identity) ?? "")
          .join("\n");
  return [
    {
      role: "system",
      content: [
        "Create one editable Slurp creator profile draft.",
        "Return JSON only with displayName, handle, bio, stagePersonality, and disclosureMode.",
        "Make the profile concise and usable for future Slurp post generation. Follow the disclosure rules exactly.",
        disclosureRules(input.request.disclosureMode, identity),
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        sourceContext,
        ...(protectedDraft ? ["", "# Current draft", JSON.stringify(protectedDraft)] : []),
        "",
        "# Creator guidance",
        input.request.guidance || "Create a compelling stage identity with a clear voice.",
      ].join("\n"),
    },
  ];
}

const noodlerStageProfileDraftSchema = noodleStageProfileDraftResponseSchema.omit({ disclosureMode: true }).strip();

export function parseNoodlerStageProfileDraft(content: string) {
  const normalized = normalizeNoodlerStageProfileDraft(
    parseGameJsonish(requireModelAnswer(content, "a creator profile")),
  );
  return noodlerStageProfileDraftSchema.parse(normalized);
}

export async function generateNoodlerStageProfileDraft(
  db: DB,
  input: {
    request: NoodleStageProfileDraftRequest;
    connection: GenerationConnection;
  },
): Promise<
  NoodleStageProfileInput & {
    sourceSnapshot?: Awaited<ReturnType<typeof resolveNoodlerSourceSnapshot>>;
    sourceRevisionToken?: string;
  }
> {
  const noodle = createSlurpStorage(db);
  const noodlerAccount = input.request.noodlerAccountId
    ? await noodle.getNoodlerAccountById(input.request.noodlerAccountId)
    : null;
  const publicAccount = noodlerAccount
    ? await noodle.resolveAccountSource(noodlerAccount)
    : input.request.noodleAccountId
      ? await noodle.resolveSourceByEntityId(input.request.noodleAccountId)
      : null;
  if (!publicAccount) throw new Error("Noodle source account not found.");
  const characters = createCharactersStorage(db);
  const source =
    publicAccount.kind === "character"
      ? await characters.getById(publicAccount.entityId)
      : publicAccount.kind === "persona"
        ? await characters.getPersona(publicAccount.entityId).then((persona) =>
            persona
              ? {
                  data: {
                    name: persona.name,
                    description: persona.description,
                    personality: persona.personality,
                    scenario: persona.scenario,
                    appearance: persona.appearance,
                    backstory: persona.backstory,
                  },
                }
              : null,
          )
        : null;
  const identity = buildNoodlerPublicIdentity(publicAccount, source);
  const sourceSnapshot = await resolveNoodlerSourceSnapshot(db, publicAccount);
  const messages = buildNoodlerStageProfileDraftMessages({
    request: input.request,
    publicAccount,
    source,
  });
  const debugMode = isDebugAgentsEnabled();
  logDebugOverride(
    debugMode,
    "[debug/noodler] Stage profile draft prompt prepared with %d messages; private source content is redacted.",
    messages.length,
  );
  const connections = createConnectionsStorage(db);
  const fallbackConnection = await connections.getFallbackForMain();
  const provider = withConnectionFallbackProvider({
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
  });
  const completionOptions = {
    model: input.connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, 1200),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    ...noodleSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.7, topP: 0.9 },
    ),
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "noodler_profile"),
  } as const;
  const response = await provider.chatComplete(messages, completionOptions);
  let parsedDraft: ReturnType<typeof parseNoodlerStageProfileDraft>;
  try {
    parsedDraft = parseNoodlerStageProfileDraft(response.content ?? "");
  } catch {
    // One retry with the field names spelled out, same sampling options as the first attempt.
    // Without the retry a single malformed answer fails the creator outright, which is what the
    // wizard reported as "creation failed".
    const retry = await provider.chatComplete(
      [
        ...messages,
        // An empty assistant turn is rejected by several providers, so only echo a real answer.
        ...(modelAnswerForCorrection(response.content)
          ? [{ role: "assistant" as const, content: modelAnswerForCorrection(response.content)! }]
          : []),
        {
          role: "user",
          content:
            "That was not a valid stage profile object. Return exactly one JSON object with the keys displayName, handle, bio, and stagePersonality, all strings. No other keys, no prose.",
        },
      ],
      completionOptions,
    );
    parsedDraft = parseNoodlerStageProfileDraft(retry.content ?? "");
  }
  const draft = {
    ...parsedDraft,
    disclosureMode: input.request.disclosureMode,
  };
  if (input.request.disclosureMode !== "open" && stageProfileContainsPublicIdentity(draft, identity)) {
    throw new Error("Generated stage draft included the linked public identity. Try again with different guidance.");
  }
  return {
    ...draft,
    ...(input.request.disclosureMode === "open"
      ? {
          displayName: publicAccount.displayName,
          handle: publicAccount.handle,
          bio: input.request.currentDraft?.bio ?? parsedDraft.bio,
        }
      : {}),
    ...(input.request.disclosureMode === "open" && sourceSnapshot ? { sourceSnapshot } : {}),
    ...(input.request.disclosureMode !== "open" && input.request.noodlerAccountId && sourceSnapshot
      ? {
          sourceRevisionToken: createNoodlerSourceRevisionToken(input.request.noodlerAccountId, sourceSnapshot),
        }
      : {}),
  };
}
