// ──────────────────────────────────────────────
// Otome Forge: the Home routes (plan M3 "Routes")
// ──────────────────────────────────────────────
// GET  /runs/:run/home                → HomeView: who Home shows, today's note (null when there is none, or it was
//                                       written before a rupture opened or was repaired), the look and its cut-out,
//                                       his ready faces, whether his lines are ready, a rupture, unread replies
// POST /runs/:run/home/set {li?, show?} → {home}: the love interest Home is about, and Him or Me
// POST /runs/:run/home/note {li}       → {note}: today's note, written by the day's first call and read back after
// GET  /runs/:run/lis/:li/lines        → LinesView: his pre-written lines (cold only during a rupture)
// Reading Home queues what it is missing in the background and never waits for it: each love interest's line pack
// (the first visit backfills every one), and the cut-outs of his worn look and its ready faces. A note may fail with
// 503 `no-connection`, 422 `declined` (nothing is saved) or 502 `bad-format`.
import { forgeLocalAvatarPath } from "@forge-kit/image-avatar-references.mjs";
import { forgeStoryExpressionCast } from "@forge-kit/story-expressions-server.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import { z } from "zod";
import type {
  HomeLook,
  HomeView,
  Player,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FACES, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { cutoutView, queueCutouts, type CutoutClient } from "../art/cutout.js";
import { ensureLinePacks, linesView, needsLines } from "../home/lines.js";
import { noteFits, readNote, serveNote, toNoteView, todayKey } from "../home/note.js";
import {
  OtomeForgeError,
  debugModeOf,
  liParam,
  parseBody,
  runParam,
  type OtomeRouter,
  type RouteDeps,
} from "../http.js";
import { isLiId, runDocTarget, stateId, unitId } from "../ids.js";
import { normalizeThread, unreadCount } from "../phone/chat.js";
import { field } from "../schemas/common.js";
import { normalizeState, readRun } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";

const SetBody = z.object({
  li: z.string().min(1).max(80).optional(),
  show: z.enum(["him", "me"]).optional(),
});
const NoteBody = z.object({ li: z.string().min(1).max(80) });

export interface HomeRouteDeps extends RouteDeps {
  /** The loopback cut-out client by default; tests pass a fake. */
  cutouts?: CutoutClient;
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");

/** The persona's Engine avatar, when it is a file the Engine serves; "" otherwise. */
async function personaAvatar(runtime: Pick<CapabilityRuntimeHost, "resources">, personaId: string): Promise<string> {
  if (!personaId) return "";
  try {
    const [record] = await runtime.resources.listPersonas([personaId]);
    const data = typeof record?.data === "string" ? JSON.parse(record.data) : record?.data;
    return forgeLocalAvatarPath(field(data, "avatarPath"));
  } catch {
    return "";
  }
}

/**
 * Him: his worn look with its cut-out. Me: the protagonist's painted look, else the persona's avatar (never cut out).
 * ponytail: his worn look is his portrait until M4's "Wear at home" outfits, and the protagonist's look is never cut
 * out (the plan gives only units cut-outs); the upgrade path is a `cutouts` field on the player.
 */
async function lookOf(
  deps: HomeRouteDeps,
  runId: string,
  show: HomeView["show"],
  unit: Unit | null,
  player: Player,
): Promise<HomeLook | null> {
  if (show === "me") {
    if (player.portrait) return { url: player.portrait, source: "look", cutoutState: "uncut" };
    const avatar = await personaAvatar(deps.runtime, player.personaId);
    return avatar ? { url: avatar, source: "avatar", cutoutState: "uncut" } : null;
  }
  if (!unit?.portrait) return null;
  const { state, cutout } = cutoutView(runId, unit, unit.portrait);
  return { url: unit.portrait, source: "look", cutoutState: state, ...(cutout ? { cutout } : {}) };
}

export function registerHomeRoutes(router: OtomeRouter, deps: HomeRouteDeps): void {
  const { store, handle, runtime } = deps;
  const warn = (what: string) => (error: unknown) =>
    runtime.logger.warn("[otome-forge] %s: %s", what, error instanceof Error ? error.message : String(error));

  router.get(
    "/runs/:run/home",
    handle(async (request) => {
      const { runId } = runParam(request);
      const run = await readRun(store, runId);
      if (!run) throw runNotFound();
      const order = Object.keys(run.state.lis);
      const li = run.state.home.li ?? order[0] ?? null;
      const unit = (li && run.units.find((entry) => entry.id === li)) || null;
      const liState = li ? run.state.lis[li] : undefined;
      const { show } = run.state.home;
      const [note, look, chats] = await Promise.all([
        li ? readNote(store, runId, todayKey(), li) : null,
        lookOf(deps, runId, show, unit, run.player),
        store.listRun("chat", runId),
      ]);

      // His ready faces on his worn look (M2b paints them), each with its cut-out once it is made.
      // ponytail: until M2b lands no face is ever ready, so Home shows his plain look; nothing here changes then.
      const faces: HomeView["faces"] = {};
      const base = unit?.portrait;
      const ready =
        unit && base ? (forgeStoryExpressionCast(run.world.images, unit, base, FACES).expressions ?? {}) : {};
      if (unit && base) {
        for (const [face, url] of Object.entries(ready) as Array<[Face, string]>) {
          const { cutout } = cutoutView(runId, unit, url);
          faces[face] = { url, ...(cutout ? { cutout } : {}) };
        }
        if (show === "him") queueCutouts(deps, runId, unit, [base, ...Object.values(ready)]);
      }
      // The first visit backfills every love interest's pack; later visits catch a new stage's.
      void ensureLinePacks(deps, runId, order, { debugMode: debugModeOf(request) }).catch(
        warn("Line packs not queued"),
      );

      const view: HomeView = {
        li,
        show,
        // A note from the other side of a rupture opening or being repaired is stale: the client asks for today's.
        note: note && noteFits(note, liState) ? toNoteView(note) : null,
        look,
        faces,
        lines: { ready: !!unit && !!liState && !needsLines(unit, liState.stage) },
        rupture: !!liState?.rupture,
        unread: chats.reduce((sum, record) => sum + unreadCount(normalizeThread(record.data)), 0),
      };
      return view;
    }),
  );

  router.post(
    "/runs/:run/home/set",
    handle(async (request) => {
      const body = parseBody(SetBody, request.body);
      const { runId } = runParam(request);
      if (body.li !== undefined && !isLiId(body.li)) throw liNotFound();
      const state = await store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) => {
        if (body.li !== undefined && !current.lis[body.li]) throw liNotFound();
        const home = { li: body.li ?? current.home.li, show: body.show ?? current.home.show };
        return home.li === current.home.li && home.show === current.home.show ? current : { ...current, home };
      });
      if (!state) throw runNotFound();
      return { home: state.home };
    }),
  );

  router.post(
    "/runs/:run/home/note",
    handle(async (request) => {
      const { li } = parseBody(NoteBody, request.body);
      const { runId } = runParam(request);
      if (!isLiId(li)) throw liNotFound();
      const note = await serveNote(deps, runId, li, { debugMode: debugModeOf(request) });
      return { note: toNoteView(note) };
    }),
  );

  router.get(
    "/runs/:run/lis/:li/lines",
    handle(async (request) => {
      const { runId } = runParam(request);
      const li = liParam(request);
      const [unit, state] = await Promise.all([
        store.readDoc(unitId(runId, li), normalizeUnit),
        store.readDoc(stateId(runId), normalizeState),
      ]);
      const liState = state?.lis[li];
      if (!unit || !liState) throw liNotFound();
      const view = linesView(unit, liState);
      if (!view.ready) {
        void ensureLinePacks(deps, runId, [li], { debugMode: debugModeOf(request) }).catch(
          warn("Line pack not queued"),
        );
      }
      return view;
    }),
  );
}
