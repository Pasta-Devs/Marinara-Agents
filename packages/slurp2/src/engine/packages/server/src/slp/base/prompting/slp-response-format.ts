import { isOpenAIGpt56Model } from "@marinara-engine/shared";

const SLP_POST_HARD_MAX_LENGTH = 4000;
const SLP_REPLY_HARD_MAX_LENGTH = 2000;
const SLP_CREATOR_TITLE_HARD_MAX_LENGTH = 200;

export const NOODLE_JSON_OUTPUT_HEADING = "# JSON Output Format";

const nullableString = { type: ["string", "null"] } as const;
const nullableInteger = { type: ["integer", "null"] } as const;

const pollSchema = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
  ],
} as const;

const timelineSchema = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tempId: { type: "string" },
          authorHandle: { type: "string" },
          content: { type: "string", maxLength: SLP_POST_HARD_MAX_LENGTH },
          imagePrompt: nullableString,
          attachGalleryImage: { type: "boolean" },
          poll: pollSchema,
        },
        required: ["tempId", "authorHandle", "content", "imagePrompt", "attachGalleryImage", "poll"],
        additionalProperties: false,
      },
    },
    interactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          actorHandle: { type: "string" },
          targetTempId: nullableString,
          targetPostId: nullableString,
          parentInteractionId: nullableString,
          type: { type: "string", enum: ["like", "reply", "vote"] },
          content: { type: ["string", "null"], maxLength: SLP_REPLY_HARD_MAX_LENGTH },
          pollOptionIndex: nullableInteger,
        },
        required: [
          "actorHandle",
          "targetTempId",
          "targetPostId",
          "parentInteractionId",
          "type",
          "content",
          "pollOptionIndex",
        ],
        additionalProperties: false,
      },
    },
    follows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          actorHandle: { type: "string" },
          targetHandle: { type: "string" },
        },
        required: ["actorHandle", "targetHandle"],
        additionalProperties: false,
      },
    },
  },
  required: ["posts", "interactions", "follows"],
  additionalProperties: false,
} as const;

const profilesSchema = {
  type: "object",
  properties: {
    profiles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          entityId: { type: "string" },
          name: { type: "string" },
          handle: { type: "string" },
          bio: { type: "string" },
          location: { type: "string" },
        },
        required: ["entityId", "name", "handle", "bio", "location"],
        additionalProperties: false,
      },
    },
  },
  required: ["profiles"],
  additionalProperties: false,
} as const;

function slpCreatorPostSchema(allowImagePrompt: boolean, allowScenePlan: boolean, contentMaxLength: number) {
  return {
    type: "object",
    properties: {
      // Every NoodleR post carries a title, so the schema requires a non-empty string.
      title: { type: "string", minLength: 1, maxLength: SLP_CREATOR_TITLE_HARD_MAX_LENGTH },
      content: {
        type: "string",
        maxLength: Math.min(contentMaxLength, SLP_POST_HARD_MAX_LENGTH),
      },
      // With images enabled the prompt is mandatory: a nullable field made models skip images.
      ...(allowImagePrompt
        ? { imagePrompt: { type: "string", minLength: 1, maxLength: SLP_REPLY_HARD_MAX_LENGTH } }
        : {}),
      ...(allowScenePlan
        ? {
            scene: {
              type: "object",
              properties: {
                wardrobeId: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
                setting: { type: "string", maxLength: 500 },
                action: { type: "string", maxLength: 500 },
                expression: { type: "string", maxLength: 300 },
                visualDirection: { type: "string", maxLength: 500 },
                outfit: { type: "string", maxLength: 300 },
              },
              required: ["wardrobeId", "setting", "action", "expression", "visualDirection", "outfit"],
              additionalProperties: false,
            },
          }
        : {}),
    },
    required: allowScenePlan
      ? ["title", "content", "scene"]
      : allowImagePrompt
        ? ["title", "content", "imagePrompt"]
        : ["title", "content"],
    additionalProperties: false,
  } as const;
}

const slpCreatorProfileSchema = {
  type: "object",
  properties: {
    displayName: { type: "string" },
    handle: { type: "string" },
    bio: { type: "string" },
    stagePersonality: { type: "string" },
    gender: { anyOf: [{ type: "null" }, { type: "string", enum: ["male", "female", "other"] }] },
    tags: { type: "array", maxItems: 8, items: { type: "string" } },
  },
  required: ["displayName", "handle", "bio", "stagePersonality", "gender", "tags"],
  additionalProperties: false,
} as const;

const noodlerReplySchema = {
  type: "object",
  properties: { content: { type: "string", maxLength: SLP_REPLY_HARD_MAX_LENGTH } },
  required: ["content"],
  additionalProperties: false,
} as const;

