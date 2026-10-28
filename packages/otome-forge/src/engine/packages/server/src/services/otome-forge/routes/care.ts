// ──────────────────────────────────────────────
// Otome Forge: Remind Me's routes (plan M6 "Server")
// ──────────────────────────────────────────────
// POST /runs/:run/care-note {li, careLine?} → CareNoteResult {note, source}: the Caring message (S/care/care-note.ts).
//      Always `Cache-Control: no-store`, errors included; nothing is written; no error carries the body. Otome logs
//      nothing about it, its failures included, and the route's `logLevel: "silent"` drops the Engine's request lines
//      (incoming request, request completed), since the button shows only on a day the tracker marks and a timestamped
//      line would date one. One limit stays: a line the Engine's shared logger writes while the model call runs (a
//      provider's rate-limit, retry or fallback warning) carries this route's pattern and its time, never the line or
//      the note (README, Remind Me).
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
 * The Love Timeline kinds that come back every year: a stage a love interest reaches (`stage-<n>`, M2b, labelled with
 * the route chapter's title) and a `first-<what>` (a first date, the first Read Him, …). M4's Snapshots (`snapshot`,
 * one per new Snapshot won, labelled with its whole vignette) and couple sets (`couple`, two looks' names) are things
 * won, several a day on a ten-pull: on the calendar they would fill Coming up every year, so they stay on the Album's
 * Love Timeline only.
 */
const ANNIVERSARY_KIND = /^(?:stage-\d+|first-[a-z0-9-]+)$/;

/**
 * The calendar of a run on the local day `today`; `banners` are the data of the run's banner documents.
 *   birthdays      each love interest's bible birthday, in cast order;
 *   anniversaries  the day the story began (labelled with the world's title) and each first of the Love Timeline
 *                  (ANNIVERSARY_KIND, labelled with its entry's text), oldest first, with the year it happened;
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
  // Each first shows on its own local day, for love interests still in the cast.
  const cast = new Set(units.map((unit) => unit.id));
  for (const entry of run.state.timeline) {
    if (cast.has(entry.li) && ANNIVERSARY_KIND.test(entry.kind)) add(localDay(entry.at), entry.text, entry.li);
  }
  const anniversaries = dated.sort((a, b) => a.day.localeCompare(b.day)).map(({ row }) => row);

  // M4's banners (`${R}:banner:${kind}-${rotation}` = {key, kind, endsDay, featuredLi, …}; none before a story's first
  // Wish), read field by field, so a banner of any other shape is skipped rather than a 500, and labelled with its
  // featured love interest's name.
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
    { logLevel: "silent" },
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
