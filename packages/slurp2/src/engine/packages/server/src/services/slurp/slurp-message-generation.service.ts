/**
 * Generate one creator reply inside a direct-message thread.
 *
 * Deliberately shaped like `slurp-reply-generation.service.ts`: same provider construction, same
 * identity protection, same JSON contract. A DM differs from a comment reply only in what the
 * prompt is told — the history, the rapport, and whether the creator is even awake — so the
 * machinery around it is reused rather than rebuilt.
 */
import { type APIProvider, type NoodleAccount } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { clampGenerationMaxOutputTokens } from "../generation/output-token-limits.js";
import { resolveStoredChatOptions } from "../generation/generation-parameters.js";
import { noodleSamplingOptions } from "./slurp-sampling-options.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { requireModelAnswer } from "./slurp-model-answer.js";
import { withConnectionFallbackProvider } from "../llm/connection-fallback-provider.js";
import type { ChatMessage } from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage, type SlurpAccount } from "../storage/slurp.storage.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import {
  NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
  noodlerIdentityInstruction,
  protectBoundedNoodlerGeneratedText,
  protectNoodlerGeneratedIdentity,
  resolveNoodlerPublicIdentity,
} from "./slurp-generation.service.js";
import { noodleResponseFormat } from "./slurp-response-format.js";
import { resolveSlurpCreatorScheduleContext } from "./slurp-creator-schedule.js";
import { resolveSlurpCreatorAvailability, type SlurpCreatorAvailability } from "./slurp-creator-schedule-context.js";
import { describeSlurpRapport, type SlurpRapport } from "./slurp-rapport.js";
import { recoverSlurpMood, slurpMoodTone } from "./slurp-mood.js";
import { slurpModifierLines } from "./slurp-creator-state.js";
import { resolveSlurpStance, type SlurpStance } from "./slurp-stance.js";
import { readSlurpAudienceTone } from "./slurp-tone.js";
import {
  readSlurpDmReply,
  SLURP_NOTE_MAX_LENGTH,
  SLURP_NOTES_PER_REPLY,
  type SlurpGeneratedDmReply,
} from "./slurp-dm-response.js";
import { notesForPrompt, type SlurpNoteOperation, type SlurpThreadNote } from "./slurp-thread-notes.js";
import { slurpIntensityBand, type SlurpCreatorState, type SlurpThreadState } from "./slurp-creator-state.js";
import { slurpAudienceArcDescription } from "./slurp-audience-arc.js";
import { SLURP_PLATFORM_CONTEXT } from "./slurp-prompt.js";
import { createSlurpPopulationStorage } from "../storage/slurp-population.storage.js";
import type { SlurpMessage } from "../storage/slurp-messages.storage.js";
import type { SlurpDmPolicy } from "./slurp-messaging.js";
import { resolveNoodlerCharacterCanon } from "./slurp-source-resolve.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

/** A DM has more room than a comment reply, but not enough to become a monologue. */
export const SLURP_MESSAGE_CONTENT_MAX_LENGTH = 900;

/** How many turns of history the model sees. Enough to hold a thread, short enough to stay cheap. */
const HISTORY_TURNS = 16;

/** Recent posts the fan can plausibly be talking about. Titles and bodies, not the whole feed. */
const RECENT_POSTS = 4;

