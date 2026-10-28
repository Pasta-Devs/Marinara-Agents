/**
 * The drama catalog (`docs/DRAMA.md`): the situations and dramas Slurp ships, plus the ones imported
 * from Story Packs. Pure. Which entries run is the `drama.enabled` setting; nothing runs by default.
 *
 * Imported entries live in their own app setting (`slurp2.drama.library`), keyed by pack and id, so a
 * pack imported again updates its own entries and never another pack's.
 */
import {
  slpDramaSchema,
  slpSituationSchema,
  type SlpDrama,
  type SlpFit,
  type SlpSituation,
} from "../../../../../../shared/src/slp/slp-drama.js";
import {
  slpStorylineDraftFromDrama,
  slpStorylineDraftFromSituation,
} from "../../../../../../shared/src/slp/slp-storyline-v1.js";
import {
  slpOccasionSchema,
  slpStorylineSchema,
  type SlpOccasion,
  type SlpStoryline,
} from "../../../../../../shared/src/slp/slp-storyline.js";
import { SLURP_BUILTIN_DRAMAS, SLURP_BUILTIN_SITUATIONS } from "./slp-drama-packs.js";
import { slurpPackTopicOff } from "../../feed/slp-occasion-beats.js";
import { SLURP_CONTENT_PACK_LIBRARY } from "./slp-content-pack-library.js";
import { slurpContentPackOn } from "./slp-content-packs.js";

export const SLP_DRAMA_LIBRARY_KEY = "slurp2.drama.library";

export type SlpDramaLibrary = {
  situations: (SlpSituation & { packId: string })[];
  dramas: (SlpDrama & { packId: string })[];
  /** v2 entries, run as they are (docs/STORYLINES.md, PR 4b). */
  storylines: (SlpStoryline & { packId: string })[];
  /** One record per imported pack (docs/STORYLINES.md, PR 5b): the Packs list, and its occasions for the planner. */
  packs: SlpPackRecord[];
};
export type SlpPackRecord = {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  topics: string[];
  occasions: SlpOccasion[];
  importedAt: string;
};
export const SLP_EMPTY_DRAMA_LIBRARY: SlpDramaLibrary = { situations: [], dramas: [], storylines: [], packs: [] };

const record = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** Lenient: an entry that no longer passes the schema is dropped, the rest reads back. */
export function readSlpDramaLibrary(raw: unknown): SlpDramaLibrary {
  const value = record(raw);
  const read = <T>(list: unknown, parse: (entry: unknown) => T | null) =>
    (Array.isArray(list) ? list : []).flatMap((entry) => {
      const packId = typeof record(entry)?.packId === "string" ? (record(entry)!.packId as string) : "";
      const parsed = packId ? parse(entry) : null;
      return parsed ? [{ ...parsed, packId }] : [];
    });
  return {
    situations: read(value?.situations, (entry) => {
      const { packId: _packId, ...rest } = record(entry)!;
      const parsed = slpSituationSchema.safeParse(rest);
      return parsed.success ? parsed.data : null;
    }),
    dramas: read(value?.dramas, (entry) => {
      const { packId: _packId, ...rest } = record(entry)!;
      const parsed = slpDramaSchema.safeParse(rest);
      return parsed.success ? parsed.data : null;
    }),
    storylines: read(value?.storylines, (entry) => {
      const { packId: _packId, ...rest } = record(entry)!;
      const parsed = slpStorylineSchema.safeParse(rest);
      return parsed.success ? parsed.data : null;
    }),
    packs: (Array.isArray(value?.packs) ? value.packs : []).flatMap((entry) => {
      const pack = record(entry);
      const text = (key: string) => (typeof pack?.[key] === "string" ? (pack[key] as string) : "");
      if (!text("id") || !text("name")) return [];
      const words = (Array.isArray(pack!.topics) ? pack!.topics : []).filter((word) => typeof word === "string");
      const occasions = (Array.isArray(pack!.occasions) ? pack!.occasions : []).flatMap((occasion) => {
        const parsed = slpOccasionSchema.safeParse(occasion);
        return parsed.success ? [parsed.data] : [];
      });
      return [
        {
          id: text("id"),
          name: text("name"),
          version: text("version"),
          description: text("description"),
          ...(text("author") ? { author: text("author") } : {}),
          topics: words as string[],
          occasions,
          importedAt: text("importedAt"),
        },
      ];
    }),
  };
}

