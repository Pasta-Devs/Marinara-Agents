import {
  slpGeneratedCreatorPostSchema,
  type SlpCreatorGenerationRequest,
} from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import {
  type SlpAccount,
  type SlpCreatorManagedPost,
  type SlpCreatorStageFacts,
  type SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { logDebugOverride } from "../../../lib/logger.js";
import { requireModelAnswer } from "../../base/model/slp-model-answer.js";
import type { ChatMessage } from "../../../services/llm/base-provider.js";
import {
  composeSlurpPromptBlocks,
  type SlurpPromptBlock,
  type SlurpPromptBlockOverrides,
  type SlurpReusablePromptInstruction,
} from "../../base/prompting/slp-prompt-blocks.js";
import { buildSlurpPostTimingContext } from "../../modules/feed/slp-post-timing.js";
import { type SlurpProject } from "../../modules/projects/slp-project.js";
import { slurpProjectChapter, slurpProjectInstruction } from "../../modules/projects/slp-arc-progress.js";
import {
  NOODLER_CONTENT_HARD_MAX_LENGTH,
  type SlpCreatorContentFormat,
} from "../../base/prompting/slp-content-format.js";
import { SLURP_PLATFORM_CONTEXT } from "../../modules/prompting/slp-prompt.js";
import { protectCreatorGeneratedIdentity, type PublicIdentity } from "../../base/identity/slp-identity-protection.js";
import { NOODLER_UNTRUSTED_CONTENT_INSTRUCTION, slpCreatorIdentityInstruction } from "./slp-public-identity.js";

export type FormattedCreatorGenerationRequest = SlpCreatorGenerationRequest & {
  /** The composer asked for an image on this post, whatever the scheduler's image setting is. */
  generateImage?: boolean;
  format?: SlpCreatorContentFormat;
  /** The guided path can ask for a Story outright instead of waiting for the rotation. */
  postType?: "post" | "story";
};

const NOODLER_FORMAT_PROMPTS: Record<SlpCreatorContentFormat, string> = {
  caption:
    "Format: caption. Aim for 40-220 characters in one short creator-feed caption. Go longer only when the moment really calls for it.",
  announcement: "Format: announcement. Aim for 80-600 body characters with the important news first.",
  long_form:
    "Format: long_form. Target 500-2000 body characters with readable paragraphs. Only this format can use long text.",
};

/**
 * Recent posts, including what each one showed.
 *
 * The image prompt used to be left out, so the model could not see that it had described the same
 * desk in the same pose eight times running. It rewrote the caption each time and reinvented an
 * identical picture, because nothing told it what the picture had been.
 */
function formatCreatorPostHistory(posts: SlpCreatorManagedPost[], protect: (value: string) => string): string {
  if (posts.length === 0) return "No previous posts on this Slurp page.";
  return posts
    .slice()
    .reverse()
    .map((post) => {
      const line = `- ${post.createdAt}: ${post.title ? `${protect(post.title)} — ` : ""}${protect(post.content)}`;
      return post.imagePrompt ? `${line}\n  (showed: ${protect(post.imagePrompt)})` : line;
    })
    .join("\n");
}

export type SlurpPostPromptInput = {
  account: Pick<SlpAccount, "displayName" | "handle" | "bio">;
  stagePersonality: string;
  /** The Creator's private content menu. See `slurp-post-guidance.ts`. */
  contentMenu?: string;
  sourceCharacterContext: string;
  /** This Creator's own look and life. See `SlpCreatorStageFacts`. */
  stageFacts?: SlpCreatorStageFacts;
  disclosureMode: SlpIdentityDisclosure;
  publicIdentity: PublicIdentity | null;
  recentPosts: SlpCreatorManagedPost[];
  request: Pick<FormattedCreatorGenerationRequest, "noodlerPostGuide" | "format">;
  allowImagePrompt: boolean;
  /** Automatic image posts return a creative scene plan; Slurp renders the provider prompt. */
  allowScenePlan?: boolean;
  wardrobePrompt?: string | null;
  imageGenerationPrompt: string;
  generationGuidance: string;
  /** The player's ceiling. Formats only set a target; nothing shorter than this is cut. */
  postMaxLength?: number;
  scheduleContext?: string;
  /** The rotating angle for this post. Absent when the player has directed the post themselves. */
  variationInstruction?: string;
  /** From `slurp-post-stance.ts`: who this Creator is today. Absent when today is unremarkable. */
  conditionInstruction?: string;
  /** From `slurp-platform-events.ts`: holidays and site events running today. Absent on a normal day. */
  eventInstruction?: string;
  /**
   * What this post is for, given who can read it: the resolved public or locked guidance from
   * `slurp-post-guidance.ts`. Absent only for a caller that does not know the access yet.
   */
  accessInstruction?: string;
  /** The project this post continues, with that project's own recent posts. Absent for a loose post. */
  project?: { project: SlurpProject; posts: SlpCreatorManagedPost[] };
  generatedAt?: Date;
  publicationTime?: Date;
  /** Matching lorebook entries for this Creator. Absent when lorebook context is off or nothing matched. */
  loreContext?: string;
  promptBlocks?: SlurpPromptBlockOverrides;
  promptInstructions?: SlurpReusablePromptInstruction[];
  /** From `slp-continuity-prompt.ts`: approved notes this Creator may use in a post. */
  continuityInstruction?: string;
  /** From `slp-content-axes.ts`: what this post is for and how it goes out. */
  contentTypeInstruction?: string;
  /** From `slp-production-profile.ts`: how this Creator makes things. */
  productionInstruction?: string;
};

/**
 * The post prompt's blocks, before they are ordered and joined.
 *
 * Split out so Settings can show what a block actually contains without keeping a second copy of
 * the text. A preview built from a copy is a preview that silently stops matching the prompt.
 */
export function buildSlurpPostBlocks(input: SlurpPostPromptInput): SlurpPromptBlock[] {
  const guidance = input.generationGuidance.trim();
  const format = input.request.format ?? "caption";
  const systemBlocks = [
    {
      id: "task",
      kind: "editable" as const,
      text: "You write exactly one post for one Slurp creator page in Marinara Engine.",
    },
    { id: "platform", kind: "required" as const, text: SLURP_PLATFORM_CONTEXT },
    {
      id: "safety",
      kind: "required" as const,
      text: `${NOODLER_UNTRUSTED_CONTENT_INSTRUCTION}\nUse the Slurp stage profile as supplied.`,
    },
    // Bio and stage voice are written once when the Creator is set up. On their own they flatten
    // every Creator into the same register, so the source card is supplied as the person and the
    // stage voice sits on top of it as the performance.
    {
      id: "character",
      kind: "context" as const,
      text: "The source character is who this Creator actually is: take their temperament, register, humour, and interests from it. The stage voice describes how they perform on Slurp and how they treat the people reading, layered over that person, not a replacement for them.",
    },
    // Up to 20,000 characters of free-text user guidance spliced in bare, between two hard rules,
    // with nothing marking where it ends. Long guidance blurred into the disclosure instruction
    // that follows it. The untrusted-content rule above already establishes labelled blocks for
    // user-supplied values; the system message should not be the one place that is abandoned.
    {
      id: "creativeDirection",
      kind: "context" as const,
      optional: true,
      text: guidance ? `## Creative direction\n${guidance}\n## End creative direction` : "",
    },
    {
      id: "identity",
      kind: "required" as const,
      text: slpCreatorIdentityInstruction(input.disclosureMode, input.publicIdentity),
    },
    {
      id: "format",
      kind: "required" as const,
      text: `${NOODLER_FORMAT_PROMPTS[format]} Never exceed ${input.postMaxLength ?? NOODLER_CONTENT_HARD_MAX_LENGTH} characters.`,
    },
    // A public post and a paid post do different jobs, and writing both from one set of
    // instructions made the free feed give away the payoff and the paid feed sell what the reader
    // had already bought. Fenced like the creative direction above, because the text is editable.
    {
      id: "access",
      kind: "context" as const,
      optional: true,
      text: input.accessInstruction?.trim()
        ? `## Who can read this post\n${input.accessInstruction.trim()}\n## End who can read this post`
        : "",
    },
    // Notes written down earlier, as facts to stay consistent with. Never instructions: a line a
    // model wrote into memory must not be able to tell a later model what to do.
    {
      id: "memory",
      kind: "context" as const,
      optional: true,
      text: input.continuityInstruction?.trim() ?? "",
    },
    // What this post is for, as opposed to what it is about. Without it every post is the same
    // kind of post: something happened, here is a picture, here is what it meant.
    {
      id: "contentType",
      kind: "context" as const,
      optional: true,
      text: input.contentTypeInstruction?.trim() ?? "",
    },
    // Unrelated Creators all arrived at the same soft light and the same flattering angle, because
    // the variation gave them different situations and the same production grammar. This is the
    // block that makes one of them shoot on a phone in a messy kitchen and another run a backdrop.
    {
      id: "production",
      kind: "context" as const,
      optional: true,
      text: input.productionInstruction?.trim() ?? "",
    },
    // Tone, mood balance, and the adult flirty lean are supplied by the editable
    // generation guidance (see input.generationGuidance above), not hardcoded here.
    // "Do not reuse their exact wording" was the only anti-repetition rule, and eight different
    // captions about the same desk satisfy it completely. Repetition of situation is what reads as
    // a broken feed, so that is what this constrains.
    {
      id: "continuity",
      kind: "editable" as const,
      text: "Recent posts provide continuity. Do not repeat a recent post's setting, activity, framing, or wardrobe, and do not reuse its wording. If the last few posts happened in one place, this one happens somewhere else.\nEvery post needs a title: a short specific headline of at most 80 characters, never a repeat of the body text.",
    },
    {
      id: "imageDirection",
      kind: "context" as const,
      optional: true,
      text:
        input.allowImagePrompt && input.imageGenerationPrompt.trim()
          ? `Apply these image directions when writing imagePrompt. They are instructions to you, not text to copy into imagePrompt: ${input.imageGenerationPrompt.trim()}`
          : "",
    },
    {
      id: "wardrobe",
      kind: "context" as const,
      optional: true,
      text: input.allowScenePlan ? (input.wardrobePrompt?.trim() ?? "") : "",
    },
    {
      id: "output",
      kind: "required" as const,
      text: `${
        input.allowScenePlan
          ? "Return one JSON object with title, content, and scene. scene must contain wardrobeId, setting, action, expression, and visualDirection. Choose wardrobeId from the supplied Creator wardrobe when one is available; otherwise use null. The scene describes the specific attractive, believable photograph that belongs with this caption. setting and action must make the variation concrete without changing the character, company, camera source, or access level. visualDirection is one short memorable composition, atmosphere, or prop detail—not provider tags, identity, or policy. Do not return imagePrompt or a poll."
          : input.allowImagePrompt
            ? // The old contract asked for "subject, pose, setting, lighting, framing", which is a
              // scene brief. A brief with no gaps in it produces a photograph with no accident in
              // it, and the result reads as a shoot rather than as something a person posted.
              "Return one JSON object with title, content, and imagePrompt. imagePrompt is required and describes the photograph this person actually took with the camera named above — what it caught, not what the moment was. It is a phone picture rather than an advertisement, so it may be plain and unposed, but it must still be a sharp, clearly visible picture. Do not stage it as a studio shoot, and do not add a camera position nobody present could reach. Never return null or an empty imagePrompt, and never put the post text or field names in it. Do not create a poll."
            : "Return one JSON object with title and content only. Do not create a poll or image prompt."
      }\nReturn JSON only. No prose outside the JSON object.`,
    },
  ];
  return systemBlocks;
}

export function buildNoodlerPostMessages(input: SlurpPostPromptInput): ChatMessage[] {
  const protect = (value: string) =>
    protectCreatorGeneratedIdentity(value, input.disclosureMode, input.publicIdentity) ?? "";
  const system = composeSlurpPromptBlocks(
    "post",
    buildSlurpPostBlocks(input),
    input.promptBlocks,
    input.promptInstructions,
  );
  const user = [
    "# Slurp account",
    `Display name: ${protect(input.account.displayName)}`,
    `Handle: @${protect(input.account.handle)}`,
    `Bio: ${protect(input.account.bio) || "No bio provided."}`,
    `Stage voice: ${protect(input.stagePersonality) || "No additional stage voice provided."}`,
    // Stage facts, not a character card. These are what this page is actually made of: the same
    // body in every picture, clothes that are hers, and places she is repeatedly in. Without them
    // the model reinvents an average person each post, which is what made every Creator read the
    // same way.
    ...(input.stageFacts?.appearance?.trim() ? [`Appearance: ${protect(input.stageFacts.appearance)}`] : []),
    ...(input.stageFacts?.wardrobe?.trim() ? [`Usual wardrobe: ${protect(input.stageFacts.wardrobe)}`] : []),
    ...(input.stageFacts?.locations?.trim() ? [`Where her life happens: ${protect(input.stageFacts.locations)}`] : []),
    ...(input.contentMenu?.trim()
      ? [
          `Content menu (private; what this Creator offers and will not do, never quoted): ${protect(input.contentMenu)}`,
        ]
      : []),
    "",
    "# Source character",
    protect(input.sourceCharacterContext) || "No source character is linked to this Creator.",
    "",
    ...(input.loreContext && protect(input.loreContext) ? ["# World lore", protect(input.loreContext), ""] : []),
    // The schedule used to sit unlabelled inside the source card, with the one instruction that
    // refers to it ("that hour and weekday") two sections below. It is a generation input, not a
    // property of the character, so it gets its own header directly above the timing block it
    // belongs with. The `Content format:` line that also lived here is gone: the system prompt
    // already states the format via NOODLER_FORMAT_PROMPTS.
    ...(input.conditionInstruction ? [input.conditionInstruction, ""] : []),
    ...(input.eventInstruction ? ["# Platform events", input.eventInstruction, ""] : []),
    "# Today's schedule",
    protect(input.scheduleContext ?? "") || "No active Conversation Schedule is available for this Creator today.",
    "",
    "# Publication timing",
    buildSlurpPostTimingContext(input.generatedAt ?? new Date(), input.publicationTime),
    "",
    "# Recent Slurp posts",
    formatCreatorPostHistory(input.recentPosts, protect),
    ...(input.variationInstruction ? ["", input.variationInstruction] : []),
    ...(input.project
      ? [
          "",
          slurpProjectInstruction({
            title: protect(input.project.project.title),
            direction: protect(input.project.project.direction),
            // Protected like every other supplied value: a Secret Creator who typed their city
            // into a direction field must not have it read back out through the project block.
            chapter: protect(slurpProjectChapter(input.project.project) ?? "") || null,
            tone: protect(input.project.project.tone),
            twist: protect(input.project.project.twist),
            // Only until the poll post publishes; after that the choice waits for its votes.
            choice: input.project.project.pollPostId
              ? null
              : (() => {
                  const choice = input.project.project.choices[input.project.project.chapter];
                  return choice
                    ? {
                        question: protect(choice.question),
                        options: choice.options.map((option) => protect(option.label)),
                      }
                    : null;
                })(),
            partners: input.project.project.partnerNames ?? [],
            history: input.project.posts
              .slice()
              .reverse()
              .map((post) => `${post.title ? `${protect(post.title)} — ` : ""}${protect(post.content)}`),
          }),
        ]
      : []),
    ...(input.request.noodlerPostGuide ? ["", "# Post direction", protect(input.request.noodlerPostGuide)] : []),
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

const SLP_CREATOR_FALLBACK_TITLE_MAX_LENGTH = 80;

/** Title for posts whose model dropped the field: the first sentence, trimmed to a headline. */
export function slpCreatorTitleFromContent(content: string): string {
  const firstSentence =
    content
      .trim()
      .split(/(?<=[.!?])\s|\n/u)[0]
      ?.trim() || content.trim();
  if (firstSentence.length <= SLP_CREATOR_FALLBACK_TITLE_MAX_LENGTH)
    return firstSentence.replace(/[.!?,;:\s]+$/u, "") || firstSentence;
  // Leave room for the trailing ellipsis so the result never exceeds the stated max length.
  const clipped = firstSentence.slice(0, SLP_CREATOR_FALLBACK_TITLE_MAX_LENGTH - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped).replace(/[.!?,;:\s]+$/u, "")}…`;
}

export function parseCreatorPost(content: string) {
  const parsed = parseGameJsonish(requireModelAnswer(content, "a creator post"));
  // Many LLMs (especially local models via Ollama/KoboldCPP) wrap the expected object
  // in an array ([{"title":...}]) regardless of the prompt instructing "one JSON object".
  // Unwrap the common single-item array response while preserving validation for other shapes.
  return slpGeneratedCreatorPostSchema.parse(Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed);
}

/**
 * One post from the model, with the single correction turn that malformed JSON earns. Returns the
 * messages actually sent, so the caller records the prompt that produced the answer.
 */
export async function completeSlurpCreatorPost(
  provider: { chatComplete: (messages: ChatMessage[], options: never) => Promise<{ content?: string | null }> },
  messages: ChatMessage[],
  completionOptions: object,
  {
    askModelForImagePrompt,
    askModelForScene,
    debugMode,
  }: { askModelForImagePrompt: boolean; askModelForScene?: boolean; debugMode: boolean },
) {
  let sentMessages: ChatMessage[] = messages;
  let attempts = 1;
  let response = await provider.chatComplete(messages, completionOptions as never);
  let content = response.content ?? "";
  logDebugOverride(
    debugMode,
    "[debug/slurp] Model response attempt 1 received (%d characters); content is redacted.",
    content.length,
  );
  let generated: ReturnType<typeof parseCreatorPost>;
  try {
    generated = parseCreatorPost(content);
  } catch {
    // Automatic posts used to get one attempt where a foreground post got two, so a scheduled post
    // failed outright on malformed output that a manual post recovered from — and the slot was lost
    // with the first call already paid for. The correction turn reuses the admission this run was
    // already granted and only fires on the failure path, so both paths now recover the same way.
    const correctionMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content },
      {
        role: "user",
        content: askModelForScene
          ? "The response was not one valid Slurp-post JSON object. Return exactly one object with title, content, and scene. scene must contain wardrobeId, setting, action, expression, and visualDirection. Do not include imagePrompt or a poll. Return JSON only."
          : askModelForImagePrompt
            ? "The response was not one valid Slurp-post JSON object. Return exactly one object with title, content, and imagePrompt. title and imagePrompt must both be non-empty. Do not include a poll. Return JSON only."
            : "The response was not one valid Slurp-post JSON object. Return exactly one object with title and content only. Do not include a poll or image prompt. Return JSON only.",
      },
    ];
    logDebugOverride(
      debugMode,
      "[debug/slurp] Correction prompt prepared with %d messages; private prompt content is redacted.",
      correctionMessages.length,
    );
    sentMessages = correctionMessages;
    attempts = 2;
    response = await provider.chatComplete(correctionMessages, completionOptions as never);
    content = response.content ?? "";
    logDebugOverride(
      debugMode,
      "[debug/slurp] Model response attempt 2 received (%d characters); content is redacted.",
      content.length,
    );
    generated = parseCreatorPost(content);
  }
  return { generated, content, sentMessages, attempts };
}
