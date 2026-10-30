// ──────────────────────────────────────────────
// Otome Forge: P20 banner plan (plan M4 "P20 banner-plan")
// ──────────────────────────────────────────────
// One structured call per banner, at temperature 0.8, when the banner is created (Wish open): the featured 5★ (a
// Memory's title, premise and key image brief, or a look's name and English outfit line), three 4★s and six Snapshots.
// Pulls never call a model: everything a pull hands out is written here.
// - Premises take the `planner` contract; a premise is a situation, and how close they are follows their stage when
//   the item is first opened (S/items/character-story.ts writes it then, against the canon of that day).
// - Snapshots are short vignettes the player reads on the Love Timeline, so they take the `home` wording (SFW whatever
//   the Heat, Lines and Veils kept) and the knowledge boundary. Each Snapshot is one love interest's private memory once
//   owned (S/wish/banners.ts itemMemorySources), so the prompt carries only what the whole cast may know: scene cards
//   without the secrets she learned in a route, the shared part of what stands between each of them and the
//   protagonist, and recall as a scene with nobody in it (shared canon only). No love interest's own chapter reaches it.
// - Outfit lines and key image briefs are English image text, held to the `image` contract's tags. Above SFW a look may
//   be revealing but stays a complete clothed look. Memory art follows its premise: at most Suggestive, unless Explicit
//   Heat and the Explicit rating both allow an explicit one and its brief sets `explicit` (content-contract.ts
//   imageBriefRule, as a story CG). A world that raised nothing gets the prompt it got before.
// - 0.5.2 (#1951): above SFW Heat a Memories banner's premises span the Heat: SFW and suggestive ones, and explicit ones
//   at Explicit Heat. Each 4★ Moment then gets its own English brief within the image rating (momentBriefs), since its
//   illustration would otherwise be painted from a premise that may go further. Snapshots stay SFW, and an SFW world's
//   prompt is unchanged.
// Prompts are English and never localized; titles, premises, look names and Snapshots are in the world's language. A
// love interest may be any gender: the prompt names them or uses their bible's pronouns.
import { z } from "zod";
import type {
  LiState,
  Player,
  RunState,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { sameName } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  BANNER_SIZES,
  type BannerKind,
  type ItemLook,
} from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { explicitCgAllowed, imageBriefRule, otomeContentContract, otomeContractReminder } from "../content-contract.js";
import type { OtomeMessage } from "../generation.js";
import { mainChapterNumber } from "../ids.js";
import { otomeSceneCard } from "../scene-card.js";
import { defaultLiState } from "../schemas/state.js";
import { ITEM_LIMITS } from "../schemas/wish.js";
import { betweenYou } from "../story/prompts.js";
import { otomeWritingRules } from "../writing-rules.js";
import { intimacyLine } from "../intimacy.js";

export const BANNER_PLAN_TEMPERATURE = 0.8;
export const BANNER_PLAN_TOKENS = 3000;
/** Earlier banner titles of the kind the planner is told not to repeat. */
const EARLIER_TITLES = 12;

const KIND_TEXT: Record<BannerKind, string> = {
  memories:
    "MEMORIES: the 5★ is a Memory of the featured love interest (a key image, a 3–5 scene Character Story and one voiced line, all written later from your premise); each 4★ is a one-scene Moment with one love interest of the cast.",
  "his-wardrobe":
    "HIS WARDROBE: the 5★ is a complete new look for the featured love interest; each 4★ is a complete look for one of the other love interests.",
  "my-wardrobe":
    "MY WARDROBE: the 5★ is a complete look for the protagonist that pairs with the featured love interest's look named below as a couple set; each 4★ is another complete look for the protagonist.",
};

const LOOK_SHAPE = `{"name": "<look name>", "outfitLine": "<English outfit tags>"}`;
const SNAPSHOT_SHAPE = `{"li": "<love interest id>", "title": "<2–5 words>", "text": "<2–3 sentences>", "cgBrief": "<English illustration of this vignette, 1–2 sentences>", "cgCast": ["<this love interest's name; the protagonist only if present>"]}`;
/**
 * The Memories shape. `explicit` adds the key image's mark where the world allows an explicit one; `moments` gives each
 * 4★ its own illustration brief (momentBriefs).
 */
