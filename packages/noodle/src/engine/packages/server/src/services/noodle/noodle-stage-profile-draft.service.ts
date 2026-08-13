import {
  noodleStageProfileDraftResponseSchema,
  type APIProvider,
  type NoodleIdentityDisclosure,
  type NoodlerSourceSnapshot,
  type NoodleStageProfileDraftRequest,
  type NoodleStageProfileInput,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import {
  resolveStoredChatOptions,
  resolveStoredMaxTokens,
} from "../generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { noodleSamplingOptions } from "./noodle-sampling-options.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { noodleResponseFormat } from "./noodle-response-format.js";
import {
  buildNoodlerPublicIdentity,
  protectNoodlerGeneratedIdentity,
  stageProfileContainsPublicIdentity,
} from "./noodle-noodler-generation.service.js";
import { resolveNoodlerSourceSnapshot } from "./noodle-noodler-source-resolve.js";
import { hintedNoodlerSourceBrief } from "./noodle-prompt-safety.js";
import { normalizeNoodlerStageProfileDraft } from "./noodler-stage-profile-normalize.js";
import { parseRecord } from "./noodle-public-support.js";
import { createNoodlerSourceRevisionToken } from "./noodle-source-revision.js";

type GenerationConnection = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>
>;

/**
 * Hinted drafts see look, temperament, and everyday texture — the material a follower would
 * recognize — but not the name or the canonical story beats (scenario, backstory).
 */
export function noodlerHintedSourceText(data: unknown): string {
  const source = parseRecord(data);
  const extensions = parseRecord(source.extensions);
  return [
    `Description: ${typeof source.description === "string" ? source.description : ""}`,
    `Personality: ${typeof source.personality === "string" ? source.personality : ""}`,
    `Appearance: ${typeof source.appearance === "string" ? source.appearance : typeof extensions.appearance === "string" ? extensions.appearance : ""}`,
  ]
    .filter((line) => line.split(": ").slice(1).join(": ").trim())
    .join("\n");
}

export function noodlerSourceText(data: unknown): string {
  const source = parseRecord(data);
  const extensions = parseRecord(source.extensions);
  return [
    `Name: ${typeof source.name === "string" ? source.name : ""}`,
    `Description: ${typeof source.description === "string" ? source.description : ""}`,
    `Personality: ${typeof source.personality === "string" ? source.personality : ""}`,
    `Scenario: ${typeof source.scenario === "string" ? source.scenario : ""}`,
    `Appearance: ${typeof source.appearance === "string" ? source.appearance : typeof extensions.appearance === "string" ? extensions.appearance : ""}`,
    `Backstory: ${typeof source.backstory === "string" ? source.backstory : typeof extensions.backstory === "string" ? extensions.backstory : ""}`,
  ]
    .filter((line) => line.trim().split(": ").slice(1).join(": ").trim())
    .join("\n");
}

function disclosureRules(
  mode: NoodleIdentityDisclosure,
  publicIdentity: { displayName: string; handle: string },
) {
  if (mode === "open")
    return `The public identity ${publicIdentity.displayName} (@${publicIdentity.handle}) may inspire and appear in the draft.`;
  if (mode === "hinted")
    return "Create the same person behind a stage name, as an open secret. Looks, voice, interests, and daily life carry over so a regular follower recognizes them, but never use the exact public name or handle, and never copy canonical biography sentences.";
  return "Create a separate persona. Treat the source only as confidential authoring inspiration. Do not use the public name, handle, canonical occupation, relationships, locations, signature phrases, or distinctive identifying details.";
}

export function buildNoodlerStageProfileDraftMessages(input: {
  request: Pick<
    NoodleStageProfileDraftRequest,
    "disclosureMode" | "guidance" | "currentDraft"
  >;
  publicAccount: { displayName: string; handle: string; bio: string };
  source: {
    data: string | ({ name?: unknown } & Record<string, unknown>);
  } | null;
  sourceSnapshot: NoodlerSourceSnapshot | null;
}): ChatMessage[] {
  const identity = buildNoodlerPublicIdentity(
    input.publicAccount,
    input.source,
  );
  const protectedDraft = input.request.currentDraft
    ? Object.fromEntries(
        Object.entries(input.request.currentDraft).map(([key, value]) => [
          key,
          typeof value === "string"
            ? (protectNoodlerGeneratedIdentity(
                value,
                input.request.disclosureMode,
                identity,
              ) ?? "")
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
          "# Non-identifying inspiration brief",
          "Use only broad temperament, creative interests, and non-identifying aesthetic direction.",
          "Do not infer canonical facts or recognizable story details.",
          `Public bio themes, redacted: ${input.publicAccount.bio ? "A source bio exists; do not reproduce its wording." : "None."}`,
        ].join("\n")
      : hintedBrief
        ? [
            "# Open-secret inspiration brief",
            "The stage identity is the same person as the source. Carry over look, vibe, interests, and daily life so a regular follower can recognize them.",
            "Never use the source name or handle, and never copy four or more consecutive words from the text below. Rewrite everything in the stage voice.",
            noodlerHintedSourceText(input.source?.data) ||
              hintedNoodlerSourceBrief(input.sourceSnapshot),
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
          .map(
            (line) =>
              protectNoodlerGeneratedIdentity(
                line,
                input.request.disclosureMode,
                identity,
              ) ?? "",
          )
          .join("\n");
  return [
    {
      role: "system",
      content: [
        "Create one editable NoodleR stage profile draft.",
        "Return JSON only with displayName, handle, bio, stagePersonality, and disclosureMode.",
        "Make the stage identity distinct, concise, and usable for future NoodleR post generation.",
        disclosureRules(input.request.disclosureMode, identity),
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        sourceContext,
        ...(protectedDraft
          ? ["", "# Current draft", JSON.stringify(protectedDraft)]
          : []),
        "",
        "# Creator guidance",
        input.request.guidance ||
          "Create a compelling stage identity with a clear voice.",
      ].join("\n"),
    },
  ];
}

const noodlerStageProfileDraftSchema = noodleStageProfileDraftResponseSchema
  .omit({ disclosureMode: true })
  .strip();

export function parseNoodlerStageProfileDraft(content: string) {
  const normalized = normalizeNoodlerStageProfileDraft(parseGameJsonish(content));
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
  const noodle = createNoodleStorage(db);
  const noodlerAccount = input.request.noodlerAccountId
    ? await noodle.getNoodlerAccountById(input.request.noodlerAccountId)
    : null;
  const publicAccount = noodlerAccount?.noodleAccountId
    ? await noodle.getAccountById(noodlerAccount.noodleAccountId)
    : input.request.noodleAccountId
      ? await noodle.getAccountById(input.request.noodleAccountId)
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
    sourceSnapshot,
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
    fallbackBaseUrl: fallbackConnection
      ? resolveBaseUrl(fallbackConnection)
      : "",
    category: "main",
  });
  const completionOptions = {
    model: input.connection.model,
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: resolveStoredMaxTokens(
        input.connection.defaultParameters,
        1200,
      ),
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    ...noodleSamplingOptions(
      resolveStoredChatOptions(
        input.connection.defaultParameters,
        input.connection.provider,
        input.connection.model,
      ),
      { temperature: 0.7, topP: 0.9 },
    ),
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(
      input.connection.model,
      "noodler_profile",
    ),
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
        { role: "assistant", content: response.content ?? "" },
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
  if (stageProfileContainsPublicIdentity(draft, identity)) {
    throw new Error(
      "Generated stage draft included the linked public identity. Try again with different guidance.",
    );
  }
  return {
    ...draft,
    ...(input.request.disclosureMode === "open" && sourceSnapshot
      ? { sourceSnapshot }
      : {}),
    ...(input.request.disclosureMode !== "open" &&
    input.request.noodlerAccountId &&
    sourceSnapshot
      ? {
          sourceRevisionToken: createNoodlerSourceRevisionToken(
            input.request.noodlerAccountId,
            sourceSnapshot,
          ),
        }
      : {}),
  };
}
