// ──────────────────────────────────────────────
// Otome Forge: the story routes (plan M2a "Routes")
// ──────────────────────────────────────────────
// GET  /runs/:run/story                                        → StoryView
// POST /runs/:run/arcs {choice, newcomer?}                     → {arc: StoryArcView}: the next arc, once the last has ended
//                                                                 (#1983 M2/M3: breathing room, the story goes on, or
//                                                                 someone new arrives)
// POST /runs/:run/prologue                                     → {chapter: ChapterView}: the prologue, made once
//                                                                 with no model call (its scene is a beat like any)
// POST /runs/:run/chapters/next {lead}                         → {chapter: ChapterView}
// GET  /runs/:run/chapters/:key                                → ChapterDetail
// POST /runs/:run/chapters/:key/beats/:i {rewrite?, reviewImagePrompts?} → {beat, confrontation?: ConfrontationView};
//                                                                 then the next node is queued (M2b: a confrontation
//                                                                 node carries its stance game; S/routes/arcs.ts
//                                                                 takes its stances)
// POST /runs/:run/chapters/:key/beats/:i/choose {choice, option} → {beat: BeatView, remembered, rememberedBy}
// POST /runs/:run/chapters/:key/beats/:i/read {segment}        → ReadResult {grants, starlight, chapterDone}
// POST /runs/:run/chapters/:key/beats/:i/ease-off {segment}    → {beat: BeatView, veilSuggestions} & ReadResult
// POST /runs/:run/veil {limits}                                → {world: WorldView}; only ever lowers allow → veil
// POST /runs/:run/cancel                                       → {ok}
// POST /runs/:run/favorites {text, ref, li?, keep?}            → {favorites}; keeps the line (keep: false lets it go),
//                                                                 so sending it twice changes nothing
// Writing a plan or a beat may fail with 503 `no-connection`, 422 `declined` (nothing is written) or 502
// `bad-format`; a Cancel while it runs is a 409 `conflict`; a beat of a route chapter while a rupture stands is a 409
// `locked`. Hidden parts (node guides, the ledger, effects, trust and tension, a confrontation's composure and the
// endings not reached) never leave the server.
import { z } from "zod";
import type { Beat, BeatView, Favorite } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { LIMIT_IDS } from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  OtomeForgeError,
  debugModeOf,
  parseBody,
  reviewModeOf,
  runParam,
  type OtomeRequest,
  type RegisterRoutes,
} from "../http.js";
import { isChapterKey, isLiId, runDocTarget, stateId, worldId } from "../ids.js";
import { STATE_LIMITS, keepNewest, normalizeState } from "../schemas/state.js";
import { cgView } from "../art/cg.js";
import { withPlaceViews } from "../art/places.js";
import { toBeatView, toChapterView } from "../schemas/story.js";
import { toConfrontationView } from "../story/confrontation.js";
import { normalizeWorld, toWorldView } from "../schemas/world.js";
import { cancellable, chooseOption, easeOff, readTo, serveBeat } from "../story/beats.js";
import { chapterDetail, planNextChapter, startArc, storyView } from "../story/chapters.js";
import { ARC_CHOICES, toArcView } from "../schemas/story-arc.js";
import { ensurePrologue } from "../story/prologue.js";
import { introduceLoveInterest } from "../story/introduce.js";