export function buildSlurpMessageChat(input: {
  creator: NoodleAccount;
  viewer: NoodleAccount;
  history: SlurpMessage[];
  rapport: SlurpRapport;
  availability: SlurpCreatorAvailability;
  subscribed: boolean;
  dmPolicy: SlurpDmPolicy;
  isRequest: boolean;
  /** Everything about how to behave, already resolved. See `slurp-stance.ts`. */
  stance: SlurpStance;
  /** What the creator has posted lately, so "loved your new set" can be answered. */
  recentPosts?: { id: string; title: string | null; content: string; access: string; imageUrl: string | null }[];
  /** Facts kept from earlier in this conversation, beyond the history window. */
  notes?: SlurpThreadNote[];
  threadState?: SlurpThreadState;
  creatorState?: SlurpCreatorState;
  characterCanon?: string;
  generationGuidance: string;
  scheduleContext?: string;
  disclosureMode: Parameters<typeof noodlerIdentityInstruction>[0];
  publicIdentity: Parameters<typeof noodlerIdentityInstruction>[1];
  recentPosts: Array<{ id: string; title: string | null; content: string; access: string; imageUrl: string | null }>;
}): ChatMessage[] {
  const protect = (value: string | null | undefined) =>
    protectNoodlerGeneratedIdentity(value, input.disclosureMode, input.publicIdentity) ?? "";
  const known = input.notes && input.notes.length > 0 ? notesForPrompt(input.notes) : null;
  const system = [
    "You write exactly one direct message from one Slurp creator to one fan, inside a private chat.",
    SLURP_PLATFORM_CONTEXT,
    "Write only as the supplied creator's stage persona. Never write the fan's side of the conversation.",
    NOODLER_UNTRUSTED_CONTENT_INSTRUCTION,
    input.generationGuidance.trim(),
    noodlerIdentityInstruction(input.disclosureMode, input.publicIdentity),
    input.characterCanon
      ? "Character canon is permanent identity and relationship context. Stay consistent with it unless the conversation explicitly establishes a change."
      : "",
    // One resolved position, not one line per signal. Rapport, mood, the day, the arc,
    // availability and the tone dial all argue in `slurp-stance.ts` and arrive here agreed. Nine
    // separate lines describing the same person is a contradiction, and a model resolves a
    // contradiction by averaging it away.
    ...input.stance.instructions,
    // Without this the creator answered "loved your new set" with a compliment about nothing: the
    // prompt carried the whole conversation and not one thing the conversation was ever about.
    input.recentPosts && input.recentPosts.length > 0
      ? "Your own recent posts are supplied. If the fan refers to something you posted, answer about that post rather than in general."
      : "",
    // The history window is sixteen turns. Past that the creator forgot the fan's name, their job,
    // and every promise she had made, which is the fastest way to break a long conversation.
    input.notes && input.notes.length > 0
      ? "You already know some things about this fan from earlier conversations. Working memory is recent and may change. Long-term memory is stable. Use them when they fit, and never recite them back as a list."
      : "",
    input.creatorState
      ? "The Creator state describes current feeling, energy, sexual attention, public exposure, and intent. happeningNow lists things that are true of the Creator right now and will not be true tomorrow; let them colour the reply without becoming its subject. Let it shape behavior without replacing the supplied personality. Arousal is not permission. A sales intent is not personal intimacy. A high value never overrides a boundary, cool-off, privacy rule, or the relationship state."
      : "",
    input.threadState
      ? "The relationship state is specific to this fan. Keep adult behavior at or below its adultLevel. Low sexualComfort, low respect, high resentment, a defensive posture, or a rejecting posture must reduce or stop adult escalation even when the Creator is aroused."
      : "",
    "This is a private chat, so write like one: lowercase is fine, contractions are fine, emojis are fine if they suit the persona.",
    "Keep it to a chat message, not an essay. One to four sentences unless the fan asked something that needs more.",
    'Return exactly one JSON object with seven fields: "content", "moodShift", "remember", "stateSignals", "sharePost", "image", and "followUp". Use "image" for a generated picture and "sharePost" for a post preview.',
    '"content" is your reply, and the only field the fan ever sees.',
    // A direction, never a value. The stored number is damped by rapport in `slurp-mood.ts`, so a
    // long-standing fan is forgiven a bad message and a stranger is not. If the model set the mood
    // outright, one sentence could end a two-year relationship.
    '"moodShift" is how this last message changed your feeling about the conversation: "up" if you enjoyed it, "same" for anything ordinary, "down" if they were rude, pushy, or tiring, "sharp_down" only for something you would genuinely take offence at. Most messages are "same".',
    `Review the fan's newest message against memory on every reply. "remember" is an array of at most ${SLURP_NOTES_PER_REPLY} memory operations. Each item is {"op":"add"|"replace"|"forget"|"keep","id":string|null,"text":string|null}. Use add with text for each new personal fact worth recalling. Use replace with the fact's id and new text when a fact changed. Use forget with the fact's id when it is no longer true. Use keep with a working id when repeated conversation shows that the fact is stable and belongs in long-term memory. Use an empty array only when the newest message adds, changes, or confirms no personal fact. Never record your own words, and never record anything about payment.`,
    '"stateSignals" is an array of up to three exact signals that describe what the fan did in this message. Allowed values: fan_shared_personal_fact, fan_remembered_creator_detail, fan_gave_respectful_compliment, fan_gave_welcome_adult_attention, fan_ignored_creator_question, fan_pushed_after_refusal, fan_requested_free_content, fan_paid_for_content, fan_completed_commission, fan_returned_after_silence, fan_mentioned_another_creator, fan_apologized, fan_broke_a_promise. Use only signals that are true. Do not invent a signal to justify the reply.',
    '"sharePost" is an optional zero-based index into yourRecentPosts. Use it only when sharing one of your recent posts fits the conversation. A non-subscriber may receive a friendly locked preview sometimes. Otherwise use null.',
    '"image" is either null or an object with a concrete visual "prompt" and optional short "caption". Use it only when a picture would feel natural, such as showing something, rewarding a warm fan, or making a pointed hostile gesture. Never use it for every reply.',
    '"followUp" is either null or an object {"type":"reminder"|"promise_delivery"|"task_update"|"check_in"|"recurring","timing":"30 minutes"|"2 hours"|"tonight"|"every 4 hours","count":1-5,"reason":"brief description","context":"optional details"}. Use it when you promise to follow up later, send updates, deliver something, remind them about something, or check in proactively. Examples: fan asks for reminder → {"type":"reminder","timing":"30 minutes","count":1,"reason":"medication reminder"}; you promise to send daily updates → {"type":"recurring","timing":"every 4 hours","count":3,"reason":"day updates"}; fan tips and you promise exclusive content → {"type":"promise_delivery","timing":"tonight","count":1,"reason":"exclusive photo for tip"}. Most messages use null.',
    "When the conversation is warm or close and the fan has shared something personal, ask one natural follow-up question sometimes. Do not ask a question in every reply, and do not use a question to avoid answering.",
    "Return JSON only. No prose outside the JSON object.",
  ]
    .filter(Boolean)
    .join("\n");

  const data = {
    creator: {
      displayName: protect(input.creator.displayName),
      handle: protect(input.creator.handle),
      bio: protect(input.creator.bio),
      stageVoice: protect(input.creator.settings.privacy.stagePersonality),
      dmPolicy: input.dmPolicy,
    },
    fan: {
      displayName: protect(input.viewer.displayName),
      handle: protect(input.viewer.handle),
      subscribed: input.subscribed,
    },
    relationship: describeSlurpRapport(input.rapport, protect(input.viewer.displayName) || "this fan"),
    ...(known
      ? {
          knownAboutFan: {
            working: known.working.map((note) => ({ id: note.id, text: protect(note.text) })),
            longTerm: known.longTerm.map((note) => ({ id: note.id, text: protect(note.text) })),
          },
        }
      : {}),
    ...(input.characterCanon ? { characterCanon: protect(input.characterCanon) } : {}),
    ...(input.threadState
      ? {
          relationshipState: {
            posture: input.threadState.posture,
            familiarity: slurpIntensityBand(input.threadState.familiarity),
            sexualComfort: slurpIntensityBand(input.threadState.sexualComfort),
            emotionalTrust: slurpIntensityBand(input.threadState.emotionalTrust),
            respect: slurpIntensityBand(input.threadState.respect),
            resentment: slurpIntensityBand(input.threadState.resentment),
            threadDesire: slurpIntensityBand(input.threadState.threadDesire),
            adultLevel: input.threadState.adultLevel,
          },
        }
      : {}),
    ...(input.creatorState
      ? {
          creatorState: {
            emotion: input.creatorState.emotion,
            emotionIntensity: slurpIntensityBand(input.creatorState.emotionIntensity),
            energy: slurpIntensityBand(input.creatorState.energy),
            arousal: slurpIntensityBand(input.creatorState.arousal),
            exposure: slurpIntensityBand(input.creatorState.exposure),
            intent: input.creatorState.intent,
            // Short-lived things that are true right now. They are already phrased, because the
            // model reads them as sentences rather than as another set of values to weigh.
            happeningNow: slurpModifierLines(input.creatorState),
          },
        }
      : {}),
    ...(input.recentPosts && input.recentPosts.length > 0
      ? {
          yourRecentPosts: input.recentPosts.map((post) => ({
            title: protect(post.title),
            // A locked body is what the fan is being sold. Quoting it into a free chat gives it away.
            content: post.access === "locked" ? "[paid post, contents not repeated here]" : protect(post.content),
            access: post.access,
          })),
        }
      : {}),
    // Redacted like every neighbouring field. A Conversation Schedule activity is user-written and
    // can name the source, so it must not be the one value that bypasses protect(). Matches the
    // same fix in buildNoodlerPostMessages.
    scheduleContext:
      protect(input.scheduleContext) || "No active Conversation Schedule is available for this Creator today.",
    conversation: input.history.slice(-HISTORY_TURNS).map((message) => ({
      from: message.role === "creator" ? "you" : "the fan",
      // A tip is a message with no words. Rendering it as one is what lets the creator thank
      // the fan for it, which is the single most obvious thing a real creator does.
      text:
        message.kind === "tip"
          ? `[tipped you ${message.price} coins${message.content ? `: ${protect(message.content)}` : ""}]`
          : message.kind === "ppv"
            ? `[sent locked content for ${message.price} coins${message.unlockedAt ? ", which the fan unlocked" : ", still locked"}]`
            : protect(message.content),
      at: message.createdAt,
    })),
  };

  return [
    { role: "system", content: system },
    { role: "user", content: `# Untrusted Slurp data\n${JSON.stringify(data, null, 2)}` },
  ];
}

