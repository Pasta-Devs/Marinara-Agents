// ──────────────────────────────────────────────
// Otome Hearth: friends (#2458) routes
// ──────────────────────────────────────────────
// GET  /runs/:run/friends/met                                   → {met: [{key, name, cardId?}], block}: the people she
//      has met who could become her friend, newest first, and why none may join now (SH/friends.ts friendBlock)
// POST /runs/:run/friends {source: "met"|"card"|"new", …}        → {friend: {id, name}}: writes one friend (S/story/
//      friends.ts addFriend), in the run's foreground queue so two taps write one. 409 `conflict` when none may join.
import { z } from "zod";
import { DATE_PLACE_IDS, BASE_LOOK } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { friendBlock, friendHeld } from "../../../../../client/src/features/otome-forge/shared/friends.js";
import { cancellable } from "../story/beats.js";
import { runForeground } from "../generation.js";
import {
  OtomeForgeError,
  debugModeOf,
  liParam,
  param,
  parseBody,
  reviewModeOf,
  runParam,
  type RegisterRoutes,
} from "../http.js";
import { isChapterKey, sideCastId } from "../ids.js";
import { settleInvites } from "../phone/upset.js";
import { normalizeSideCast } from "../schemas/side-cast.js";
import { readRun } from "../schemas/state.js";
import { toChapterView } from "../schemas/story.js";
import { nextEndingStep } from "../story/ending.js";
import { askWingman } from "../story/friend-rewards.js";
import { openMendStory, openRankStory, startHangout } from "../story/friend-stories.js";
import { addFriend, currentArc, metPeople } from "../story/friends.js";
import { mementoPromptFor, paintMemento } from "../story/hangout-memento.js";
import { readChapter } from "../story/canon.js";
import { wearLook } from "./wardrobe.js";

const Pronouns = z.object({
  subject: z.string().trim().min(1).max(20),
  object: z.string().trim().min(1).max(20),
  possessive: z.string().trim().min(1).max(20),
});
const FriendBody = z.union([
  z.object({
    source: z.literal("met"),
    key: z.string().min(1).max(200),
    pronouns: Pronouns,
    cardId: z.string().min(1).max(200).optional(),
  }),
  z.object({ source: z.literal("card"), cardId: z.string().min(1).max(200), pronouns: Pronouns }),
  z.object({
    source: z.literal("new"),
    name: z.string().trim().min(1).max(80),
    pronouns: Pronouns,
    notes: z.string().max(500).optional(),
  }),
]);

const NoFields = z.object({});
const WingmanBody = z.object({ li: z.string().min(1).max(80) });
/** A place: one of Date Night's, a story place by name (`story:<name>`), or "partner-choice" (they choose). */
const HangoutBody = z.object({
  friends: z.array(z.string().min(1).max(80)).min(1).max(5),
  place: z.string().min(1).max(220),
  herLook: z.string().min(1).max(80),
  /** Accepting a friend's invitation to hang out: their message in their thread. */
  invite: z.object({ message: z.string().min(1).max(60) }).optional(),
});
const MementoBody = z.object({
  prompt: z.string().max(4000).optional(),
  negativePrompt: z.string().max(4000).optional(),
});

/** The hangout's place as the planner reads it (see HangoutBody). */
function placeText(place: string, firstFriend: string): string {
  if (place === "partner-choice") return `somewhere ${firstFriend} chooses`;
  if (place.startsWith("story:")) return `at ${place.slice("story:".length).trim()}`;
  if ((DATE_PLACE_IDS as readonly string[]).includes(place))
    return `at a ${place.replace(/-/g, " ")}, as this world has one`;
  throw new OtomeForgeError(400, "That place is not one you can choose.", "bad-request");
}

