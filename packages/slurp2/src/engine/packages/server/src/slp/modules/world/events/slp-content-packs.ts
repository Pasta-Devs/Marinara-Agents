/**
 * Content packs: bundles of events, dated moments and storylines the player switches on and off in
 * Backstage › Packs. Pure.
 *
 * A pack is not a second library. Switched on, its events join the calendar (`platformEvents`) and
 * its storylines join the storyline library (`arcLibrary`), as built-ins with the pack as their
 * provenance, so the calendar, the story engine, Studio and the story-pack export all see them the
 * usual way. Switched off, they leave both again. The join happens where saved settings are read,
 * so a pack added in a later version reaches existing installs, and a pack item the player hid
 * stays hidden (it is still there, so it is not added again).
 */
import {
  SLP_STORY_PACK_FORMAT,
  SLP_STORY_PACK_SCHEMA_VERSION,
  slpArcBlueprintSchema,
  slpEventBlueprintSchema,
  slpStoryPackSchema,
  type SlpArcBlueprint,
  type SlpEventBlueprint,
  type SlpStoryPack,
} from "../../../../../../shared/src/slp/slp-story-engine.js";
import {
  SLURP_CONTENT_PACK_LIBRARY,
  type SlurpContentPack,
  type SlurpPackArc,
  type SlurpPackDateBeats,
  type SlurpPackEvent,
} from "./slp-content-pack-library.js";

/** Pack id → on/off, as the player set it. A pack missing here uses its default. */
export type SlurpContentPackToggles = Record<string, boolean>;

export function readSlurpContentPackToggles(raw: unknown): SlurpContentPackToggles {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, boolean] =>
        typeof entry[1] === "boolean" && SLURP_CONTENT_PACK_LIBRARY.some((pack) => pack.id === entry[0]),
    ),
  );
}

export function slurpContentPackOn(pack: Pick<SlurpContentPack, "id" | "defaultOn">, toggles: SlurpContentPackToggles) {
  return toggles[pack.id] ?? pack.defaultOn;
}

/** The packs switched on. */
export function slurpContentPacksOn(toggles: SlurpContentPackToggles): SlurpContentPack[] {
  return SLURP_CONTENT_PACK_LIBRARY.filter((pack) => slurpContentPackOn(pack, toggles));
}

const provenance = (packId: string, contentId: string) => ({
  packId,
  contentId,
  packVersion: "1.0.0",
  // Like the core calendar: a placeholder, so a pack update is never mistaken for a local edit.
  contentHash: "0".repeat(64),
});

function eventBlueprint(pack: SlurpContentPack, event: SlurpPackEvent): SlpEventBlueprint {
  return slpEventBlueprintSchema.parse({
    id: `pack-${event.contentId}`,
    contentId: event.contentId,
    name: event.name,
    guidance: event.guidance,
    storyTags: event.storyTags,
    enabled: true,
    builtin: true,
    activation: { kind: "annual", month: event.month, day: event.day, durationDays: event.days },
    target: { kind: "all" },
    provenance: provenance(pack.id, event.contentId),
  });
}

function arcBlueprint(pack: SlurpContentPack, arc: SlurpPackArc): SlpArcBlueprint {
  return slpArcBlueprintSchema.parse({
    id: `pack-${arc.contentId}`,
    contentId: arc.contentId,
    name: arc.name,
    description: arc.description,
    chapters: arc.chapters.map(([label, minDays, maxDays, poll]) => ({
      label,
      minDays,
      maxDays,
      // A real fan poll: the winner becomes a short chapter of its own, then the story goes on.
      ...(poll
        ? {
            choice: {
              question: poll.question,
              options: poll.options.map((option) => ({
                label: option,
                chapters: [{ label: `the fans picked: ${option.toLocaleLowerCase()}`, minDays: 1, maxDays: 2 }],
              })),
            },
          }
        : {}),
    })),
    ...(arc.once ? { once: true } : {}),
    storyTags: arc.storyTags,
    enabled: true,
    builtin: true,
    provenance: provenance(pack.id, arc.contentId),
  });
}

