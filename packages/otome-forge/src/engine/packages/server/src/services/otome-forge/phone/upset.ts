// ──────────────────────────────────────────────
// Otome Forge: her grievance with him (#2156): "I'm upset with him" in Routes, and his invitation to clear the air
// ──────────────────────────────────────────────
// - POST /runs/:run/routes/:li/upset {upset} (S/routes/arcs.ts): a flag on his state (LiState.upset), which the player
//   sets or takes back at any time, in one revision-checked write. Telling him queues one message from him (P17 with
//   reason "upset", S/phone/chat.ts writeFirstMessage) on the Messages connection, as the player's own request
//   (foreground admission), inside the thread's lock so his thread shows him typing. A thread that is busy, or ends on
//   her message waiting for his reply, drops it with a log line: his next reply knows anyway (S/prompts.ts upsetLine).
//   Taking it back calls no model, and lets an invitation still waiting lapse.
// - His invitation (S/phone/chat.ts inviteOffered) waits on his message: POST /runs/:run/phone/:li/invite {message,
//   accept}. Accept is a 409 `locked` while he holds a grievance of his own, and a 409 `conflict` (the invitation
//   lapses) unless it waits and she is still upset with him since before he asked; otherwise one write of the state
//   lets the upset go, sets `asked` and (#2303) registers the scene that clears the air, a one-node Character Story
//   with him (S/items/character-story.ts clearAirStoryChapter, saved first, the first save winning), then the thread
//   marks it accepted with that scene (an Accept sent again finishes that, and answers with the same scene). `asked`
//   is let go once the scene is read to its end (S/state/rewards.ts). A story that accepted before #2303, while Date
//   Night was that evening, gets its scene when it is next opened (ensureClearAirScenes). Decline marks it declined:
//   she stays upset, and he never asks again until she takes it back and tells him again. Neither calls a model.
import type {
  LiId,
  PhoneInviteStatus,
  PhoneThread,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { clearAirOfKey, heldAgainst } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import type { RunState } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { resolveConnectionId } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, runDocTarget, stateId, unitId } from "../ids.js";
import { clearAirStoryChapter } from "../items/character-story.js";
import { normalizeState } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import { normalizeUnit } from "../schemas/unit.js";
import type { OtomeStore } from "../store.js";
import {
  chatTarget,
  conflict,
  inThreadLock,
  loadThreadRun,
  normalizeThread,
  readThread,
  writeFirstMessage,
} from "./chat.js";
import type { DailyDeps } from "./daily.js";

/** What POST .../routes/:li/upset did: whether she is upset with him now, and whether his answer is being written. */
export interface UpsetResult {
  upset: boolean;
  writing: boolean;
}

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");

/** His thread with every invitation still waiting set to `status` (`only`: that message's alone). */
async function settleInvites(
  deps: Pick<DailyDeps, "store">,
  runId: string,
  li: LiId,
  status: PhoneInviteStatus,
  only?: string,
  scene?: string,
): Promise<PhoneThread | null> {
  return deps.store.updateDoc(chatTarget(runId, li), normalizeThread, (current) => {
    const waiting = (id: string, invite?: { status: PhoneInviteStatus }) =>
      invite?.status === "pending" && (!only || id === only);
    if (!current.messages.some((message) => waiting(message.id, message.invite))) return current;
    return {
      ...current,
      messages: current.messages.map((message) =>
        waiting(message.id, message.invite) ? { ...message, invite: { status, ...(scene ? { scene } : {}) } } : message,
      ),
    };
  });
}

/** #2303: the clear-the-air scenes registered for `li`, by number, newest last. */
const clearAirScenes = (state: Pick<RunState, "chapters">, li: LiId) =>
  Object.keys(state.chapters)
    .flatMap((key) => {
      const scene = clearAirOfKey(key);
      return scene?.li === li ? [{ key, n: scene.n }] : [];
    })
    .sort((a, b) => a.n - b.n);

/**
 * #2303: saves the next scene to clear the air with `li` (one already saved under its key wins) and returns its key;
 * the caller registers it in the state, or removes it when its write refuses.
 */
async function saveClearAirScene(
  store: Pick<OtomeStore, "readDoc" | "mutateDoc">,
  runId: string,
  li: LiId,
  state: Pick<RunState, "chapters">,
): Promise<string> {
  const unit = await store.readDoc(unitId(runId, li), normalizeUnit);
  if (!unit) throw notFound("love interest");
  const n = (clearAirScenes(state, li).at(-1)?.n ?? 0) + 1;
  const chapter = clearAirStoryChapter(unit, n, new Date().toISOString());
  await store.mutateDoc(runDocTarget("chapter", chapterId(runId, chapter.key)), normalizeChapter, (current) =>
    current?.key ? current : chapter,
  );
  return chapter.key;
}

/** The state with `key` registered as a chapter to read, unless it is already. */
const withScene = (state: RunState, key: string): RunState =>
  state.chapters[key]
    ? state
    : { ...state, chapters: { ...state.chapters, [key]: { beatsRead: 0, completed: null, applied: [] } } };

/**
 * #2303: a story that accepted his invitation before #2303 kept `asked` for the Date Night that would be that evening,
 * and Date Night is no longer started: each love interest whose `asked` stands with no clear-the-air scene of theirs
 * left to read gets one now (the Story screen lists it). GET /runs/:run calls it; it writes only when one is owed.
 */
