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

/** A note is one short fact. Long enough for a sentence, short enough that twenty of them fit. */
export const SLURP_NOTE_MAX_LENGTH = 160;

/** Per reply. The creator may notice one or two things, not empty the conversation into storage. */
export const SLURP_NOTES_PER_REPLY = 2;

export const slurpDmReplySchema = z.object({
  content: z.string(),
  // `.catch` rather than plain `.optional`: a model that answers `"moodShift": "annoyed"` has still
  // written a good reply, and rejecting the envelope would throw that reply away over a detail
  // only the simulation reads.
  moodShift: z.enum(SLURP_MOOD_SHIFTS).optional().catch(undefined),
  remember: z.array(z.string()).optional().catch(undefined),
  sharePost: z.number().int().min(0).max(4).optional().catch(undefined),
  image: z
    .object({ prompt: z.string().trim().min(3).max(1000), caption: z.string().trim().max(500).optional() })
    .nullable()
    .optional()
    .catch(undefined),
});

export type SlurpDmReply = {
  content: string;
  moodShift: SlurpMoodShift;
  remember: string[];
  sharePost?: number;
  image?: { prompt: string; caption: string };
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
    remember: (parsed.data.remember ?? [])
      .map((note) => note.trim().slice(0, SLURP_NOTE_MAX_LENGTH))
      .filter((note) => note.length > 0)
      .slice(0, SLURP_NOTES_PER_REPLY),
    ...(parsed.data.sharePost === undefined ? {} : { sharePost: parsed.data.sharePost }),
    ...(parsed.data.image?.prompt
      ? { image: { prompt: parsed.data.image.prompt, caption: parsed.data.image.caption?.trim() ?? "" } }
      : {}),
  };
}
