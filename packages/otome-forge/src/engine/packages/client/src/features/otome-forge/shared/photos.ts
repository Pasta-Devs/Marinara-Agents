// ──────────────────────────────────────────────
// Otome Hearth: the Photo Shoot's picks (#2087), shared by both bundles
// ──────────────────────────────────────────────
// Pure TypeScript. The player picks a place the story painted, what each of them wears, and an expression and a pose
// for each of them: a preset id or their own words ("custom"). Only the ids and the typed words travel; the English
// prompt text for each id lives in S/prompts.ts (photoPrompt) and the client labels each id through its own literal
// map of ui.otomeForge.* keys. A shared pose is one pick for both of them: each side holds its own id of the pair
// (PHOTO_POSE_PARTNER), so "Carries piggyback" on one side is "Rides piggyback" on the other.
import type { LiId, Paint } from "./api-types";

/** `ph-<time base36>-<6 [a-z0-9]>`: made by the client for one tap; Try again names the same one. */
export const PHOTO_ID = /^ph-[0-9a-z]{1,12}-[0-9a-z]{6}$/;
/** The most characters of a custom expression or pose (UTF-16 units, as the field's maxLength counts them). */
export const PHOTO_TEXT_MAX = 80;
/** The pick that takes the player's own words. */
export const PHOTO_CUSTOM = "custom";

export const PHOTO_EXPRESSIONS = ["smile", "laugh", "wink", "blush", "pout", "smirk", "fond", "surprised"] as const;
export type PhotoExpression = (typeof PHOTO_EXPRESSIONS)[number];

export const PHOTO_SOLO_POSES = [
  "pose",
  "peace",
  "wave",
  "finger-heart",
  "hand-on-hip",
  "arms-crossed",
  "thumbs-up",
  "hands-in-pockets",
] as const;
export type PhotoSoloPose = (typeof PHOTO_SOLO_POSES)[number];

export const PHOTO_SHARED_POSES = [
  "kiss",
  "hug",
  "play-fight",
  "hold-hands",
  "forehead",
  "back-to-back",
  "hand-heart",
  "cheek-kiss",
  "cheek-kissed",
  "piggyback-carry",
  "piggyback-ride",
  "back-hug",
  "back-hugged",
] as const;
export type PhotoSharedPose = (typeof PHOTO_SHARED_POSES)[number];
export type PhotoPose = PhotoSoloPose | PhotoSharedPose;

/** Each shared pose's counterpart in the other person's list: itself when both do the same. */
export const PHOTO_POSE_PARTNER: Record<PhotoSharedPose, PhotoSharedPose> = {
  kiss: "kiss",
  hug: "hug",
  "play-fight": "play-fight",
  "hold-hands": "hold-hands",
  forehead: "forehead",
  "back-to-back": "back-to-back",
  "hand-heart": "hand-heart",
  "cheek-kiss": "cheek-kissed",
  "cheek-kissed": "cheek-kiss",
  "piggyback-carry": "piggyback-ride",
  "piggyback-ride": "piggyback-carry",
  "back-hug": "back-hugged",
  "back-hugged": "back-hug",
};

/** The solo pose a person goes back to when the shared pose they were in ends. */
export const PHOTO_DEFAULT_POSE: PhotoSoloPose = "pose";
export const PHOTO_DEFAULT_EXPRESSION: PhotoExpression = "smile";

/** One person's expression and pose: a preset id, or "custom" with their own words. */
export interface PhotoPick {
  expression: PhotoExpression | typeof PHOTO_CUSTOM;
  expressionText?: string;
  pose: PhotoPose | typeof PHOTO_CUSTOM;
  poseText?: string;
}

/** POST /runs/:run/photos/prompt, and with `id` POST /runs/:run/photos: what the player picked. */
export interface PhotoSetup {
  li: LiId;
  /** A key of world.places whose art is ready. */
  place: string;
  /** BASE_LOOK or a look item each of them owns and has painted. */
  hisLook: string;
  herLook: string;
  his: PhotoPick;
  her: PhotoPick;
}

/** A photo as the client sees it (the record keeps the prompt it was sent with, which stays on the server). */
export interface PhotoView extends Omit<PhotoSetup, "place"> {
  id: string;
  /** The place's key and its name in the world's language (the Album's caption). */
  place: { key: string; name: string };
  createdAt: string;
  art: Paint;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function isPhotoId(value: unknown): value is string {
  return typeof value === "string" && PHOTO_ID.test(value);
}

/** A fresh photo id (SH PHOTO_ID). */
export function newPhotoId(now = Date.now()): string {
  const bytes = new Uint8Array(6);
  try {
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  const token = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
  return `ph-${Math.max(0, Math.trunc(now)).toString(36)}-${token}`;
}

export function isSharedPose(pose: string): pose is PhotoSharedPose {
  return (PHOTO_SHARED_POSES as readonly string[]).includes(pose);
}

/**
 * Both picks after one side chooses `pose`. A shared pose sets the other side to its partner (Kiss with Kiss, Carries
 * piggyback with Rides piggyback); a solo pose or their own words ends a shared pose, and the other side goes back to
 * "Pose for the camera". Expressions and typed words are never touched.
 */
export function withPose(
  picks: { his: PhotoPick; her: PhotoPick },
  side: "his" | "her",
  pose: PhotoPick["pose"],
): { his: PhotoPick; her: PhotoPick } {
  const other = side === "his" ? "her" : "his";
  const mine = { ...picks[side], pose };
  const theirs = isSharedPose(pose)
    ? { ...picks[other], pose: PHOTO_POSE_PARTNER[pose] }
    : isSharedPose(picks[other].pose)
      ? { ...picks[other], pose: PHOTO_DEFAULT_POSE }
      : picks[other];
  return side === "his" ? { his: mine, her: theirs } : { his: theirs, her: mine };
}

/** True unless one of them is in a shared pose the other is not in (the server refuses that photo). */
export function posesAgree(his: Pick<PhotoPick, "pose">, her: Pick<PhotoPick, "pose">): boolean {
  if (isSharedPose(his.pose)) return her.pose === PHOTO_POSE_PARTNER[his.pose];
  return !isSharedPose(her.pose);
}
