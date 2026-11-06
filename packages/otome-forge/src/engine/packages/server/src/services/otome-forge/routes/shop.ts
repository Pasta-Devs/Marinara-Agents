// ──────────────────────────────────────────────
// Otome Hearth: the Shop in Wish (#2128): gifts for dates and each love interest's figurine, paid for with Starlight
// ──────────────────────────────────────────────
// GET  /runs/:run/shop                            → ShopView: Starlight, the gifts offered under the story's Heat
//                                                   (price, how many she owns) and each love interest's figurine
//                                                   (drawn yet or `drawing`, bought, its scene). It queues, in the
//                                                   background, the drawing of each figurine not drawn yet
//                                                   (S/minigames/plush.ts), and never waits for one
// POST /runs/:run/shop/gifts {gift, requestId?}   → ShopBuyResult {starlight, shop}: one more of that gift
// POST /runs/:run/shop/figurines/:li {requestId?} → ShopBuyResult {starlight, shop, story}: their figurine, once, and
//                                                   the scene it unlocks (S/items/character-story.ts
//                                                   figurineStoryChapter)
// A purchase is one revision-checked write of the state (applyPurchase): 409 `insufficient` changes nothing, 409
// `locked` refuses the aphrodisiac under SFW Heat (the client hides it too, but is never trusted), 409 `conflict` a
// second figurine of the same love interest, and 404 an unknown gift or love interest. A request id seen before
// answers as that purchase did and charges nothing, so a double tap or a lost answer pays once. Buying never calls a
// model and never waits for a figurine's drawing: a figurine bought before it is drawn shows their plush frame until
// it is.
// ponytail: a figurine's scene is saved just after the write that bought it; a process stopped between the two leaves a
// bought figurine with no scene until the same request is sent again (the client keeps its id until answered). The
// upgrade path is GET /shop saving any missing scene of a bought figurine.
import { z } from "zod";
import type { LiId, RunState } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { ContentSettings } from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  FIGURINE_COST,
  GIFT_PRICES,
  figurineSceneKey,
  giftsFor,
  isGiftId,
  type GiftId,
  type ShopBuyResult,
  type ShopView,
} from "../../../../../client/src/features/otome-forge/shared/shop.js";
import { plushSvgUrl } from "../art/plush-svg.js";
import { updateIfChanged } from "../art/paint.js";
import {
  OtomeForgeError,
  debugModeOf,
  liParam,
  parseBody,
  runParam,
  type OtomeRequest,
  type RegisterRoutes,
  type RouteDeps,
} from "../http.js";
import { runDocTarget, stateId } from "../ids.js";
import { ensureFigurineStory } from "../items/character-story.js";
import { ensureFigurineArt } from "../minigames/plush.js";
import { STATE_LIMITS, keepNewest, normalizeState, readRun, type RunDocuments } from "../schemas/state.js";

const RequestId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,80}$/)
  .optional();
const GiftBody = z.object({ gift: z.string().min(1).max(40), requestId: RequestId });
const FigurineBody = z.object({ requestId: RequestId });

/** What one purchase buys: one gift, or a love interest's figurine. */
export type Purchase = { gift: GiftId } | { figurine: LiId };

