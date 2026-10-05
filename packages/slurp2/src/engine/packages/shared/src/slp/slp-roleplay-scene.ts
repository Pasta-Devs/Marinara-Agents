/**
 * Roleplay scenes from a DM thread (docs/SCENES.md).
 *
 * Slurp writes the scene itself and hands the plan to the Engine, which runs it as an ordinary scene
 * chat (capability API 1.66). Not the sign-up role-play in `slp-scene.ts`: that one never leaves Slurp.
 */
import { z } from "zod";

/**
 * How far a finished scene may travel inside Slurp. Chosen per scene by the planner, changeable by
 * the player before the start and on the recap afterwards.
 *
 * - `none`: the scene stays out of Slurp; the thread only notes that it ended. The player's choice.
 * - `private`: only this thread knows it happened.
 * - `hint`: the Creator may allude to it elsewhere, never with details.
 * - `public`: it may become something she posts about.
 */
export const SLP_SCENE_REACHES = ["none", "private", "hint", "public"] as const;
export type SlpSceneReach = (typeof SLP_SCENE_REACHES)[number];
export const slpSceneReachSchema = z.enum(SLP_SCENE_REACHES);

/**
 * This scene's own settings, sent to the Engine as `packageData` and handed back to the claim and the
 * release (capability API 1.66): whether the scene locks the thread and keeps the Creator busy, and
 * how far its recap travels.
 */
export const slpSceneSettingsSchema = z.object({
  lock: z.boolean().catch(true),
  reach: slpSceneReachSchema.catch("private"),
});
export type SlpSceneSettings = z.infer<typeof slpSceneSettingsSchema>;

export function readSlpSceneSettings(value: unknown): SlpSceneSettings {
  return slpSceneSettingsSchema.parse(value && typeof value === "object" ? value : {});
}

/** The plan the model writes. The Engine's scene plan fields, plus the scene's settings. */
export const slpScenePlanSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(1200),
  scenario: z.string().trim().min(1).max(3000),
  firstMessage: z.string().trim().min(1).max(6000),
  systemPrompt: z.string().trim().min(1).max(4000),
  rating: z.enum(["sfw", "nsfw"]),
  relationshipHistory: z.string().trim().max(1500).default(""),
  participationGuide: z.string().trim().max(400).default(""),
  reach: z.enum(["private", "hint", "public"]),
  lock: z.boolean().default(true),
});
export type SlpScenePlan = z.infer<typeof slpScenePlanSchema>;

export const slpScenePlanRequestSchema = z.object({
  personaId: z.string().trim().min(1),
  /** What the player wants, in their words. Empty lets the thread decide. */
  idea: z.string().trim().max(600).default(""),
  /** An invite the Creator sent: the scene follows her pitch. */
  inviteMessageId: z.string().trim().min(1).optional(),
});
export type SlpScenePlanRequest = z.infer<typeof slpScenePlanRequestSchema>;

/** What the start sheet shows and passes to the Engine's `startScene`. */
export type SlpScenePlanResponse = {
  plan: Omit<SlpScenePlan, "reach" | "lock"> & { background: null; characterIds: string[] };
  /** The planner's settings for this scene; the start sheet may change them before `startScene`. */
  settings: SlpSceneSettings;
  initiatorCharacterId: string | null;
  initiatorName: string;
};

export const slpSceneReachRequestSchema = z.object({
  personaId: z.string().trim().min(1),
  reach: slpSceneReachSchema,
});

/** A scene line in a DM thread, on the message's `metadata.scene`. */
export type SlpSceneLine =
  | { kind: "recap"; sceneChatId: string; title: string; summary: string; reach: SlpSceneReach }
  /** Ended without a recap: discarded, deleted, converted, or concluded and kept out of Slurp. */
  | { kind: "ended"; sceneChatId: string; outcome: "concluded" | "abandoned" | "deleted" | "converted" }
  | { kind: "invite"; pitch: string; state: "open" | "accepted" | "declined" };

export function readSlpSceneLine(metadata: Record<string, unknown> | null | undefined): SlpSceneLine | null {
  const scene = metadata?.scene;
  if (!scene || typeof scene !== "object") return null;
  const line = scene as Record<string, unknown>;
  if (line.kind === "recap" && typeof line.summary === "string")
    return {
      kind: "recap",
      sceneChatId: String(line.sceneChatId ?? ""),
      title: String(line.title ?? ""),
      summary: line.summary,
      reach: slpSceneReachSchema.catch("private").parse(line.reach),
    };
  if (line.kind === "ended")
    return {
      kind: "ended",
      sceneChatId: String(line.sceneChatId ?? ""),
      outcome:
        line.outcome === "concluded" || line.outcome === "converted" || line.outcome === "deleted"
          ? line.outcome
          : "abandoned",
    };
  if (line.kind === "invite" && typeof line.pitch === "string")
    return {
      kind: "invite",
      pitch: line.pitch,
      state: line.state === "accepted" ? "accepted" : line.state === "declined" ? "declined" : "open",
    };
  return null;
}
