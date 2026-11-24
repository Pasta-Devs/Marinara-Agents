// ──────────────────────────────────────────────
// Otome Hearth: what a friend gives at their rank-5 finale (#2458)
// ──────────────────────────────────────────────
// Once a friend's rank-5 story is read to its end:
// - A look for her: the one their finale picked out (its plan's `look`), kept as a 4★ look of hers in the Wardrobe
//   (`my-wardrobe-0-g<n>`, SH/wish.ts friendGiftItemId: n is their place among her friends), owned and new. It is
//   painted as a won look is, when it is opened (S/items/open.ts).
// - Their own card: their bible's arcana, showing them, in the Tarot deck (S/art/tarot-deck.ts claimFriendCard),
//   painted as a drawn card is; the Album's Cards keep it. Tarot night's readings stay the love interests'.
// - The Wingman: once a story arc, while a love interest's grievance with her waits for its space, she may ask them to
//   talk to him: the space is waived, and the friend appears in his repair (POST /runs/:run/friends/:id/wingman).
// ensureFinaleRewards grants what is owed on each read of the run (GET /runs/:run), so a finale read on another device
// or before a restart still gives them; each grant is idempotent.
import type { LiId, RunState } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { GRIEVANCE_SPACE_CHAPTERS } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { heldAgainst } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { FRIEND_MAX_LEVEL, friendRankKey } from "../../../../../client/src/features/otome-forge/shared/friends.js";
import { friendGiftItemId, type Item } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { claimFriendCard, friendCardKey, readDeck } from "../art/tarot-deck.js";
import type { ItemArtDeps, ItemPaintOptions } from "../art/outfits.js";
import { OtomeForgeError } from "../http.js";
import { itemId, runDocTarget, stateId } from "../ids.js";
import { normalizeState, type RunDocuments } from "../schemas/state.js";
import { normalizeItem } from "../schemas/wish.js";
import { readChapter } from "./canon.js";
import { currentArc } from "./friends.js";

/** A friend's rank-5 story is read to its end. */
export const finaleRead = (state: RunState, id: LiId) =>
  !!state.chapters[friendRankKey(id, FRIEND_MAX_LEVEL)]?.completed;

/** The look a friend gives her: its item id, from their place among her friends. */
const giftOf = (state: RunState, id: LiId) => friendGiftItemId(Object.keys(state.friends).indexOf(id) + 1);

/** Grants each finished finale's look and card that are still owed (see the header). Never throws. */
export async function ensureFinaleRewards(
  deps: ItemArtDeps,
  runId: string,
  run: RunDocuments,
  mode: ItemPaintOptions,
): Promise<void> {
  for (const unit of run.friends ?? []) {
    if (!unit.friend || !finaleRead(run.state, unit.id)) continue;
    try {
      const gift = giftOf(run.state, unit.id);
      if (!run.state.owned.items.includes(gift)) await giveLook(deps, runId, unit.id, gift);
      if (!(await readDeck(deps.store, runId)).cards[friendCardKey(unit.friend.arcana, unit.id)]) {
        await claimFriendCard(deps, runId, unit.id, unit.friend.arcana, mode);
      }
    } catch (error) {
      deps.runtime.logger.warn(
        "[otome-forge] %s's finale rewards wait: %s",
        unit.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

/** Writes the look their finale picked out as her owned 4★ look, once. */
async function giveLook(deps: ItemArtDeps, runId: string, id: LiId, gift: string): Promise<void> {
  const chapter = await readChapter(deps.store, runId, friendRankKey(id, FRIEND_MAX_LEVEL));
  const look = chapter?.friendStory?.look;
  if (!look) return;
  const item: Item = {
    id: gift,
    kind: "her-look4",
    banner: "my-wardrobe-0",
    li: null,
    title: look.name,
    look,
    art: null,
    story: null,
    createdAt: new Date().toISOString(),
  };
  await deps.store.mutateDoc(runDocTarget("item", itemId(runId, gift)), normalizeItem, (current) =>
    current?.id === gift ? current : item,
  );
  const at = new Date().toISOString();
  await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) =>
    state.owned.items.includes(gift)
      ? state
      : {
          ...state,
          owned: {
            ...state.owned,
            items: [...state.owned.items, gift],
            at: { ...state.owned.at, [gift]: at },
            unseen: [...state.owned.unseen, gift],
          },
        },
  );
}

/**
 * POST /runs/:run/friends/:id/wingman {li}: she asks friend `id` to talk to love interest `li` for her (see the
 * header). 409 `locked` before their finale, when they helped already this arc, or when his grievance is not waiting
 * for its space.
 */
export async function askWingman(
  deps: Pick<ItemArtDeps, "store">,
  runId: string,
  id: LiId,
  li: LiId,
): Promise<{ li: LiId; helper: LiId }> {
  const arc = await currentArc(deps.store, runId);
  const locked = (message: string) => new OtomeForgeError(409, message, "locked");
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    const friend = current.friends[id];
    const his = current.lis[li];
    if (!friend) throw new OtomeForgeError(404, "No such friend.", "not-found");
    if (!his) throw new OtomeForgeError(404, "No such love interest.", "not-found");
    if (!finaleRead(current, id)) throw locked("They can help once your friendship reaches rank 5.");
    if (friend.wingmanArc === arc) throw locked("They have already helped once in this story arc.");
    const rupture = his.rupture;
    if (!heldAgainst(his) || !rupture || (rupture.space ?? GRIEVANCE_SPACE_CHAPTERS) >= GRIEVANCE_SPACE_CHAPTERS) {
      throw locked("There is nothing for them to smooth over right now.");
    }
    return {
      ...current,
      lis: { ...current.lis, [li]: { ...his, rupture: { ...rupture, space: GRIEVANCE_SPACE_CHAPTERS, helper: id } } },
      friends: { ...current.friends, [id]: { ...friend, wingmanArc: arc } },
    };
  });
  if (!state) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
  return { li, helper: id };
}
