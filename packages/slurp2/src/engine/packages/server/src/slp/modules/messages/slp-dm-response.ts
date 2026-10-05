/**
 * What a direct-message reply is allowed to come back as.
 *
 * The shared package owns `slpGeneratedCreatorReplySchema`, and this repo does not contain it,
 * so the direct-message contract is defined here instead of extended there.
 *
 * Everything except `content` is optional on the way in. A connection that cannot honour a JSON
 * schema returns whatever it likes, and a reply with good words and no mood is still a good reply.
 * Failing the message because a mood was missing would trade the thing the fan asked for against
 * a detail only the simulation cares about.
 */
import { z } from "zod";
import { SLURP_MOOD_SHIFTS, type SlurpMoodShift } from "../world/slp-mood.js";
import type { SlurpStanceLatitude } from "../world/slp-stance.js";
import type { SlurpMediaIntent } from "../economy/slp-media-offer.js";
import {
  readSlurpNoteOperations,
  SLURP_NOTE_MAX_LENGTH,
  SLURP_NOTES_PER_REPLY,
  type SlurpNoteOperation,
} from "./slp-thread-notes.js";
import { SLURP_CREATOR_STATE_SIGNALS, type SlurpCreatorStateSignal } from "../creators/slp-creator-state.js";

export { SLURP_NOTE_MAX_LENGTH, SLURP_NOTES_PER_REPLY };

export const slurpDmReplySchema = z.object({
  content: z.string(),
  // `.catch` rather than plain `.optional`: a model that answers `"moodShift": "annoyed"` has still
  // written a good reply, and rejecting the envelope would throw that reply away over a detail
  // only the simulation reads.
  moodShift: z.enum(SLURP_MOOD_SHIFTS).optional().catch(undefined),
  remember: z.array(z.unknown()).optional().catch(undefined),
  stateSignals: z.array(z.enum(SLURP_CREATOR_STATE_SIGNALS)).max(3).optional().catch(undefined),
  sharePost: z.number().int().min(0).max(4).optional().catch(undefined),
  image: z
    .object({
      prompt: z.string().trim().min(3).max(1000),
      caption: z.string().trim().max(500).nullish(),
      spicy: z.boolean().optional().catch(undefined),
    })
    .nullable()
    .optional()
    .catch(undefined),
  media: z
    .object({
      kind: z.enum(["post", "generated_image"]),
      postIndex: z.number().int().min(0).max(4).optional(),
      intent: z.enum(["friendly", "hostile", "premium", "preview"]),
      prompt: z.string().trim().min(3).max(1000).optional(),
      caption: z.string().trim().max(500).optional(),
    })
    .nullable()
    .optional()
    .catch(undefined),
  followUp: z
    .object({
      type: z.enum(["reminder", "promise_delivery", "task_update", "check_in", "recurring"]),
      timing: z.string().trim().min(1).max(50),
      count: z.number().int().min(1).max(10).optional(),
      reason: z.string().trim().min(1).max(200),
      context: z.string().trim().max(500).nullish(),
    })
    .nullable()
    .optional()
    .catch(undefined),
  /** Only in Slurp Support's thread: what the talk changed for the Creator. Read by `slp-support.ts`. */
  staff: z.record(z.string(), z.unknown()).nullable().optional().catch(undefined),
  /** Only in Slurp Support's thread: trust, an offer's answer, intel, a rating (`slp-support-desk-talk.ts`). */
  desk: z.record(z.string(), z.unknown()).nullable().optional().catch(undefined),
  /** Only Creator to Creator: the two agreed on a joint post. Read by `readSlurpDmCollab`. */
  collab: z.record(z.string(), z.unknown()).nullable().optional().catch(undefined),
  /** Only in a chat with the player: what the talk did to the two of them. Read by `readSlurpDmUs`. */
  us: z.record(z.string(), z.unknown()).nullable().optional().catch(undefined),
  /** Only when offered: her pitch for a roleplay scene (docs/SCENES.md). */
  sceneInvite: z.string().nullable().optional().catch(undefined),
});

export type SlurpDmReply = {
  content: string;
  moodShift: SlurpMoodShift;
  remember: SlurpNoteOperation[];
  stateSignals: SlurpCreatorStateSignal[];
  sharePost?: number;
  image?: { prompt: string; caption: string; spicy?: boolean };
  media?: {
    kind: "post" | "generated_image";
    postIndex?: number;
    intent: SlurpMediaIntent;
    prompt?: string;
    caption: string;
  };
  followUp?: {
    type: "reminder" | "promise_delivery" | "task_update" | "check_in" | "recurring";
    timing: string;
    count?: number;
    reason: string;
    context?: string;
  };
  staff?: Record<string, unknown>;
  desk?: Record<string, unknown>;
  collab?: Record<string, unknown>;
  us?: Record<string, unknown>;
  /** Her pitch for a roleplay scene, when the reply was offered the field (docs/SCENES.md). */
  sceneInvite?: string;
};

