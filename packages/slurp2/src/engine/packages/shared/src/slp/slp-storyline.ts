/**
 * Story Pack format v2 (docs/STORYLINES.md, "Storylines"): one storyline shape for what v1 keeps as arcs,
 * events, situations and dramas. A storyline has a cast, `requires` on state, an optional track, stages and
 * endings. The validator rejects a cycle, so every run ends: a stage leads on to a later stage or an ending,
 * or it stands (a situation). Pure; v1 packs convert through `slp-storyline-v1.ts`.
 */
import { z } from "zod";
import { slpFilledDefault } from "./slp-schema-defaults.js";
import {
  checkSlpDramaRoles,
  slpFitSchema,
  slpDramaBeatRoles,
  slpDramaBeatSchema,
  slpDramaChoiceSchema,
  slpDramaDialsSchema,
  slpDramaOutcomeSchema,
  slpDramaRoleSchema,
} from "./slp-drama.js";
import {
  SLP_STORY_PACK_FORMAT,
  SLP_STORY_PACK_MAX_ENTRIES,
  SLP_STORY_TRACKS,
  slpArcBlueprintSchema,
  slpEventActivationSchema,
  slpEventBlueprintSchema,
  slpEventTargetSchema,
  slpInfluenceDraftSchema,
  slpStoryAutomationSchema,
  slpStoryConditionFields,
  slpStoryOutcomeSchema,
  slpStoryProvenanceSchema,
} from "./slp-story-engine.js";

export const SLP_STORY_PACK_V2_SCHEMA_VERSION = 2 as const;
export const SLP_STORYLINE_MAX_STAGES = 40;
export const SLP_STORYLINE_MAX_ENDINGS = 6;
export const SLP_STORYLINE_MAX_DAYS = 365;

const key = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,47}$/u, "use lowercase letters, digits and dashes");
const id = (max = 128) => z.string().trim().min(1).max(max);
const tag = z.string().trim().min(1).max(64);
const tags = z.array(tag).max(50).default([]);
const chapter = slpArcBlueprintSchema.shape.chapters.element.shape;

/** State a storyline needs (on its start, or on an edge): tags that must be set, tags that must not. */
export const slpStoryRequiresSchema = z
  .object({ tags: z.array(tag).max(10).default([]), lacks: z.array(tag).max(10).default([]) })
  .strict();
export type SlpStoryRequires = z.infer<typeof slpStoryRequiresSchema>;

/** Both outcome families: story facts and boosts, and the ties a drama leaves. */
export const slpStorylineOutcomeSchema = z.discriminatedUnion("kind", [
  ...slpStoryOutcomeSchema.options,
  ...slpDramaOutcomeSchema.options,
]);
export type SlpStorylineOutcome = z.infer<typeof slpStorylineOutcomeSchema>;

/** Where a stage goes: a stage or ending key, or the first entry whose `when` holds (the last has none). */
const target = key;
const nextSchema = z.union([
  target,
  z
    .array(
      z
        .object({
          to: target,
          when: z
            .object({ tag, set: z.boolean().default(true) })
            .strict()
            .optional(),
        })
        .strict(),
    )
    .min(1)
    .max(6),
]);

/** What is true while the stage runs (an arc chapter's reach); gone when it ends. */
const stageConditionSchema = z
  .object({
    tag: tag.optional(),
    label: id(120).optional(),
    ...slpStoryConditionFields,
    mood: chapter.mood,
    effects: chapter.effects,
    profile: chapter.profile,
    storyTags: chapter.storyTags,
  })
  .strict();

export const slpStorylineStageSchema = z
  .object({
    key,
    label: id(200),
    /** For the writer: what this stage is about (an event's guidance). */
    guidance: z.string().trim().max(600).default(""),
    /** How long it runs. None: it stands until a choice moves it, or for good. */
    days: z.tuple([z.number().int().min(0).max(365), z.number().int().min(0).max(365)]).optional(),
    minSpice: z.number().int().min(0).max(3).optional(),
    /** A stage that does not fit the lead is skipped, like one nobody can be cast for. */
    fit: slpFitSchema.optional(),
    condition: stageConditionSchema.optional(),
    influences: z.array(slpInfluenceDraftSchema).max(16).default([]),
    /** Planned: drawn once while the stage runs. */
    beats: z.array(slpDramaBeatSchema).max(8).default([]),
    /** Small moments drawn now and then while the stage runs. */
    deck: z.array(slpDramaBeatSchema).max(24).default([]),
    choice: slpDramaChoiceSchema
      .extend({
        // An arc's fans' question may be as long as the poll allows.
        question: z.string().trim().min(1).max(240),
        options: z
          .array(
            z
              .object({
                label: z.string().trim().min(1).max(120),
                next: target,
                fit: slpFitSchema.optional(),
                /** Offered only while the storyline's dials have these values (a hard ending off by default). */
                when: z.record(key, key).optional(),
              })
              .strict(),
          )
          .min(2)
          .max(4),
      })
      .optional(),
    /** Without a choice: this, else the next stage in the list, else the first ending. */
    next: nextSchema.optional(),
    /** Applied when the stage starts (an arc chapter) and when it ends (a drama stage). */
    enter: z.array(slpStorylineOutcomeSchema).max(16).default([]),
    leave: z.array(slpStorylineOutcomeSchema).max(16).default([]),
  })
  .strict();
