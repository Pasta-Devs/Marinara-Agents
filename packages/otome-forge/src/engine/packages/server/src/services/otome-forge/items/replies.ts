// ──────────────────────────────────────────────
// Otome Forge: what the item prompts P19 (he noticed), P21 (a Memory's Character Story plan), the extra story plan
// (#2025) and P24 (Show {{name}}) send back, and the checks on a line (plan M4 "Other prompts")
// ──────────────────────────────────────────────
// The prompts are in S/prompts.ts. P21's and the extra story's plans are P5's shape (S/story/replies.ts
// ChapterPlanSchema) with their own fields; the extra story kinds a world may have (prestigeKindsFor) are read by the
// prompt and by S/items/prestige.ts.
import { z, type ZodType } from "zod";
import type { World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { intimacyOpen } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { PRESTIGE_KINDS, type PrestigeKind } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { lineWords } from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import { ChapterPlanSchema, type ChapterPlanReply } from "../story/replies.js";

export const STORY_NODES_MIN = 3;
export const STORY_NODES_MAX = 5;
export const STORY_PLAN_TOKENS = 3000;
export const LINE_TOKENS = 300;
const LINE_MAX = 400;

const lineText = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
/** The line without the quotation marks a model may wrap it in. */
const quoteless = (value: string) => value.replace(/^["“”«»「『]+|["“”«»」』]+$/gu, "").trim();

/** One line of his, or what is wrong with it (the generation core's repair turn names it). */
export function checkLine(value: unknown, maxWords: number): { text: string } | string {
  const text = quoteless(lineText(value));
  if (!text) return "text is empty";
  if (text.length > LINE_MAX || lineWords(text) > maxWords) return `text must be one line of at most ${maxWords} words`;
  return { text };
}

// ── P21's reply: a Memory's Character Story plan (the prompt: S/prompts.ts storyPlanMessages) ──

/** P21's reply: a chapter plan (P5's shape) and the one line he says that the Memory card voices. */
export interface StoryPlanReply extends ChapterPlanReply {
  voicedLine: string;
}

// P5's fields, with the voiced line added (zod v3 and v4 both keep an object schema's fields on `.shape`).
const PLAN_FIELDS = (ChapterPlanSchema as unknown as { shape: Record<string, ZodType> }).shape;
export const StoryPlanSchema = z.object({
  ...PLAN_FIELDS,
  voicedLine: z.string().min(1).max(LINE_MAX),
}) as unknown as ZodType<StoryPlanReply>;

// ── The extra story plan's reply (#2025; the prompt: S/prompts.ts prestigePlanMessages) ──

/** The extra story plan's reply: P21's plan without a ledger or a voiced line, with the story's kind and premise. */
export interface PrestigePlanReply extends Pick<ChapterPlanReply, "title" | "tags" | "summary" | "nodes"> {
  kind: string;
  premise: string;
}

export const PrestigePlanSchema = z.object({
  kind: z.string().max(40),
  premise: z.string().min(1).max(600),
  title: PLAN_FIELDS.title!,
  tags: PLAN_FIELDS.tags!,
  summary: PLAN_FIELDS.summary!,
  nodes: PLAN_FIELDS.nodes!,
}) as unknown as ZodType<PrestigePlanReply>;

/** The extra story kinds this world may have: a kink only under NSFW Heat (intimacyOpen). */
export function prestigeKindsFor(world: Pick<World, "content">): PrestigeKind[] {
  return PRESTIGE_KINDS.filter((kind) => kind !== "kink" || intimacyOpen(world.content));
}

// ── P19's (he noticed) and P24's (Show {{name}}) replies (the prompts: S/prompts.ts noticedMessages, showMessages) ──

export const LineReplySchema: ZodType<{ text: string }> = z.object({ text: z.string().min(1).max(LINE_MAX) });

export interface ShowReply {
  text: string;
  face?: string | null;
}

export const ShowReplySchema: ZodType<ShowReply> = z.object({
  text: z.string().min(1).max(LINE_MAX),
  face: z.string().max(20).nullable().optional(),
});