export interface PurchaseRequest {
  purchase: Purchase;
  /** The world's content settings: the aphrodisiac is sold only under NSFW Heat. */
  content: Pick<ContentSettings, "heat">;
  /** The client's id for this purchase; a second request with it answers with the first and changes nothing. */
  requestId?: string;
  at: string;
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");
const insufficient = () => new OtomeForgeError(409, "Not enough Starlight for this purchase.", "insufficient");

/** How the state's purchase records name what was bought. */
const whatOf = (purchase: Purchase) => ("gift" in purchase ? purchase.gift : `figurine:${purchase.figurine}`);

/**
 * The state after one purchase (pure): Starlight charged, the gift counted or the figurine dated, the purchase kept by
 * its request id. Every refusal throws before anything changes (see the header). A request id seen before returns the
 * state unchanged with `replayed`.
 */
export function applyPurchase(
  state: RunState,
  { purchase, content, requestId, at }: PurchaseRequest,
): { state: RunState; replayed: boolean } {
  const what = whatOf(purchase);
  const earlier = requestId ? state.purchases.find((entry) => entry.id === requestId) : undefined;
  if (earlier) {
    if (earlier.what !== what) {
      throw new OtomeForgeError(400, "That request id belongs to another purchase.", "bad-request");
    }
    return { state, replayed: true };
  }
  let cost: number;
  let owned: RunState["owned"];
  if ("gift" in purchase) {
    const { gift } = purchase;
    if (!giftsFor(content).includes(gift)) {
      throw new OtomeForgeError(409, "That gift is sold only under NSFW Heat.", "locked");
    }
    cost = GIFT_PRICES[gift];
    owned = { ...state.owned, gifts: { ...state.owned.gifts, [gift]: (state.owned.gifts[gift] ?? 0) + 1 } };
  } else {
    const li = purchase.figurine;
    if (!state.lis[li]) throw liNotFound();
    if (state.owned.figurines[li]) throw new OtomeForgeError(409, "Their figurine is already yours.", "conflict");
    cost = FIGURINE_COST;
    owned = { ...state.owned, figurines: { ...state.owned.figurines, [li]: at } };
  }
  if (state.wallet.starlight < cost) throw insufficient();
  return {
    state: {
      ...state,
      wallet: { ...state.wallet, starlight: state.wallet.starlight - cost },
      owned,
      purchases: requestId
        ? keepNewest([...state.purchases, { id: requestId, what, at }], STATE_LIMITS.purchases)
        : state.purchases,
    },
    replayed: false,
  };
}

/** The Shop as the client shows it; `drawing` names the love interests whose figurine waits or runs. */
export function shopView(run: RunDocuments, state: RunState, drawing: readonly LiId[] = []): ShopView {
  return {
    starlight: state.wallet.starlight,
    gifts: giftsFor(run.world.content).map((id) => ({ id, price: GIFT_PRICES[id], owned: state.owned.gifts[id] ?? 0 })),
    // The cast's love interests with a bible, in cast order (readRun reads them so).
    figurines: run.units
      .filter((unit) => !!unit.bible)
      .map((unit) => {
        const art = plushSvgUrl(unit.figurineArt?.svg);
        const owned = !!state.owned.figurines[unit.id];
        return {
          li: unit.id,
          name: unit.name,
          accent: unit.accent,
          ...(art ? { art } : {}),
          drawing: !art && drawing.includes(unit.id),
          owned,
          ...(owned ? { story: { key: figurineSceneKey(unit.id) } } : {}),
        };
      }),
    figurineCost: FIGURINE_COST,
  };
}

/** One purchase in one write of the state, then (a figurine) its scene; the run is read first for its world and cast. */
async function buy(
  deps: Pick<RouteDeps, "store">,
  request: OtomeRequest,
  purchase: (run: RunDocuments) => Purchase,
  requestId: string | undefined,
): Promise<ShopBuyResult> {
  const { runId } = runParam(request);
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const bought = purchase(run);
  const at = new Date().toISOString();
  const saved = await updateIfChanged(deps.store, runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    const outcome = applyPurchase(current, { purchase: bought, content: run.world.content, requestId, at });
    return outcome.replayed ? undefined : outcome.state;
  });
  if (!saved) throw runNotFound();
  // A figurine's scene is saved now (a replay saves it if the first answer was lost before it was).
  const unit = "figurine" in bought ? run.units.find((entry) => entry.id === bought.figurine) : undefined;
  const story = unit ? { key: await ensureFigurineStory(deps, runId, unit) } : undefined;
  return {
    starlight: saved.value.wallet.starlight,
    shop: shopView(run, saved.value),
    ...(story ? { story } : {}),
  };
}

export const registerShopRoutes: RegisterRoutes = (router, deps) => {
  const { store, handle, runtime } = deps;

  router.get(
    "/runs/:run/shop",
    handle(async (request) => {
      const { runId } = runParam(request);
      const run = await readRun(store, runId);
      if (!run) throw runNotFound();
      // Each figurine is drawn once, in the background, so the shelf can show it before it is bought.
      let drawing: LiId[] = [];
      try {
        drawing = await ensureFigurineArt(deps, runId, Object.keys(run.state.lis), {
          debugMode: debugModeOf(request),
        });
      } catch (error) {
        runtime.logger.warn(
          "[otome-forge] Figurines not queued: %s",
          error instanceof Error ? error.message : String(error),
        );
      }
      return shopView(run, run.state, drawing);
    }),
  );

  router.post(
    "/runs/:run/shop/gifts",
    handle(async (request) => {
      const { gift, requestId } = parseBody(GiftBody, request.body);
      if (!isGiftId(gift)) throw new OtomeForgeError(404, "No such gift.", "not-found");
      return buy(deps, request, () => ({ gift }), requestId);
    }),
  );

  router.post(
    "/runs/:run/shop/figurines/:li",
    handle(async (request) => {
      const { requestId } = parseBody(FigurineBody, request.body);
      const li = liParam(request);
      return buy(
        deps,
        request,
        (run) => {
          if (!run.units.some((unit) => unit.id === li && unit.bible)) throw liNotFound();
          return { figurine: li };
        },
        requestId,
      );
    }),
  );
};
