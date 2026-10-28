// ──────────────────────────────────────────────
// Otome Forge: Remind Me's routes (plan M6 "Server")
// ──────────────────────────────────────────────
// POST /runs/:run/care-note {li, careLine?} → CareNoteResult {note, source}: the Caring message (S/care/care-note.ts).
//      Always `Cache-Control: no-store`, errors included; nothing is written; no error carries the body; nothing
//      about the request is logged, its failures included.
// GET  /runs/:run/calendar                → CalendarView {birthdays, anniversaries, bannerEnds}
// The calendar reads days in the request's time zone. Cycle data never reaches the server except as the care line, so
// the cycle row and the protagonist's own birthday are drawn by the client from this device's storage. Labels are
// story text (the world's title, a Love Timeline entry, a love interest's name), shown as written; the client's copy
// around them is localized.
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import { z } from "zod";
import type { CalendarView, LiId } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { BIRTHDAY_PATTERN } from "../../../../../client/src/features/otome-forge/shared/bible.js";
import { careLineAllowed, serveCareNote } from "../care/care-note.js";
import { todayKey } from "../home/note.js";
import {
  OtomeForgeError,
  parseBody,
  runParam,
  type OtomeReply,
  type RegisterRoutes,
  type RouteHandler,
} from "../http.js";
import { isDayKey, isLiId } from "../ids.js";
import { field } from "../schemas/common.js";
import { readRun, type RunDocuments } from "../schemas/state.js";

/** The instant's local day ("YYYY-MM-DD") in the request's zone, or null for a value that is not a time. */
function localDay(value: string): string | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? forgeDayKey(time) : null;
}

/**
 * The calendar of a run on the local day `today`; `banners` are the data of the run's banner documents.
 *   birthdays      each love interest's bible birthday, in cast order;
 *   anniversaries  the day the story began (labelled with the world's title) and each Love Timeline first (his
 *                  firsts, labelled with the timeline entry that records it), oldest first, with the year it happened;
 *   bannerEnds     the last day of each banner still running, soonest first.
 */
export function calendarView(run: RunDocuments, banners: readonly unknown[], today: string): CalendarView {
  const order = Object.keys(run.state.lis);
  const units = run.units
    .filter((unit) => order.includes(unit.id))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  const birthdays = units.flatMap((unit) =>
    unit.bible && BIRTHDAY_PATTERN.test(unit.bible.birthday) ? [{ li: unit.id, md: unit.bible.birthday }] : [],
  );

  const dated: Array<{ day: string; row: CalendarView["anniversaries"][number] }> = [];
  const add = (day: string | null, label: string, li?: LiId) => {
    const text = label.replace(/\s+/g, " ").trim();
    if (!day || !text) return;
    dated.push({ day, row: { md: day.slice(5), label: text, ...(li ? { li } : {}), year: Number(day.slice(0, 4)) } });
  };
  add(localDay(run.world.createdAt), run.world.title);
  // ponytail: nothing writes firsts or their timeline entries before M2b; until then only the story's first day shows.
  // A first with no timeline entry has nothing to be labelled with and is left out.
  for (const unit of units) {
    for (const [kind, at] of Object.entries(run.state.lis[unit.id]?.firsts ?? {})) {
      const entry = run.state.timeline.find((row) => row.li === unit.id && row.kind === kind);
      if (entry) add(localDay(at), entry.text, unit.id);
    }
  }
  const anniversaries = dated.sort((a, b) => a.day.localeCompare(b.day)).map(({ row }) => row);

  // ponytail: banners are M4's (`${R}:banner:${kind}-${rotation}` = {key, kind, endsDay, featuredLi, …}); until M4
  // lands none exist and bannerEnds is []. Read field by field, so a banner of any other shape is skipped rather than
  // a 500, and labelled with its featured love interest's name. Upgrade path: M4's banner normalizer and name.
  const names = new Map(units.map((unit) => [unit.id, unit.name]));
  const bannerEnds: CalendarView["bannerEnds"] = [];
  for (const data of banners) {
    const day = field(data, "endsDay");
    const featured = field(data, "featuredLi");
    const banner = isLiId(featured) ? names.get(featured)?.trim() : undefined;
    // A past rotation is an Echo: still pullable, with nothing left to end.
    if (!isDayKey(day) || day < today || !banner) continue;
    if (!bannerEnds.some((row) => row.day === day && row.banner === banner)) bannerEnds.push({ day, banner });
  }
  bannerEnds.sort((a, b) => a.day.localeCompare(b.day) || a.banner.localeCompare(b.banner));

  return { birthdays, anniversaries, bannerEnds };
}

const CareNoteBody = z.object({
  li: z.string().min(1).max(80),
  careLine: z.string().max(300).nullable().optional(),
});

/** The reply as Fastify gives it: `header` sets a response header (a test's fake reply may have none). */
type HeaderReply = OtomeReply & { header?(name: string, value: string): unknown };

/** Marks the response, success or error, as never to be stored by the browser or a proxy. */
const noStore =
  (handler: RouteHandler): RouteHandler =>
  (request, reply) => {
    (reply as HeaderReply).header?.("Cache-Control", "no-store");
    return handler(request, reply);
  };

export const registerCareRoutes: RegisterRoutes = (router, deps) => {
  const { handle, runtime, store } = deps;

  router.post(
    "/runs/:run/care-note",
    noStore(
      handle(async (request) => {
        try {
          const body = parseBody(CareNoteBody, request.body);
          const { runId } = runParam(request);
          if (!isLiId(body.li)) throw new OtomeForgeError(404, "No such love interest.", "not-found");
          return await serveCareNote(deps, runId, body.li, {
            careLine: body.careLine ?? undefined,
            allowed: () => careLineAllowed(runtime, request),
          });
        } catch (error) {
          if (error instanceof OtomeForgeError) throw error;
          // An unexpected failure is a plain 500 here and never logged, unlike other routes' (createHandle logs the
          // path): a line naming this route, or a stack through the care code, would date a cycle day in the log.
          throw new OtomeForgeError(500, "Otome Forge could not complete the request.");
        }
      }),
    ),
  );

  router.get(
    "/runs/:run/calendar",
    handle(async (request) => {
      const { runId } = runParam(request);
      const [run, banners] = await Promise.all([readRun(store, runId), store.listRun("banner", runId)]);
      if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
      return calendarView(
        run,
        banners.map((record) => record.data),
        todayKey(),
      );
    }),
  );
};
