import type { SlurpPromptBlockOverride } from "../../base/state/slp-state-types";
import type { SlurpPromptBlockDefinition, SlurpPromptDefinition } from "./slp-settings-contract";

export const SLP_PROMPT_GROUP_ORDER = ["writing", "messages", "audience", "profiles", "images", "world"] as const;

const PROMPT_NAMES: Record<string, string> = {
  post: "Creator posts",
  dmReply: "Direct messages",
  commentReply: "Comments and replies",
  fanActivity: "Audience activity",
  stageProfile: "Creator profiles",
  ambientProfile: "Audience profiles",
  publicProfile: "Character profiles",
  arc: "World and stories",
  pendingCommission: "Commission requests",
  pendingQuestion: "Post questions",
  pendingOpener: "First messages",
  pendingDelivery: "Commission delivery",
  fanReply: "Fan replies",
  postGuidance: "Post guidance",
  conversationSchedule: "Conversation schedules",
  invitedPost: "Invited posts",
  reactionBank: "Reusable comments",
  imageInterpretation: "Image interpretation",
  imagePost: "Image prompts",
  garnishAds: "Advertisements",
};

const PROMPT_PURPOSES: Record<string, string> = {
  post: "Plans and writes timeline posts in the Creator's voice.",
  dmReply: "Replies to private messages with the right relationship context.",
  commentReply: "Responds to comments and joins public conversations naturally.",
  fanActivity: "Creates believable activity around Creator content.",
  stageProfile: "Writes the public identity for a managed Creator.",
  ambientProfile: "Creates lightweight profiles for simulated audience members.",
  publicProfile: "Sets up public profiles for existing characters.",
  arc: "Develops continuing events and Creator storylines.",
  pendingCommission: "Responds to new commission requests.",
  pendingQuestion: "Answers questions attached to Creator posts.",
  pendingOpener: "Starts a new private conversation.",
  pendingDelivery: "Writes notes for completed commission deliveries.",
  fanReply: "Writes a fan's next message in a conversation you play as the Creator.",
  postGuidance: "Turns a short direction into usable post guidance.",
  conversationSchedule: "Plans when conversations should continue.",
  invitedPost: "Drafts posts requested through an invitation.",
  reactionBank: "Builds reusable audience reactions.",
  imageInterpretation: "Turns an image idea into provider-ready direction.",
  imagePost: "Assembles the image prompt for a Creator post.",
  garnishAds: "Writes advertisements that fit the simulated feed.",
};

const BLOCK_PURPOSES: Record<string, string> = {
  identity: "Provides the Creator's public identity and voice.",
  creatorIdentity: "Provides the Creator's public identity and voice.",
  relationshipState: "Adds the current relationship and conversation state.",
  recentPosts: "Adds recent content so the result stays varied and continuous.",
  recentContinuity: "Adds recent content so the result stays varied and continuous.",
  task: "Defines what this result should achieve.",
  objective: "Defines what this result should achieve.",
  guidance: "Applies the writing direction shared across Slurp.",
  output: "Defines the response shape Slurp can safely read.",
  outputContract: "Defines the response shape Slurp can safely read.",
  privacy: "Protects private source identity details.",
  safety: "Applies content boundaries and safety rules.",
  continuity: "Keeps the result consistent with recent activity.",
  schedule: "Adds relevant timing and schedule context.",
  image: "Adds the current visual direction.",
  imageDirection: "Adds the current visual direction.",
};

export function promptName(id: string) {
  return PROMPT_NAMES[id] ?? id.replace(/([a-z])([A-Z])/gu, "$1 $2").replace(/^./u, (letter) => letter.toUpperCase());
}

export function promptPurpose(id: string) {
  return PROMPT_PURPOSES[id] ?? "Controls one part of Slurp's content system.";
}

export function promptGroupName(group: SlurpPromptDefinition["group"]) {
  return {
    writing: "Content and writing",
    messages: "Conversations",
    audience: "Audience",
    profiles: "Identity",
    images: "Visuals",
    world: "World and stories",
  }[group];
}

export function promptGroupPurpose(group: SlurpPromptDefinition["group"]) {
  return {
    writing: "Shape what Creators make and how posts read.",
    messages: "Shape private and public conversations.",
    audience: "Shape activity around Creator content.",
    profiles: "Shape Creator and audience identities.",
    images: "Shape visual interpretation and image creation.",
    world: "Shape continuing stories and scheduled context.",
  }[group];
}

export function blockName(id: string) {
  return id.replace(/([a-z])([A-Z])/gu, "$1 $2").replace(/^./u, (letter) => letter.toUpperCase());
}

export function blockPurpose(block: SlurpPromptBlockDefinition) {
  return (
    BLOCK_PURPOSES[block.id] ??
    (block.kind === "required"
      ? "Keeps this recipe safe and gives the model a reliable output contract."
      : block.kind === "context"
        ? "Adds live context when this recipe runs."
        : "Adds editable direction to this recipe.")
  );
}

export function completePromptLayout(
  prompt: SlurpPromptDefinition,
  value: SlurpPromptBlockOverride[] | undefined,
): SlurpPromptBlockOverride[] {
  const known = new Set(prompt.blocks.map((block) => block.id));
  const configured = (value ?? []).filter((block) => known.has(block.id));
  const present = new Set(configured.map((block) => block.id));
  return [...configured, ...prompt.blocks.filter((block) => !present.has(block.id)).map((block) => ({ id: block.id }))];
}

export function promptCustomizationCount(prompt: SlurpPromptDefinition, value: SlurpPromptBlockOverride[] | undefined) {
  if (!value?.length) return 0;
  const defaultOrder = prompt.blocks.map((block) => block.id).join("\n");
  const configuredOrder = completePromptLayout(prompt, value)
    .map((block) => block.id)
    .join("\n");
  const edited = value.filter(
    (block) => block.text !== undefined || block.instructionId !== undefined || block.enabled === false,
  ).length;
  return edited + (configuredOrder === defaultOrder ? 0 : 1);
}

export function blockDefinition(prompt: SlurpPromptDefinition, id: string) {
  return prompt.blocks.find((block) => block.id === id)!;
}
