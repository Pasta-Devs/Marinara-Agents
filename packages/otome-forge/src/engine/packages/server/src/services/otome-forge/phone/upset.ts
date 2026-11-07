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
//   lets the upset go and sets `asked`, so the next Date Night with him is that evening (S/minigames/date-night.ts),
//   then the thread marks it accepted (an Accept sent again finishes that). Decline marks it declined: she stays upset,
//   and he never asks again until she takes it back and tells him again. Neither calls a model.
import type {
  LiId,
  PhoneInviteStatus,
  PhoneThread,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { heldAgainst } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { resolveConnectionId } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, stateId } from "../ids.js";
import { normalizeState } from "../schemas/state.js";
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
): Promise<PhoneThread | null> {
  return deps.store.updateDoc(chatTarget(runId, li), normalizeThread, (current) => {
    const waiting = (id: string, invite?: { status: PhoneInviteStatus }) =>
      invite?.status === "pending" && (!only || id === only);
    if (!current.messages.some((message) => waiting(message.id, message.invite))) return current;
    return {
      ...current,
      messages: current.messages.map((message) =>
        waiting(message.id, message.invite) ? { ...message, invite: { status } } : message,
      ),
    };
  });
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
  if (!state) throw notFound("Otome Forge run");
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

/** POST /runs/:run/phone/:li/invite {message, accept}: her answer to his invitation to clear the air (the header). */
export async function answerInvite(
  deps: Pick<DailyDeps, "store">,
  runId: string,
  li: LiId,
  { message, accept }: { message: string; accept: boolean },
): Promise<{ status: PhoneInviteStatus }> {
  await loadThreadRun(deps, runId, li);
  const invited = (await readThread(deps.store, runId, li))?.messages.find(
    (entry) => entry.id === message && entry.who === "li" && entry.invite,
  );
  if (!invited?.invite) throw notFound("invitation");
  const answer: PhoneInviteStatus = accept ? "accepted" : "declined";
  if (invited.invite.status === answer) return { status: answer };
  if (invited.invite.status !== "pending") throw conflict("That invitation was answered already.");
  if (accept) {
    const at = new Date().toISOString();
    let lapsed = false;
    const state = await deps.store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
      const his = current.lis[li];
      if (!his) throw notFound("love interest");
      if (heldAgainst(his)) {
        throw new OtomeForgeError(409, "They need space first: make it right in Routes.", "locked");
      }
      // An Accept sent again after its thread write failed: the evening already waits.
      lapsed = !his.upset && !(his.asked && Date.parse(his.asked) >= Date.parse(invited.at));
      // Taken back since, or told again after he asked: this invitation was for an upset that is over.
      if (his.upset && Date.parse(his.upset.since) > Date.parse(invited.at)) lapsed = true;
      if (lapsed || !his.upset) return current;
      return { ...current, lis: { ...current.lis, [li]: { ...his, upset: null, asked: at } } };
    });
    if (!state) throw notFound("Otome Forge run");
    if (lapsed) {
      await settleInvites(deps, runId, li, "lapsed", message);
      throw conflict("You took it back, so that invitation has lapsed.");
    }
  }
  await settleInvites(deps, runId, li, answer, message);
  return { status: answer };
}
