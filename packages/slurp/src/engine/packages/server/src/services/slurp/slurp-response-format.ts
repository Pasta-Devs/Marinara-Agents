import { isOpenAIGpt56Model } from "@marinara-engine/shared";

const NOODLE_POST_HARD_MAX_LENGTH = 4000;
const NOODLE_REPLY_HARD_MAX_LENGTH = 2000;
const NOODLER_TITLE_HARD_MAX_LENGTH = 200;

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
          content: { type: "string", maxLength: NOODLE_POST_HARD_MAX_LENGTH },
          imagePrompt: nullableString,
          attachGalleryImage: { type: "boolean" },
          poll: pollSchema,
        },
        required: [
          "tempId",
          "authorHandle",
          "content",
          "imagePrompt",
          "attachGalleryImage",
          "poll",
        ],
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
          type: { type: "string", enum: ["like", "repost", "reply", "vote"] },
          content: { type: ["string", "null"], maxLength: NOODLE_REPLY_HARD_MAX_LENGTH },
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

function noodlerPostSchema(allowImagePrompt: boolean, contentMaxLength: number) {
  return {
    type: "object",
    properties: {
      // Every NoodleR post carries a title, so the schema requires a non-empty string.
      title: { type: "string", minLength: 1, maxLength: NOODLER_TITLE_HARD_MAX_LENGTH },
      content: {
        type: "string",
        maxLength: Math.min(contentMaxLength, NOODLE_POST_HARD_MAX_LENGTH),
      },
      // With images enabled the prompt is mandatory: a nullable field made models skip images.
      ...(allowImagePrompt
        ? { imagePrompt: { type: "string", minLength: 1, maxLength: NOODLE_REPLY_HARD_MAX_LENGTH } }
        : {}),
    },
    required: allowImagePrompt
      ? ["title", "content", "imagePrompt"]
      : ["title", "content"],
    additionalProperties: false,
  } as const;
}

const noodlerProfileSchema = {
  type: "object",
  properties: {
    displayName: { type: "string" },
    handle: { type: "string" },
    bio: { type: "string" },
    stagePersonality: { type: "string" },
    disclosureMode: { type: "string", enum: ["open", "hinted", "secret"] },
  },
  required: [
    "displayName",
    "handle",
    "bio",
    "stagePersonality",
    "disclosureMode",
  ],
  additionalProperties: false,
} as const;

const noodlerReplySchema = {
  type: "object",
  properties: { content: { type: "string", maxLength: NOODLE_REPLY_HARD_MAX_LENGTH } },
  required: ["content"],
  additionalProperties: false,
} as const;

const noodlerFanActivitySchema = {
  type: "object",
  properties: {
    actorHandle: { type: "string" },
    creatorAccountId: { type: "string" },
    targetPostId: { type: "string" },
    type: { type: "string", enum: ["like", "reply", "repost"] },
    content: nullableString,
  },
  required: [
    "actorHandle",
    "creatorAccountId",
    "targetPostId",
    "type",
    "content",
  ],
  additionalProperties: false,
} as const;

export function noodleResponseFormat(
  model: string,
  kind:
    | "timeline"
    | "profiles"
    | "noodler_post"
    | "noodler_profile"
    | "noodler_reply"
    | "noodler_fan_activity",
  options: { allowImagePrompt?: boolean; contentMaxLength?: number } = {},
): { type: string; [key: string]: unknown } {
  if (!isOpenAIGpt56Model(model)) return { type: "json_object" };
  const schema =
    kind === "timeline"
      ? timelineSchema
      : kind === "profiles"
        ? profilesSchema
        : kind === "noodler_profile"
          ? noodlerProfileSchema
          : kind === "noodler_reply"
            ? noodlerReplySchema
            : kind === "noodler_fan_activity"
              ? {
                  type: "object",
                  properties: {
                    activities: {
                      type: "array",
                      items: noodlerFanActivitySchema,
                    },
                  },
                  required: ["activities"],
                  additionalProperties: false,
                }
              : noodlerPostSchema(
                  options.allowImagePrompt === true,
                  options.contentMaxLength ?? NOODLE_POST_HARD_MAX_LENGTH,
                );
  return {
    type: "json_schema",
    name:
      kind === "timeline"
        ? "noodle_timeline"
        : kind === "profiles"
          ? "noodle_profiles"
          : kind === "noodler_profile"
            ? "noodler_profile"
            : kind === "noodler_reply"
              ? "noodler_reply"
              : kind === "noodler_fan_activity"
                ? "noodler_fan_activity"
                : "noodler_post",
    schema,
    strict: true,
  };
}
