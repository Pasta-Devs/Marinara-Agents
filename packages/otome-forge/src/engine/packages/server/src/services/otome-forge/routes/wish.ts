// ──────────────────────────────────────────────
// Otome Forge: the Wish routes (plan M4 "Routes")
// ──────────────────────────────────────────────
// GET  /runs/:run/wish                                   → WishView: the current banners, Echoes, exact pity, the
//                                                          kinds still missing, `creating`, and each Memory Selector
// POST /runs/:run/wish/open {reviewImagePrompts?}         → WishOpenResult {wish, failed}: creates the current
//                                                          rotation's missing banners (one P20 call each; their art
//                                                          paints up to 3 images, or waits for the tap)
// POST /runs/:run/wish/pull {banner, count, requestId?}   → WishPullResponse {results, starlight, pity}; one state write,
//                                                          never a model call; 409 `insufficient` rolls nothing
// POST /runs/:run/wish/art {banner, prompt?, negativePrompt?} → {art}; paints a banner's art now (the tap, or Retry)
// POST /runs/:run/wish/art/prompt {banner}                → {prompt, negativePrompt}; for the prompt review dialog
// POST /runs/:run/selector/:li {item}                     → SelectorResult {item, selector}; 409 `locked` below level 10
// Creating a banner may fail per kind with 503 `no-connection`, 422 `declined` or 502 `bad-format` (reported in
// `failed`; open again to retry). Echoes are pulled through the same route, on the same pity.
import { z } from "zod";
import { PULL_COUNTS, isItemId } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import {
  OtomeForgeError,
  debugModeOf,
  liParam,
  parseBody,
  reviewModeOf,
  runParam,
  type OtomeRouter,
  type RouteDeps,
} from "../http.js";
import { bannerArtPromptFor, openWish, paintBannerArtNow, wishView } from "../wish/banners.js";
import { claimSelector, pullWish } from "../wish/pull.js";

const PROMPT_MAX = 4000;
const BannerRef = { banner: z.string().min(1).max(80) };
const PullBody = z.object({
  ...BannerRef,
  count: z.union([z.literal(PULL_COUNTS[0]), z.literal(PULL_COUNTS[1])]),
  requestId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,80}$/)
    .optional(),
});
const ArtBody = z.object({
  ...BannerRef,
  prompt: z.string().max(PROMPT_MAX).optional(),
  negativePrompt: z.string().max(PROMPT_MAX).optional(),
});
const ArtPromptBody = z.object(BannerRef);
const SelectorBody = z.object({ item: z.string().min(1).max(80) });
const NoFields = z.object({});

/**
 * `active` is false once the package is torn down (server-entry.ts): a banner's art still waiting in the paint lane
 * then stops before its paid call.
 */
export function registerWishRoutes(
  router: OtomeRouter,
  deps: RouteDeps,
  { active }: { active?: () => boolean } = {},
): void {
  const { handle } = deps;

  router.get(
    "/runs/:run/wish",
    handle(async (request) => wishView(deps, runParam(request).runId)),
  );

  router.post(
    "/runs/:run/wish/open",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return openWish(deps, runId, { debugMode: debugModeOf(request), review: reviewModeOf(request), active });
    }),
  );

  router.post(
    "/runs/:run/wish/pull",
    handle(async (request) => {
      const body = parseBody(PullBody, request.body);
      const { runId } = runParam(request);
      return pullWish(deps, runId, body);
    }),
  );

  router.post(
    "/runs/:run/wish/art",
    handle(async (request) => {
      const { banner, prompt, negativePrompt } = parseBody(ArtBody, request.body);
      const { runId } = runParam(request);
      const art = await paintBannerArtNow(deps, runId, banner, {
        debugMode: debugModeOf(request),
        edited: { prompt, negativePrompt },
        active,
      });
      return { art };
    }),
  );

  router.post(
    "/runs/:run/wish/art/prompt",
    handle(async (request) => {
      const { banner } = parseBody(ArtPromptBody, request.body);
      const { runId } = runParam(request);
      return bannerArtPromptFor(deps, runId, banner);
    }),
  );

  router.post(
    "/runs/:run/selector/:li",
    handle(async (request) => {
      const { item } = parseBody(SelectorBody, request.body);
      const { runId } = runParam(request);
      const li = liParam(request);
      if (!isItemId(item)) throw new OtomeForgeError(404, "No such Memory of theirs.", "not-found");
      return claimSelector(deps, runId, li, item);
    }),
  );
}