export const registerFriendRoutes: RegisterRoutes = (router, deps) => {
  const { store, handle } = deps;
  const mode = (request: Parameters<typeof debugModeOf>[0]) => ({
    debugMode: debugModeOf(request),
    review: reviewModeOf(request),
  });

  // Their rank story, and their make-up story (S/story/friend-stories.ts): planned once, then read in the reader.
  router.post(
    "/runs/:run/friends/:li/rank",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      const id = liParam(request);
      const chapter = await cancellable(deps, runId, (signal) =>
        openRankStory(deps, runId, id, { debugMode: debugModeOf(request), ...(signal ? { signal } : {}) }),
      );
      return { chapter: toChapterView(chapter) };
    }),
  );

  router.post(
    "/runs/:run/friends/:li/mend",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      const id = liParam(request);
      const chapter = await cancellable(deps, runId, (signal) =>
        openMendStory(deps, runId, id, { debugMode: debugModeOf(request), ...(signal ? { signal } : {}) }),
      );
      return { chapter: toChapterView(chapter) };
    }),
  );

  // The rank-5 Wingman (S/story/friend-rewards.ts).
  router.post(
    "/runs/:run/friends/:li/wingman",
    handle(async (request) => {
      const { li } = parseBody(WingmanBody, request.body);
      const { runId } = runParam(request);
      return askWingman(deps, runId, liParam(request), li);
    }),
  );

  // Hangouts (Album → Hangouts): every one planned so far, newest first, and a new one.
  router.get(
    "/runs/:run/hangouts",
    handle(async (request) => {
      const { runId } = runParam(request);
      const run = await readRun(store, runId);
      if (!run) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
      const hangouts = (await store.listRun("chapter", runId))
        .map((record) => record.data as { key?: unknown })
        .flatMap((data) => (typeof data.key === "string" && data.key.startsWith("story-hangout-") ? [data.key] : []));
      const chapters = (await Promise.all(hangouts.map((key) => readChapter(store, runId, key)))).flatMap((chapter) =>
        chapter ? [chapter] : [],
      );
      return {
        hangouts: chapters
          .sort((a, b) => b.plannedAt.localeCompare(a.plannedAt))
          .map((chapter) => ({
            ...toChapterView(chapter),
            state: run.state.chapters[chapter.key]?.completed ? "done" : "in-progress",
            memento: !!chapter.friendStory?.memento,
          })),
        // Who may come now: her friends whose grievance does not stand.
        free: Object.entries(run.state.friends).flatMap(([id, friend]) => (friendHeld(friend) ? [] : [id])),
      };
    }),
  );

  router.post(
    "/runs/:run/hangouts",
    handle(async (request) => {
      const body = parseBody(HangoutBody, request.body);
      const { runId } = runParam(request);
      const run = await readRun(store, runId);
      if (!run) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
      const first = run.friends?.find((unit) => unit.id === body.friends[0])?.name ?? "";
      const place = placeText(body.place, first);
      const { debugMode } = mode(request);
      // Her look first, as a date does: a look she cannot wear refuses the hangout before anything is planned.
      if (body.herLook !== BASE_LOOK) await wearLook(deps, runId, { owner: "me", look: body.herLook }, { debugMode });
      const chapter = await cancellable(deps, runId, (signal) =>
        startHangout(deps, runId, { friends: body.friends, place }, { debugMode, ...(signal ? { signal } : {}) }),
      );
      if (body.invite) await settleInvites(deps, runId, body.friends[0]!, "accepted", body.invite.message, chapter.key);
      return { chapter: toChapterView(chapter) };
    }),
  );

  router.post(
    "/runs/:run/hangouts/:key/memento/prompt",
    handle(async (request) => {
      const edited = parseBody(MementoBody, request.body);
      const key = param(request, "key");
      if (!isChapterKey(key)) throw new OtomeForgeError(404, "No such hangout.", "not-found");
      return mementoPromptFor(deps, runParam(request).runId, key, edited);
    }),
  );

  router.post(
    "/runs/:run/hangouts/:key/memento",
    handle(async (request) => {
      const edited = parseBody(MementoBody, request.body);
      const key = param(request, "key");
      if (!isChapterKey(key)) throw new OtomeForgeError(404, "No such hangout.", "not-found");
      return {
        art: await paintMemento(deps, runParam(request).runId, key, { ...edited, debugMode: debugModeOf(request) }),
      };
    }),
  );

  // #2459: End the Story: the finale, then the epilogue (S/story/ending.ts).
  router.post(
    "/runs/:run/ending",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      const chapter = await cancellable(deps, runId, (signal) =>
        nextEndingStep(deps, runId, { debugMode: debugModeOf(request), ...(signal ? { signal } : {}) }),
      );
      return { chapter: toChapterView(chapter) };
    }),
  );

  router.get(
    "/runs/:run/friends/met",
    handle(async (request) => {
      const { runId } = runParam(request);
      const run = await readRun(store, runId);
      if (!run) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
      const sides = await store.readDoc(sideCastId(runId), normalizeSideCast);
      const taken = { player: run.player, units: [...run.units, ...(run.friends ?? [])] };
      return {
        met: metPeople(sides?.people ?? {}, taken).map((person) => ({
          key: person.key,
          name: person.name,
          ...(person.cardId ? { cardId: person.cardId } : {}),
        })),
        block: friendBlock(run.units.length, Object.values(run.state.friends), await currentArc(store, runId)),
      };
    }),
  );

  router.post(
    "/runs/:run/friends",
    handle(async (request) => {
      const body = parseBody(FriendBody, request.body);
      const { runId } = runParam(request);
      const debugMode = debugModeOf(request);
      const friend = await runForeground(runId, () => addFriend(deps, runId, body, { debugMode }));
      return { friend };
    }),
  );
};