/** The `drama.enabled` list without the entries of an imported pack the player switched off (its switches stay). */
export function slpDramaEnabledIds(
  library: SlpDramaLibrary,
  enabled: readonly string[],
  toggles: Readonly<Record<string, boolean>>,
): string[] {
  const off = new Set(
    [...library.situations, ...library.dramas, ...library.storylines]
      .filter(
        (entry) =>
          toggles[entry.packId] === false || slurpPackTopicOff(entry.packId, (entry as { fit?: SlpFit }).fit, toggles),
      )
      .map((entry) => entry.id),
  );
  // A built-in pack's storylines run while the pack is on; the pack switch is their switch.
  const packed = SLURP_CONTENT_PACK_LIBRARY.flatMap((pack) =>
    slurpContentPackOn(pack, toggles) ? (pack.storylines ?? []).map((entry) => entry.id) : [],
  );
  return [...new Set([...enabled.filter((id) => !off.has(id)), ...packed])];
}

export type SlpDramaCatalog = { situations: SlpSituation[]; dramas: SlpDrama[]; storylines: SlpStoryline[] };

/** Everything that could run: the built-ins, then imported entries (an imported id never hides a built-in). */
export function slpDramaCatalog(library: SlpDramaLibrary): SlpDramaCatalog {
  const builtinSituations = new Set(SLURP_BUILTIN_SITUATIONS.map((entry) => entry.id));
  const builtinDramas = new Set(SLURP_BUILTIN_DRAMAS.map((entry) => entry.id));
  return {
    situations: [
      ...SLURP_BUILTIN_SITUATIONS,
      ...library.situations
        .filter((entry) => !builtinSituations.has(entry.id))
        .map(({ packId: _packId, ...entry }) => entry),
    ],
    dramas: [
      ...SLURP_BUILTIN_DRAMAS,
      ...library.dramas.filter((entry) => !builtinDramas.has(entry.id)).map(({ packId: _packId, ...entry }) => entry),
    ],
    storylines: [
      ...SLURP_CONTENT_PACK_LIBRARY.flatMap((pack) => pack.storylines ?? []),
      ...library.storylines.map(({ packId: _packId, ...entry }) => entry),
    ],
  };
}

/** Only the entries the player switched on (`drama.enabled`), and a drama only with its situation on. */
export function slpEnabledDrama(catalog: SlpDramaCatalog, enabled: readonly string[]): SlpDramaCatalog {
  const on = new Set(enabled);
  const situations = catalog.situations.filter((entry) => on.has(entry.id));
  const storylines = catalog.storylines.filter((entry) => on.has(entry.id));
  const standing = new Set([...situations, ...storylines.filter(slpStorylineStands)].map((entry) => entry.id));
  return {
    situations,
    dramas: catalog.dramas.filter(
      (entry) => on.has(entry.id) && (!entry.requires || standing.has(entry.requires.situation)),
    ),
    storylines: storylines.filter(
      (entry) => !entry.start.within || standing.has(entry.start.within.replace(/^situation:/, "")),
    ),
  };
}

/** What the runtime runs: every entry as a storyline (docs/STORYLINES.md, PR 4); one that does not convert stays out. */
/** A v2 storyline that is one stage with no days and no ending stands, like a situation. */
export const slpStorylineStands = (entry: SlpStoryline) =>
  entry.stages.length === 1 && !entry.stages[0]!.days && !entry.endings.length;