export type SlpStorylineStage = z.infer<typeof slpStorylineStageSchema>;

export const slpStorylineEndingSchema = z
  .object({
    key,
    label: id(120),
    beat: slpDramaBeatSchema.optional(),
    outcomes: z.array(slpStorylineOutcomeSchema).max(16).default([]),
  })
  .strict();
export type SlpStorylineEnding = z.infer<typeof slpStorylineEndingSchema>;

export const slpStorylineStartSchema = z
  .object({
    mode: slpStoryAutomationSchema.default("inherit"),
    activation: slpEventActivationSchema.optional(),
    target: slpEventTargetSchema.optional(),
    weight: z.number().min(0.1).max(10).default(1),
    /** Cast from the people of this running storyline (a drama inside a situation). */
    within: id(160).optional(),
    cooldownDays: z.number().int().min(0).max(365).default(0),
    /** A life event a Creator has only once (moving, a new job). */
    once: z.boolean().default(false),
  })
  .strict();

export const SLP_STORYLINE_SOURCES = ["arc", "event", "situation", "drama"] as const;

/** The storyline shape without the graph checks: a run's own copy, built by code and edited in place. */
export const slpStorylineObjectSchema = z
  .object({
    id: id(160),
    contentId: id().optional(),
    name: id(80),
    description: z.string().trim().max(2000).default(""),
    tone: z.string().trim().max(80).default(""),
    tags,
    storyTags: tags,
    /** A storyline that does not fit the lead never starts. */
    fit: slpFitSchema.optional(),
    /** 1 to 5 roles; one role is a solo story. */
    cast: z.array(slpDramaRoleSchema).min(1).max(5),
    requires: slpFilledDefault(slpStoryRequiresSchema),
    /** A built-in track, or one its pack adds (`tracks`). */
    track: key.optional(),
    start: slpFilledDefault(slpStorylineStartSchema),
    maxDays: z.number().int().min(1).max(SLP_STORYLINE_MAX_DAYS).default(90),
    dials: slpDramaDialsSchema,
    /** At most this many deck moments reach the player a day. */
    perDay: z.number().int().min(1).max(6).default(2),
    stages: z.array(slpStorylineStageSchema).min(1).max(SLP_STORYLINE_MAX_STAGES),
    endings: z.array(slpStorylineEndingSchema).max(SLP_STORYLINE_MAX_ENDINGS).default([]),
    revertProfileAtEnd: z.boolean().default(false),
    enabled: z.boolean().default(true),
    builtin: z.boolean().default(false),
    hidden: z.boolean().default(false),
    provenance: slpStoryProvenanceSchema.optional(),
    /** What a converted storyline was in v1. */
    source: z
      .object({ kind: z.enum(SLP_STORYLINE_SOURCES), id: id() })
      .strict()
      .optional(),
  })
  .strict();

export const slpStorylineEdges = (next: z.infer<typeof nextSchema>) =>
  typeof next === "string" ? [{ to: next }] : next;

/** The edges out of a stage, `null` where it stands. Shared with the runtime and the dry run. */
export function slpStorylineNext(
  storyline: Pick<z.infer<typeof slpStorylineObjectSchema>, "stages" | "endings">,
  index: number,
): { to: string; when?: { tag: string; set: boolean } }[] | null {
  const stage = storyline.stages[index]!;
  if (stage.choice) return stage.choice.options.map((option) => ({ to: option.next }));
  if (stage.next !== undefined) return slpStorylineEdges(stage.next);
  if (!stage.days) return null;
  const following = storyline.stages[index + 1]?.key ?? storyline.endings[0]?.key;
  return following ? [{ to: following }] : null;
}

