// ──────────────────────────────────────────────
// Otome Forge: the phone routes (plan M3 "Phone server")
// ──────────────────────────────────────────────
// GET  /runs/:run/phone                                              → PhoneListView {threads: [{li, last, unread, busy,
//                                                                       closing?, remembered?}], group: {members, last,
//                                                                       unread, busy, closing?, remembered?} | null}
// GET  /runs/:run/phone/:li?page=                                    → PhoneHistoryPage (80 messages a page, newest first)
// POST /runs/:run/phone/:li/send {text?, quote?, sticker?, id?, retry?} → PhoneSendResult {messages, suggestions}
// POST /runs/:run/phone/:li/close                                    → PhoneCloseResult {remembering} | {memory}
// POST /runs/:run/phone/:li/seen {last?}                             → {}
// The group chat (#2154, S/phone/group.ts), registered before `:li`, which is a 404 for anything but a love interest:
// GET  /runs/:run/phone/group?page=                                  → PhoneHistoryPage with its members
// POST /runs/:run/phone/group/send {text?, sticker?, id?, retry?}    → PhoneSendResult (the members' reply)
// POST /runs/:run/phone/group/close                                  → PhoneCloseResult (it earns nothing)
// POST /runs/:run/phone/group/seen {last?}                           → {}
// Until two love interests are met its routes are a 409 `conflict`.
// POST /runs/:run/phone/:li/invite {message, accept}                 → {status} (#2156): her answer to his invitation
//      to clear the air (S/phone/upset.ts): 409 `locked` while he needs space, 409 `conflict` once it lapsed. #2424:
//      his date invitation is only declined here (its Accept is POST /runs/:run/dates/invited, a 409 `conflict` here)
// POST /runs/:run/phone/due {open?}                     → PhoneDueResult {status, latest, group, invite}: the daily
//      messages' heartbeat (S/phone/daily.ts), the group chat's squabbles' (S/phone/group.ts groupDue) and the date
//      invitations' (#2424, S/phone/invite.ts inviteDue), with the thread the player has open, if any
// A send's result names (#2424, `held`) those whose grievance with her the reply's hurt opened (S/phone/chat.ts).
// A thread has one send or close in flight at a time: another is a 409 `busy`. Writing his reply may fail with 503
// `no-connection`, 422 `declined` or 502 `bad-format`; the player's message stays saved and the history page offers
// Retry. 0.47.1: a close answers once it is accepted, and its memory is written in the background (S/phone/memory.ts):
// the list and the history page say `closing` while it is, and its error once it failed; each read of them, and each
// heartbeat, queues a close a restart left remembering again. Sending and closing wait for a forged world (409
// `conflict`); an unknown run or love interest is a 404.
import { z } from "zod";
import type { PhoneCloseView } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { GROUP_THREAD } from "../../../../../client/src/features/otome-forge/shared/home.js";
import { STICKER_ID } from "../../../../../client/src/features/otome-forge/shared/stickers.js";
import { OtomeForgeError, debugModeOf, liParam, parseBody, runParam, type RegisterRoutes } from "../http.js";
import { field } from "../schemas/common.js";
import { MESSAGE_ID, markSeen, phoneList, sendMessage, threadPage } from "../phone/chat.js";
import { noteOpenThread, phoneDue } from "../phone/daily.js";
import {
  closeGroup,
  groupDue,
  groupList,
  groupPage,
  groupRemembering,
  groupSeen,
  sendToGroup,
} from "../phone/group.js";
import { friendDue } from "../phone/friends.js";
import { runEnded } from "./ended.js";
import { inviteDue } from "../phone/invite.js";
import { closeAndRemember, liRemembering, resumeClose } from "../phone/memory.js";
import { answerInvite } from "../phone/upset.js";
import { MESSAGE_TEXT_MAX, NOTE_QUOTE_MAX } from "../phone/replies.js";

const SendBody = z.object({
  text: z.string().max(MESSAGE_TEXT_MAX).optional(),
  quote: z.string().max(NOTE_QUOTE_MAX).optional(),
  sticker: z.string().regex(STICKER_ID).optional(),
  id: z.string().max(60).optional(),
  retry: z.boolean().optional(),
  // 0.34.0: the minutes he still holds the remote of her toys (the client keeps it), or none.
  remote: z.number().int().min(1).max(1440).optional(),
});
const GroupSendBody = SendBody.omit({ quote: true, remote: true });
const SeenBody = z.object({ last: z.string().max(60).optional() });
const DueBody = z.object({ open: z.string().max(80).nullable().optional() });
const NoFields = z.object({});
const InviteBody = z.object({ message: z.string().min(1).max(60), accept: z.boolean() });