const memoriesShape = ({ explicit, moments }: { explicit: boolean; moments: boolean }) =>
  `{"featured": {"title": "<title>", "premise": "<2–3 sentences>", "cgBrief": "<English, 1–2 sentences>", "cgCast": ["<names in the key image, the featured love interest first; the protagonist only if present>"]${explicit ? ', "explicit": false, "clothedBrief": "<English, 1–2 sentences, only when explicit is true>"' : ""}}, "four": [{"li": "<love interest id>", "title": "<title>", "premise": "<1–2 sentences>"${moments ? `, "cgBrief": "<English, 1–2 sentences>", "cgCast": ["<this love interest's name; the protagonist only if present>"]` : ""}} ×3], "snapshots": [${SNAPSHOT_SHAPE} ×6]}`;
const SHAPES: Record<BannerKind, string> = {
  memories: memoriesShape({ explicit: false, moments: false }),
  "his-wardrobe": `{"featured": {"title": "<title>", "look": ${LOOK_SHAPE}}, "four": [{"li": "<another love interest's id>", "title": "<title>", "look": ${LOOK_SHAPE}} ×3], "snapshots": [${SNAPSHOT_SHAPE} ×6]}`,
  "my-wardrobe": `{"featured": {"title": "<title>", "look": ${LOOK_SHAPE}}, "four": [{"title": "<title>", "look": ${LOOK_SHAPE}} ×3], "snapshots": [${SNAPSHOT_SHAPE} ×6]}`,
};

/**
 * Above SFW Heat, how far a Memories banner's premises may go, mixed across the featured Memory and the 4★ Moments
 * (#1951). None under SFW Heat, whose prompt stays as it was.
 */
const PREMISE_HEAT: Partial<Record<World["content"]["heat"], string>> = {
  fade: "- Premises span the Heat across the featured Memory and the 4★s: SFW ones, and suggestive ones (desire, tension, a night that fades to black).",
  explicit:
    "- Premises span the Heat across the featured Memory and the 4★s: SFW ones, suggestive ones (desire, tension, a near miss) and explicit ones (sex between the adults, written on the page when the scene is written).",
};

/**
 * Whether each 4★ Moment gets its own illustration brief: above SFW Heat its premise may go further than the image
 * rating, and its art is otherwise painted from the premise (S/art/outfits.ts).
 */
export const momentBriefs = (kind: BannerKind, world: Pick<World, "content">) =>
  kind === "memories" && world.content.heat !== "sfw";

/** Whether a Memory's key image may be explicit: where a story CG may be (Explicit Heat and the Explicit rating). */
export const explicitMemoryArt = (kind: BannerKind, world: Pick<World, "content" | "images">) =>
  kind === "memories" && explicitCgAllowed(world);

const pronounText = (pronouns: Unit["pronouns"]) => `${pronouns.subject}/${pronouns.object}/${pronouns.possessive}`;

/** A contract block under its own heading (the contract's text starts with "CONTENT CONTRACT"). */
const relabel = (contract: string, heading: string) => contract.replace(/^CONTENT CONTRACT/, heading);

/**
 * What stands between them that the whole cast may know: grievances and disclosures from main chapters only, and never
 * a notebook (Read Me, #1945): what one love interest has come to know is theirs alone, and a banner plans for all.
 */
function sharedState(liState: LiState): LiState {
  const shared = (ref: string) => mainChapterNumber(ref.split("/")[0] ?? "") !== null;
  return {
    ...liState,
    grievances: liState.grievances.filter((grievance) => shared(grievance.opened)),
    disclosures: liState.disclosures.filter((disclosure) => shared(disclosure.ref)),
    known: [],
  };
}

/**
 * A scene card without the secrets the protagonist has learned: she learned each in that love interest's own route
 * chapter, so a Snapshot of anyone else's must not know it.
 */
function sharedCard(unit: Unit, liState: LiState): string {
  return otomeSceneCard(unit, liState)
    .split("\n")
    .filter((line) => !line.startsWith(KNOWN_LINE))
    .join("\n");
}

/** How otomeSceneCard (S/scene-card.ts) starts the line of secrets the protagonist knows. */
const KNOWN_LINE = "The protagonist knows: ";

export interface BannerPlanInput {
  kind: BannerKind;
  world: World;
  player: Player;
  /** The cast in setup order, each with a bible. */
  units: Unit[];
  state: RunState;
  featured: Unit;
  /** My Wardrobe: his look the 5★ pairs with. */
  partnerLook?: ItemLook & { title: string };
  /** Earlier banner titles of this kind, newest last. */
  earlierTitles: string[];
  /** Shared canon (recall as a scene with nobody in it). */
  memory: string;
}

