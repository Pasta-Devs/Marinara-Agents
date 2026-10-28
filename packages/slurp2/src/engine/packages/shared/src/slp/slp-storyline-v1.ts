/**
 * v1 Story Packs convert to storylines on import (docs/STORYLINES.md, "One pack format (v2)"). An arc's
 * chapters become stages (a fans' choice leads into its branch chapters, then on); an event is one timed
 * stage; a situation is one standing stage with a deck and a tag; a drama keeps its stages and its exit
 * becomes the ending's beat. A drama that needs a situation requires that situation's tag. Pure.
 */
import type { SlpDrama, SlpSituation } from "./slp-drama.js";
import {
  SLP_STORY_PACK_FORMAT,
  slpStoryPackSchema,
  type SlpArcBlueprint,
  type SlpEventActivation,
  type SlpEventBlueprint,
  type SlpStoryPack,
} from "./slp-story-engine.js";
import {
  SLP_STORY_PACK_V2_SCHEMA_VERSION,
  SLP_STORYLINE_MAX_DAYS,
  slpStoryPackV2Schema,
  slpStorylineSchema,
  type SlpStoryline,
  type SlpStoryPackV2,
} from "./slp-storyline.js";

type Draft = Record<string, unknown> & { id: string };

const SOLO = [{ key: "creator" }];
const END = { key: "end", label: "End" };
const DAY_MS = 86_400_000;

const boost = (opportunity: { storyTags: string[]; weight: number }) => ({
  kind: "grant-arc-opportunity" as const,
  storyTags: opportunity.storyTags,
  weight: opportunity.weight,
});

const capDays = (days: number) => Math.min(SLP_STORYLINE_MAX_DAYS, Math.max(1, days));

export function slpStorylineDraftFromArc(arc: SlpArcBlueprint): Draft {
  const stages: Record<string, unknown>[] = [];
  let longest = 0;
  arc.chapters.forEach((chapter, index) => {
    const key = `c${index + 1}`;
    const after = index + 1 < arc.chapters.length ? `c${index + 2}` : END.key;
    const { mood, effects, profile, storyTags } = chapter;
    const branches = chapter.choice?.options ?? [];
    stages.push({
      key,
      label: chapter.label,
      // v1 reads a reversed pair as its low end (slp-arc-progress).
      days: [chapter.minDays, Math.max(chapter.minDays, chapter.maxDays)],
      ...(mood || effects || profile || storyTags ? { condition: { mood, effects, profile, storyTags } } : {}),
      influences: chapter.influences,
      enter: [...chapter.outcomes, ...chapter.opportunities.map(boost)],
      ...(chapter.choice
        ? {
            choice: {
              asks: "fans",
              question: chapter.choice.question.slice(0, 200),
              default: 0,
              options: branches.map((option, choice) => ({
                label: option.label,
                next: option.chapters.length ? `${key}-${choice + 1}-1` : after,
              })),
            },
          }
        : { next: after }),
    });
    branches.forEach((option, choice) =>
      option.chapters.forEach((branch, step) =>
        stages.push({
          key: `${key}-${choice + 1}-${step + 1}`,
          label: branch.label,
          days: [branch.minDays, Math.max(branch.minDays, branch.maxDays)],
          next: step + 1 < option.chapters.length ? `${key}-${choice + 1}-${step + 2}` : after,
        }),
      ),
    );
    longest +=
      Math.max(chapter.minDays, chapter.maxDays) +
      Math.max(
        0,
        ...branches.map((option) =>
          option.chapters.reduce((sum, branch) => sum + Math.max(branch.minDays, branch.maxDays), 0),
        ),
      );
  });
  return {
    id: `arc:${arc.id}`,
    contentId: arc.contentId,
    name: arc.name,
    description: arc.description,
    tone: arc.tone,
    tags: arc.tags,
    storyTags: arc.storyTags,
    cast: SOLO,
    start: { mode: arc.automation, once: arc.once ?? false },
    maxDays: capDays(Math.max(arc.durationDays, longest)),
    stages,
    endings: [END],
    revertProfileAtEnd: arc.revertProfileAtEnd ?? false,
    enabled: arc.enabled,
    builtin: arc.builtin,
    hidden: arc.hidden,
    provenance: arc.provenance,
    source: { kind: "arc", id: arc.id },
  };
}

const activationDays = (activation: SlpEventActivation) =>
  activation.kind === "window"
    ? Math.ceil((Date.parse(activation.endsAt) - Date.parse(activation.startsAt)) / DAY_MS)
    : activation.durationDays;

