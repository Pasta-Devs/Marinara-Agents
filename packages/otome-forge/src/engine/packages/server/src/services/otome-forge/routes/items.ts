// ──────────────────────────────────────────────
// Otome Forge: an owned item's first open and its art (plan M4 "First open")
// ──────────────────────────────────────────────
// POST /runs/:run/items/:item/open {reviewImagePrompts?}        → ItemOpenResult {item, story, art}; its art and its
//                                                                 story are each started once (S/items/open.ts)
// POST /runs/:run/items/:item/art {prompt?, negativePrompt?}    → {art}; the tap: Ask's consent, a reviewed prompt,
//                                                                 or Retry. Waits for the paint; never pays twice
// POST /runs/:run/items/:item/art/prompt                        → {prompt, negativePrompt}; for the prompt review
// POST /runs/:run/items/:item/seen                              → {unseen}; 0.21.0: the item was looked at, so its
//                                                                 dot in the Wardrobe or the Album goes (idempotent;
//                                                                 an item that is not unseen changes nothing)
// Only an owned item opens or paints (409 `locked` before it is won; 404 for no such item). The story's call may fail
// with 503 `no-connection`, 422 `declined` or 502 `bad-format`; a tap with no image connection is a 503. The story is
// read through the M2a chapter routes (S/routes/story.ts) under its key `story-<itemId>`.
import { z } from "zod";
import { isItemId, unseenCounts } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { updateIfChanged } from "../art/paint.js";
import { runDocTarget, stateId } from "../ids.js";
import { normalizeState } from "../schemas/state.js";
import { itemArtPrompt, paintItemNow } from "../art/outfits.js";
import {
  OtomeForgeError,
  debugModeOf,
  parseBody,
  reviewModeOf,
  runParam,
  type OtomeRequest,
  type RegisterRoutes,
} from "../http.js";
import { openItem, readOwnedItem } from "../items/open.js";

const PROMPT_MAX = 4000;
const NoFields = z.object({});
/** A tap's body: the reviewed prompt, when the player edited it (also the Shop figurine's tap, S/routes/shop.ts). */
export const ArtBody = z.object({
  prompt: z.string().max(PROMPT_MAX).optional(),
  negativePrompt: z.string().max(PROMPT_MAX).optional(),
});
const SnapshotArtBody = z.object({ prompt: z.string().optional(), negativePrompt: z.string().optional() });

/** The `:item` param, or a 404 (a malformed id names no item). */
function itemParam(request: OtomeRequest): string {
  const params = request.params;
  const value = params && typeof params === "object" ? (params as Record<string, unknown>).item : undefined;
  if (!isItemId(value)) throw new OtomeForgeError(404, "No such item.", "not-found");
  return value;
}

export const registerItemRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.post(
    "/runs/:run/items/:item/open",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return openItem(deps, runId, itemParam(request), {
        debugMode: debugModeOf(request),
        review: reviewModeOf(request),
      });
    }),
  );

  router.post(
    "/runs/:run/items/:item/art",
    handle(async (request) => {
      const { runId } = runParam(request);
      const id = itemParam(request);
      const { item } = await readOwnedItem(deps, runId, id);
      const { prompt, negativePrompt } = parseBody(item.kind === "snapshot3" ? SnapshotArtBody : ArtBody, request.body);
      const art = await paintItemNow(deps, runId, id, {
        debugMode: debugModeOf(request),
        edited: { prompt, negativePrompt },
      });
      return { art };
    }),
  );

  router.post(
    "/runs/:run/items/:item/art/prompt",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      const { item } = await readOwnedItem(deps, runId, itemParam(request));
      return itemArtPrompt(deps, runId, item, {}, debugModeOf(request));
    }),
  );

  router.post(
    "/runs/:run/items/:item/seen",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      const id = itemParam(request);
      const saved = await updateIfChanged(deps.store, runDocTarget("state", stateId(runId)), normalizeState, (state) =>
        state.owned.unseen.includes(id)
          ? { ...state, owned: { ...state.owned, unseen: state.owned.unseen.filter((entry) => entry !== id) } }
          : undefined,
      );
      if (!saved) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
      return { unseen: unseenCounts(saved.value.owned.unseen) };
    }),
  );
};