/** A pack in the portable story-pack format, for "Review" and the library export. */
export function slurpContentStoryPack(pack: SlurpContentPack): SlpStoryPack {
  return slpStoryPackSchema.parse({
    format: SLP_STORY_PACK_FORMAT,
    schemaVersion: SLP_STORY_PACK_SCHEMA_VERSION,
    id: pack.id,
    version: "1.0.0",
    name: pack.name,
    description: pack.adds,
    author: "Slurp",
    arcs: pack.arcs.map((arc) => arcBlueprint(pack, arc)),
    events: pack.events.map((event) => eventBlueprint(pack, event)),
  });
}

type Entry = { provenance?: { packId: string; contentId: string } | undefined };
const fromPack = (entry: Entry, packId: string) => entry.provenance?.packId === packId;
const has = (list: readonly Entry[], packId: string, contentId: string) =>
  list.some((entry) => entry.provenance?.packId === packId && entry.provenance.contentId === contentId);

/**
 * The libraries with the packs applied: a pack that is on adds what it is missing (inside the
 * libraries' size limits, so a full library never gets rejected and reset), a pack that is off
 * takes its items out. Everything else stays exactly as saved.
 */
export function slurpApplyContentPacks<A extends Entry, E extends Entry>(input: {
  arcs: readonly A[];
  events: readonly E[];
  toggles: SlurpContentPackToggles;
  maxArcs: number;
  maxEvents: number;
}): { arcs: A[]; events: E[] } {
  let arcs = [...input.arcs];
  let events = [...input.events];
  for (const pack of SLURP_CONTENT_PACK_LIBRARY) {
    if (!slurpContentPackOn(pack, input.toggles)) {
      arcs = arcs.filter((entry) => !fromPack(entry, pack.id));
      events = events.filter((entry) => !fromPack(entry, pack.id));
      continue;
    }
    for (const arc of pack.arcs)
      if (!has(arcs, pack.id, arc.contentId) && arcs.length < input.maxArcs)
        arcs.push(arcBlueprint(pack, arc) as unknown as A);
    for (const event of pack.events)
      if (!has(events, pack.id, event.contentId) && events.length < input.maxEvents)
        events.push(eventBlueprint(pack, event) as unknown as E);
  }
  return { arcs, events };
}

/** What Backstage lists: each pack, what it adds and what is in it. On/off is the player's setting. */
export function slurpContentPackSummaries() {
  return SLURP_CONTENT_PACK_LIBRARY.map((pack) => ({
    id: pack.id,
    name: pack.name,
    adds: pack.adds,
    defaultOn: pack.defaultOn,
    dates: [
      ...pack.events.map((event) => ({ name: event.name, month: event.month, day: event.day })),
      ...Object.values(pack.dateBeats ?? {}).map((entry) => ({ name: entry.name, month: null, day: null })),
    ],
    arcs: pack.arcs.map((arc) => arc.name),
    extras: [...(pack.birthday ? ["birthday"] : []), ...(pack.firstThousandSubs ? ["first-1k-subs"] : [])],
  }));
}

/** A pack event's fit and moments, by its content id (only while its pack is on). */
export function slurpPackEventFor(contentId: string, toggles: SlurpContentPackToggles): SlurpPackEvent | null {
  for (const pack of slurpContentPacksOn(toggles)) {
    const found = pack.events.find((event) => event.contentId === contentId);
    if (found) return found;
  }
  return null;
}

/** Moments an on pack adds to another pack's date (the core holidays), by that event's content id. */
export function slurpPackDateBeatsFor(contentId: string, toggles: SlurpContentPackToggles): SlurpPackDateBeats | null {
  for (const pack of slurpContentPacksOn(toggles)) {
    const found = pack.dateBeats?.[contentId];
    if (found) return found;
  }
  return null;
}

/** A pack storyline's fit, by its content id (whether or not the pack is on: a running one keeps it). */
export function slurpPackArcFit(contentId: string | undefined): SlurpPackArc["fit"] | null {
  if (!contentId) return null;
  for (const pack of SLURP_CONTENT_PACK_LIBRARY) {
    const found = pack.arcs.find((arc) => arc.contentId === contentId);
    if (found) return found.fit;
  }
  return null;
}
