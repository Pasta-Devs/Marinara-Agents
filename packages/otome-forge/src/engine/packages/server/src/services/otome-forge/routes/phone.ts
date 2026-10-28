// ──────────────────────────────────────────────
// Otome Forge: the phone routes (plan M3 "Phone server")
// ──────────────────────────────────────────────
// GET  /runs/:run/phone                                              → PhoneListView {threads: [{li, last, unread, busy}]}
// GET  /runs/:run/phone/:li?page=                                    → PhoneHistoryPage (80 messages a page, newest first)
// POST /runs/:run/phone/:li/send {text?, quote?, sticker?, id?, retry?} → PhoneSendResult {messages, suggestions}
// POST /runs/:run/phone/:li/close                                    → PhoneCloseResult {memory, grants}
// POST /runs/:run/phone/:li/seen {last?}                             → {}
// A thread has one send or close in flight at a time: another is a 409 `busy`. Writing his reply or the memory may fail
// with 503 `no-connection`, 422 `declined` or 502 `bad-format`; the player's message stays saved and the history page
// offers Retry. Sending and closing wait for a forged world (409 `conflict`); an unknown run or love interest is a 404.
import { z } from "zod";
import { FACES } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { OtomeForgeError, debugModeOf, liParam, parseBody, runParam, type RegisterRoutes } from "../http.js";
import { field } from "../schemas/common.js";
import { MESSAGE_ID, markSeen, phoneList, sendMessage, threadPage } from "../phone/chat.js";
import { closeAndRemember } from "../phone/memory.js";
import { MESSAGE_TEXT_MAX, NOTE_QUOTE_MAX } from "../phone/prompts.js";

const SendBody = z.object({
  text: z.string().max(MESSAGE_TEXT_MAX).optional(),
  quote: z.string().max(NOTE_QUOTE_MAX).optional(),
  sticker: z.enum(FACES).optional(),
  id: z.string().max(60).optional(),
  retry: z.boolean().optional(),
});
const SeenBody = z.object({ last: z.string().max(60).optional() });
const NoFields = z.object({});

export const registerPhoneRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.get(
    "/runs/:run/phone",
    handle(async (request) => phoneList(deps, runParam(request).runId)),
  );

  router.get(
    "/runs/:run/phone/:li",
    handle(async (request) =>
      threadPage(deps, runParam(request).runId, liParam(request), field(request.query, "page")),
    ),
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
};