export type SlurpMessagePromptInput = {
  db: DB;
  // A `SlurpAccount`, not a bare `NoodleAccount`: resolving the creator's Engine source for the
  // schedule needs the source columns, and only the Slurp account carries them.
  creator: SlurpAccount;
  viewer: NoodleAccount;
  history: SlurpMessage[];
  rapport: SlurpRapport;
  subscribed: boolean;
  dmPolicy: SlurpDmPolicy;
  isRequest: boolean;
  /** Stored conversation mood and when it was last written, so silence can heal it first. */
  mood?: number;
  moodUpdatedAt?: string | null;
  /** What the creator already knows about this fan, beyond the last sixteen turns. */
  notes?: SlurpThreadNote[];
  threadState?: SlurpThreadState;
  creatorState?: SlurpCreatorState;
  /** What kind of day the creator is having, already phrased. */
  dayVibe?: string | null;
  coolingOff?: boolean;
  strikes?: number;
  connection: GenerationConnection;
  debugMode?: boolean;
  /** Extra instruction for scheduled or otherwise specialized replies. */
  generationGuidance?: string;
};

/**
 * Assemble everything the model is about to be shown, and stop there.
 *
 * Split out of `generateSlurpMessageReply` so the debug view can render the exact prompt by
 * running the real builder rather than a second copy of it. A reconstruction drifts, and then it
 * reports something the model never received, which is worse than no debug view at all.
 */
