/**
 * What a direct-message reply is allowed to come back as.
 *
 * The shared package owns `noodleGeneratedNoodlerReplySchema`, and this repo does not contain it,
 * so the direct-message contract is defined here instead of extended there.
 *
 * Everything except `content` is optional on the way in. A connection that cannot honour a JSON
 * schema returns whatever it likes, and a reply with good words and no mood is still a good reply.
 * Failing the message because a mood was missing would trade the thing the fan asked for against
 * a detail only the simulation cares about.
 */
import { z } from "zod";
import { SLURP_MOOD_SHIFTS, type SlurpMoodShift } from "./slurp-mood.js";
import type { SlurpStanceLatitude } from "./slurp-stance.js";
import type { SlurpMediaIntent } from "./slurp-media-offer.js";
import {
  readSlurpNoteOperations,
  SLURP_NOTE_MAX_LENGTH,
  SLURP_NOTES_PER_REPLY,
  type SlurpNoteOperation,
} from "./slurp-thread-notes.js";

export { SLURP_NOTE_MAX_LENGTH, SLURP_NOTES_PER_REPLY };

export const slurpDmReplySchema = z.object({
  content: z.string(),
  // `.catch` rather than plain `.optional`: a model that answers `"moodShift": "annoyed"` has still
  // written a good reply, and rejecting the envelope would throw that reply away over a detail
  // only the simulation reads.
  moodShift: z.enum(SLURP_MOOD_SHIFTS).optional().catch(undefined),
  remember: z.array(z.unknown()).optional().catch(undefined),
  sharePost: z.number().int().min(0).max(4).optional().catch(undefined),
  image: z
    .object({ prompt: z.string().trim().min(3).max(1000), caption: z.string().trim().max(500).optional() })
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
});

export type SlurpDmReply = {
  content: string;
  moodShift: SlurpMoodShift;
  remember: SlurpNoteOperation[];
  sharePost?: number;
  image?: { prompt: string; caption: string };
  media?: {
    kind: "post" | "generated_image";
    postIndex?: number;
    intent: SlurpMediaIntent;
    prompt?: string;
    caption: string;
  };
};

/** The reply plus what the resolved stance allows the creator to do about the conversation. */
export type SlurpGeneratedDmReply = SlurpDmReply & {
  latitude: SlurpStanceLatitude;
  canSendImage: boolean;
  imageMode: "friendly" | "hostile" | "none";
  sharedPost: { id: string; title: string | null; content: string; access: string; imageUrl: string | null } | null;
};

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
    if (typeof value === "string") return { content: value, moodShift: "same", remember: [] };
    throw new Error("Slurp direct-message generation returned no usable content.");
  }
  return {
    content: parsed.data.content,
    moodShift: parsed.data.moodShift ?? "same",
    remember: readSlurpNoteOperations(parsed.data.remember),
    ...(parsed.data.sharePost === undefined ? {} : { sharePost: parsed.data.sharePost }),
    ...(parsed.data.image?.prompt
      ? { image: { prompt: parsed.data.image.prompt, caption: parsed.data.image.caption?.trim() ?? "" } }
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
  };
}
