// ──────────────────────────────────────────────
// Otome Forge: the 18+ gate, runs and their settings, bibles and accents
// ──────────────────────────────────────────────
// POST /age-gate {confirm:true}            → {ageGate}
// POST /age-gate/revoke                    → {ageGate:null}; every world drops to SFW Heat, Angst at most, SFW images
// POST /runs {setup}                      → {run, view: RunView}; writes the run's documents and starts the forge
// GET  /runs/:run                          → {view: RunView}
// POST /runs/:run/activate                 → {index}
// POST /runs/:run/delete {confirmTitle}    → {index}; removes every `${R}:*` document and the run's gallery images
// POST /runs/:run/settings {content?, images?, connections?, language?} → {world: WorldView}; with an image
//      connection, each paint step the world lacks is added, waiting for the tap
// GET  /runs/:run/lis/:li/bible?spoilers=1 → {bible}
// POST /runs/:run/lis/:li/bible {bible}    → {bible}
// POST /runs/:run/lis/:li/accent {accent}  → {accent}
//
// The server never trusts the client with content. The gate is read from the index on each write: raising Heat or the
// image rating, or picking Dark romance, needs it (403 `age-gate`), lowering never does, and every stored content goes
// through enforceContent, so a limit that cannot apply is always a Line.
import { z } from "zod";
import { ARCHETYPE_IDS } from "../../../../../client/src/features/otome-forge/shared/archetypes.js";
import {
  DEFAULT_IMAGE_RATING,
  IMAGE_RATINGS,
  contentNeedsAgeGate,
  enforceContent,
  imageRatingNeedsAgeGate,
  raisesGatedSetting,
} from "../../../../../client/src/features/otome-forge/shared/content.js";
import { galleryRefIds } from "../art/image-client.js";
import { imagesOf, paintView, updateIfChanged } from "../art/paint.js";
import { withPlaceViews } from "../art/places.js";
import { OtomeForgeError, debugModeOf, liParam, parseBody, runParam, type RegisterRoutes } from "../http.js";
import {
  INDEX_ID,
  INDEX_TARGET,
  RUN_DOC_KINDS,
  newLiId,
  newRunKey,
  playerId,
  runDocTarget,
  runIdOf,
  stateId,
  unitId,
  worldId,
} from "../ids.js";
import { PronounsSchema, field } from "../schemas/common.js";
import { normalizeIndex } from "../schemas/index.js";
import { PLAYER_GOAL_MAX, PLAYER_TRAITS_MAX, normalizePlayer } from "../schemas/player.js";
import {
  defaultLiState,
  normalizeState,
  readRun,
  remapLearnedTells,
  toRunView,
  type RunDocuments,
} from "../schemas/state.js";
import { ACCENT_PATTERN, BibleSchema, LI_NOTES_MAX, normalizeUnit } from "../schemas/unit.js";
import {
  ConnectionsSchema,
  ContentSchema,
  DEFAULT_LANGUAGE,
  LANGUAGE_MAX,
  normalizeConnections,
  normalizeWorld,
  toWorldView,
} from "../schemas/world.js";
import { checkBible } from "../setup/bible.js";
import { initialForge, settleForge, startForge, withPaintSteps } from "../setup/forge.js";
import { readCard, readPersona } from "../setup/prompts.js";
import type { OtomeStore } from "../store.js";

const NoFields = z.object({});
const LIS_MIN = 2;
const LIS_MAX = 5;
const ID_MAX = 200;
const SetupLiSchema = z.union([
  z.object({ source: z.literal("card"), cardId: z.string().min(1).max(ID_MAX), pronouns: PronounsSchema }),
  z.object({
    source: z.literal("archetype"),
    archetype: z.enum(ARCHETYPE_IDS),
    name: z.string().min(1).max(80),
    pronouns: PronounsSchema,
    notes: z.string().max(LI_NOTES_MAX).optional(),
  }),
]);
const SetupBody = z.object({
  setup: z.object({
    title: z.string().max(200).optional(),
    premise: z.string().max(2000),
    language: z.string().min(1).max(LANGUAGE_MAX),
    protagonist: z.object({
      personaId: z.string().min(1).max(ID_MAX),
      pronouns: PronounsSchema,
      traits: z.array(z.string().max(80)).max(PLAYER_TRAITS_MAX),
      goal: z.string().max(PLAYER_GOAL_MAX),
    }),
    lis: z.array(SetupLiSchema).min(LIS_MIN).max(LIS_MAX),
    content: ContentSchema,
    images: z.object({
      connectionId: z.string().min(1).max(ID_MAX).nullable(),
      rating: z.enum(IMAGE_RATINGS),
      ask: z.boolean(),
      expressions: z.boolean(),
    }),
    connections: ConnectionsSchema,
  }),
});
const AgeGateBody = z.object({ confirm: z.literal(true) });
const DeleteBody = z.object({ confirmTitle: z.string().max(400) });
const SettingsBody = z.object({
  content: ContentSchema.optional(),
  images: z
    .object({
      connectionId: z.string().min(1).max(200).nullable().optional(),
      rating: z.enum(IMAGE_RATINGS).optional(),
      ask: z.boolean().optional(),
      expressions: z.boolean().optional(),
      styleProfileId: z.string().max(200).optional(),
    })
    .optional(),
  connections: ConnectionsSchema.optional(),
  language: z.string().min(1).max(LANGUAGE_MAX).optional(),
});
const BibleBody = z.object({ bible: BibleSchema });
const AccentBody = z.object({ accent: z.string().regex(ACCENT_PATTERN) });

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const liNotFound = () => new OtomeForgeError(404, "No such love interest.", "not-found");
const badRequest = (message: string) => new OtomeForgeError(400, message, "bad-request");
const ageGateNeeded = () => new OtomeForgeError(403, "Confirm the 18+ gate before raising this setting.", "age-gate");