export const slpStorylineSchema = slpStorylineObjectSchema.superRefine((storyline, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  const stageIndex = new Map(storyline.stages.map((stage, index) => [stage.key, index]));
  const endingKeys = new Set(storyline.endings.map((ending) => ending.key));
  if (stageIndex.size !== storyline.stages.length) issue("stage keys must be unique");
  if (endingKeys.size !== storyline.endings.length) issue("ending keys must be unique");
  for (const ending of endingKeys) if (stageIndex.has(ending)) issue(`"${ending}" is both a stage and an ending`);
  const edges = storyline.stages.map((stage, index) => {
    if (stage.days && stage.days[0] > stage.days[1]) issue(`stage "${stage.key}": days go from low to high`);
    if (stage.choice) {
      if (stage.choice.default >= stage.choice.options.length)
        issue(`stage "${stage.key}": the default is not an option`);
      if (stage.choice.asks === "role" && !stage.choice.role)
        issue(`stage "${stage.key}": a role choice names its role`);
    }
    if (Array.isArray(stage.next) && stage.next.at(-1)!.when) issue(`stage "${stage.key}": the last next has no when`);
    const edges = slpStorylineNext(storyline, index);
    // Only a lone stage may stand (a situation); anything else has somewhere to go, so every run ends.
    if (!edges && !(storyline.stages.length === 1 && !storyline.endings.length && !stage.days))
      issue(`stage "${stage.key}" has nowhere to go`);
    // Beside a choice, `next` is the way on when the stage is skipped (too hot for the level).
    const fallback = stage.choice && stage.next !== undefined ? slpStorylineEdges(stage.next) : [];
    const out = [...(edges ?? []), ...fallback];
    for (const edge of out)
      if (!stageIndex.has(edge.to) && !endingKeys.has(edge.to))
        issue(`stage "${stage.key}": "${edge.to}" does not exist`);
    return out.map((edge) => stageIndex.get(edge.to)).filter((to): to is number => to !== undefined);
  });
  // Every run ends: no stage leads back to itself, and every stage is reachable from the first.
  const state = new Array<0 | 1 | 2>(edges.length).fill(0);
  const longest = new Array<number>(edges.length).fill(0);
  const visit = (index: number): boolean => {
    if (state[index] === 2) return true;
    if (state[index] === 1) return false;
    state[index] = 1;
    let after = 0;
    for (const to of edges[index]!) {
      if (!visit(to)) return false;
      after = Math.max(after, longest[to]!);
    }
    longest[index] = (storyline.stages[index]!.days?.[0] ?? 0) + after;
    state[index] = 2;
    return true;
  };
  if (!visit(0)) issue("a stage leads back to itself: every storyline must end");
  else {
    const unreachable = storyline.stages.filter((_, index) => state[index] !== 2).map((stage) => stage.key);
    if (unreachable.length) issue(`stages nobody reaches: ${unreachable.join(", ")}`);
    if (longest[0]! > storyline.maxDays) issue("maxDays is shorter than the longest way through");
  }
  checkSlpDramaRoles(
    { roles: storyline.cast },
    [
      ...storyline.stages.flatMap((stage) => [
        ...stage.beats.flatMap(slpDramaBeatRoles),
        ...stage.deck.flatMap(slpDramaBeatRoles),
        stage.choice?.role,
        ...[...stage.enter, ...stage.leave].flatMap((outcome) => ("between" in outcome ? outcome.between : [])),
      ]),
      ...storyline.endings.flatMap((ending) => [
        ...(ending.beat ? slpDramaBeatRoles(ending.beat) : []),
        ...ending.outcomes.flatMap((outcome) => ("between" in outcome ? outcome.between : [])),
      ]),
    ],
    context,
  );
});
export type SlpStoryline = z.infer<typeof slpStorylineSchema>;

/** A dated pack moment: today's event shape, the beats the planner posts for it, and a JSON fit (PR 5b). */
export const slpOccasionSchema = slpEventBlueprintSchema.extend({
  fit: slpFitSchema.optional(),
  beats: z
    .array(
      z
        .object({
          /** A post beat type; the planner drops one it does not know. */
          type: z.string().trim().min(1).max(32),
          line: z.string().trim().min(1).max(600),
          withPartner: z.string().trim().min(1).max(600).optional(),
          withCollab: z.string().trim().min(1).max(600).optional(),
          level: z.enum(["suggestive", "nudity", "explicit"]).optional(),
          atDay: z.number().min(0).max(31).optional(),
        })
        .strict(),
    )
    .max(8)
    .default([]),
});
export type SlpOccasion = z.infer<typeof slpOccasionSchema>;

export const slpStoryPackV2Schema = z
  .object({
    format: z.literal(SLP_STORY_PACK_FORMAT),
    schemaVersion: z.literal(SLP_STORY_PACK_V2_SCHEMA_VERSION),
    id: id(),
    version: id(32),
    name: id(100),
    description: z.string().trim().max(1000).default(""),
    author: z.string().trim().min(1).max(100).optional(),
    /** Tracks this pack adds beside the built-in ones. */
    tracks: z.array(key).max(6).default([]),
    storylines: z.array(slpStorylineSchema).max(SLP_STORY_PACK_MAX_ENTRIES).default([]),
    occasions: z.array(slpOccasionSchema).max(SLP_STORY_PACK_MAX_ENTRIES).default([]),
    /** What the pack is about, as words (for the Packs list). */
    topics: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  })
  .strict()
  .superRefine((pack, context) => {
    const ids = pack.storylines.map((storyline) => storyline.id);
    if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "storyline ids must be unique" });
    const occasions = pack.occasions.map((occasion) => occasion.contentId ?? occasion.id);
    if (new Set(occasions).size !== occasions.length)
      context.addIssue({ code: "custom", message: "occasion ids must be unique" });
    const tracks = new Set<string>([...SLP_STORY_TRACKS, ...pack.tracks]);
    for (const storyline of pack.storylines)
      if (storyline.track && !tracks.has(storyline.track))
        context.addIssue({ code: "custom", message: `${storyline.id}: unknown track "${storyline.track}"` });
  });
export type SlpStoryPackV2 = z.infer<typeof slpStoryPackV2Schema>;