export function slpDramaStorylines(catalog: {
  situations: readonly SlpSituation[];
  dramas: readonly SlpDrama[];
  storylines?: readonly SlpStoryline[];
}): { situations: SlpStoryline[]; dramas: SlpStoryline[] } {
  const parse = (draft: unknown): SlpStoryline[] => {
    const parsed = slpStorylineSchema.safeParse(draft);
    return parsed.success ? [parsed.data] : [];
  };
  const v2 = catalog.storylines ?? [];
  return {
    situations: [
      ...catalog.situations.flatMap((entry) => parse(slpStorylineDraftFromSituation(entry))),
      ...v2.filter(slpStorylineStands),
    ],
    dramas: [
      ...catalog.dramas.flatMap((entry) => parse(slpStorylineDraftFromDrama(entry))),
      ...v2.filter((entry) => !slpStorylineStands(entry)),
    ],
  };
}

export type SlpDramaPreviewStatus = "new" | "update" | "conflict";

/** How an imported entry would land: new, an update of the same pack's entry, or an id another pack or Slurp uses. */
export function slpDramaPreviewStatus(
  library: SlpDramaLibrary,
  packId: string,
  kind: SlpDramaEntry["kind"],
  id: string,
): SlpDramaPreviewStatus {
  const list: readonly { id: string; packId: string }[] =
    kind === "situation" ? library.situations : kind === "drama" ? library.dramas : library.storylines;
  // Runs, cooldowns and the enabled list share one id space, so a v2 storyline may not take a v1 or built-in id.
  const others =
    kind === "storyline"
      ? [
          ...SLURP_BUILTIN_SITUATIONS,
          ...SLURP_BUILTIN_DRAMAS,
          ...SLURP_CONTENT_PACK_LIBRARY.flatMap((pack) => pack.storylines ?? []),
          ...library.situations,
          ...library.dramas,
        ]
      : [...(kind === "situation" ? SLURP_BUILTIN_SITUATIONS : SLURP_BUILTIN_DRAMAS), ...library.storylines];
  const builtin = others.some((entry) => entry.id === id);
  const installed = list.find((entry) => entry.id === id);
  if (builtin || (installed && installed.packId !== packId)) return "conflict";
  return installed ? "update" : "new";
}

export type SlpDramaEntry =
  | { kind: "situation"; value: SlpSituation }
  | { kind: "drama"; value: SlpDrama }
  | { kind: "storyline"; value: SlpStoryline };

/** Writes chosen entries into the library: new ones are added, the same pack's entries replaced; conflicts skipped. */
export function applySlpDramaEntries(
  library: SlpDramaLibrary,
  packId: string,
  entries: readonly SlpDramaEntry[],
): SlpDramaLibrary {
  const next: SlpDramaLibrary = {
    situations: [...library.situations],
    dramas: [...library.dramas],
    storylines: [...library.storylines],
    packs: library.packs,
  };
  for (const entry of entries) {
    if (slpDramaPreviewStatus(next, packId, entry.kind, entry.value.id) === "conflict") continue;
    // Imported entries arrive switched off in the catalog; `enabled` is the player's setting, not the pack's.
    // `source` marks the Engine's own converted v1 entries; an imported storyline keeps only its own id.
    const stored = {
      ...entry.value,
      ...(entry.kind === "storyline" ? { source: undefined } : {}),
      enabled: false,
      builtin: false,
      packId,
    };
    if (entry.kind === "situation")
      next.situations = [
        ...next.situations.filter((item) => item.id !== entry.value.id),
        stored as SlpDramaLibrary["situations"][number],
      ];
    else if (entry.kind === "drama")
      next.dramas = [
        ...next.dramas.filter((item) => item.id !== entry.value.id),
        stored as SlpDramaLibrary["dramas"][number],
      ];
    else
      next.storylines = [
        ...next.storylines.filter((item) => item.id !== entry.value.id),
        stored as SlpDramaLibrary["storylines"][number],
      ];
  }
  return next;
}
