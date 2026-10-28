// ──────────────────────────────────────────────
// Otome Forge: an owned item's first open (plan M4 "First open"), the item as the client sees it, and couple sets
// ──────────────────────────────────────────────
// POST /runs/:run/items/:item/open is the one place an item's paid work starts, and it does each part once however many
// times or tabs ask:
// 1. Art (S/art/outfits.ts queueItemArt): a Memory's CG or a look, claimed in one revision-checked write of the item and
//    painted in the background, or held for the tap under Ask before painting or prompt review. A look already painted
//    is made wearable.
// 2. A couple set the look completes is dated on the Love Timeline once (by its `ref`).
// 3. The item's own chapter (S/items/character-story.ts): a Memory's Character Story (P21, one structured call), a
//    Moment or a first-wear beat (no call), written against the canon of the day, in the run's Cancel scope.
// The art comes first: a declined or failed story never holds back the image, and the next open only retries what is
// missing. Pulls never call a model; only this open and the taps after it (S/routes/items.ts) do.
import type { RunState, TimelineEntry } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { ItemOpenResult } from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import {
  ITEM_RARITY,
  isLookKind,
  type Item,
  type ItemView,
} from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { addOutfit, itemArtView, queueItemArt, type ItemPaintOptions } from "../art/outfits.js";
import { updateIfChanged } from "../art/paint.js";
import { OtomeForgeError, type RouteDeps } from "../http.js";
import { itemId, runDocTarget, stateId } from "../ids.js";
import { STATE_LIMITS, keepNewest, normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeItem } from "../schemas/wish.js";
import type { OtomeStore } from "../store.js";
import { cancellable } from "../story/beats.js";
import { ensureItemStory } from "./character-story.js";

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");

/** The stored item, or null when there is none. */
export async function readItem(store: Pick<OtomeStore, "readDoc">, runId: string, id: string): Promise<Item | null> {
  const item = await store.readDoc(itemId(runId, id), normalizeItem);
  return item?.id ? item : null;
}

/** Every item of the run (every banner's, owned or not). */
export async function readItems(store: Pick<OtomeStore, "listRun">, runId: string): Promise<Item[]> {
  return (await store.listRun("item", runId)).map((record) => normalizeItem(record.data)).filter((item) => !!item.id);
}

/** An item the player owns, with the run: 404 for no such item, 409 `locked` for one not won yet. */
export async function readOwnedItem(deps: Pick<RouteDeps, "store">, runId: string, id: string) {
  const [run, item] = await Promise.all([readRun(deps.store, runId), readItem(deps.store, runId, id)]);
  if (!run) throw notFound("Otome Forge run");
  if (!item) throw notFound("item");
  if (!run.state.owned.items.includes(item.id)) {
    throw new OtomeForgeError(409, "This item has not been won yet.", "locked");
  }
  return { run, item };
}

/** The item as the client sees it: no CG brief or outfit line, a Snapshot's text only once owned. */
export function itemView(runId: string, item: Item, owned: boolean): ItemView {
  return {
    id: item.id,
    kind: item.kind,
    rarity: ITEM_RARITY[item.kind],
    banner: item.banner,
    li: item.li,
    title: item.title,
    ...(item.premise ? { premise: item.premise } : {}),
    ...(item.text && owned ? { text: item.text } : {}),
    ...(item.look ? { look: { name: item.look.name } } : {}),
    ...(item.coupleWith ? { coupleWith: item.coupleWith } : {}),
    owned,
    art: itemArtView(runId, item),
    story: item.story,
    ...(item.voicedLine ? { voicedLine: item.voicedLine } : {}),
  };
}

// ── Couple sets ──

export interface CoupleRow {
  his: Item;
  hers: Item;
}

/** Every couple set among `items`: a her-look5 and the his-look5 it names, in the order the her-looks come. */
export function couplesOf(items: readonly Item[]): CoupleRow[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return items.flatMap((hers) => {
    const his = hers.kind === "her-look5" && hers.coupleWith ? byId.get(hers.coupleWith) : undefined;
    return his && his.kind === "his-look5" ? [{ his, hers }] : [];
  });
}

/** The Love Timeline's `ref` for a couple set. */
export const coupleRef = ({ his, hers }: CoupleRow) => `couple:${his.id}+${hers.id}`;

/**
 * The state with a dated Love Timeline entry (`kind` "couple", the two looks' names) for every couple set it owns both
 * halves of and has not dated yet. Pure: call it inside the write that adds the second half (the pull), or after.
 */
export function withCoupleTimeline(state: RunState, items: readonly Item[], at: string): RunState {
  const owned = new Set(state.owned.items);
  const dated = new Set(state.timeline.map((entry) => entry.ref));
  const entries: TimelineEntry[] = couplesOf(items)
    .filter((row) => owned.has(row.his.id) && owned.has(row.hers.id) && !dated.has(coupleRef(row)))
    .map((row) => ({
      at,
      li: row.his.li ?? row.hers.li ?? "",
      kind: "couple",
      text: [row.his.look?.name, row.hers.look?.name].filter(Boolean).join(" · ") || row.hers.title,
      ref: coupleRef(row),
    }));
  return entries.length
    ? { ...state, timeline: keepNewest([...state.timeline, ...entries], STATE_LIMITS.timeline) }
    : state;
}

/** Dates every couple set now complete that has no timeline entry yet; writes nothing when there is none. */
export async function dateCouples(deps: Pick<RouteDeps, "store">, runId: string): Promise<void> {
  const items = await readItems(deps.store, runId);
  if (!items.some((item) => item.kind === "her-look5" && item.coupleWith)) return;
  const at = new Date().toISOString();
  await updateIfChanged(deps.store, runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    const next = withCoupleTimeline(current, items, at);
    return next === current ? undefined : next;
  });
}

// ── The first open ──

/**
 * POST /runs/:run/items/:item/open: an owned item's art and story, each started once (see the header). Resolves the
 * item as it stands, its story to read (or null) and its art; the story's model call may fail as any plan does (503
 * `no-connection`, 422 `declined`, 502 `bad-format`; a Cancel is a 409), after the art has been claimed.
 */
export async function openItem(
  deps: RouteDeps,
  runId: string,
  id: string,
  { debugMode, review }: ItemPaintOptions,
): Promise<ItemOpenResult> {
  const { run, item } = await readOwnedItem(deps, runId, id);
  if (run.world.forge.phase !== "ready") {
    throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  }
  const art = await queueItemArt(deps, runId, item, { debugMode, review });
  if (art?.state === "ready") await addOutfit(deps, runId, { ...item, art });
  if (isLookKind(item.kind)) await dateCouples(deps, runId);
  const chapter = await cancellable(deps, runId, (signal) => ensureItemStory(deps, runId, item, { debugMode, signal }));
  const saved = (await readItem(deps.store, runId, id)) ?? item;
  return {
    item: itemView(runId, saved, true),
    story: saved.story ?? (chapter ? { key: chapter.key } : null),
    art: itemArtView(runId, saved),
  };
}

/** The run's owned items, in the order won. */
export function ownedItems(run: Pick<RunDocuments, "state">, items: readonly Item[]): Item[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return run.state.owned.items.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}