/** P20: the banner plan's messages (system: role, shape, rules, boundary, contracts; user: cast, story, task). */
export function bannerPlanMessages(input: BannerPlanInput): OtomeMessage[] {
  const { kind, world, player, units, state, featured } = input;
  const lis = units.map((unit) => ({ name: unit.name, presentation: unit.bible?.look.presentation }));
  const imageTags = otomeContentContract({
    world,
    lis: [...lis, { name: player.name, presentation: "person" as const }],
    kind: "image",
  });
  const explicitArt = explicitMemoryArt(kind, world);
  const briefRule = kind === "memories" ? imageBriefRule(world, explicitArt ? "cg" : "clothed") : "";
  const moments = momentBriefs(kind, world);
  // A Moment's illustration stays clothed (at most Suggestive) whatever its premise holds.
  const momentRule = moments ? imageBriefRule(world, "clothed").replace(/^The key image at this rating: /, "") : "";
  const tagged = explicitArt
    ? "every outfit line and 4★ brief must fit"
    : moments
      ? "every outfit line, key image brief and 4★ brief must fit"
      : "every outfit line and key image brief must fit";
  const system = [
    "You plan one banner of Wish in an otome game: the collectible side stories, looks and Snapshots the player pulls for with Starlight they earned. Nothing on a banner changes the main story.",
    KIND_TEXT[kind],
    `Reply with ONLY this JSON object:\n${kind === "memories" ? memoriesShape({ explicit: explicitArt, moments }) : SHAPES[kind]}`,
    [
      "RULES",
      "- A premise is a situation: where they are, what is happening, what each of them wants from it. Never a plot turn, a reveal, a confession or anything the main story has not reached. How close they are follows their current stage; the scene itself is written later, when the item is first opened.",
      kind === "memories" ? (PREMISE_HEAT[world.content.heat] ?? "") : "",
      `- Titles, premises, look names and Snapshots are written in ${world.language || "English"}. Outfit lines and the key image brief are always English.`,
      "- An outfit line is English, visual-only, comma-separated tags for one complete look: clothes, shoes and accessories. Never the body, face, hair, pose, background or other people.",
      world.images.rating === "sfw"
        ? ""
        : "- Every look stays a complete clothed look: it may be revealing (lingerie, swimwear), never nude.",
      "- The key image brief is one or two English sentences on where and how the moment is framed (place, light, what they are doing), never anyone's looks.",
      briefRule ? `- ${briefRule}` : "",
      explicitArt
        ? '- When "explicit" is true, also write clothedBrief: the same moment just before or after it, everyone clothed, in one or two English sentences. It is painted instead if the image settings are lowered first.'
        : "",
      moments
        ? `- Each 4★'s cgBrief is one or two English sentences for its Moment's illustration: the place, light and what they are doing, never anyone's looks. Whatever its premise holds, the picture follows this: ${momentRule} cgCast names only that love interest and, when shown, the protagonist.`
        : "",
      `- Exactly ${BANNER_SIZES.four} entries in "four" and ${BANNER_SIZES.three} in "snapshots". Use the love interest ids given below for "li".`,
      `- Snapshots: 2–3 sentences each, a small everyday moment between one love interest and the protagonist, in the third person. Spread them across the cast, at least two with ${featured.name}. Each one stays within what that love interest has seen or been told.`,
      "- Each Snapshot's cgBrief illustrates its saved vignette: the actual place, light and action, never an invented plot turn or anyone's looks. Write the brief in English; cgCast names only that love interest and, when shown, the protagonist. Its picture stays clothed and within the Snapshot's SFW contract.",
      "- Every love interest keeps their own voice, wants and mask; tenderness before stage 4 costs them something.",
      "- New ideas only: never repeat an earlier banner's title or situation.",
    ]
      .filter(Boolean)
      .join("\n"),
    otomeWritingRules({ story: true, style: world.writingStyle, banned: world.bannedPhrases }),
    relabel(otomeContentContract({ world, lis, kind: "planner" }), "CONTENT CONTRACT (titles, premises and looks)"),
    relabel(
      otomeContentContract({ world, lis, kind: "home" }),
      "CONTENT CONTRACT FOR SNAPSHOTS (they show on the Love Timeline)",
    ),
    `IMAGE TAGS ${tagged}: ${imageTags}.${explicitArt ? " The featured key image brief follows its rule above." : ""}`,
  ].join("\n\n");

  const cast = units.map((unit) => {
    const liState = sharedState(state.lis[unit.id] ?? defaultLiState());
    // Their tastes can shape a Character Story's premise; a wardrobe banner plans looks, which they have no part in.
    const tastes = kind === "memories" ? intimacyLine(world, unit) : "";
    return [`id ${unit.id}: ${sharedCard(unit, liState)}`, tastes, betweenYou(unit, liState)]
      .filter(Boolean)
      .join("\n");
  });
  const user = [
    `WORLD: ${world.title}\n${world.setting}\nPremise: ${world.premise}`,
    [
      `PROTAGONIST: ${player.name || "The protagonist"} (${pronounText(player.pronouns)}). Never assume a gender the pronouns do not state.`,
      player.traits.length ? `Traits: ${player.traits.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    `THE CAST\n${cast.join("\n\n")}`,
    `FEATURED: ${featured.name} (id ${featured.id}, ${pronounText(featured.pronouns)}).`,
    input.partnerLook
      ? `${featured.name.toUpperCase()}'S LOOK THIS PAIRS WITH: "${input.partnerLook.name}" (${input.partnerLook.title}): ${input.partnerLook.outfitLine}`
      : "",
    input.earlierTitles.length
      ? `EARLIER BANNERS OF THIS KIND (do not repeat): ${input.earlierTitles.slice(-EARLIER_TITLES).join("; ")}`
      : "",
    input.memory.trim() ? `THE STORY SO FAR (what everyone knows)\n${input.memory.trim()}` : "",
    `Plan the ${kind} banner featuring ${featured.name}. ${otomeContractReminder("planner")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ── The reply ──

const Look = z.object({ name: z.string().min(1), outfitLine: z.string().min(1) });

export const BannerPlanSchema = z.object({
  featured: z.object({
    title: z.string().min(1),
    premise: z.string().optional(),
    look: Look.optional(),
    cgBrief: z.string().optional(),
    cgCast: z.array(z.string()).optional(),
    explicit: z.boolean().nullable().optional(),
    clothedBrief: z.string().nullable().optional(),
  }),
  four: z.array(
    z.object({
      li: z.string().optional(),
      title: z.string().min(1),
      premise: z.string().optional(),
      look: Look.optional(),
      cgBrief: z.string().optional(),
      cgCast: z.array(z.string()).optional(),
    }),
  ),
  snapshots: z.array(
    z.object({
      li: z.string().min(1),
      title: z.string().optional(),
      text: z.string().min(1),
      cgBrief: z.string().optional(),
      cgCast: z.array(z.string()).optional(),
    }),
  ),
});
export type BannerPlanReply = z.infer<typeof BannerPlanSchema>;

/** The plan as the banner is written from it: love interests as ids, every text clipped to its document's limit. */
export interface BannerPlan {
  featured: {
    title: string;
    premise?: string;
    look?: ItemLook;
    cg?: { brief: string; cast: string[]; explicit?: true; clothed?: string };
  };
  four: Array<{
    li: string | null;
    title: string;
    premise?: string;
    look?: ItemLook;
    cg?: { brief: string; cast: string[] };
  }>;
  snapshots: Array<{ li: string; title: string; text: string; cg?: { brief: string; cast: string[] } }>;
}

const clip = (value: string, max: number) => {
  const text = value.replace(/\s+/g, " ").trim();
  return [...text].length <= max
    ? text
    : `${[...text]
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`;
};

const cleanLook = (look: { name: string; outfitLine: string }): ItemLook => ({
  name: clip(look.name, ITEM_LIMITS.title),
  outfitLine: clip(look.outfitLine, ITEM_LIMITS.line),
});

/**
 * The reply as a BannerPlan, or a string naming what is wrong (the generation core's one repair turn). `units` is the
 * cast; a love interest may be named by id or by name.
 */
export function normalizeBannerPlan(
  reply: BannerPlanReply,
  {
    kind,
    units,
    featured,
    playerName,
    moments = false,
    explicitArt = false,
  }: {
    kind: BannerKind;
    units: readonly Unit[];
    featured: Unit;
    playerName?: string;
    moments?: boolean;
    explicitArt?: boolean;
  },
): BannerPlan | string {
  const liOf = (value: string | undefined) => {
    const named = (value ?? "").trim();
    return units.find((unit) => unit.id === named) ?? units.find((unit) => sameName(named, unit.name)) ?? null;
  };
  const { featured: top } = reply;
  if (reply.four.length < BANNER_SIZES.four) return `"four" needs ${BANNER_SIZES.four} entries`;
  if (reply.snapshots.length < BANNER_SIZES.three) return `"snapshots" needs ${BANNER_SIZES.three} entries`;

  const plan: BannerPlan = { featured: { title: clip(top.title, ITEM_LIMITS.title) }, four: [], snapshots: [] };
  if (kind === "memories") {
    if (!top.premise?.trim()) return "featured.premise is missing";
    if (!top.cgBrief?.trim()) return "featured.cgBrief is missing";
    // An explicit brief needs its clothed twin; a null or missing one is fine when the brief is not explicit.
    const clothed = explicitArt && top.explicit === true ? (top.clothedBrief?.trim() ?? "") : null;
    if (clothed === "") return "featured.clothedBrief is missing (it is needed when explicit is true)";
    // The featured love interest is always in the key image, first; anyone else only when the planner put them in.
    const others = (top.cgCast ?? [])
      .map((name) => name.trim())
      .filter((name) => name && !sameName(name, featured.name));
    plan.featured.premise = clip(top.premise, ITEM_LIMITS.premise);
    plan.featured.cg = {
      brief: clip(top.cgBrief, ITEM_LIMITS.line),
      cast: [featured.name, ...new Set(others)].slice(0, 3),
      // Kept only when the plan was offered it (as a story CG's, S/story/beats.ts cgExplicit), and then painted
      // explicit only while the world still allows it (S/wish/banners.ts).
      ...(clothed ? { explicit: true as const, clothed: clip(clothed, ITEM_LIMITS.line) } : {}),
    };
  } else {
    if (!top.look) return "featured.look is missing";
    plan.featured.look = cleanLook(top.look);
  }

  for (const [index, entry] of reply.four.slice(0, BANNER_SIZES.four).entries()) {
    if (kind === "my-wardrobe") {
      if (!entry.look) return `four[${index}].look is missing`;
      plan.four.push({ li: null, title: clip(entry.title, ITEM_LIMITS.title), look: cleanLook(entry.look) });
      continue;
    }
    const li = liOf(entry.li);
    if (!li) return `four[${index}].li is not one of the love interest ids given`;
    if (kind === "his-wardrobe") {
      if (!entry.look) return `four[${index}].look is missing`;
      if (li.id === featured.id && units.length > 1) return `four[${index}] must be another love interest's look`;
      plan.four.push({ li: li.id, title: clip(entry.title, ITEM_LIMITS.title), look: cleanLook(entry.look) });
    } else {
      if (!entry.premise?.trim()) return `four[${index}].premise is missing`;
      if (moments && !entry.cgBrief?.trim()) return `four[${index}].cgBrief is missing`;
      plan.four.push({
        li: li.id,
        title: clip(entry.title, ITEM_LIMITS.title),
        premise: clip(entry.premise, ITEM_LIMITS.premise),
        ...(entry.cgBrief?.trim()
          ? {
              cg: {
                brief: clip(entry.cgBrief, ITEM_LIMITS.line),
                cast: [
                  li.name,
                  ...(playerName && entry.cgCast?.some((name) => sameName(name, playerName)) ? [playerName] : []),
                ],
              },
            }
          : {}),
      });
    }
  }

  for (const [index, entry] of reply.snapshots.slice(0, BANNER_SIZES.three).entries()) {
    const li = liOf(entry.li);
    if (!li) return `snapshots[${index}].li is not one of the love interest ids given`;
    const text = clip(entry.text, ITEM_LIMITS.snapshot);
    // A missing title takes the Snapshot's first words, or its first characters when it has no spaces (as in Japanese).
    const title =
      entry.title?.trim() ||
      `${/\s/.test(text) ? text.split(/\s+/).slice(0, 5).join(" ") : [...text].slice(0, 12).join("")}…`;
    plan.snapshots.push({
      li: li.id,
      title: clip(title, ITEM_LIMITS.title),
      text,
      ...(entry.cgBrief?.trim()
        ? {
            cg: {
              brief: entry.cgBrief.trim(),
              cast: [
                li.name,
                ...(playerName && entry.cgCast?.some((name) => sameName(name, playerName)) ? [playerName] : []),
              ],
            },
          }
        : {}),
    });
  }
  return plan;
}
