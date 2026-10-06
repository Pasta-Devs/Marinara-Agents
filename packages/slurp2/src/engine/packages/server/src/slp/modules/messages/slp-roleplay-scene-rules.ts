/**
 * Pure rules for roleplay scenes from a DM thread (docs/SCENES.md): what the scene reads from the
 * thread, and the lines it leaves behind.
 */
import type { SlpSceneLine, SlpSceneReach } from "../../../../../shared/src/slp/slp-roleplay-scene.js";

type TranscriptMessage = {
  role: "viewer" | "creator";
  kind: string;
  content: string;
  imageUrl: string | null;
  price: number;
  unlockedAt: string | null;
  metadata: Record<string, unknown>;
};

/**
 * The thread as the scene sees it, oldest first. What a fan pays for never travels: a locked message
 * is named, not quoted, as in the Engine chat bridge. Scene lines and desk rows are not conversation.
 */
export function slpSceneTranscript(
  history: readonly TranscriptMessage[],
  names: { creator: string; fan: string },
  limit = 30,
): Array<{ speaker: string; content: string }> {
  if (limit <= 0) return [];
  const lines: Array<{ speaker: string; content: string }> = [];
  for (const message of history) {
    if (message.metadata?.scene || message.metadata?.deskNote || message.metadata?.deskNotice) continue;
    const speaker = message.role === "creator" ? names.creator : names.fan;
    const content =
      message.kind === "tip"
        ? `(tipped ${message.price} coins)`
        : message.kind === "ppv"
          ? message.unlockedAt
            ? `(sent paid content, unlocked) ${message.content}`.trim()
            : "(sent locked paid content)"
          : message.content.trim() || (message.imageUrl ? "(sent a picture)" : "");
    if (content) lines.push({ speaker, content: content.slice(0, 1200) });
  }
  return lines.slice(-limit);
}

/** The `metadata.scene` a recap line carries. */
export function slpSceneRecapLine(input: {
  sceneChatId: string;
  title: string;
  summary: string;
  reach: SlpSceneReach;
}): SlpSceneLine {
  return {
    kind: "recap",
    sceneChatId: input.sceneChatId,
    title: input.title.replace(/^Scene:\s*/u, "").slice(0, 80),
    summary: input.summary.trim().slice(0, 2400),
    reach: input.reach,
  };
}

/**
 * How far the recap travels in the continuity ledger. Reality is always `roleplay`: a scene is never
 * literally Slurp history unless the player promotes it.
 */
export function slpSceneAudienceScope(reach: SlpSceneReach): "thread_private" | "creator_private" | "creator_public" {
  return reach === "public" ? "creator_public" : reach === "hint" ? "creator_private" : "thread_private";
}

/** Days between two invites from the same Creator in one thread. */
export const SLP_SCENE_INVITE_GAP_DAYS = 3;

/**
 * Whether the Creator may pitch a scene in this reply: no invite of hers is still open, and the last
 * one is old enough. The model decides whether she wants to; this only keeps it rare.
 */
export function slpSceneInviteAllowed(
  history: ReadonlyArray<{ metadata: Record<string, unknown>; createdAt: string }>,
  at: Date,
): boolean {
  const invites = history.filter((message) => {
    const scene = message.metadata?.scene as { kind?: unknown } | undefined;
    return scene?.kind === "invite";
  });
  if (invites.some((message) => (message.metadata.scene as { state?: unknown }).state === "open")) return false;
  const last = invites.at(-1);
  return !last || at.getTime() - Date.parse(last.createdAt) >= SLP_SCENE_INVITE_GAP_DAYS * 86_400_000;
}

/** The instruction that offers the invite field, in the reply's role header. */
export function slpSceneInviteInstruction(viewer: string): string {
  return `You may invite ${viewer} into a scene: meeting up, a call, a date, a shoot together. Add "sceneInvite" to your JSON: your invitation in your own voice, one to three sentences, only when this conversation has really reached the point where doing something together is the natural next step and you want it. It opens a roleplay scene ${viewer} can accept or turn down, so never pressure. Most messages use null. Never invite when you are annoyed with ${viewer}.`;
}
