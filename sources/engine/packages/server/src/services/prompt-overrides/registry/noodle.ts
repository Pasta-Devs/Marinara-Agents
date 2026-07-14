// ──────────────────────────────────────────────
// Registered prompt-override keys: Noodle social feed
// ──────────────────────────────────────────────
import type { PromptOverrideKeyDef } from "../types.js";
import { noodleTimelineVoiceDefaultText } from "../../noodle/noodle-prompt.js";

export interface NoodleImagePostCtx extends Record<string, string | number | undefined> {
  authorName: string;
  postContent: string;
  draftPrompt: string;
  userInstructions: string;
  characterDescription: string;
}

export const NOODLE_IMAGE_POST: PromptOverrideKeyDef<NoodleImagePostCtx> = {
  key: "noodle.imagePost",
  label: "Noodle Post Image",
  description:
    "Template that assembles the final image-generation prompt. The default sends the visual idea, appearance notes, and Noodle image directions without the post text or meta-instructions.",
  variables: [
    { name: "authorName", description: "Display name of the Noodle account posting.", example: "Dottore" },
    {
      name: "postContent",
      description: "The Noodle post text, available for custom templates but omitted by the default image prompt.",
      example: "I left one meeting unattended for six minutes and returned to theatrical accusations.",
    },
    {
      name: "draftPrompt",
      description: "The timeline writer's initial image idea for this post.",
      example: 'Meme image: Dottore staring at a ruined lab bench, caption text "six minutes unsupervised" at the top',
    },
    {
      name: "userInstructions",
      description: "Noodle-specific image instructions from Noodle Settings.",
      example:
        "Create either a social-media-ready character image or a meme. Mention build, clothing, appearance, pose, expression, setting, lighting, mood, composition, meme format, and short visible meme text when relevant.",
    },
    {
      name: "characterDescription",
      description: "Optional character appearance or description notes included by Noodle Settings.",
      example: "Character appearance notes:\nDottore's Appearance: tall, slim build, blue hair, red eyes, mask.",
    },
  ],
  defaultBuilder: (ctx) =>
    [ctx.draftPrompt.trim() || `A social-media-ready image posted by ${ctx.authorName}.`, ctx.characterDescription, ctx.userInstructions]
      .map((part) => part.trim())
      .filter(Boolean)
      .join("\n\n"),
  exampleContext: {
    authorName: "Dottore",
    postContent: "I left one meeting unattended for six minutes and returned to theatrical accusations.",
    draftPrompt:
      'Meme image: Dottore staring at a ruined lab bench, caption text "six minutes unsupervised" at the top',
    userInstructions:
      "Create either a social-media-ready character image or a meme. Mention build, clothing, appearance, pose, expression, setting, lighting, mood, composition, meme format, and short visible meme text when relevant.",
    characterDescription:
      "Character appearance notes:\nDottore's Appearance: tall, slim build, blue hair, red eyes, mask.",
  },
};

export interface NoodleTimelineVoiceCtx extends Record<string, string | number | undefined> {
  /** Mirrors the Noodle setting `enableEnhancedTimelineWriting` ("true"/"false"). Only affects the
   *  unedited default text — once a user customizes this override, their text always wins. */
  enhanced: string;
  allowRandomUsers?: string;
}

export const NOODLE_TIMELINE_VOICE: PromptOverrideKeyDef<NoodleTimelineVoiceCtx> = {
  key: "noodle.timelineVoice",
  label: "Noodle Timeline Voice & Tone",
  description:
    "Tone and creative-freedom instructions for Noodle timeline refreshes: how much personality/attitude each account's voice should carry, and how much accounts may banter, joke, or clash with each other. This does not control which structured actions (posts, replies, likes, polls) are allowed or their JSON shape — those rules always stay enforced regardless of this text, so editing it cannot break refresh generation.",
  variables: [],
  defaultBuilder: (ctx) => noodleTimelineVoiceDefaultText(ctx.enhanced === "true", ctx.allowRandomUsers !== "false"),
  exampleContext: { enhanced: "false", allowRandomUsers: "true" },
};