const readIndex = async (store: Pick<OtomeStore, "readDoc">) =>
  (await store.readDoc(INDEX_ID, normalizeIndex)) ?? normalizeIndex(undefined);

/** The run as the client sees it: the protagonist's or a place's paint left pending by a restart reads as `stopped`. */
function runView(runKey: string, runId: string, { world, player, units, state }: RunDocuments) {
  const shown = player.art ? { ...player, art: paintView(runId, "player", player.art) } : player;
  return toRunView(runKey, withPlaceViews(runId, world), shown, units, state);
}

export const registerRunRoutes: RegisterRoutes = (router, deps) => {
  const { runtime, store, handle } = deps;

  router.post(
    "/runs",
    handle(async (request) => {
      const { setup } = parseBody(SetupBody, request.body);
      const premise = setup.premise.trim();
      if (!premise) throw badRequest("A story needs a premise.");
      const cardIds = setup.lis.flatMap((li) => (li.source === "card" ? [li.cardId] : []));
      if (new Set(cardIds).size !== cardIds.length)
        throw badRequest("Each character card is one love interest at most.");
      const ageGate = (await readIndex(store)).ageGate !== null;
      if (!ageGate && (contentNeedsAgeGate(setup.content) || imageRatingNeedsAgeGate(setup.images.rating))) {
        throw ageGateNeeded();
      }
      const persona = await readPersona(runtime, setup.protagonist.personaId);
      if (!persona?.name) throw badRequest("That persona is not available.");
      const names = await Promise.all(
        setup.lis.map(async (li) =>
          li.source === "card" ? ((await readCard(runtime, li.cardId))?.name ?? "") : li.name.trim(),
        ),
      );
      if (names.some((name) => !name)) throw badRequest("A love interest's card is not available or has no name.");

      const runKey = newRunKey();
      const runId = runIdOf(runKey);
      const at = new Date().toISOString();
      const liIds: string[] = [];
      for (const name of names) liIds.push(newLiId(name, liIds));
      // The world goes last: GET /runs/:run finds the run only once every other document exists.
      for (const [index, li] of setup.lis.entries()) {
        const id = liIds[index]!;
        await store.mutateDoc(runDocTarget("unit", unitId(runId, id)), normalizeUnit, (unit) => ({
          ...unit,
          id,
          name: names[index]!,
          pronouns: li.pronouns,
          source: li.source,
          ...(li.source === "card"
            ? { cardId: li.cardId }
            : { archetype: li.archetype, ...(li.notes?.trim() ? { notes: li.notes.trim() } : {}) }),
          createdAt: at,
        }));
      }
      const { protagonist } = setup;
      await store.mutateDoc(runDocTarget("player", playerId(runId)), normalizePlayer, (player) => ({
        ...player,
        personaId: protagonist.personaId,
        name: persona.name,
        pronouns: protagonist.pronouns,
        traits: protagonist.traits.map((trait) => trait.trim()).filter(Boolean),
        goal: protagonist.goal.trim(),
      }));
      await store.mutateDoc(runDocTarget("state", stateId(runId)), normalizeState, (state) => ({
        ...state,
        lis: Object.fromEntries(liIds.map((id) => [id, defaultLiState()])),
      }));
      const world = await store.mutateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => ({
        ...current,
        title: setup.title?.trim() ?? "",
        premise,
        language: setup.language.trim() || DEFAULT_LANGUAGE,
        createdAt: at,
        content: enforceContent(setup.content, ageGate),
        images: { ...current.images, ...setup.images },
        connections: normalizeConnections(setup.connections),
        forge: initialForge(liIds, setup.images.connectionId !== null),
      }));
      await store.mutateDoc(INDEX_TARGET, normalizeIndex, (index) => ({
        ...index,
        runs: [...index.runs, { runKey, title: world.title, createdAt: at, lastPlayedAt: at }],
        activeRun: runKey,
      }));
      startForge(deps, runId, { debugMode: debugModeOf(request) });
      const run = await readRun(store, runId);
      if (!run) throw runNotFound();
      return { run: runKey, view: runView(runKey, runId, run) };
    }),
  );

  router.post(
    "/age-gate",
    handle(async (request) => {
      parseBody(AgeGateBody, request.body);
      const at = new Date().toISOString();
      const index = await store.mutateDoc(INDEX_TARGET, normalizeIndex, (current) => ({
        ...current,
        ageGate: current.ageGate ?? { confirmedAt: at },
      }));
      return { ageGate: index.ageGate };
    }),
  );

  router.post(
    "/age-gate/revoke",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const index = await store.mutateDoc(INDEX_TARGET, normalizeIndex, (current) => ({ ...current, ageGate: null }));
      // A world that cannot be written never keeps the ones after it at the gated level; the request still fails, so
      // the player sees it and can revoke again (which lowers every world again).
      const failed: string[] = [];
      for (const run of index.runs) {
        try {
          await store.updateDoc(runDocTarget("world", worldId(runIdOf(run.runKey))), normalizeWorld, (world) => ({
            ...world,
            content: enforceContent(world.content, false),
            images: { ...world.images, rating: DEFAULT_IMAGE_RATING },
          }));
        } catch (error) {
          runtime.logger.error(error, "Otome Forge could not lower %s after the 18+ gate was revoked", run.runKey);
          failed.push(run.runKey);
        }
      }
      if (failed.length) {
        throw new OtomeForgeError(500, `The 18+ gate was revoked, but ${failed.length} world(s) were not lowered.`);
      }
      return { ageGate: null };
    }),
  );

  router.get(
    "/runs/:run",
    handle(async (request) => {
      const { runKey, runId } = runParam(request);
      // A forge step left running or pending by a restart reads as failed, with Retry.
      await settleForge(deps, runId);
      const run = await readRun(store, runId);
      if (!run) throw runNotFound();
      return { view: runView(runKey, runId, run) };
    }),
  );

  router.post(
    "/runs/:run/activate",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const { runKey } = runParam(request);
      const at = new Date().toISOString();
      const index = await store.updateDoc(INDEX_TARGET, normalizeIndex, (current) => {
        if (!current.runs.some((run) => run.runKey === runKey)) throw runNotFound();
        return {
          ...current,
          activeRun: runKey,
          runs: current.runs.map((run) => (run.runKey === runKey ? { ...run, lastPlayedAt: at } : run)),
        };
      });
      if (!index) throw runNotFound();
      return { index };
    }),
  );

  router.post(
    "/runs/:run/delete",
    handle(async (request) => {
      const { confirmTitle } = parseBody(DeleteBody, request.body);
      const { runKey, runId } = runParam(request);
      // At once, even while the forge works: its writes all go through updateDoc, so a step that ends after this
      // finds its document gone and stops instead of bringing the run back.
      const [index, world] = await Promise.all([readIndex(store), store.readDoc(worldId(runId), normalizeWorld)]);
      const entry = index.runs.find((run) => run.runKey === runKey);
      if (!entry && !world) throw runNotFound();
      // The picker lists the index's title, so that is the one the player types.
      if (confirmTitle.trim() !== (entry?.title ?? world?.title ?? "").trim()) {
        throw new OtomeForgeError(400, "The title typed to confirm the delete does not match.", "bad-request");
      }
      const next = await store.mutateDoc(INDEX_TARGET, normalizeIndex, (current) => ({
        ...current,
        runs: current.runs.filter((run) => run.runKey !== runKey),
        activeRun: current.activeRun === runKey ? null : current.activeRun,
      }));
      // Its story writes and memory upkeep stop; anything they still save is refused or removed with the rest.
      deps.cancellation?.cancel(runId);
      deps.memory?.invalidate(runId);
      const images = new Set<string>();
      for (const kind of RUN_DOC_KINDS) {
        for (const document of await store.listRun(kind, runId)) {
          for (const id of galleryRefIds(document.data)) images.add(id);
          await store.removeDoc(document.id);
        }
      }
      let kept = 0;
      for (const id of images) {
        const deleted = await imagesOf(deps)
          .deleteGalleryImage(id)
          .catch(() => false);
        if (!deleted) kept += 1;
      }
      if (kept)
        runtime.logger.warn("[otome-forge] Deleted run %s kept %d gallery images it could not delete", runKey, kept);
      return { index: next };
    }),
  );

  router.post(
    "/runs/:run/settings",
    handle(async (request) => {
      const body = parseBody(SettingsBody, request.body);
      const { runId } = runParam(request);
      const ageGate = (await readIndex(store)).ageGate !== null;
      const at = new Date().toISOString();
      const world = await store.updateDoc(runDocTarget("world", worldId(runId)), normalizeWorld, (current) => {
        const content = body.content ?? current.content;
        const images = { ...current.images, ...body.images };
        // Turning faces on again allows one more attempt at a set that failed or stopped before (the kit's rule).
        if (images.expressions && !current.images.expressions) images.expressionsSince = at;
        const from = { ...current.content, imageRating: current.images.rating };
        if (!ageGate && raisesGatedSetting(from, { ...content, imageRating: images.rating })) throw ageGateNeeded();
        return {
          ...current,
          language: body.language?.trim() || current.language,
          connections: body.connections ? normalizeConnections(body.connections) : current.connections,
          content: enforceContent(content, ageGate),
          images: { ...images, rating: ageGate ? images.rating : DEFAULT_IMAGE_RATING },
          // A world made without images that gains a connection gets its paint steps, waiting for the tap.
          forge: images.connectionId ? withPaintSteps(current.forge) : current.forge,
        };
      });
      if (!world) throw runNotFound();
      return { world: toWorldView(withPlaceViews(runId, world)) };
    }),
  );

  router.get(
    "/runs/:run/lis/:li/bible",
    handle(async (request) => {
      const { runId } = runParam(request);
      const li = liParam(request);
      // The bible is the hidden story: the client asks for it only behind its "Show spoilers" gate.
      const spoilers = field(request.query, "spoilers");
      if (spoilers !== "1" && spoilers !== "true") {
        throw new OtomeForgeError(400, "A bible is a spoiler: ask for it with spoilers=1.", "bad-request");
      }
      const unit = await store.readDoc(unitId(runId, li), normalizeUnit);
      if (!unit) throw liNotFound();
      return { bible: unit.bible };
    }),
  );

  router.post(
    "/runs/:run/lis/:li/bible",
    handle(async (request) => {
      const body = parseBody(BibleBody, request.body);
      const { runId } = runParam(request);
      const li = liParam(request);
      const others = (await store.listRun("unit", runId))
        .map((record) => normalizeUnit(record.data))
        .filter((unit) => unit.id !== li);
      // The player is the authority on an edit: no `pronouns` here, so the ones they set are kept.
      const bible = checkBible(body.bible, { others });
      if (typeof bible === "string") throw new OtomeForgeError(400, `Invalid bible: ${bible}`, "bad-request");
      let tellsBefore: readonly string[] = [];
      const unit = await store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) => {
        if (!current.bible) throw new OtomeForgeError(409, "This bible is still being written.", "conflict");
        tellsBefore = current.bible.mask.tells;
        // His pronouns and look live on the unit too (the run view and scene cards read the pronouns there, and the
        // next paint reads the look), so an edit to either steers what comes next.
        return {
          ...current,
          pronouns: bible.pronouns,
          identityLine: bible.look.identityLine,
          outfitLine: bible.look.outfitLine,
          bible,
          bibleEdited: true,
        };
      });
      if (!unit) throw liNotFound();
      // The tells he has learned are indexes into `mask.tells`: follow them to where an edit left those tells, so none
      // names a tell the protagonist did not read.
      // ponytail: the unit and the state are two writes, so a scene card built between them reads the old indexes
      // against the new tells; the upgrade path is to store each learned tell's text beside its index.
      const tellsAfter = unit.bible?.mask.tells;
      if (tellsAfter && tellsBefore.join("\n") !== tellsAfter.join("\n")) {
        await updateIfChanged(store, runDocTarget("state", stateId(runId)), normalizeState, (state) => {
          const learned = state.lis[li]?.tellsLearned ?? [];
          const remapped = remapLearnedTells(learned, tellsBefore, tellsAfter);
          if (remapped.length === learned.length && remapped.every((index, at) => index === learned[at])) {
            return undefined;
          }
          return { ...state, lis: { ...state.lis, [li]: { ...state.lis[li]!, tellsLearned: remapped } } };
        });
      }
      return { bible: unit.bible };
    }),
  );

  router.post(
    "/runs/:run/lis/:li/accent",
    handle(async (request) => {
      const { accent } = parseBody(AccentBody, request.body);
      const { runId } = runParam(request);
      const li = liParam(request);
      const unit = await store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) => ({
        ...current,
        accent: accent.toUpperCase(),
      }));
      if (!unit) throw liNotFound();
      return { accent: unit.accent };
    }),
  );
};
