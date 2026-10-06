/**
 * The role-play Creator sign-up: one scene core, roles as data.
 *
 * The player plays a part (Slurp Support, a friend) while the model voices the newcomer, and each
 * exchange returns the next lines plus a small patch for the page draft. The client owns the draft,
 * the locks and the undo; the server only writes lines and proposes a patch. Both sides need the
 * preset, moment and action ids and the turn shape, so they live here.
 */
import { z } from "zod";

export const SLP_SCENE_PRESETS = ["support", "friend", "seat"] as const;
export type SlpScenePreset = (typeof SLP_SCENE_PRESETS)[number];

/**
 * The moments each preset walks through, in order. Support asks one question after another; the
 * friend and the creator seat share the friend's evening. Moments can be skipped or revisited.
 */
export const SLP_SCENE_MOMENTS = {
  support: ["name", "about", "look", "voice", "limits", "review"],
  friend: ["arrival", "name", "shoot", "bio", "limits", "firstPost"],
  seat: ["arrival", "name", "shoot", "bio", "limits", "firstPost"],
} as const satisfies Record<SlpScenePreset, readonly string[]>;
export type SlpSceneMoment = (typeof SLP_SCENE_MOMENTS)[SlpScenePreset][number];
export const SLP_SCENE_ALL_MOMENTS = [...new Set(Object.values(SLP_SCENE_MOMENTS).flat())] as readonly SlpSceneMoment[];

/** Suggested actions per preset. The server holds what each one means; the client holds the label. */
export const SLP_SCENE_ACTIONS = {
  support: ["askName", "askAbout", "askLook", "askVoice", "askLimits", "joke", "stamp"],
  friend: ["suggestName", "askOutfit", "helpBio", "askLimits", "pickFirstPost", "hypeUp", "lookTogether", "tease"],
  seat: ["bolder", "askOutfit", "helpBio", "askLimits", "pickFirstPost", "hypeUp", "lookTogether", "tease"],
} as const satisfies Record<SlpScenePreset, readonly string[]>;
export type SlpSceneActionId = (typeof SLP_SCENE_ACTIONS)[SlpScenePreset][number];
export const SLP_SCENE_ALL_ACTIONS = [
  ...new Set(Object.values(SLP_SCENE_ACTIONS).flat()),
] as readonly SlpSceneActionId[];

/** Page fields a turn may change. Text fields plus gender, tags and the limits the moment sets. */
export const SLP_SCENE_TEXT_FIELDS = [
  "displayName",
  "handle",
  "bio",
  "stagePersonality",
  "appearance",
  "wardrobe",
  "locations",
  "turnOns",
  "hardNoes",
] as const;
export const SLP_SCENE_FIELDS = [...SLP_SCENE_TEXT_FIELDS, "gender", "tags", "spice"] as const;
export type SlpSceneField = (typeof SLP_SCENE_FIELDS)[number];

/** How far this Creator goes on the page. Saved with the Creator's strategy until a real level exists. */
export const SLP_SCENE_SPICE = ["flirty", "suggestive", "explicit"] as const;
export type SlpSceneSpice = (typeof SLP_SCENE_SPICE)[number];

/** The same limits as the stage profile schema; the two limits fields share the strategy text. */
export const SLP_SCENE_FIELD_LIMITS: Record<(typeof SLP_SCENE_TEXT_FIELDS)[number], number> = {
  displayName: 120,
  handle: 40,
  bio: 500,
  stagePersonality: 1000,
  appearance: 2000,
  wardrobe: 2000,
  locations: 2000,
  turnOns: 300,
  hardNoes: 300,
};

export type SlpSceneDraft = {
  displayName: string;
  handle: string;
  bio: string;
  stagePersonality: string;
  appearance: string;
  wardrobe: string;
  locations: string;
  turnOns: string;
  hardNoes: string;
  gender: "male" | "female" | "other" | null;
  tags: string[];
  spice: SlpSceneSpice | null;
};
export type SlpScenePatch = Partial<SlpSceneDraft>;

