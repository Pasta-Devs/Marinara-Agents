// ──────────────────────────────────────────────
// Otome Forge: a pull, and the Memory Selector (plan M4 "Pull", "Memory Selector")
// ──────────────────────────────────────────────
// applyPull is the whole state change of one pull of 1 or 10, applied inside ONE revision-checked write of
// `${R}:state`: the Starlight check (409 `insufficient`, and nothing is rolled), the charge, the rolls with GF's
// interpolated pity on that banner kind's counter (SH/wish.ts rollRarity), the featured 5★ and the uniform 4★ and 3★,
// a refund for each duplicate (also one won earlier in the same ten), the new items appended to `owned` with when each
// was won (the Album and Home date a Memory's CG by it), each new Snapshot on the Love Timeline (and a couple set the
// pull completes), and the pull kept by its request id. Another writer that got there first (a read paying
// Starlight, a second pull) makes the store re-read and apply it again on top, rolling again from the new counter, so
// the charge, the roll and the counter always land together and a pull is never paid twice or lost. A request id seen
// before answers with that pull and changes nothing: a retried request (a dropped reply, a double tap) charges once.
// A pull reads only stored documents: it never calls a model, and paints nothing (items paint on first open).
import type { RunState, TimelineEntry } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { MAX_LEVEL, levelOf } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import {
  DUPLICATE_REFUNDS,
  bannerKey,
  rollRarity,
  wishCost,
  type Banner,
  type Item,
  type PullCount,
  type Rarity,
  type SelectorResult,
  type WishPullResponse,
} from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, stateId, worldId } from "../ids.js";
import { updateIfChanged } from "../art/paint.js";
import { withCoupleTimeline } from "../items/open.js";
import { STATE_LIMITS, keepNewest, normalizeState } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import {
  bannerItemIds,
  currentRotation,
  pityViews,
  readBanner,
  readBanners,
  readItem,
  readItems,
  selectorViews,
  toItemView,
} from "./banners.js";

export interface PullRequest {
  banner: Banner;
  /** Every item of the banner, by id. */
  items: ReadonlyMap<string, Item>;
  count: PullCount;
  /** The client's id for this pull; a second request with it answers with the first and changes nothing. */
  requestId?: string;
  at?: string;
  random?: () => number;
}

export type PullOutcome = RunState["pulls"][number]["results"];

const insufficient = () => new OtomeForgeError(409, "Not enough Starlight for this wish.", "insufficient");

/** Uniform over the list. */
const pick = (ids: readonly string[], random: () => number) =>
  ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))]!;

/**
 * The state after one pull (pure). Throws 409 `insufficient` without rolling when the wallet cannot pay. Returns the
 * state unchanged with `replayed` when the request id was pulled before.
 */