export function slpStorylineDraftFromEvent(event: SlpEventBlueprint): Draft {
  const days = capDays(activationDays(event.activation));
  return {
    id: `event:${event.id}`,
    contentId: event.contentId,
    name: event.name,
    storyTags: event.storyTags,
    cast: SOLO,
    start: { mode: event.automation, activation: event.activation, target: event.target },
    maxDays: days,
    stages: [
      {
        key: "run",
        label: event.name,
        guidance: event.guidance,
        days: [days, days],
        influences: event.influences,
        enter: [...event.outcomes, ...event.arcOpportunities.map(boost)],
      },
    ],
    endings: [END],
    enabled: event.enabled,
    builtin: event.builtin,
    hidden: event.hidden,
    provenance: event.provenance,
    source: { kind: "event", id: event.id },
  };
}

export function slpStorylineDraftFromSituation(situation: SlpSituation): Draft {
  return {
    id: `situation:${situation.id}`,
    name: situation.name,
    description: situation.description,
    cast: situation.roles,
    // v1 starts every enabled situation whose roles can be cast.
    start: { mode: "auto" },
    maxDays: SLP_STORYLINE_MAX_DAYS,
    dials: situation.dials,
    perDay: situation.perDay,
    stages: [{ key: "stands", label: situation.name, condition: { tag: situation.id }, deck: situation.deck }],
    enabled: situation.enabled,
    builtin: situation.builtin,
    source: { kind: "situation", id: situation.id },
  };
}

export function slpStorylineDraftFromDrama(drama: SlpDrama): Draft {
  return {
    id: `drama:${drama.id}`,
    name: drama.name,
    description: drama.description,
    cast: drama.roles,
    requires: drama.requires ? { tags: [drama.requires.situation] } : {},
    start: {
      weight: drama.weight,
      cooldownDays: drama.cooldownDays,
      ...(drama.requires ? { within: `situation:${drama.requires.situation}` } : {}),
    },
    maxDays: drama.maxDays,
    stages: drama.stages.map((stage) => ({
      key: stage.key,
      label: stage.key,
      days: stage.days,
      minSpice: stage.minSpice,
      beats: stage.beats,
      ...(stage.choice ? { choice: stage.choice } : {}),
      ...(stage.next ? { next: stage.next } : {}),
      leave: stage.outcomes,
    })),
    endings: [{ ...END, beat: drama.exit }],
    enabled: drama.enabled,
    builtin: drama.builtin,
    source: { kind: "drama", id: drama.id },
  };
}

/** Every entry of a v1 pack as a storyline; an entry that does not convert is named in `errors`. */
export function slpStorylinesFromV1(pack: Pick<SlpStoryPack, "arcs" | "events" | "situations" | "dramas">): {
  storylines: SlpStoryline[];
  errors: string[];
} {
  const drafts = [
    ...pack.arcs.map(slpStorylineDraftFromArc),
    ...pack.events.map(slpStorylineDraftFromEvent),
    ...pack.situations.map(slpStorylineDraftFromSituation),
    ...pack.dramas.map(slpStorylineDraftFromDrama),
  ];
  const storylines: SlpStoryline[] = [];
  const errors: string[] = [];
  for (const draft of drafts) {
    const parsed = slpStorylineSchema.safeParse(draft);
    if (parsed.success) storylines.push(parsed.data);
    else errors.push(`${draft.id}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return { storylines, errors };
}

/** A pack in either format, as v2. A v1 pack converts; nothing half-converted is returned. */
export function parseSlpStoryPackV2(value: unknown): { pack: SlpStoryPackV2 | null; errors: string[] } {
  const version = (value as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version === SLP_STORY_PACK_V2_SCHEMA_VERSION) {
    const parsed = slpStoryPackV2Schema.safeParse(value);
    return parsed.success
      ? { pack: parsed.data, errors: [] }
      : { pack: null, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  const v1 = slpStoryPackSchema.safeParse(value);
  if (!v1.success)
    return { pack: null, errors: v1.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  const { storylines, errors } = slpStorylinesFromV1(v1.data);
  if (errors.length) return { pack: null, errors };
  const { id, version: packVersion, name, description, author } = v1.data;
  return {
    pack: {
      format: SLP_STORY_PACK_FORMAT,
      schemaVersion: SLP_STORY_PACK_V2_SCHEMA_VERSION,
      id,
      version: packVersion,
      name,
      description,
      ...(author ? { author } : {}),
      tracks: [],
      storylines,
      occasions: [],
      topics: [],
    },
    errors: [],
  };
}
