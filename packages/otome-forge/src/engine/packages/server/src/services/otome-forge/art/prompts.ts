// ──────────────────────────────────────────────
// Otome Forge: image prompts, built in code with no model call (plan §1.8, M1 "Image prompts")
// ──────────────────────────────────────────────
// A look is the identity line and the outfit line, full body on a flat mid-grey background (so the Home cut-out has
// an easy matte), plus the world's image rating and "adult <presentation>" from the content contract. The prompt goes
// to the Engine as a prompt override, which replaces the Engine's own prompt and style, so the chosen style profile's
// text and tags are added here. A prompt the player edited in the review dialog keeps every rating and adult tag:
// the missing ones are appended again. Image prompts are always English. GF's buildImagePromptsMessages (server.mjs,
// offset 574915) is the reference for the wording.
import type { Presentation, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { ImageRating } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { otomeContentContract } from "../content-contract.js";
import type { StyleProfile } from "./image-client.js";

/** A look's size: a full-body portrait. */
export const LOOK_SIZE = { width: 832, height: 1216 } as const;
/** CGs and places (M2b). */
export const SCENE_SIZE = { width: 768, height: 1344 } as const;

export const LOOK_FRAMING = "full body, standing, neutral pose, plain flat mid-grey background";
const LOOK_NEGATIVE =
  "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, extra people, cropped-off heads, cropped feet, busy background, scenery";
/** Kept on every image, whatever the player edits. */
const ADULT_NEGATIVE = "child, childlike, minor, underage, school uniform";
const RATING_NEGATIVE: Record<ImageRating, string> = {
  sfw: "nudity, nsfw, sexual content, lingerie",
  suggestive: "explicit nudity, sex",
  explicit: "",
};

export interface LookInput {
  name: string;
  identityLine: string;
  outfitLine: string;
  presentation: Presentation;
  world: Pick<World, "content" | "images">;
  style: StyleProfile;
}

export interface ImagePrompt {
  prompt: string;
  negativePrompt: string;
}

const tagsOf = (text: string) =>
  text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

/** Comma-separated tags in order, each once (case-insensitive). */
function mergeTags(...parts: string[]): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of parts.flatMap(tagsOf)) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.join(", ");
}

/**
 * `text` as written, with every tag of `required` it lacks appended. Whole comma-separated tags are compared, so
 * "adult manga style" does not stand in for "adult man", nor "not fully clothed" for "fully clothed".
 */
function withTags(text: string, required: string): string {
  const have = new Set(tagsOf(text).map((tag) => tag.toLowerCase()));
  const missing = tagsOf(required).filter((tag) => !have.has(tag.toLowerCase()));
  return [text.trim().replace(/[,\s]+$/, ""), ...missing].filter(Boolean).join(", ");
}

/**
 * The look prompt for one person. With `edited` (the review dialog's text), the player's wording is kept and only the
 * rating, adult and negative safety tags it dropped are put back.
 */
export function lookPrompt(input: LookInput, edited: Partial<ImagePrompt> = {}): ImagePrompt {
  const { world, style } = input;
  const required = otomeContentContract({
    world,
    lis: [{ name: input.name, presentation: input.presentation }],
    kind: "image",
  });
  const requiredNegative = mergeTags(ADULT_NEGATIVE, RATING_NEGATIVE[world.images.rating]);
  const prompt = edited.prompt?.trim()
    ? withTags(edited.prompt, required)
    : [style.styleText, mergeTags(input.identityLine, input.outfitLine, LOOK_FRAMING, required, style.positiveTags)]
        .filter(Boolean)
        .join(", ");
  const negativePrompt = edited.negativePrompt?.trim()
    ? withTags(edited.negativePrompt, requiredNegative)
    : mergeTags(LOOK_NEGATIVE, requiredNegative, style.negativeTags);
  return { prompt, negativePrompt };
}

// ── M5: a date's keepsake ──

const KEEPSAKE_FRAMING = "two people, romantic date, candid moment, cinematic composition, detailed background";
// Two people are drawn, so the Engine's own "extra people" is left out on purpose.
const KEEPSAKE_NEGATIVE =
  "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, cropped-off heads, extra limbs";

/** A person in the keepsake: who they are and what they wear (English, visual only), drawn as an adult. */
export interface KeepsakePerson {
  name: string;
  identityLine: string;
  outfitLine: string;
  presentation: Presentation;
}

export interface KeepsakeInput {
  /** The date plan's English brief: where and how the moment is shot, never anyone's looks. */
  brief: string;
  people: readonly KeepsakePerson[];
  world: Pick<World, "content" | "images">;
  style: StyleProfile;
}

/**
 * A date's keepsake (S/minigames/date-night.ts): the brief, each person's look, the framing, then the rating and an
 * adult tag for every person. An edited prompt keeps its wording with every safety tag put back.
 * ponytail: written beside M1's look prompt; once M2b's cgPrompt lands this is cgPrompt with the keepsake's framing.
 */
export function keepsakePrompt(input: KeepsakeInput, edited: Partial<ImagePrompt> = {}): ImagePrompt {
  const { world, style } = input;
  const required = otomeContentContract({ world, lis: input.people, kind: "image" });
  const requiredNegative = mergeTags(ADULT_NEGATIVE, RATING_NEGATIVE[world.images.rating]);
  const sentence = (text: string) => {
    const value = text.trim().replace(/[,\s]+$/, "");
    return !value || /[.!?…]$/.test(value) ? value : `${value}.`;
  };
  const looks = input.people.map((person) => {
    const look = [person.identityLine, person.outfitLine].map((line) => line.trim()).filter(Boolean);
    const first = person.name.trim().split(/\s+/)[0] ?? "";
    return look.length ? sentence(`${first}: ${look.join("; ")}`) : "";
  });
  const prompt = edited.prompt?.trim()
    ? withTags(edited.prompt, required)
    : [style.styleText, sentence(input.brief), ...looks, mergeTags(KEEPSAKE_FRAMING, required, style.positiveTags)]
        .filter(Boolean)
        .join(" ");
  const negativePrompt = edited.negativePrompt?.trim()
    ? withTags(edited.negativePrompt, requiredNegative)
    : mergeTags(KEEPSAKE_NEGATIVE, requiredNegative, style.negativeTags);
  return { prompt, negativePrompt };
}