const NextBody = z.object({ lead: z.string().min(1).max(80) });
const ArcBody = z.object({
  choice: z.enum(ARC_CHOICES),
  /** M3: who arrives, when the choice is "newcomer". */
  newcomer: z
    .union([
      z.object({
        source: z.literal("card"),
        cardId: z.string().min(1).max(200),
        pronouns: z.object({
          subject: z.string().min(1).max(20),
          object: z.string().min(1).max(20),
          possessive: z.string().min(1).max(20),
        }),
      }),
      z.object({
        source: z.literal("archetype"),
        archetype: z.string().min(1).max(80),
        name: z.string().min(1).max(80),
        pronouns: z.object({
          subject: z.string().min(1).max(20),
          object: z.string().min(1).max(20),
          possessive: z.string().min(1).max(20),
        }),
        notes: z.string().max(500).optional(),
      }),
    ])
    .optional(),
});
const BeatBody = z.object({ rewrite: z.boolean().optional() });
const ChooseBody = z.object({ choice: z.string().min(1).max(40), option: z.string().min(1).max(40) });
const SegmentBody = z.object({ segment: z.number().int().min(0).max(10_000) });
const VeilBody = z.object({ limits: z.array(z.enum(LIMIT_IDS)).max(LIMIT_IDS.length) });
const FavoriteBody = z.object({
  text: z.string().min(1).max(2000),
  ref: z.string().min(1).max(200),
  li: z.string().max(80).optional(),
  /** False lets the line go; absent or true keeps it. */
  keep: z.boolean().optional(),
});
const NoFields = z.object({});

const param = (request: OtomeRequest, name: string) => {
  const params = request.params;
  return params && typeof params === "object" ? (params as Record<string, unknown>)[name] : undefined;
};