/** The reply plus what the resolved stance allows the creator to do about the conversation. */
export type SlurpGeneratedDmReply = SlurpDmReply & {
  latitude: SlurpStanceLatitude;
  canSendImage: boolean;
  imageMode: "friendly" | "hostile" | "none";
  sharedPost: { id: string; title: string | null; content: string; access: string; imageUrl: string | null } | null;
  /** Creator to Creator: a joint post the two agreed on, with the replying Creator's share. */
  agreedCollab?: SlurpDmCollab;
  /** With the player: the talk moved the two of them (`slurpPlayerCoupleStep`). */
  us?: SlurpDmUs;
  /** The player's page the "us" step is about. */
  usPageId?: string;
};

export type SlurpDmUs = { step: "closer" | "hurt" | "madeUp"; why: string };

/** The "us" field of a reply to the player, or undefined when the talk changed nothing between them. */
export function readSlurpDmUs(
  raw: unknown,
  protect: (value: string) => string | null | undefined,
): SlurpDmUs | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const step = (["closer", "hurt", "madeUp"] as const).find((entry) => entry === value.step);
  if (!step) return undefined;
  return { step, why: typeof value.why === "string" ? (protect(value.why.trim()) ?? "") : "" };
}

export type SlurpDmCollab = { partnerId: string; idea: string; hostShare: number | null; shoot?: boolean };

/** The "collab" field of a Creator-to-Creator reply, or undefined when they did not agree on one. */
export function readSlurpDmCollab(
  raw: unknown,
  partnerId: string,
  protect: (value: string) => string | null | undefined,
): SlurpDmCollab | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  if (value.agreed === false) return undefined;
  const idea = typeof value.idea === "string" ? (protect(value.idea.trim()) ?? "") : "";
  const share = typeof value.yourShare === "number" && Number.isFinite(value.yourShare) ? value.yourShare : null;
  return idea || share !== null
    ? { partnerId, idea, hostShare: share, ...(value.shoot === true ? { shoot: true } : {}) }
    : undefined;
}

/**
 * Read a model answer back, tolerating everything except a missing reply.
 *
 * Unknown fields are dropped rather than rejected: a model that adds `"tone": "playful"` of its own
 * accord must not cost the fan their answer.
 */
export function readSlurpDmReply(value: unknown): SlurpDmReply {
  const parsed = slurpDmReplySchema.safeParse(value);
  if (!parsed.success) {
    // The one required field. A string answer with no envelope at all is still usable.
    if (typeof value === "string") return { content: value, moodShift: "same", remember: [], stateSignals: [] };
    throw new Error("Slurp direct-message generation returned no usable content.");
  }
  return {
    content: parsed.data.content,
    moodShift: parsed.data.moodShift ?? "same",
    remember: readSlurpNoteOperations(parsed.data.remember),
    stateSignals: parsed.data.stateSignals ?? [],
    ...(parsed.data.sharePost === undefined ? {} : { sharePost: parsed.data.sharePost }),
    ...(parsed.data.image?.prompt
      ? {
          image: {
            prompt: parsed.data.image.prompt,
            caption: parsed.data.image.caption?.trim() ?? "",
            ...(parsed.data.image.spicy === undefined ? {} : { spicy: parsed.data.image.spicy }),
          },
        }
      : {}),
    ...(parsed.data.media?.kind
      ? {
          media: {
            kind: parsed.data.media.kind,
            postIndex: parsed.data.media.postIndex,
            intent: parsed.data.media.intent,
            prompt: parsed.data.media.prompt,
            caption: parsed.data.media.caption?.trim() ?? "",
          },
        }
      : {}),
    ...(parsed.data.followUp
      ? {
          followUp: {
            type: parsed.data.followUp.type,
            timing: parsed.data.followUp.timing,
            count: parsed.data.followUp.count,
            reason: parsed.data.followUp.reason,
            context: parsed.data.followUp.context ?? undefined,
          },
        }
      : {}),
    ...(parsed.data.staff ? { staff: parsed.data.staff } : {}),
    ...(parsed.data.desk ? { desk: parsed.data.desk } : {}),
    ...(parsed.data.collab ? { collab: parsed.data.collab } : {}),
    ...(parsed.data.us ? { us: parsed.data.us } : {}),
    ...(parsed.data.sceneInvite ? { sceneInvite: parsed.data.sceneInvite } : {}),
  };
}

/**
 * A note is model output about the player, stored and fed back into a later prompt: redacted and
 * bounded by `protect`, and never about payment.
 */
export function protectNoteOperation(
  operation: SlurpNoteOperation,
  protect: (text: string) => string | null | undefined,
): SlurpNoteOperation | null {
  if (operation.op === "forget" || operation.op === "keep") return operation;
  const text = protect(operation.text);
  // "Never record anything about payment" is only a prompt line, and stored notes were all payment
  // notes that later fed "you'd need to subscribe" upsells. Enforced here.
  if (!text || /\b(?:coins?|unlock\w*|subscri\w*|tips?|tipped|paid|pays?|payment|ppv)\b/iu.test(text)) return null;
  return operation.op === "add" ? { op: "add", text } : { op: "replace", id: operation.id, text };
}
