// ──────────────────────────────────────────────
// Otome Forge: what P20, the banner plan, sends back, and how a banner is written from it (plan M4 "P20 banner-plan")
// ──────────────────────────────────────────────
// One structured call per banner, when the banner is created (Wish open); the prompt is in
// S/prompts.ts. normalizeBannerPlan reads the reply as the banner (love interests named by id or by name, every text
// clipped to its document's limit) or names what is wrong for the repair turn. Pulls never call a model.
import { z } from "zod";
import type { Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { sameName } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  BANNER_SIZES,
  type BannerKind,
  type ItemLook,
} from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { ITEM_LIMITS } from "../schemas/wish.js";

export const BANNER_PLAN_TOKENS = 3000;

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
      brief: clip(top.cgBrief, ITEM_LIMITS.brief),
      cast: [featured.name, ...new Set(others)].slice(0, 3),
      // Kept only when the plan was offered it (as a story CG's, S/story/beats.ts cgExplicit), and then painted
      // explicit only while the world still allows it (S/wish/banners.ts).
      ...(clothed ? { explicit: true as const, clothed: clip(clothed, ITEM_LIMITS.brief) } : {}),
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
                brief: clip(entry.cgBrief, ITEM_LIMITS.brief),
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
