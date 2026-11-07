// ──────────────────────────────────────────────
// Otome Forge: the Home routes (plan M3 "Routes")
// ──────────────────────────────────────────────
// GET  /runs/:run/home                → HomeView: who Home shows, today's note (null when there is none, or it was
//                                       written before a rupture opened or was repaired), the look worn (M4's Wear at
//                                       home) and its cut-out, his ready faces with their cut-outs, whether his lines
//                                       are ready, a rupture, unread replies, L0's picture (backdropOf), what a
//                                       love interest noticed about her look (M4's P19, and whether it is on its way),
//                                       the newest Photo Shoot photo with him, taped into his note (#2087), Your
//                                       thoughts… waiting for the next main chapter (#2127), and each figurine
//                                       bought in the Shop (#2128) once painted or while it paints (#2138), which
//                                       stands in L0, and (#2153) the love interests whose birthday can be
//                                       celebrated now and is not yet (`celebrate`, absent for none)
// POST /runs/:run/home/set {li?, show?} → {home}: the love interest Home is about, and Him or Me
// POST /runs/:run/home/note {li}       → {note}: today's note, written by the day's first call and read back after
// POST /runs/:run/home/thoughts {text} → {thoughts}: Your thoughts… (#2127), trimmed, wait with no model call for
//                                       the next main chapter's plan (S/story/chapters.ts), which lets them go; ""
//                                       lets them go now. 400 over THOUGHTS_MAX characters
// POST /runs/:run/home/birthday {li, gift?} → {key, resumed}: celebrates his birthday (#2153, S/home/birthday.ts):
//                                       his birthday scene, with no model call, and the Shop gift given. 404 for no
//                                       birthday to celebrate (or an unknown love interest or gift), 409 `conflict`
//                                       for a gift she has none of, 409 `locked` for the aphrodisiac under SFW Heat
// GET  /runs/:run/lis/:li/lines        → LinesView: his pre-written lines (cold only during a rupture), from a pack
//                                       the world's content allows (#2152)
// Reading Home queues what it is missing in the background and never waits for it: each love interest's line pack
// (the first visit backfills every one), and the cut-outs of his worn look and its ready faces and of each painted
// figurine (S/art/figurine.ts). It never paints a figurine. A note may fail with 503 `no-connection`, 422 `declined`
// (nothing is saved) or 502 `bad-format`.
import { z } from "zod";
import type {
  AlbumCg,
  HomeLook,
  HomeView,
  LiId,
  Player,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { isEngineAvatar } from "../../../../../client/src/features/otome-forge/shared/engine-art.js";
import type { Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { wornLookUrl } from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import { cutoutView, queueCutouts, type CutoutClient } from "../art/cutout.js";
import { personaAvatarPath } from "../art/engine-art.js";
import { figurinePicture, queueFigurineCutouts } from "../art/figurine.js";
import { birthdayOffers, celebrateBirthday } from "../home/birthday.js";
import { ensureLinePacks, linesView, needsLines } from "../home/lines.js";
import { noteFits, readNote, serveNote, toNoteView, todayKey } from "../home/note.js";
import { readItems } from "../items/open.js";
import { albumPhotos, listPhotos } from "../minigames/photo-shoot.js";
import {
  OtomeForgeError,
  debugModeOf,
  liParam,
  parseBody,
  runParam,
  type OtomeRouter,
  type RouteDeps,
} from "../http.js";
import { isLiId, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { readThread, unreadCount } from "../phone/chat.js";
import { GROUP_THREAD, THOUGHTS_MAX } from "../../../../../client/src/features/otome-forge/shared/home.js";
import { isGiftId } from "../../../../../client/src/features/otome-forge/shared/shop.js";
import { normalizeState, readRun, readyFaces } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeWorld } from "../schemas/world.js";
import { albumCgs } from "./album.js";
import { noticingLooks } from "./wardrobe.js";

const SetBody = z.object({
  li: z.string().min(1).max(80).optional(),
  show: z.enum(["him", "me"]).optional(),
});
const NoteBody = z.object({ li: z.string().min(1).max(80) });
const ThoughtsBody = z.object({ text: z.string().max(THOUGHTS_MAX) });
const BirthdayBody = z.object({ li: z.string().min(1).max(80), gift: z.string().min(1).max(40).optional() });

export interface HomeRouteDeps extends RouteDeps {
  /** The loopback cut-out client by default; tests pass a fake. */
  cutouts?: CutoutClient;
}

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");

/**
 * Him: the look he wears (Wear at home, else his portrait) with its cut-out. Me: the look she wears, else the
 * persona's avatar. Generated looks share the same cleanup; the avatar stays as supplied by the player.
 */
async function lookOf(
  deps: HomeRouteDeps,
  runId: string,
  show: HomeView["show"],
  unit: Unit | null,
  player: Player,
): Promise<HomeLook | null> {
  if (show === "me") {
    const worn = wornLookUrl(player);
    // #2147: her persona avatar (her look adopted from it too) is read live, so a new one shows here at once.
    if (worn && !isEngineAvatar(worn)) {
      const { state, cutout } = cutoutView(runId, { id: "player", cutouts: player.cutouts ?? {} }, worn);
      return { url: worn, source: "look", cutoutState: state, ...(cutout ? { cutout } : {}) };
    }
    const avatar = (await personaAvatarPath(deps.runtime, player.personaId).catch(() => "")) || worn;
    return avatar ? { url: avatar, source: "avatar", cutoutState: "uncut" } : null;
  }
  const worn = unit ? wornLookUrl(unit) : "";
  if (!unit || !worn) return null;
  const { state, cutout } = cutoutView(runId, unit, worn);
  return { url: worn, source: sourceOf(worn), cutoutState: state, ...(cutout ? { cutout } : {}) };
}

/** #2147: a look that is a card or persona avatar (S/art/engine-art.ts) stands as an avatar, uncut. */
const sourceOf = (url: string): HomeLook["source"] => (isEngineAvatar(url) ? "avatar" : "look");

/** The item of `items` with the latest `at`, or undefined for none. */
const newest = <T>(items: T[], at: (item: T) => string) =>
  items.reduce<T | undefined>((best, item) => (!best || at(item) > at(best) ? item : best), undefined);

/**
 * Home's back layer: the newest CG unlocked with this love interest (the Album's CGs, routes/album.ts albumCgs: they
 * name the love interest in them, so one from another love interest's scenes never stands behind him), else the
 * newest painted place; null for the gradient.
 */
export function backdropOf(
  cgs: ReadonlyArray<Pick<AlbumCg, "url" | "at" | "li">>,
  world: Pick<World, "places">,
  li: LiId | null,
): HomeView["backdrop"] {
  const cg = newest(
    cgs.filter((item) => !!li && item.li === li && !!item.url),
    (item) => item.at,
  );
  if (cg) return { url: cg.url, kind: "cg" };
  const place = newest(
    Object.values(world.places).filter((item) => item.art?.state === "ready" && !!item.art.url),
    (item) => item.art!.at,
  );
  return place ? { url: place.art!.url!, kind: "place" } : null;
}

export function registerHomeRoutes(router: OtomeRouter, deps: HomeRouteDeps): void {
  const { store, handle, runtime } = deps;
  const warn = (what: string) => (error: unknown) =>
    runtime.logger.warn("[otome-forge] %s: %s", what, error instanceof Error ? error.message : String(error));

  router.get(
    "/runs/:run/home",
    handle(async (request) => {
      const { runId } = runParam(request);
      // Asked before the reads: a line that lands while they run then answers "on its way", never "none and done".
      const noticingNow = noticingLooks(runId);
      const run = await readRun(store, runId);
      if (!run) throw runNotFound();
      const order = Object.keys(run.state.lis);
      const li = run.state.home.li ?? order[0] ?? null;
      let unit = (li && run.units.find((entry) => entry.id === li)) || null;
      const liState = li ? run.state.lis[li] : undefined;
      const { show } = run.state.home;
      let player = run.player;
      const base = unit ? wornLookUrl(unit) : "";
      const ready = unit && base ? (readyFaces(run.world, unit) ?? {}) : {};
      if (show === "him" && unit && base) {
        unit = await queueCutouts(deps, runId, unit, [base, ...Object.values(ready)]);
      } else if (show === "me") {
        const worn = wornLookUrl(player);
        if (worn) {
          const queued = await queueCutouts(deps, runId, { id: "player", cutouts: player.cutouts ?? {} }, [worn]);
          player = { ...player, cutouts: queued.cutouts };
        }
      }
      // Each love interest's thread by id, as the phone list reads them (listing would load every world's threads),
      // and the group chat's (#2154).
      const [note, look, threads, items, photos] = await Promise.all([
        li ? readNote(store, runId, todayKey(), li) : null,
        lookOf(deps, runId, show, unit, player),
        Promise.all([...order, GROUP_THREAD].map((id) => readThread(store, runId, id))),
        readItems(store, runId),
        listPhotos(store, runId),
      ]);
      const photo = newest(
        albumPhotos(photos).filter((entry) => !!li && entry.li === li),
        (entry) => entry.at,
      );

      // His ready faces on his worn look (M2b paints them in the background, as the reader and the phone read them),
      // each with its cut-out once it is made, and whether one is on its way (the client asks again until it lands).
      const faces: HomeView["faces"] = {};
      if (unit && base) {
        for (const [face, url] of Object.entries(ready) as Array<[Face, string]>) {
          const { state, cutout } = cutoutView(runId, unit, url);
          faces[face] = { url, cutoutState: state, ...(cutout ? { cutout } : {}) };
        }
      }
      // The first visit backfills every love interest's pack; later visits catch a new stage's.
      void ensureLinePacks(deps, runId, order, { debugMode: debugModeOf(request) }).catch(
        warn("Line packs not queued"),
      );
      // A bought figurine stands on Home once painted, cut out once its cut-out is made.
      const figurines = await queueFigurineCutouts(
        deps,
        runId,
        run.units.filter((entry) => run.state.owned.figurines[entry.id]),
      );
      const celebrate = birthdayOffers(run, todayKey()).flatMap((offer) => (offer.started ? [] : [offer.li]));

      const view: HomeView = {
        li,
        show,
        // A note from the other side of a rupture opening or being repaired is stale: the client asks for today's.
        note: note && noteFits(note, liState) ? toNoteView(note) : null,
        look,
        faces,
        lines: { ready: !!unit && !!liState && !needsLines(unit, liState.stage, run.world.content) },
        rupture: !!liState?.rupture,
        unread: threads.reduce((sum, thread) => sum + (thread ? unreadCount(thread) : 0), 0),
        backdrop: backdropOf(albumCgs(run, items), run.world, li),
        photo: photo ? { url: photo.url, at: photo.at } : null,
        // Only a line about the look she wears now is kept (schemas/player.ts), so a changed look shows none.
        noticed: run.player.noticed,
        noticing: noticingNow.includes(run.player.wornOutfit ?? ""),
        thoughts: run.state.thoughts,
        figurines: figurines.flatMap((entry) => {
          const picture = figurinePicture(runId, entry);
          return picture.url || picture.art?.state === "pending" ? [{ li: entry.id, ...picture }] : [];
        }),
        ...(celebrate.length ? { celebrate } : {}),
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
    "/runs/:run/home/thoughts",
    handle(async (request) => {
      const text = parseBody(ThoughtsBody, request.body).text.trim();
      const { runId } = runParam(request);
      const at = new Date().toISOString();
      // The same words sent again keep their time, so a plan being written as they are sent still lets them go.
      const state = await store.updateDoc(runDocTarget("state", stateId(runId)), normalizeState, (current) =>
        (current.thoughts?.text ?? "") === text ? current : { ...current, thoughts: text ? { text, at } : null },
      );
      if (!state) throw runNotFound();
      return { thoughts: state.thoughts };
    }),
  );

  router.post(
    "/runs/:run/home/birthday",
    handle(async (request) => {
      const { li, gift } = parseBody(BirthdayBody, request.body);
      const { runId } = runParam(request);
      if (!isLiId(li)) throw liNotFound();
      if (gift !== undefined && !isGiftId(gift)) throw new OtomeForgeError(404, "No such gift.", "not-found");
      return celebrateBirthday(deps, runId, li, gift);
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
      const [unit, state, world] = await Promise.all([
        store.readDoc(unitId(runId, li), normalizeUnit),
        store.readDoc(stateId(runId), normalizeState),
        // #2152: the world's Heat decides which packs Home may serve and which zones they hold.
        store.readDoc(worldId(runId), normalizeWorld),
      ]);
      const liState = state?.lis[li];
      if (!unit || !liState || !world) throw liNotFound();
      const view = linesView(unit, liState, world.content);
      if (!view.ready) {
        void ensureLinePacks(deps, runId, [li], { debugMode: debugModeOf(request) }).catch(
          warn("Line pack not queued"),
        );
      }
      return view;
    }),
  );
}