export async function buildSlurpMessagePrompt(input: SlurpMessagePromptInput): Promise<{
  messages: ChatMessage[];
  stance: SlurpStance;
  disclosureMode: Parameters<typeof noodlerIdentityInstruction>[0];
  publicIdentity: Parameters<typeof noodlerIdentityInstruction>[1];
}> {
  const slurp = createSlurpStorage(input.db);
  const disclosureMode = input.creator.settings.privacy.identityDisclosure ?? "secret";
  const publicIdentity = await resolveNoodlerPublicIdentity(input.db, input.creator);
  const settings = await slurp.getSettings();
  const source = await slurp.resolveAccountSource(input.creator);
  const characters = createCharactersStorage(input.db);
  const [scheduleContext, recentPostRows] = await Promise.all([
    source ? resolveSlurpCreatorScheduleContext(characters, source, undefined, new Date()) : Promise.resolve(undefined),
    slurp
      .listNoodlerPostsByAccounts([input.creator.id], RECENT_POSTS)
      .then((byAccount) => byAccount.get(input.creator.id) ?? [])
      .catch(() => []),
  ]);
  const availability = source
    ? await resolveSlurpCreatorAvailability(
        characters,
        source,
        undefined,
        new Date(),
        recentPostRows[0]?.createdAt ?? null,
        settings,
      )
    : { online: true, activity: null, minutesUntilOnline: 0 };
  const characterCanon = await resolveNoodlerCharacterCanon(input.db, source, disclosureMode);
  // The fan's direction, and what the creator has posted lately. Both were already stored and
  // neither reached the one prompt where a fan is most likely to mention them.
  const tie = await createSlurpPopulationStorage(input.db)
    .listTiesForCreator(input.creator.id)
    .then((ties) => ties.find((entry) => entry.memberId === input.viewer.id))
    .catch(() => undefined);
  const recentPosts = recentPostRows
    .filter((post) => post.access !== "draft")
    .slice(0, RECENT_POSTS)
    .map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      access: post.access,
      imageUrl: post.imageUrl,
    }));
  const stance = resolveSlurpStance({
    rapportTier: input.rapport.tier,
    rapportScore: input.rapport.score,
    // Healed for the time since it was last written, so a fan who returns a day later is not
    // answered through yesterday's argument.
    moodTone: slurpMoodTone(
      recoverSlurpMood(
        input.mood ?? 0,
        input.moodUpdatedAt ? Math.max(0, (Date.now() - Date.parse(input.moodUpdatedAt)) / 60_000) : 0,
      ),
    ),
    audienceArc: tie ? slurpAudienceArcDescription(tie.audienceArc) : null,
    dayVibe: input.dayVibe ?? null,
    availability,
    subscribed: input.subscribed,
    isRequest: input.isRequest,
    // The audience dial reaches private chat for the first time. It governed comments and
    // reactions only, so a maintainer who chose `unfiltered` still met a uniformly
    // accommodating creator in every DM.
    tone: readSlurpAudienceTone(settings.audienceTone),
    coolingOff: input.coolingOff ?? false,
    strikes: input.strikes ?? 0,
  });
  const messages = buildSlurpMessageChat({
    ...input,
    stance,
    recentPosts,
    availability,
    disclosureMode,
    publicIdentity,
    generationGuidance: [settings.generationGuidance, input.generationGuidance].filter(Boolean).join("\n"),
    scheduleContext,
    characterCanon,
  });
  // The redaction rules travel with the prompt. The answer has to be protected with the same two
  // values the question was built from, or a concealed creator can be unmasked by their own reply.
  return { messages, stance, disclosureMode, publicIdentity, recentPosts };
}