/** The `:key` and `:i` params, or a 404 (a malformed one names no chapter or beat). */
export function beatParams(request: OtomeRequest): { key: string; i: number } {
  const key = param(request, "key");
  const index = Number(param(request, "i"));
  if (!isChapterKey(key)) throw new OtomeForgeError(404, "No such chapter.", "not-found");
  if (!Number.isInteger(index) || index < 0 || index > 99) throw new OtomeForgeError(404, "No such beat.", "not-found");
  return { key, i: index };
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");

/** The beat as the client sees it, its CG's paint left pending by a restart reading as `stopped` (S/art/cg.ts). */
function beatView(runId: string, beat: Beat): BeatView {
  const cg = cgView(runId, beat);
  return { ...toBeatView(beat), ...(cg ? { cg } : {}) };
}

export const registerStoryRoutes: RegisterRoutes = (router, deps) => {
  const { store, handle } = deps;

  router.get(
    "/runs/:run/story",
    handle(async (request) => storyView(deps, runParam(request).runId)),
  );

  router.post(
    "/runs/:run/arcs",
    handle(async (request) => {
      const body = parseBody(ArcBody, request.body);
      const { runId } = runParam(request);
      const debugMode = debugModeOf(request);
      // A malformed choice is refused before anything is read or written.
      if (body.choice === "newcomer" && !body.newcomer) {
        throw new OtomeForgeError(400, "Say who arrives, or choose another way on.", "bad-request");
      }
      // Someone arriving belongs to the newcomer choice alone: a body that names one for breathing room or the story
      // going on would write a love interest the arc never introduces.
      if (body.choice !== "newcomer" && body.newcomer) {
        throw new OtomeForgeError(400, "Only the newcomer choice brings someone in.", "bad-request");
      }
      let arrival: { id: string; name: string } | null = null;
      const arc = await startArc(deps, runId, body.choice, {
        debugMode,
        // Written only once every gate has passed, so a refused choice leaves no half-arrived love interest.
        ...(body.choice === "newcomer" && body.newcomer
          ? {
              arrive: async () => {
                arrival = await introduceLoveInterest(deps, runId, body.newcomer!);
                return arrival;
              },
            }
          : {}),
      });
      return { arc: toArcView(arc, 0), ...(arrival ? { li: (arrival as { id: string }).id } : {}) };
    }),
  );

  router.post(
    "/runs/:run/prologue",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return { chapter: toChapterView(await ensurePrologue(deps, runId)) };
    }),
  );

  router.post(
    "/runs/:run/chapters/next",
    handle(async (request) => {
      const { lead } = parseBody(NextBody, request.body);
      const { runId } = runParam(request);
      if (!isLiId(lead)) throw new OtomeForgeError(404, "No such love interest.", "not-found");
      const debugMode = debugModeOf(request);
      const chapter = await cancellable(deps, runId, (signal) =>
        planNextChapter(deps, runId, lead, { debugMode, signal }),
      );
      return { chapter: toChapterView(chapter) };
    }),
  );

  router.get(
    "/runs/:run/chapters/:key",
    handle(async (request) => {
      const { runId } = runParam(request);
      const key = param(request, "key");
      if (!isChapterKey(key)) throw new OtomeForgeError(404, "No such chapter.", "not-found");
      return chapterDetail(deps, runId, key);
    }),
  );

  router.post(
    "/runs/:run/chapters/:key/beats/:i",
    handle(async (request) => {
      const { rewrite } = parseBody(BeatBody, request.body);
      const { runId } = runParam(request);
      const { key, i } = beatParams(request);
      const beat = await serveBeat(deps, runId, key, i, {
        rewrite,
        debugMode: debugModeOf(request),
        review: reviewModeOf(request),
      });
      const confrontation = toConfrontationView(beat);
      return { beat: beatView(runId, beat), ...(confrontation ? { confrontation } : {}) };
    }),
  );

  router.post(
    "/runs/:run/chapters/:key/beats/:i/choose",
    handle(async (request) => {
      const { choice, option } = parseBody(ChooseBody, request.body);
      const { runId } = runParam(request);
      const { key, i } = beatParams(request);
      const { beat, remembered, rememberedBy } = await chooseOption(deps, runId, key, i, choice, option);
      return { beat: beatView(runId, beat), remembered, rememberedBy };
    }),
  );

  router.post(
    "/runs/:run/chapters/:key/beats/:i/read",
    handle(async (request) => {
      const { segment } = parseBody(SegmentBody, request.body);
      const { runId } = runParam(request);
      const { key, i } = beatParams(request);
      return readTo(deps, runId, key, i, segment, { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/chapters/:key/beats/:i/ease-off",
    handle(async (request) => {
      const { segment } = parseBody(SegmentBody, request.body);
      const { runId } = runParam(request);
      const { key, i } = beatParams(request);
      const { beat, ...rest } = await easeOff(deps, runId, key, i, segment, { debugMode: debugModeOf(request) });
      return { beat: beatView(runId, beat), ...rest };
    }),
  );

  router.post(
    "/runs/:run/veil",
    handle(async (request) => {
      const { limits } = parseBody(VeilBody, request.body);
      const { runId } = runParam(request);
      // Only lowers: an allowed limit becomes a Veil, and nothing else changes, so the 18+ gate never applies.
      const world = await store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
        const next = { ...current.content.limits };
        for (const id of limits) if (next[id] === "allow") next[id] = "veil";
        return { ...current, content: { ...current.content, limits: next } };
      });
      if (!world) throw runNotFound();
      return { world: toWorldView(withPlaceViews(runId, world)) };
    }),
  );

  router.post(
    "/runs/:run/cancel",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      deps.cancellation?.cancel(runId);
      return { ok: true };
    }),
  );

  router.post(
    "/runs/:run/favorites",
    handle(async (request) => {
      const { text, ref, li, keep = true } = parseBody(FavoriteBody, request.body);
      const { runId } = runParam(request);
      const at = new Date().toISOString();
      const state = await store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
        if (li && !current.lis[li]) throw new OtomeForgeError(404, "No such love interest.", "not-found");
        const starred = current.favorites.some((favorite) => favorite.ref === ref);
        if (starred === keep) return current;
        const favorite: Favorite = { at, text, ref, ...(li ? { li } : {}) };
        return {
          ...current,
          favorites: keep
            ? keepNewest([...current.favorites, favorite], STATE_LIMITS.favorites)
            : current.favorites.filter((entry) => entry.ref !== ref),
        };
      });
      if (!state) throw runNotFound();
      return { favorites: state.favorites };
    }),
  );
};