export const SLP_SCENE_SPEAKERS = ["host", "newcomer"] as const;
export type SlpSceneSpeaker = (typeof SLP_SCENE_SPEAKERS)[number];
export const SLP_SCENE_LINE_MAX = 1200;
/** How much of the conversation one turn sends back. Older lines are already in the draft. */
export const SLP_SCENE_TRANSCRIPT_MAX = 40;

const slpSceneLineSchema = z
  .object({ speaker: z.enum(SLP_SCENE_SPEAKERS), text: z.string().trim().min(1).max(SLP_SCENE_LINE_MAX) })
  .strict();
export type SlpSceneLine = z.infer<typeof slpSceneLineSchema>;

const sceneText = (field: (typeof SLP_SCENE_TEXT_FIELDS)[number]) => z.string().max(SLP_SCENE_FIELD_LIMITS[field]);
const slpSceneDraftSchema = z
  .object({
    displayName: sceneText("displayName"),
    handle: sceneText("handle"),
    bio: sceneText("bio"),
    stagePersonality: sceneText("stagePersonality"),
    appearance: sceneText("appearance"),
    wardrobe: sceneText("wardrobe"),
    locations: sceneText("locations"),
    turnOns: sceneText("turnOns"),
    hardNoes: sceneText("hardNoes"),
    gender: z.enum(["male", "female", "other"]).nullable(),
    tags: z.array(z.string().max(40)).max(12),
    spice: z.enum(SLP_SCENE_SPICE).nullable(),
  })
  .partial();

export const slpSceneTurnRequestSchema = z
  .object({
    preset: z.enum(SLP_SCENE_PRESETS),
    /** The Engine character or persona the newcomer is made from. */
    sourceAccountId: z.string().min(1).max(64),
    /** The seat preset: the existing Creator who helps. */
    helperCreatorId: z.string().min(1).max(64).optional(),
    disclosureMode: z.enum(["open", "hinted", "secret"]),
    moment: z.enum(SLP_SCENE_ALL_MOMENTS as [SlpSceneMoment, ...SlpSceneMoment[]]),
    action: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("say"), text: z.string().trim().min(1).max(SLP_SCENE_LINE_MAX) }).strict(),
      z
        .object({
          kind: z.literal("suggest"),
          id: z.enum(SLP_SCENE_ALL_ACTIONS as [SlpSceneActionId, ...SlpSceneActionId[]]),
        })
        .strict(),
      z.object({ kind: z.literal("continue") }).strict(),
      z.object({ kind: z.literal("open") }).strict(),
    ]),
    transcript: z.array(slpSceneLineSchema).max(SLP_SCENE_TRANSCRIPT_MAX).default([]),
    draft: slpSceneDraftSchema.default({}),
    locked: z.array(z.enum(SLP_SCENE_FIELDS)).max(SLP_SCENE_FIELDS.length).default([]),
    /** The player's steer for the whole session ("keep it casual"). Never written into a line. */
    direction: z.string().trim().max(300).default(""),
    /** R6: the newcomer is a Creator already on Slurp, back to fill in what their page is missing. */
    updating: z.boolean().default(false),
    connectionId: z.string().min(1).optional(),
  })
  .strict()
  .refine((input) => input.preset !== "seat" || Boolean(input.helperCreatorId), {
    message: "Pick the Creator who helps.",
    path: ["helperCreatorId"],
  });
export type SlpSceneTurnRequest = z.infer<typeof slpSceneTurnRequestSchema>;
export type SlpSceneAction = SlpSceneTurnRequest["action"];

export type SlpSceneTurnResponse = {
  lines: SlpSceneLine[];
  patch: SlpScenePatch;
  /** The model thinks this moment has what it needs; the client may move on. */
  momentDone: boolean;
};

/** Keep the transcript as the new Creator's first DM thread. */
export const slpSceneKeepRequestSchema = z
  .object({
    preset: z.enum(SLP_SCENE_PRESETS),
    creatorAccountId: z.string().min(1).max(64),
    viewerPersonaId: z.string().min(1).max(64),
    /** Shown above the host's lines when the player did not write them as themselves. */
    hostName: z.string().trim().max(120).default(""),
    lines: z.array(slpSceneLineSchema).min(1).max(120),
  })
  .strict();
export type SlpSceneKeepRequest = z.infer<typeof slpSceneKeepRequestSchema>;