/**
 * A direct-message reply.
 *
 * Separate from `noodlerReplySchema` because a DM carries two things a comment reply does not: how
 * the creator now feels about the conversation, and anything about this fan worth keeping. Both
 * ride the reply that already runs, so neither costs an extra call.
 *
 * `strict` requires every property to be listed in `required`, so the model always answers all
 * three fields. The parser still treats the two new ones as optional, because a connection that
 * does not support json_schema returns whatever it likes.
 */
const slpCreatorDmSchema = {
  type: "object",
  properties: {
    content: { type: "string", maxLength: SLP_REPLY_HARD_MAX_LENGTH },
    moodShift: { type: "string", enum: ["up", "same", "down", "sharp_down"] },
    remember: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["add", "replace", "forget", "keep"] },
          id: { type: ["string", "null"] },
          text: { type: ["string", "null"], maxLength: 160 },
        },
        required: ["op", "id", "text"],
        additionalProperties: false,
      },
    },
    stateSignals: {
      type: "array",
      maxItems: 3,
      items: {
        type: "string",
        enum: [
          "fan_shared_personal_fact",
          "fan_remembered_creator_detail",
          "fan_gave_respectful_compliment",
          "fan_gave_welcome_adult_attention",
          "fan_ignored_creator_question",
          "fan_pushed_after_refusal",
          "fan_requested_free_content",
          "fan_paid_for_content",
          "fan_completed_commission",
          "fan_returned_after_silence",
          "fan_mentioned_another_creator",
          "fan_apologized",
          "fan_broke_a_promise",
        ],
      },
    },
    // The prompt asks for these three too. Strict schemas forbid any field they do not list, so on
    // a json_schema connection the Creator could never share a post, send a picture, or promise one.
    sharePost: { type: ["integer", "null"] },
    image: {
      anyOf: [
        {
          type: "object",
          properties: { prompt: { type: "string" }, caption: { type: ["string", "null"] } },
          required: ["prompt", "caption"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    followUp: {
      anyOf: [
        {
          type: "object",
          properties: {
            type: { type: "string", enum: ["reminder", "promise_delivery", "task_update", "check_in", "recurring"] },
            timing: { type: "string" },
            count: { type: "integer" },
            reason: { type: "string" },
            context: { type: ["string", "null"] },
          },
          required: ["type", "timing", "count", "reason", "context"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
  },
  required: ["content", "moodShift", "remember", "stateSignals", "sharePost", "image", "followUp"],
  additionalProperties: false,
} as const;

const slpCreatorFanActivitySchema = {
  type: "object",
  properties: {
    actorHandle: { type: "string" },
    creatorAccountId: { type: "string" },
    targetPostId: { type: "string" },
    type: { type: "string", enum: ["like", "reply"] },
    content: nullableString,
  },
  required: ["actorHandle", "creatorAccountId", "targetPostId", "type", "content"],
  additionalProperties: false,
} as const;

export function slpResponseFormat(
  model: string,
  kind:
    | "timeline"
    | "profiles"
    | "noodler_post"
    | "noodler_profile"
    | "noodler_reply"
    | "noodler_dm"
    | "noodler_fan_activity",
  options: { allowImagePrompt?: boolean; allowScenePlan?: boolean; contentMaxLength?: number } = {},
): { type: string; [key: string]: unknown } {
  if (!isOpenAIGpt56Model(model)) return { type: "json_object" };
  const schema =
    kind === "timeline"
      ? timelineSchema
      : kind === "profiles"
        ? profilesSchema
        : kind === "noodler_profile"
          ? slpCreatorProfileSchema
          : kind === "noodler_reply"
            ? noodlerReplySchema
            : kind === "noodler_dm"
              ? slpCreatorDmSchema
              : kind === "noodler_fan_activity"
                ? {
                    type: "object",
                    properties: {
                      activities: {
                        type: "array",
                        items: slpCreatorFanActivitySchema,
                      },
                    },
                    required: ["activities"],
                    additionalProperties: false,
                  }
                : slpCreatorPostSchema(
                    options.allowImagePrompt === true,
                    options.allowScenePlan === true,
                    options.contentMaxLength ?? SLP_POST_HARD_MAX_LENGTH,
                  );
  return {
    type: "json_schema",
    name:
      kind === "timeline"
        ? "slurp_timeline"
        : kind === "profiles"
          ? "slurp_profiles"
          : kind === "noodler_profile"
            ? "slurp_profile"
            : kind === "noodler_reply"
              ? "slurp_reply"
              : kind === "noodler_dm"
                ? "slurp_dm"
                : kind === "noodler_fan_activity"
                  ? "slurp_fan_activity"
                  : "slurp_post",
    schema,
    strict: true,
  };
}
