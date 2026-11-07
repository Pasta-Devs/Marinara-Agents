// ──────────────────────────────────────────────
// Otome Forge: the phone routes (plan M3 "Phone server")
// ──────────────────────────────────────────────
// GET  /runs/:run/phone                                              → PhoneListView {threads: [{li, last, unread, busy}],
//                                                                       group: {members, last, unread, busy} | null}
// GET  /runs/:run/phone/:li?page=                                    → PhoneHistoryPage (80 messages a page, newest first)
// POST /runs/:run/phone/:li/send {text?, quote?, sticker?, id?, retry?} → PhoneSendResult {messages, suggestions}
// POST /runs/:run/phone/:li/close                                    → PhoneCloseResult {memory, grants}
// POST /runs/:run/phone/:li/seen {last?}                             → {}
// The group chat (#2154, S/phone/group.ts), registered before `:li`, which is a 404 for anything but a love interest:
// GET  /runs/:run/phone/group?page=                                  → PhoneHistoryPage with its members
// POST /runs/:run/phone/group/send {text?, sticker?, id?, retry?}    → PhoneSendResult (the members' reply)
// POST /runs/:run/phone/group/close                                  → PhoneCloseResult (no grants)
// POST /runs/:run/phone/group/seen {last?}                           → {}
// Until two love interests are met its routes are a 409 `conflict`.
// POST /runs/:run/phone/:li/invite {message, accept}                 → {status} (#2156): her answer to his invitation
//      to clear the air (S/phone/upset.ts): 409 `locked` while he needs space, 409 `conflict` once it lapsed
// POST /runs/:run/phone/due {open?}                                  → PhoneDueResult {status, latest, group}: the daily
//      messages' heartbeat (S/phone/daily.ts) and the group chat's squabbles' (S/phone/group.ts groupDue), with the
//      thread the player has open, if any
// A thread has one send or close in flight at a time: another is a 409 `busy`. Writing his reply or the memory may fail
// with 503 `no-connection`, 422 `declined` or 502 `bad-format`; the player's message stays saved and the history page
// offers Retry. Sending and closing wait for a forged world (409 `conflict`); an unknown run or love interest is a 404.
import { z } from "zod";
import { STICKER_ID } from "../../../../../client/src/features/otome-forge/shared/stickers.js";
import { OtomeForgeError, debugModeOf, liParam, parseBody, runParam, type RegisterRoutes } from "../http.js";
import { field } from "../schemas/common.js";
import { MESSAGE_ID, markSeen, phoneList, sendMessage, threadPage } from "../phone/chat.js";
import { noteOpenThread, phoneDue } from "../phone/daily.js";
import { closeGroup, groupDue, groupList, groupPage, groupSeen, sendToGroup } from "../phone/group.js";
import { closeAndRemember } from "../phone/memory.js";
import { answerInvite } from "../phone/upset.js";
import { MESSAGE_TEXT_MAX, NOTE_QUOTE_MAX } from "../phone/replies.js";

const SendBody = z.object({
  text: z.string().max(MESSAGE_TEXT_MAX).optional(),
  quote: z.string().max(NOTE_QUOTE_MAX).optional(),
  sticker: z.string().regex(STICKER_ID).optional(),
  id: z.string().max(60).optional(),
  retry: z.boolean().optional(),
});
const GroupSendBody = SendBody.omit({ quote: true });
const SeenBody = z.object({ last: z.string().max(60).optional() });
const DueBody = z.object({ open: z.string().max(80).nullable().optional() });
const NoFields = z.object({});
const InviteBody = z.object({ message: z.string().min(1).max(60), accept: z.boolean() });

export const registerPhoneRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.get(
    "/runs/:run/phone",
    handle(async (request) => {
      const { runId } = runParam(request);
      return groupList(deps, runId, (await phoneList(deps, runId)).threads);
    }),
  );

  router.get(
    "/runs/:run/phone/group",
    handle(async (request) => groupPage(deps, runParam(request).runId, field(request.query, "page"))),
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
      return page;
    }),
  );

  router.post(
    "/runs/:run/phone/due",
    handle(async (request) => {
      const { open } = parseBody(DueBody, request.body);
      const { runId } = runParam(request);
      const options = { open: open ?? null, debugMode: debugModeOf(request) };
      const daily = await phoneDue(deps, runId, options);
      return { ...daily, group: await groupDue(deps, runId, options) };
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