export function applyPull(
  state: RunState,
  { banner, items, count, requestId, at = new Date().toISOString(), random = Math.random }: PullRequest,
): { state: RunState; results: PullOutcome; replayed: boolean } {
  const earlier = requestId ? state.pulls.find((entry) => entry.id === requestId) : undefined;
  if (earlier) {
    if (earlier.banner !== banner.key) {
      throw new OtomeForgeError(400, "That request id belongs to another banner's pull.", "bad-request");
    }
    return { state, results: earlier.results, replayed: true };
  }
  const cost = wishCost(count);
  if (state.wallet.starlight < cost) throw insufficient();

  let pity = state.pity[banner.kind];
  const owned = new Set(state.owned.items);
  const won: string[] = [];
  const timeline: TimelineEntry[] = [];
  const results: PullOutcome = [];
  let refunds = 0;
  for (let index = 0; index < count; index += 1) {
    const roll = rollRarity(pity, random);
    pity = roll.pity;
    const rarity: Rarity = roll.rarity;
    const id =
      rarity === 5 ? banner.items.five[0]! : pick(rarity === 4 ? banner.items.four : banner.items.three, random);
    const isNew = !owned.has(id);
    const refund = isNew ? 0 : DUPLICATE_REFUNDS[rarity];
    refunds += refund;
    if (isNew) {
      owned.add(id);
      won.push(id);
      const item = items.get(id);
      // A Snapshot joins its love interest's Love Timeline the moment it is won.
      if (item?.kind === "snapshot3" && item.li && state.lis[item.li] && item.text) {
        timeline.push({ at, li: item.li, kind: "snapshot", text: item.text, ref: id });
      }
    }
    results.push({ item: id, rarity, isNew, refund });
  }
  return {
    state: {
      ...state,
      wallet: { ...state.wallet, starlight: state.wallet.starlight - cost + refunds },
      pity: { ...state.pity, [banner.kind]: pity },
      owned: {
        ...state.owned,
        items: [...state.owned.items, ...won],
        at: { ...state.owned.at, ...Object.fromEntries(won.map((id) => [id, at])) },
      },
      timeline: keepNewest([...state.timeline, ...timeline], STATE_LIMITS.timeline),
      pulls: requestId
        ? keepNewest([...state.pulls, { id: requestId, banner: banner.key, at, results }], STATE_LIMITS.pulls)
        : state.pulls,
    },
    results,
    replayed: false,
  };
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

/** A wardrobe banner's other half of its couple set: His Wardrobe's 5★ and My Wardrobe's of the same rotation. */
async function couplePartner(store: OtomeStore, runId: string, banner: Banner, items: ReadonlyMap<string, Item>) {
  if (banner.kind === "memories") return [];
  const partner =
    banner.kind === "my-wardrobe"
      ? items.get(banner.items.five[0]!)?.coupleWith
      : (await readBanner(store, runId, bannerKey("my-wardrobe", banner.rotation)))?.items.five[0];
  const item = partner ? await readItem(store, runId, partner) : null;
  return item ? [item] : [];
}

/** POST /runs/:run/wish/pull {banner, count, requestId?}: one write of the state; never a model call. */
export async function pullWish(
  deps: { store: OtomeStore },
  runId: string,
  request: { banner: string; count: PullCount; requestId?: string; random?: () => number },
): Promise<WishPullResponse> {
  const { store } = deps;
  const banner = await readBanner(store, runId, request.banner);
  if (!banner) throw new OtomeForgeError(404, "No such banner.", "not-found");
  const items = await readItems(store, runId, bannerItemIds(banner));
  if (bannerItemIds(banner).some((id) => !items.has(id))) {
    throw new OtomeForgeError(409, "This banner is still being written. Try again.", "conflict");
  }
  const couple = [...items.values(), ...(await couplePartner(store, runId, banner, items))];
  const at = new Date().toISOString();
  let results: PullOutcome = [];
  const saved = await updateIfChanged(store, runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    // Each attempt rolls again on the state it was given, so only the write that lands decides the results.
    const outcome = applyPull(current, { ...request, banner, items, at });
    results = outcome.results;
    // A couple set whose second half this pull won is dated now, on the Love Timeline (once, by its ref).
    return outcome.replayed ? undefined : withCoupleTimeline(outcome.state, couple, at);
  });
  if (!saved) throw runNotFound();
  const owned = new Set(saved.value.owned.items);
  return {
    results: results.map((result) => ({
      item: toItemView(runId, items.get(result.item)!, owned),
      rarity: result.rarity,
      isNew: result.isNew,
      refund: result.refund,
    })),
    starlight: saved.value.wallet.starlight,
    pity: pityViews(saved.value),
  };
}

/**
 * POST /runs/:run/selector/:li {item}: at affection 10, once per love interest, claims one of their Memories that the
 * player does not own, from an Echo (a past rotation's banner; the live one is pulled with pity). It costs nothing and
 * moves no pity. The state records which Memory it claimed: claiming that one again answers as before; any other claim
 * once used is a 409 `conflict`.
 */
export async function claimSelector(
  deps: { store: OtomeStore },
  runId: string,
  li: string,
  item: string,
): Promise<SelectorResult> {
  const { store } = deps;
  const [memory, world] = await Promise.all([
    readItem(store, runId, item),
    store.readDoc(worldId(runId), normalizeWorld),
  ]);
  if (!world) throw runNotFound();
  const banner =
    memory && memory.kind === "memory5" && memory.li === li ? await readBanner(store, runId, memory.banner) : null;
  // Rotations only move forward, so a Memory that is an Echo now stays one.
  if (!memory || !banner || banner.rotation >= currentRotation(world).number) {
    throw new OtomeForgeError(404, "No such Echo Memory of theirs.", "not-found");
  }
  const saved = await updateIfChanged(store, runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    const liState = current.lis[li];
    if (!liState) throw new OtomeForgeError(404, "No such love interest.", "not-found");
    if (current.selector[li]) {
      // A retry of the claim that landed changes nothing; any other is refused.
      if (current.selector[li] === item) return undefined;
      throw new OtomeForgeError(409, "Their Memory Selector has been used.", "conflict");
    }
    if (levelOf(liState.points) < MAX_LEVEL) {
      throw new OtomeForgeError(409, "The Memory Selector opens at affection 10.", "locked");
    }
    if (current.owned.items.includes(item)) {
      throw new OtomeForgeError(409, "That Memory is already yours.", "conflict");
    }
    return {
      ...current,
      owned: {
        ...current.owned,
        items: [...current.owned.items, item],
        at: { ...current.owned.at, [item]: new Date().toISOString() },
      },
      selector: { ...current.selector, [li]: item },
    };
  });
  if (!saved) throw runNotFound();
  const owned = new Set(saved.value.owned.items);
  const banners = await readBanners(store, runId);
  const memories = await readItems(
    store,
    runId,
    banners.map((banner) => banner.items.five[0]!),
  );
  const selector = selectorViews(runId, saved.value, memories.values(), owned, currentRotation(world).number).find(
    (view) => view.li === li,
  )!;
  return { item: toItemView(runId, memory, owned), selector };
}
