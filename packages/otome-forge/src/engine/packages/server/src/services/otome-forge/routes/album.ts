// ──────────────────────────────────────────────
// Otome Forge: the Album (plan M4 "Album"): only what is unlocked
// ──────────────────────────────────────────────
// GET /runs/:run/album → AlbumView {cgs, memories, timeline, favorites, soundtrack, tells}
// - cgs: story CGs once seen (M2b: POST .../art/cg/seen), each owned Memory's CG once painted, and couple sets' pair
//   portraits, oldest first. The client saves an image through the Engine's services.imageDownloads.
// - memories: the owned Memories, Moments and Snapshots in the order won, with how far each story has been read.
// - timeline and favorites: the state's Love Timeline (stages, Snapshots, couple sets, …) and starred lines.
// - soundtrack: each cue with its generated track, or null for the stock one.
// - tells: per love interest, the tells she has learned to read: the mask tells Read Him taught (M5), and those of each
//   secret of his she has learned (its truth is out, so what gave it away reads plainly now). The seed of the R2
//   Dossier.
// Nothing the player has not won, seen or learned is listed: no banner item not owned, no CG not seen, no tell of a
// secret still hidden.
import type { LiState, RunState, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { MUSIC_MOODS } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import type {
  AlbumImage,
  AlbumMemory,
  AlbumView,
} from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import type { Item } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { pairKey } from "../art/outfits.js";
import { playableTracks } from "../audio/music.js";
import { OtomeForgeError, runParam, type RegisterRoutes, type RouteDeps } from "../http.js";
import { couplesOf, itemView, ownedItems, readItems } from "../items/open.js";
import { readRun, type RunDocuments } from "../schemas/state.js";

const MEMORY_KINDS: ReadonlySet<Item["kind"]> = new Set(["memory5", "moment4", "snapshot3"]);

/**
 * The tells she has learned to read of his: the mask tells Read Him taught (M5's `tellsLearned`, indexes into his mask
 * tells in the order learned), then each learned secret's tells.
 */
export function learnedTells(unit: Pick<Unit, "bible">, liState: LiState): string[] {
  const bible = unit.bible;
  if (!bible) return [];
  const mask = liState.tellsLearned.map((index) => bible.mask.tells[index]).filter((tell): tell is string => !!tell);
  const secrets = bible.secrets
    .filter((secret) => liState.revealed.includes(secret.id))
    .flatMap((secret) => secret.tells);
  return [...new Set([...mask, ...secrets])];
}

/** How far an item's story has been read, or null when it has none. */
function readState(state: RunState, item: Item): AlbumMemory["read"] {
  if (!item.story) return null;
  const progress = state.chapters[item.story.key];
  return progress?.completed ? "done" : progress?.beatsRead ? "in-progress" : "unread";
}

/**
 * The Album's CGs, oldest first: story CGs once seen, couple sets' pair portraits, and each owned Memory's CG once
 * painted, dated when it was won or, when it was painted later, painted (a featured Memory shares its banner's art,
 * painted before anyone wins it). Home's back layer (S/routes/home.ts backdropOf) picks its love interest's newest.
 */
export function albumCgs(run: Pick<RunDocuments, "state">, items: readonly Item[]): AlbumImage[] {
  const owned = ownedItems(run, items);
  const pairs = new Map(couplesOf(items).map((row) => [pairKey(row.hers.id), row]));
  return [
    ...run.state.album.cgs.map((cg): AlbumImage => {
      const pair = pairs.get(cg.key);
      const title = pair ? [pair.his.look?.name, pair.hers.look?.name].filter(Boolean).join(" · ") : "";
      return { ...cg, source: cg.key.startsWith("pair:") ? "pair" : "story", ...(title ? { title } : {}) };
    }),
    ...owned.flatMap((item): AlbumImage[] => {
      if (item.kind !== "memory5" || item.art?.state !== "ready" || !item.art.url) return [];
      const won = run.state.owned.at[item.id] ?? "";
      return [
        {
          key: `item:${item.id}`,
          url: item.art.url,
          ...(item.art.ref ? { ref: item.art.ref } : {}),
          at: won > item.art.at ? won : item.art.at,
          ...(item.li ? { li: item.li } : {}),
          source: "memory",
          title: item.title,
        },
      ];
    }),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

export async function albumView(deps: Pick<RouteDeps, "store">, runId: string): Promise<AlbumView> {
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  const items = await readItems(deps.store, runId);
  const owned = ownedItems(run, items);
  const cgs = albumCgs(run, items);
  const tracks = playableTracks(run.world.audio);
  const tells: AlbumView["tells"] = {};
  for (const unit of run.units) {
    const liState = run.state.lis[unit.id];
    if (liState) tells[unit.id] = learnedTells(unit, liState);
  }
  return {
    cgs,
    memories: owned
      .filter((item) => MEMORY_KINDS.has(item.kind))
      .map((item) => ({ ...itemView(runId, item, true), read: readState(run.state, item) })),
    timeline: run.state.timeline,
    favorites: run.state.favorites,
    soundtrack: MUSIC_MOODS.map((cue) => ({ cue, track: tracks.find((track) => track.cue === cue) ?? null })),
    tells,
  };
}

export const registerAlbumRoutes: RegisterRoutes = (router, deps) => {
  router.get(
    "/runs/:run/album",
    deps.handle(async (request) => albumView(deps, runParam(request).runId)),
  );
};