export const registerPhoneRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;
  /**
   * 0.47.1: a close a restart left remembering, queued again by this read (S/phone/memory.ts resumeClose). One that
   * cannot be is logged, and the read still answers; its mark stands for the next read.
   */
  const resume = (runId: string, key: string, view: PhoneCloseView, debugMode: boolean) =>
    resumeClose(deps, runId, key, view, debugMode, (mark) =>
      key === GROUP_THREAD ? groupRemembering(deps, runId, mark) : liRemembering(deps, runId, key),
    ).catch((error: unknown) =>
      deps.runtime.logger.warn(
        "[otome-forge] Close and remember in %s was not queued again: %s",
        key,
        error instanceof Error ? error.message : String(error),
      ),
    );

  /** The list, with each close a restart left remembering queued again (resume). */
  const resumedList = async (runId: string, debugMode: boolean) => {
    const list = await groupList(deps, runId, (await phoneList(deps, runId)).threads);
    for (const thread of list.threads) await resume(runId, thread.li, thread, debugMode);
    if (list.group) await resume(runId, GROUP_THREAD, list.group, debugMode);
    return list;
  };

  router.get(
    "/runs/:run/phone",
    handle(async (request) => resumedList(runParam(request).runId, debugModeOf(request))),
  );

  router.get(
    "/runs/:run/phone/group",
    handle(async (request) => {
      const { runId } = runParam(request);
      const page = await groupPage(deps, runId, field(request.query, "page"));
      await resume(runId, GROUP_THREAD, page, debugModeOf(request));
      return page;
    }),
  );

  router.post(
    "/runs/:run/phone/group/send",
    handle(async (request) => {
      const body = parseBody(GroupSendBody, request.body);
      if (body.id !== undefined && !MESSAGE_ID.test(body.id)) {
        throw new OtomeForgeError(400, "Invalid request: id: not a message id", "bad-request");
      }
      return sendToGroup(deps, runParam(request).runId, body, { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/phone/group/close",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      return closeGroup(deps, runParam(request).runId, { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/phone/group/seen",
    handle(async (request) => {
      const { last } = parseBody(SeenBody, request.body);
      await groupSeen(deps, runParam(request).runId, last);
      return {};
    }),
  );

  router.get(
    "/runs/:run/phone/:li",
    handle(async (request) => {
      const { runId } = runParam(request);
      const li = liParam(request);
      const page = await threadPage(deps, runId, li, field(request.query, "page"));
      // Only the open thread reads its pages: no daily message starts there until the next heartbeat says she left.
      noteOpenThread(runId, li);
      await resume(runId, li, page, debugModeOf(request));
      return page;
    }),
  );

  router.post(
    "/runs/:run/phone/due",
    handle(async (request) => {
      const { open } = parseBody(DueBody, request.body);
      const { runId } = runParam(request);
      // #2459: an ended story writes no more messages.
      if (await runEnded(deps.store, runId)) return { status: "disabled", latest: null };
      const options = { open: open ?? null, debugMode: debugModeOf(request) };
      const daily = await phoneDue(deps, runId, options);
      // 0.47.1: nobody writes first in a thread being remembered, so the heartbeat queues a close a restart left too.
      await resumedList(runId, options.debugMode);
      return {
        ...daily,
        group: await groupDue(deps, runId, options),
        invite: await inviteDue(deps, runId, options),
        // #2458: her friends' messages and hangout invitations, each week.
        friend: await friendDue(deps, runId, "message", options),
        hangout: await friendDue(deps, runId, "hangout", options),
      };
    }),
  );

  router.post(
    "/runs/:run/phone/:li/send",
    handle(async (request) => {
      const body = parseBody(SendBody, request.body);
      if (body.id !== undefined && !MESSAGE_ID.test(body.id)) {
        throw new OtomeForgeError(400, "Invalid request: id: not a message id", "bad-request");
      }
      const { runId } = runParam(request);
      return sendMessage(deps, runId, liParam(request), body, { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/phone/:li/close",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runId } = runParam(request);
      return closeAndRemember(deps, runId, liParam(request), { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/phone/:li/seen",
    handle(async (request) => {
      const { last } = parseBody(SeenBody, request.body);
      const { runId } = runParam(request);
      await markSeen(deps, runId, liParam(request), last);
      return {};
    }),
  );

  router.post(
    "/runs/:run/phone/:li/invite",
    handle(async (request) => {
      const body = parseBody(InviteBody, request.body);
      const { runId } = runParam(request);
      return answerInvite(deps, runId, liParam(request), body);
    }),
  );
};