export async function ensureClearAirScenes(
  store: Pick<OtomeStore, "readDoc" | "mutateDoc" | "updateDoc" | "removeDoc">,
  runId: string,
  state: RunState,
): Promise<void> {
  const owed = (current: RunState, li: LiId) =>
    !!current.lis[li]?.asked && !clearAirScenes(current, li).some(({ key }) => !current.chapters[key]!.completed);
  for (const li of Object.keys(state.lis).filter((li) => owed(state, li))) {
    const key = await saveClearAirScene(store, runId, li, state);
    let registered = false;
    await store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
      registered = owed(current, li) || !!current.chapters[key];
      return owed(current, li) ? withScene(current, key) : current;
    });
    if (!registered) await store.removeDoc(chapterId(runId, key)).catch(() => false);
  }
}

/** POST /runs/:run/routes/:li/upset {upset}: tells him she is upset with him, or takes it back (see the header). */
export async function setUpset(
  deps: DailyDeps,
  runId: string,
  li: LiId,
  upset: boolean,
  { debugMode }: { debugMode: boolean },
): Promise<UpsetResult> {
  const { run } = await loadThreadRun(deps, runId, li);
  const since = new Date().toISOString();
  let told = false;
  const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    const his = current.lis[li];
    if (!his) throw notFound("love interest");
    told = upset && !his.upset;
    if (upset === !!his.upset) return current;
    return { ...current, lis: { ...current.lis, [li]: { ...his, upset: upset ? { since } : null } } };
  });
  if (!state) throw notFound("Otome Hearth story");
  if (!upset) {
    await settleInvites(deps, runId, li, "lapsed");
    return { upset: false, writing: false };
  }
  const connectionId = resolveConnectionId(run.world, "chat");
  if (!told || !connectionId || !deps.background) return { upset: true, writing: false };
  deps.background.ensure({
    key: `${runId}:upset:${li}`,
    connectionId,
    // The player's own tap, labelled with its call: it never waits for an idle connection.
    foreground: true,
    run: async () => {
      // She may have taken it back while the job waited.
      if (!(await deps.store.readDoc(stateId(runId), normalizeState))?.lis[li]?.upset) return;
      try {
        const sent = await inThreadLock(runId, li, () =>
          writeFirstMessage(deps, runId, li, { connectionId, debugMode, reason: "upset" }),
        );
        if (!sent) deps.runtime.logger.info("[otome-forge] %s answers her upset in his next reply instead.", li);
      } catch (error) {
        if (error instanceof OtomeForgeError && (error.code === "busy" || error.code === "conflict")) {
          deps.runtime.logger.info("[otome-forge] %s's answer to her upset was dropped: %s", li, error.message);
          return;
        }
        throw error;
      }
    },
  });
  return { upset: true, writing: true };
}

/**
 * POST /runs/:run/phone/:li/invite {message, accept}: her answer to his invitation to clear the air (the header). An
 * accepted one answers with the scene it opened (#2303), for the reader.
 */
export async function answerInvite(
  deps: Pick<DailyDeps, "store">,
  runId: string,
  li: LiId,
  { message, accept }: { message: string; accept: boolean },
): Promise<{ status: PhoneInviteStatus; scene?: string }> {
  await loadThreadRun(deps, runId, li);
  const invited = (await readThread(deps.store, runId, li))?.messages.find(
    (entry) => entry.id === message && entry.who === "li" && entry.invite,
  );
  if (!invited?.invite) throw notFound("invitation");
  const answer: PhoneInviteStatus = accept ? "accepted" : "declined";
  if (invited.invite.status === answer) {
    return { status: answer, ...(invited.invite.scene ? { scene: invited.invite.scene } : {}) };
  }
  if (invited.invite.status !== "pending") throw conflict("That invitation was answered already.");
  let scene: string | undefined;
  if (accept) {
    const at = new Date().toISOString();
    let lapsed = false;
    const before = await deps.store.readDoc(stateId(runId), normalizeState);
    if (!before) throw notFound("Otome Hearth story");
    const key = await saveClearAirScene(deps.store, runId, li, before);
    const state = await deps.store
      .updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
        const his = current.lis[li];
        if (!his) throw notFound("love interest");
        if (heldAgainst(his)) {
          throw new OtomeForgeError(409, "They need space first: make it right in Routes.", "locked");
        }
        // An Accept sent again after its thread write failed: the scene already waits.
        lapsed = !his.upset && !(his.asked && Date.parse(his.asked) >= Date.parse(invited.at));
        // Taken back since, or told again after he asked: this invitation was for an upset that is over.
        if (his.upset && Date.parse(his.upset.since) > Date.parse(invited.at)) lapsed = true;
        if (lapsed || !his.upset) return current;
        return withScene({ ...current, lis: { ...current.lis, [li]: { ...his, upset: null, asked: at } } }, key);
      })
      .catch(async (error: unknown) => {
        await deps.store.removeDoc(chapterId(runId, key)).catch(() => false);
        throw error;
      });
    if (!state) throw notFound("Otome Hearth story");
    // The scene this acceptance registered, or (an Accept sent again) the one already waiting; one saved for nothing
    // goes.
    scene = state.chapters[key] ? key : clearAirScenes(state, li).at(-1)?.key;
    if (scene !== key) await deps.store.removeDoc(chapterId(runId, key)).catch(() => false);
    if (lapsed) {
      await settleInvites(deps, runId, li, "lapsed", message);
      throw conflict("You took it back, so that invitation has lapsed.");
    }
  }
  await settleInvites(deps, runId, li, answer, message, scene);
  return { status: answer, ...(scene ? { scene } : {}) };
}