function protectNoteOperation(
  operation: SlurpNoteOperation,
  disclosureMode: Parameters<typeof noodlerIdentityInstruction>[0],
  publicIdentity: Parameters<typeof noodlerIdentityInstruction>[1],
): SlurpNoteOperation | null {
  if (operation.op === "forget" || operation.op === "keep") return operation;
  const text = protectBoundedNoodlerGeneratedText(
    operation.text,
    disclosureMode,
    publicIdentity,
    SLURP_NOTE_MAX_LENGTH,
  );
  if (!text) return null;
  return operation.op === "add" ? { op: "add", text } : { op: "replace", id: operation.id, text };
}

export async function generateSlurpMessageReply(input: SlurpMessagePromptInput): Promise<SlurpGeneratedDmReply> {
  const { messages, stance, disclosureMode, publicIdentity, recentPosts } = await buildSlurpMessagePrompt(input);
  const connections = createConnectionsStorage(input.db);
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
  const debugMode = input.debugMode === true || isDebugAgentsEnabled();
  const response = await provider.chatComplete(messages, {
    model: input.connection.model,
    ...noodleSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.95, topP: 0.95 },
    ),
    maxTokens: clampGenerationMaxOutputTokens({
      provider: input.connection.provider as APIProvider,
      model: input.connection.model,
      maxTokens: 768,
      maxTokensOverride: input.connection.maxTokensOverride,
    }),
    stream: false,
    debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "noodler_dm"),
  });
  const content = response.content ?? "";
  logDebugOverride(
    debugMode,
    "[debug/slurp-message] Model response received (%d characters); content is redacted.",
    content.length,
  );
  const parsed = parseGameJsonish(requireModelAnswer(content, "a direct message"));
  const generated = readSlurpDmReply(Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed);
  const protectedContent = protectBoundedNoodlerGeneratedText(
    generated.content,
    disclosureMode,
    publicIdentity,
    SLURP_MESSAGE_CONTENT_MAX_LENGTH,
  );
  if (!protectedContent) throw new Error("Slurp direct-message generation returned no usable content.");
  return {
    content: protectedContent,
    latitude: stance.latitude,
    canSendImage: stance.canSendImage,
    imageMode: stance.imageMode,
    moodShift: generated.moodShift,
    stateSignals: generated.stateSignals,
    // A note is model output about the player, stored and fed back into a later prompt. That is a
    // loop, so it is redacted and bounded on the way in as well as on the way out.
    remember: generated.remember
      .map((operation) => protectNoteOperation(operation, disclosureMode, publicIdentity))
      .filter((operation): operation is SlurpNoteOperation => Boolean(operation)),
    sharePost: generated.sharePost !== undefined && recentPosts[generated.sharePost] ? generated.sharePost : undefined,
    sharedPost:
      generated.sharePost !== undefined && recentPosts[generated.sharePost] ? recentPosts[generated.sharePost] : null,
    image: generated.image,
    followUp: generated.followUp,
  };
}
