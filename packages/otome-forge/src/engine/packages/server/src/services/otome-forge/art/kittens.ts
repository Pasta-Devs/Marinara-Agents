// ──────────────────────────────────────────────
// Otome Hearth: Kitty Cards' painted kittens (0.35.0): the protagonist and each love interest drawn as a kitten
// ──────────────────────────────────────────────
// With an image connection, the protagonist and each love interest with a bible get one kitten picture (kittenPrompt):
// a chibi kitten whose breed and fur echo their colouring, wearing small accessories from their look, painted through
// the portrait path so their avatar is the likeness reference. The records are `player.kitten` and `unit.kitten`.
// In a game the kittens take the value-5 cards (SH/kitty.ts kittenCards); a card without one keeps its breed's art.
//
// Paints follow the stickers' rules (art/stickers.ts, art/paint.ts): GET /runs/:run/play starts the run's chain, which
// claims one kitten at a time in its document before the paid call and paints it in the image connection's `low` lane
// behind taps and scene art; under Ask before painting or prompt review it is claimed `waiting-consent`, so only a tap
// pays (POST /runs/:run/art/kitten, the Kitty Cards screen's Paint our kittens); a failed or stopped one waits for a tap
// (Try again), and a failure rests the chain for STICKER_SET_RETRY_MS. A restart leaves at most one kitten `stopped`.
// Each is painted on the look's chroma matte and cut out by the free cut-out queue (art/cutout.ts, queued by GET /play
// and by a tap's paint) before it is shown. A tap on a painted kitten answers with it: Kitty Cards never repaints one.
// 0.36.0: the Album lists the painted ones (albumKittens) and its Repaint (POST /runs/:run/art/kitten with `repaint`)
// paints one again, as a sticker's (#2299, art/stickers.ts): the tap is the consent, the record keeps the old picture
// while the new one paints in the `low` lane and after a failure, the old one (cut out) is shown everywhere until the
// new one is cut out, and the replaced original leaves the gallery once the new one is saved.
// ponytail: the chain lives in this process, as the stickers' does; a restart stops it and the next GET /play starts it
// again (a stopped kitten waits for a tap). Upgrade path: a job document.
import type { Paint, World } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import type { KittenOwner, KittenView } from "../../../../../client/src/features/otome-forge/shared/kitty.js";
import { OtomeForgeError } from "../http.js";
import { playerId, runDocTarget, unitId } from "../ids.js";
import { type ImagePrompt, STICKER_SIZE, kittenPrompt } from "../prompts.js";
import { normalizePlayer } from "../schemas/player.js";
import { readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { queueCutouts, type CutoutDeps } from "./cutout.js";
import { worldStyle } from "./image-client.js";
import {
  imagesOf,
  paintIsLive,
  paintRecord,
  paintView,
  readSubject,
  releaseReplacedImage,
  repainting,
  samePicture,
  startPaint,
  tapPaint,
  updateIfChanged,
  withKeptPicture,
  type ArtDeps,
  type PaintCheck,
  type PaintOwner,
} from "./paint.js";
import { STICKER_SET_RETRY_MS, keepReplaced, shownPicture } from "./stickers.js";

type Run = Pick<RunDocuments, "world" | "player" | "units" | "state">;

/** A kitten owed to the player, and the document whose cut-outs it is kept in. */
interface OwedKitten {
  owner: KittenOwner;
  art?: Paint;
  doc: { id: string; cutouts: RunDocuments["units"][number]["cutouts"] };
}

/** The protagonist's kitten, then each love interest's with a bible, in cast order. */
function owedKittens(run: Pick<Run, "player" | "units" | "state">): OwedKitten[] {
  const her = run.player.kitten;
  return [
    { owner: "player", ...(her ? { art: her } : {}), doc: { id: "player", cutouts: run.player.cutouts ?? {} } },
    ...run.units
      .filter((unit) => unit.bible && run.state.lis[unit.id])
      .map((unit) => ({ owner: unit.id, ...(unit.kitten ? { art: unit.kitten } : {}), doc: unit })),
  ];
}

const ownerOf = (owner: KittenOwner): PaintOwner => `kitten:${owner}`;
const notFound = () => new OtomeForgeError(404, "No such kitten.", "not-found");
const runNotFound = () => new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");

/** A kitten's record changed when `change` returns one; true when it was saved. */
async function saveArt(
  deps: Pick<ArtDeps, "store">,
  runId: string,
  owner: KittenOwner,
  change: (current: Paint | undefined) => Paint | undefined,
): Promise<boolean> {
  const apply = <T extends { kitten?: Paint }>(current: T): T | undefined => {
    const next = change(current.kitten);
    return next ? { ...current, kitten: next } : undefined;
  };
  const saved =
    owner === "player"
      ? await updateIfChanged(deps.store, runDocTarget("player", playerId(runId)), normalizePlayer, apply)
      : await updateIfChanged(deps.store, runDocTarget("unit", unitId(runId, owner)), normalizeUnit, (current) =>
          current.bible ? apply(current) : undefined,
        );
  return !!saved?.changed;
}

/** The prompt a kitten's paint sends (the review dialog shows it), with `edited` text kept and made safe. */
export async function kittenPromptFor(
  deps: ArtDeps,
  runId: string,
  owner: KittenOwner,
  edited: Partial<ImagePrompt> = {},
  debugMode = false,
): Promise<ImagePrompt & { world: World; subject: Awaited<ReturnType<typeof readSubject>> }> {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  if (!owedKittens(run).some((kitten) => kitten.owner === owner)) throw notFound();
  const subject = await readSubject(deps, runId, run.world, owner === "player" ? "player" : `li:${owner}`, debugMode);
  const style = await worldStyle(imagesOf(deps), run.world.images);
  return { ...kittenPrompt({ ...subject, world: run.world, style }, edited), world: run.world, subject };
}

interface PaintKittenOptions {
  debugMode: boolean;
  /** A tap: paints under Ask before painting, in the `high` lane. */
  consent: boolean;
  /** 0.36.0: the Album's Repaint, a tap that waits in the `low` lane. */
  repaint?: boolean;
  edited?: Partial<ImagePrompt>;
  active?: () => boolean;
}

/** Paints a kitten the caller has marked pending at `at`; resolves its record as left. */
function paintKitten(
  deps: ArtDeps,
  runId: string,
  owner: KittenOwner,
  at: string,
  connectionId: string,
  options: PaintKittenOptions,
): Promise<Paint | null> {
  const ours = (art: Paint | undefined) => art?.state === "pending" && art.at === at;
  return paintRecord(deps, {
    connectionId,
    label: `kitten ${owner}`,
    active: options.active,
    lane: options.consent && !options.repaint ? "high" : "low",
    async check(): Promise<PaintCheck> {
      const run = await readRun(deps.store, runId);
      if (!run || !ours(owedKittens(run).find((kitten) => kitten.owner === owner)?.art)) return "gone";
      if (run.world.images.connectionId !== connectionId) return "stopped";
      if (!options.consent && run.world.images.ask) return "waiting-consent";
      return "paint";
    },
    async paint() {
      // Built now, so the rating and the look are the ones in force at the paid call.
      const built = await kittenPromptFor(deps, runId, owner, options.edited, options.debugMode);
      return imagesOf(deps).generatePortrait({
        connectionId,
        name: built.subject.name,
        unit: { ...built.subject.image, who: built.subject.name },
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        // Square, as the pre-made cards are.
        ...STICKER_SIZE,
        debugMode: options.debugMode,
      });
    },
    save: async (art) => {
      let replaced: Paint | undefined;
      const saved = await saveArt(deps, runId, owner, (current) => {
        if (!ours(current)) return undefined;
        replaced = current;
        return withKeptPicture(art, current);
      });
      if (saved && art.state === "ready") {
        // 0.36.0: a repaint's new picture is cut out after this; until then kittensView shows the replaced one's
        // cut-out (which stays in the gallery), and only the replaced original, a gallery image of ours, is deleted.
        if (replaced?.url && art.url && replaced.url !== art.url) keepReplaced(runId, replaced.url, art.url);
        await releaseReplacedImage(deps, replaced, art);
      }
      return saved;
    },
  });
}

/** Runs whose kitten chain is live in this process. */
const chains = new Map<string, Promise<void>>();
/** Runs whose last kitten paint failed, and when: the chain rests, so a broken connection fails one kitten only. */
const failedChains = new Map<string, number>();
const resting = (runId: string) => Date.now() - (failedChains.get(runId) ?? -Infinity) < STICKER_SET_RETRY_MS;

export interface KittenQueueOptions {
  debugMode: boolean;
  /** The player reviews image prompts: an automatic paint waits for the tap, as with Ask before painting. */
  review?: boolean;
  /** False once the art service is torn down (S/art/expressions.ts createOtomeArt). */
  active?: () => boolean;
}

/**
 * Starts this run's chain unless it is live or resting: claims the next owed kitten with no record (`pending`, or
 * `waiting-consent` under Ask or review, which pays nothing), paints it, and goes on until none is left. Each owner is
 * claimed at most once a chain, so a record that does not stay (its document gone or refused meanwhile) ends it rather
 * than claiming again; the next GET /play starts another. Never throws; resolves once the chain ends (tests wait on it).
 */
export function queueKittens(deps: ArtDeps, runId: string, options: KittenQueueOptions): Promise<void> {
  const live = chains.get(runId);
  if (live) return live;
  if (resting(runId)) return Promise.resolve();
  const chain = (async () => {
    const claimedHere = new Set<KittenOwner>();
    for (;;) {
      if (options.active && !options.active()) return;
      const run = await readRun(deps.store, runId);
      const connectionId = run?.world.images.connectionId;
      const next = run && connectionId ? owedKittens(run).find((kitten) => !kitten.art) : undefined;
      if (!run || !connectionId || !next || claimedHere.has(next.owner)) return;
      claimedHere.add(next.owner);
      const release = startPaint(runId, ownerOf(next.owner));
      // A tap holds it: the next read of the play view starts the chain again.
      if (!release) return;
      try {
        const wait = run.world.images.ask || options.review === true;
        const at = new Date().toISOString();
        const claimed = await saveArt(deps, runId, next.owner, (current) =>
          current ? undefined : { state: wait ? "waiting-consent" : "pending", at },
        );
        const left =
          claimed && !wait
            ? await paintKitten(deps, runId, next.owner, at, connectionId, { ...options, consent: false })
            : null;
        if (left?.state === "failed") {
          failedChains.set(runId, Date.now());
          return;
        }
      } finally {
        release();
      }
    }
  })()
    .catch((error: unknown) =>
      deps.runtime.logger.warn(
        "[otome-forge] kittens stopped: %s",
        error instanceof Error ? error.message : String(error),
      ),
    )
    .finally(() => chains.delete(runId));
  chains.set(runId, chain);
  return chain;
}

/** Queues the free cut-out of every painted kitten without one; the run as shown meanwhile (cut-outs pending). */
export async function queueKittenCutouts(deps: CutoutDeps, runId: string, run: Run): Promise<Run> {
  const painted = (owner: KittenOwner) => {
    const art = owner === "player" ? run.player.kitten : run.units.find((unit) => unit.id === owner)?.kitten;
    return art?.state === "ready" && art.url ? [art.url] : [];
  };
  const player = await queueCutouts(
    deps,
    runId,
    { id: "player", cutouts: run.player.cutouts ?? {} },
    painted("player"),
  );
  const units = await Promise.all(run.units.map((unit) => queueCutouts(deps, runId, unit, painted(unit.id))));
  return { ...run, player: { ...run.player, cutouts: player.cutouts }, units };
}

/**
 * The play view's kittens (with images on): each owed one, shown once its cut-out settled (its cut-out, or the painted
 * picture when the cut-out failed), else its paint as the client should see it; a painted one still being cut out reads
 * as painting. 0.36.0: a repainted one (the Album's Repaint) keeps showing the picture it paints over, cut out, and reads
 * as painting until the new one is cut out (stickers' rule, art/stickers.ts shownPicture); a failed or stopped repaint
 * shows that picture as painted. `kittensPending` while one may land without a tap: one with no record yet (unless the
 * chain rests), one painting in this process, or one being cut out. `painting`: an art service runs the chain.
 */
export function kittensView(
  runId: string,
  run: Run,
  painting: boolean,
): { kittens?: KittenView[]; kittensPending?: true } {
  if (!run.world.images.connectionId) return {};
  let pending = false;
  const kittens = owedKittens(run).map(({ owner, art, doc }): KittenView => {
    const shown = paintView(runId, ownerOf(owner), art);
    const picture = shown?.url ? shownPicture(runId, doc, shown.url) : null;
    if (shown?.state === "ready" && picture) {
      const url = picture.url ? { url: picture.url } : {};
      if (!picture.cutting) return { owner, ...url };
      pending = true;
      return { owner, ...url, art: { state: "pending", at: shown.at } };
    }
    if (painting && (shown ? shown.state === "pending" && paintIsLive(runId, ownerOf(owner)) : !resting(runId)))
      pending = true;
    // A repaint: the picture it paints over, and its paint only while it paints (Kitty Cards never repaints one).
    if (picture?.url) return { owner, url: picture.url, ...(shown?.state === "pending" ? { art: shown } : {}) };
    return { owner, ...(shown ? { art: shown } : {}) };
  });
  return { kittens, ...(pending ? { kittensPending: true as const } : {}) };
}

/**
 * 0.36.0: the Album's kittens (S/routes/album.ts): the play view's own (kittensView), hers then the cast's, only those
 * painted and cut out, each with its repaint's paint while it paints. Reading them queues nothing, painted or cut out.
 */
export const albumKittens = (runId: string, run: Run): KittenView[] =>
  (kittensView(runId, run, false).kittens ?? []).filter((kitten) => kitten.url);

/**
 * POST /runs/:run/art/kitten: the tap that paints a kitten now (its consent, or Try again). Resolves its paint as left;
 * a painted one is answered as it is, and a tap while it is painting waits for that same paint, so no tap pays twice.
 * 0.36.0: `repaint` (the Album's Repaint) paints a painted one again, as a sticker's (art/stickers.ts paintStickerNow):
 * only the picture shown when its tap began, so one that lands while it waits is its answer, and a failed or stopped
 * repaint again. Without it a kitten with a picture, a repaint's kept one too, is answered as it is. Once a picture is
 * saved its free cut-out is queued, as GET /play queues it, so the Album, which queues nothing, shows it once cut out.
 */
export async function paintKittenNow(
  deps: ArtDeps & Pick<CutoutDeps, "cutouts">,
  runId: string,
  owner: KittenOwner,
  {
    debugMode,
    edited,
    active,
    repaint = false,
  }: { debugMode: boolean; edited?: Partial<ImagePrompt>; active?: () => boolean; repaint?: boolean },
): Promise<Paint | null> {
  const read = async () => {
    const run = await readRun(deps.store, runId);
    if (!run) throw runNotFound();
    const kitten = owedKittens(run).find((entry) => entry.owner === owner);
    if (!kitten) throw notFound();
    return { run, art: kitten.art ? paintView(runId, ownerOf(owner), kitten.art) : undefined };
  };
  const first = repaint ? (await read()).art : undefined;
  const painted = first?.state === "ready";
  return tapPaint(
    runId,
    async () => ownerOf(owner),
    async ({ threw }) => {
      const { art } = await read();
      // A paint that was refused (it threw) left the kitten as this repaint found it, which is no answer to it.
      const untouched = threw && repaint && art?.state === first?.state && art?.at === first?.at;
      return { value: art ?? null, ...(art && !untouched ? { art } : {}) };
    },
    async () => {
      const { run } = await read();
      const connectionId = run.world.images.connectionId;
      if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
      const at = new Date().toISOString();
      const claimed = await saveArt(deps, runId, owner, (current) => {
        if (current?.state === "ready")
          return repaint && painted && samePicture(current, first) ? repainting(current, at) : undefined;
        if (current?.url) return repaint ? repainting(current, at) : undefined;
        return { state: "pending", at };
      });
      if (!claimed) return (await read()).art ?? null;
      const left = await paintKitten(deps, runId, owner, at, connectionId, {
        debugMode,
        consent: true,
        repaint,
        edited,
        active,
      });
      // Its free cut-out now, as GET /play would queue it. Once its picture is saved this paint never throws, so a tap
      // waiting on it takes that picture (tapPaint `threw`).
      if (left?.state === "ready")
        await readRun(deps.store, runId)
          .then((now) => (now ? queueKittenCutouts(deps, runId, now) : null))
          .catch((error: unknown) =>
            deps.runtime.logger.warn(
              "[otome-forge] kitten cut-out not queued: %s",
              error instanceof Error ? error.message : String(error),
            ),
          );
      return (await read().catch(() => null))?.art ?? left;
    },
  );
}
