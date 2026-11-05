// ──────────────────────────────────────────────
// Otome Hearth: chat stickers (#2044): the protagonist's five, each love interest's nine, and their names
// ──────────────────────────────────────────────
// The protagonist's five (SH/stickers.ts PLAYER_STICKERS) are painted for the run once the phone first opens with
// images on (POST /runs/:run/stickers sets `player.stickers = {}`); until each is painted, and with images off, the
// built-in set stands in. A love interest's nine are designed in one background text call (the Planning connection,
// as his plush is) once he reaches level 2 with images on, ordered from guarded to close, and the sticker of each
// level he reaches is painted: a story in progress catches up on every level already reached.
//
// Paints follow the paint records' rules (art/paint.ts): one sticker at a time per run, claimed in its document before
// the paid call, in the image connection's `low` lane behind taps and scene art; `waiting-consent` under Ask before
// painting or prompt review, so only a tap pays; a failed or stopped sticker waits for a tap (the Album's Paint). A
// restart leaves at most one sticker `stopped`. Every sticker is a chibi bust on the look's chroma matte, cut out by
// the free cut-out queue (art/cutout.ts) before it is shown.
//
// Names: in prompts a sticker is `[name_emotion]`: the protagonist's slug (SH ids nameSlug with "_"), or his, which
// takes `_<the last 4 characters of his id>` when the protagonist or another love interest has the same slug, so
// every name is one sticker. P17 lists only stickers that exist, and its parser (phone/replies.ts) reads either order.
// ponytail: the chain and the set jobs' cool-down live in this process; a restart stops them and the next read of the
// run starts them again (a stopped sticker waits for a tap). Upgrade path: a job document.
import { z } from "zod";
import type {
  LiId,
  Paint,
  StickerSet,
  StickerView,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { levelOf } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import {
  PLAYER_STICKERS,
  PLAYER_STICKER_LOOKS,
  PLAYER_STICKER_OWNER,
  STICKER_EMOTION,
  STICKER_FIRST_LEVEL,
  STICKERS_PER_LI,
  isPlayerSticker,
  parseStickerId,
  stickerId,
} from "../../../../../client/src/features/otome-forge/shared/stickers.js";
import type { AlbumSticker } from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import type { BackgroundQueue } from "../background-queue.js";
import { generateJson, resolveConnectionId, type GenerationDeps } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { nameSlug, playerId, runDocTarget, unitId } from "../ids.js";
import { normalizePlayer } from "../schemas/player.js";
import { readRun, type RunDocuments } from "../schemas/state.js";
import { STICKER_LABEL_MAX, STICKER_LOOK_MAX, normalizeUnit } from "../schemas/unit.js";
import { cutoutView } from "./cutout.js";
import { worldStyle } from "./image-client.js";
import {
  imagesOf,
  paintIsLive,
  paintRecord,
  paintView,
  readSubject,
  startPaint,
  tapPaint,
  updateIfChanged,
  type ArtDeps,
  type PaintCheck,
  type PaintOwner,
} from "./paint.js";
import { type ImagePrompt, STICKER_SIZE, stickerPrompt, stickerSetMessages } from "../prompts.js";

type Run = Pick<RunDocuments, "world" | "player" | "units" | "state">;
type Owner = typeof PLAYER_STICKER_OWNER | LiId;

// ── Names ──

const slug = (name: string) => nameSlug(name).replace(/-/g, "_");

/**
 * Each owner's name part: the protagonist keeps her slug; a love interest whose slug the protagonist or another love
 * interest shares gets `_<his id's last 4>` (ids end in 4 random characters), so two Kais read kai_ab12 and kai_cd34.
 */
export function stickerNames(run: Pick<Run, "player" | "units">): Map<Owner, string> {
  const player = slug(run.player.name);
  const lis = run.units.map((unit) => [unit.id, slug(unit.name)] as const);
  const taken = new Map<string, number>([[player, 1]]);
  for (const [, name] of lis) taken.set(name, (taken.get(name) ?? 0) + 1);
  return new Map<Owner, string>([
    [PLAYER_STICKER_OWNER, player],
    ...lis.map(([id, name]) => [id, taken.get(name)! > 1 ? `${name}_${id.slice(-4)}` : name] as const),
  ]);
}

/** How prompts name a sticker id: its prompt name, what it shows (English) and whose it is; null for no one's here. */
export type StickerLookup = (
  id: string,
) => { name: string; about: string; who: "player" | "li"; ownerName: string } | null;

/** The lookup for this run's stickers (P17 and P18 render a thread's stickers through it). */
export function stickerLookup(run: Pick<Run, "player" | "units">): StickerLookup {
  const names = stickerNames(run);
  return (id) => {
    const parsed = parseStickerId(id);
    const name = parsed ? names.get(parsed.owner) : undefined;
    if (!parsed || !name) return null;
    const mine = parsed.owner === PLAYER_STICKER_OWNER;
    return {
      name: `${name}_${parsed.emotion}`,
      about: mine && isPlayerSticker(parsed.emotion) ? PLAYER_STICKER_LOOKS[parsed.emotion][0] : parsed.emotion,
      who: mine ? "player" : "li",
      ownerName: mine
        ? run.player.name || "the protagonist"
        : (run.units.find((unit) => unit.id === parsed.owner)?.name ?? ""),
    };
  };
}

// ── What the player has ──

/** A sticker owed to the player: the protagonist's five once started, and his up to the level reached. */
export interface OwedSticker {
  id: string;
  owner: Owner;
  emotion: string;
  look: string;
  label?: string;
  level?: number;
  art?: Paint;
}

export function owedStickers(run: Pick<Run, "player" | "units" | "state">): OwedSticker[] {
  const owed: OwedSticker[] = [];
  const mine = run.player.stickers;
  if (mine) {
    for (const emotion of PLAYER_STICKERS) {
      const art = mine[emotion];
      owed.push({
        id: stickerId(PLAYER_STICKER_OWNER, emotion),
        owner: PLAYER_STICKER_OWNER,
        emotion,
        look: PLAYER_STICKER_LOOKS[emotion][1],
        ...(art ? { art } : {}),
      });
    }
  }
  for (const unit of run.units) {
    const progress = run.state.lis[unit.id];
    if (!progress || !unit.stickers) continue;
    const reached = levelOf(progress.points);
    unit.stickers.set.forEach(({ emotion, label, look }, index) => {
      const level = STICKER_FIRST_LEVEL + index;
      const art = unit.stickers!.art[emotion];
      if (level <= reached)
        owed.push({
          id: stickerId(unit.id, emotion),
          owner: unit.id,
          emotion,
          look,
          label,
          level,
          ...(art ? { art } : {}),
        });
    });
  }
  return owed;
}

const ownerDoc = (run: Pick<Run, "player" | "units">, owner: Owner) =>
  owner === PLAYER_STICKER_OWNER
    ? { id: "player", cutouts: run.player.cutouts ?? {} }
    : run.units.find((unit) => unit.id === owner);

/**
 * A ready sticker as shown: its cut-out (the old one while a refresh is cut, as stage art keeps it), the original when
 * its cleanup failed; null while its first cut-out is cut.
 */
function shownUrl(runId: string, run: Pick<Run, "player" | "units">, sticker: OwedSticker): string | null {
  const doc = ownerDoc(run, sticker.owner);
  if (!doc || sticker.art?.state !== "ready" || !sticker.art.url) return null;
  const cut = cutoutView(runId, doc, sticker.art.url);
  return cut.cutout ?? (cut.state === "pending" ? null : sticker.art.url);
}

/** Every painted sticker's image, by owner: what GET /runs/:run has cut out. */
export function stickerArtUrls(run: Pick<Run, "player" | "units" | "state">, owner: Owner): string[] {
  return owedStickers(run).flatMap((sticker) =>
    sticker.owner === owner && sticker.art?.state === "ready" && sticker.art.url ? [sticker.art.url] : [],
  );
}

/**
 * Every sticker that exists for the run (RunView.stickers, which bubbles render from): the protagonist's five (painted
 * and cut out, else the built-in set, with no url), then each love interest's painted ones in cast and level order.
 * What can be sent now is sendableStickers'.
 */
export function stickerBook(runId: string, run: Pick<Run, "player" | "units" | "state">): StickerView[] {
  const names = stickerNames(run);
  const owed = owedStickers(run);
  const book: StickerView[] = PLAYER_STICKERS.map((emotion) => {
    const sticker = owed.find((entry) => entry.owner === PLAYER_STICKER_OWNER && entry.emotion === emotion);
    const url = sticker ? shownUrl(runId, run, sticker) : null;
    return {
      id: stickerId(PLAYER_STICKER_OWNER, emotion),
      owner: PLAYER_STICKER_OWNER,
      emotion,
      name: `${names.get(PLAYER_STICKER_OWNER)}_${emotion}`,
      ...(url ? { url } : {}),
    };
  });
  for (const sticker of owed) {
    if (sticker.owner === PLAYER_STICKER_OWNER) continue;
    const url = shownUrl(runId, run, sticker);
    if (!url) continue;
    book.push({
      id: sticker.id,
      owner: sticker.owner,
      emotion: sticker.emotion,
      name: `${names.get(sticker.owner)}_${sticker.emotion}`,
      ...(sticker.label ? { label: sticker.label } : {}),
      ...(sticker.level ? { level: sticker.level } : {}),
      url,
    });
  }
  return book;
}

/**
 * What the player and he may send now: the protagonist's five (the built-in set with images off), and, with images on,
 * his painted ones. The picker shows the same (C/screens/phone/StickerPicker.tsx).
 */
export function sendableStickers(
  book: readonly StickerView[],
  world: Pick<World, "images">,
  li?: LiId,
): { yours: StickerView[]; his: StickerView[] } {
  const images = !!world.images.connectionId;
  return {
    yours: book.filter((sticker) => sticker.owner === PLAYER_STICKER_OWNER),
    his: images && li ? book.filter((sticker) => sticker.owner === li) : [],
  };
}

/** A paint the Album's Paint starts with a tap. */
const waitsForTap = (art: Paint | undefined) =>
  art?.state === "waiting-consent" || art?.state === "failed" || art?.state === "stopped";

/**
 * The Album's stickers: the protagonist's five, then each of his owed ones that is painted, painting or waiting for a
 * tap (the paint as the client should see it). One painted but still being cut out reads as painting, so the Album
 * keeps polling until its cut-out shows. Without images only painted ones show.
 */
export function albumStickers(runId: string, run: Run): AlbumSticker[] {
  const names = stickerNames(run);
  const book = new Map(stickerBook(runId, run).map((sticker) => [sticker.id, sticker]));
  const images = !!run.world.images.connectionId;
  const owed = new Map(owedStickers(run).map((sticker) => [sticker.id, sticker]));
  // Hers first, then his in level order, whether painted or waiting.
  const ids = [
    ...new Set([
      ...[...book.keys()].filter((id) => parseStickerId(id)?.owner === PLAYER_STICKER_OWNER),
      ...owed.keys(),
      ...book.keys(),
    ]),
  ];
  return ids.flatMap((id): AlbumSticker[] => {
    const shown = book.get(id);
    const sticker = owed.get(id);
    const painted = sticker?.art ? paintView(runId, `sticker:${id}`, sticker.art) : undefined;
    const art: Paint | undefined =
      painted?.state === "ready" && !shown?.url ? { state: "pending", at: painted.at } : painted;
    const open = images && (waitsForTap(art) || art?.state === "pending");
    if (!shown && !open) return [];
    const parsed = parseStickerId(id)!;
    return [
      {
        id,
        owner: parsed.owner,
        emotion: parsed.emotion,
        name: `${names.get(parsed.owner)}_${parsed.emotion}`,
        ...(sticker?.label ? { label: sticker.label } : {}),
        ...(sticker?.level ? { level: sticker.level } : {}),
        ...(shown?.url ? { url: shown.url } : {}),
        ...(open && art ? { art } : {}),
      },
    ];
  });
}

// ── His set: nine stickers designed in one background call ──

export const STICKER_SET_MAX_TOKENS = 2000;
/** How long a love interest whose set failed is left alone before another attempt. */
export const STICKER_SET_RETRY_MS = 10 * 60_000;

export const StickerSetReplySchema = z.object({
  stickers: z.array(z.object({ emotion: z.string(), label: z.string(), look: z.string() })).max(30),
});
export type StickerSetReply = z.infer<typeof StickerSetReplySchema>;

const squash = (value: string) => value.replace(/\s+/gu, " ").trim();

/** The reply as nine designs, or why it is refused (the repair turn sends it back). `others`: the cast's other sets. */
export function normalizeStickerSetReply(
  reply: StickerSetReply,
  others: ReadonlyArray<readonly string[]> = [],
): StickerSet["set"] | string {
  const set: StickerSet["set"] = [];
  for (const raw of reply.stickers) {
    const emotion = raw.emotion.trim().toLowerCase();
    const label = squash(raw.label);
    const look = squash(raw.look);
    if (!STICKER_EMOTION.test(emotion)) return `"${raw.emotion.slice(0, 30)}" is not one lowercase English word`;
    if (set.some((entry) => entry.emotion === emotion)) return `the emotion "${emotion}" is used twice`;
    if (!label || [...label].length > STICKER_LABEL_MAX)
      return `each label must be 1 to ${STICKER_LABEL_MAX} characters`;
    if (!look || look.length > STICKER_LOOK_MAX) return `each look must be 1 to ${STICKER_LOOK_MAX} characters`;
    set.push({ emotion, label: [...label].join(""), look });
  }
  if (set.length !== STICKERS_PER_LI) return `write exactly ${STICKERS_PER_LI} stickers, not ${set.length}`;
  const mine = set
    .map((entry) => entry.emotion)
    .sort()
    .join(" ");
  if (others.some((emotions) => [...emotions].sort().join(" ") === mine))
    return "this set is the same as another love interest's: choose nine that are his own";
  return set;
}

/** The design job's dependencies: the text call's, the store's writes, and the background lane. */
export interface StickerDeps extends GenerationDeps {
  store: ArtDeps["store"];
  background?: Pick<BackgroundQueue, "ensure" | "has">;
}

/** Love interests whose last set failed, and when (the cool-down). */
const failedSets = new Map<string, number>();
export const stickerSetJobKey = (runId: string, li: LiId) => `${unitId(runId, li)}#stickers`;

/**
 * Queues the design of each love interest's missing set on the background lane: with images on, a bible, level 2 or
 * more and no set yet, and no failure within STICKER_SET_RETRY_MS. True while any of the run's set jobs waits or runs.
 */
export function ensureStickerSets(deps: StickerDeps, runId: string, run: Run, { debugMode }: { debugMode: boolean }) {
  const { background } = deps;
  const connectionId = resolveConnectionId(run.world, "structured");
  if (!background || !connectionId || !run.world.images.connectionId) return false;
  let pending = false;
  for (const unit of run.units) {
    const progress = run.state.lis[unit.id];
    const key = stickerSetJobKey(runId, unit.id);
    if (!progress || !unit.bible || unit.stickers || levelOf(progress.points) < STICKER_FIRST_LEVEL) continue;
    if (!background.has(key) && Date.now() - (failedSets.get(key) ?? -Infinity) < STICKER_SET_RETRY_MS) continue;
    background.ensure({
      key,
      connectionId,
      run: async () => {
        try {
          await writeStickerSet(deps, runId, unit.id, { connectionId, debugMode });
          failedSets.delete(key);
        } catch (error) {
          failedSets.set(key, Date.now());
          throw error;
        }
      },
    });
    pending = true;
  }
  return pending;
}

/** The job: reads the run again, designs his set in one call, and keeps it unless one was kept meanwhile. */
export async function writeStickerSet(
  deps: StickerDeps,
  runId: string,
  li: LiId,
  { connectionId, debugMode }: { connectionId: string; debugMode: boolean },
): Promise<void> {
  const run = await readRun(deps.store, runId);
  const unit = run?.units.find((entry) => entry.id === li);
  if (!run || !unit?.bible || unit.stickers) return;
  const others = run.units
    .filter((entry) => entry.id !== li && entry.stickers)
    .map((entry) => ({ name: entry.name, emotions: entry.stickers!.set.map((sticker) => sticker.emotion) }));
  const { value } = await generateJson(deps, {
    runId,
    job: "structured",
    label: "stickers",
    messages: stickerSetMessages({ unit, language: run.world.language, others }),
    schema: StickerSetReplySchema,
    normalize: (reply) => {
      const set = normalizeStickerSetReply(
        reply,
        others.map((other) => other.emotions),
      );
      return typeof set === "string" ? set : reply;
    },
    maxTokens: STICKER_SET_MAX_TOKENS,
    debugMode,
    lane: "background",
    connectionId,
  });
  const set = normalizeStickerSetReply(value);
  if (typeof set === "string") return;
  const at = new Date().toISOString();
  await deps.store.updateDoc(runDocTarget("unit", unitId(runId, li)), normalizeUnit, (current) =>
    current.stickers ? current : { ...current, stickers: { set, at, art: {} } },
  );
}

// ── Paints: one sticker at a time per run ──

const notFound = () => new OtomeForgeError(404, "No such sticker.", "not-found");
const ownerOf = (id: string): PaintOwner => `sticker:${id}`;

/** Changes the sticker's paint record when `change` returns one; true when it was saved. */
async function saveArt(
  deps: Pick<ArtDeps, "store">,
  runId: string,
  { owner, emotion }: { owner: Owner; emotion: string },
  change: (current: Paint | undefined) => Paint | undefined,
): Promise<boolean> {
  if (owner === PLAYER_STICKER_OWNER) {
    const saved = await updateIfChanged(
      deps.store,
      runDocTarget("player", playerId(runId)),
      normalizePlayer,
      (current) => {
        const next = current.stickers && isPlayerSticker(emotion) ? change(current.stickers[emotion]) : undefined;
        return next ? { ...current, stickers: { ...current.stickers, [emotion]: next } } : undefined;
      },
    );
    return !!saved?.changed;
  }
  const saved = await updateIfChanged(
    deps.store,
    runDocTarget("unit", unitId(runId, owner)),
    normalizeUnit,
    (current) => {
      const set = current.stickers;
      const next = set?.set.some((entry) => entry.emotion === emotion) ? change(set.art[emotion]) : undefined;
      return next && set ? { ...current, stickers: { ...set, art: { ...set.art, [emotion]: next } } } : undefined;
    },
  );
  return !!saved?.changed;
}

/** The prompt a sticker's paint sends (the review dialog shows it), with `edited` text kept and made safe. */
export async function stickerPromptFor(
  deps: ArtDeps,
  runId: string,
  id: string,
  edited: Partial<ImagePrompt> = {},
  debugMode = false,
): Promise<ImagePrompt & { world: World; subject: Awaited<ReturnType<typeof readSubject>> }> {
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  const sticker = owedStickers(run).find((entry) => entry.id === id);
  if (!sticker) throw notFound();
  const subject = await readSubject(
    deps,
    runId,
    run.world,
    sticker.owner === PLAYER_STICKER_OWNER ? "player" : `li:${sticker.owner}`,
    debugMode,
  );
  const style = await worldStyle(imagesOf(deps), run.world.images);
  return {
    ...stickerPrompt({ ...subject, look: sticker.look, world: run.world, style }, edited),
    world: run.world,
    subject,
  };
}

interface PaintStickerOptions {
  debugMode: boolean;
  /** A tap: paints under Ask before painting, in the `high` lane. */
  consent: boolean;
  edited?: Partial<ImagePrompt>;
  active?: () => boolean;
}

/** Paints a sticker the caller has marked pending at `at`; resolves its record as left. */
function paintSticker(
  deps: ArtDeps,
  runId: string,
  sticker: Pick<OwedSticker, "id" | "owner" | "emotion">,
  at: string,
  connectionId: string,
  options: PaintStickerOptions,
): Promise<Paint | null> {
  const ours = (art: Paint | undefined) => art?.state === "pending" && art.at === at;
  return paintRecord(deps, {
    connectionId,
    label: `sticker ${sticker.id}`,
    active: options.active,
    lane: options.consent ? "high" : "low",
    async check(): Promise<PaintCheck> {
      const run = await readRun(deps.store, runId);
      if (!run || !ours(owedStickers(run).find((entry) => entry.id === sticker.id)?.art)) return "gone";
      if (run.world.images.connectionId !== connectionId) return "stopped";
      if (!options.consent && run.world.images.ask) return "waiting-consent";
      return "paint";
    },
    async paint() {
      // Built now, so the rating and the look are the ones in force at the paid call.
      const built = await stickerPromptFor(deps, runId, sticker.id, options.edited, options.debugMode);
      return imagesOf(deps).generatePortrait({
        connectionId,
        name: built.subject.name,
        unit: built.subject.image,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        ...STICKER_SIZE,
        debugMode: options.debugMode,
      });
    },
    save: (art) => saveArt(deps, runId, sticker, (current) => (ours(current) ? art : undefined)),
  });
}

/** Runs whose sticker chain is live in this process. */
const chains = new Map<string, Promise<void>>();
/** Runs whose last sticker paint failed, and when: the chain rests for STICKER_SET_RETRY_MS, so a broken image
 * connection fails one sticker, not every one owed. */
const failedChains = new Map<string, number>();

export interface StickerQueueOptions {
  debugMode: boolean;
  /** The player reviews image prompts: an automatic paint waits for the tap, as with Ask before painting. */
  review?: boolean;
  /** False once the art service is torn down (S/art/expressions.ts createOtomeArt). */
  active?: () => boolean;
}

/**
 * Starts this run's chain unless it is live: claims the next owed sticker with no record (`pending`, or
 * `waiting-consent` under Ask or review, which pays nothing), paints it, and goes on until nothing is owed. Never
 * throws; resolves once the chain ends (tests wait on it).
 */
export function queueStickers(deps: ArtDeps, runId: string, options: StickerQueueOptions): Promise<void> {
  const live = chains.get(runId);
  if (live) return live;
  if (Date.now() - (failedChains.get(runId) ?? -Infinity) < STICKER_SET_RETRY_MS) return Promise.resolve();
  const chain = (async () => {
    for (;;) {
      if (options.active && !options.active()) return;
      const run = await readRun(deps.store, runId);
      const connectionId = run?.world.images.connectionId;
      const next = run && connectionId ? owedStickers(run).find((sticker) => !sticker.art) : undefined;
      if (!run || !connectionId || !next) return;
      const release = startPaint(runId, ownerOf(next.id));
      // A tap holds it: the next read of the run starts the chain again.
      if (!release) return;
      try {
        const wait = run.world.images.ask || options.review === true;
        const at = new Date().toISOString();
        const claimed = await saveArt(deps, runId, next, (current) =>
          current ? undefined : { state: wait ? "waiting-consent" : "pending", at },
        );
        const left =
          claimed && !wait
            ? await paintSticker(deps, runId, next, at, connectionId, { ...options, consent: false })
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
        "[otome-forge] stickers stopped: %s",
        error instanceof Error ? error.message : String(error),
      ),
    )
    .finally(() => chains.delete(runId));
  chains.set(runId, chain);
  return chain;
}

/**
 * True while a sticker of the run may still land without a tap: with images on, one owed has no record yet (the chain
 * claims it, unless it rests after a failure), or one is painting in this process. GET /runs/:run polls on it.
 */
export function stickersComing(runId: string, run: Run): boolean {
  if (!run.world.images.connectionId) return false;
  const resting = Date.now() - (failedChains.get(runId) ?? -Infinity) < STICKER_SET_RETRY_MS;
  return owedStickers(run).some((sticker) =>
    sticker.art ? sticker.art.state === "pending" && paintIsLive(runId, ownerOf(sticker.id)) : !resting,
  );
}

/**
 * POST /runs/:run/stickers: the phone opened. With images on, the protagonist's stickers are started (once); true when
 * they are (now or before).
 */
export async function startPlayerStickers(deps: Pick<ArtDeps, "store">, runId: string): Promise<boolean> {
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
  if (run.player.stickers) return true;
  if (!run.world.images.connectionId) return false;
  await updateIfChanged(deps.store, runDocTarget("player", playerId(runId)), normalizePlayer, (current) =>
    current.stickers ? undefined : { ...current, stickers: {} },
  );
  return true;
}

/**
 * POST /runs/:run/art/sticker: the tap that paints a sticker now (its consent, or Retry). Resolves its paint as left;
 * a ready sticker is returned as it is, and a tap while it is painting waits for that same paint.
 */
export async function paintStickerNow(
  deps: ArtDeps,
  runId: string,
  id: string,
  { debugMode, edited, active }: { debugMode: boolean; edited?: Partial<ImagePrompt>; active?: () => boolean },
): Promise<Paint | null> {
  const read = async () => {
    const run = await readRun(deps.store, runId);
    if (!run) throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
    const sticker = owedStickers(run).find((entry) => entry.id === id);
    if (!sticker) throw notFound();
    return { run, sticker, art: sticker.art ? paintView(runId, ownerOf(id), sticker.art) : undefined };
  };
  return tapPaint(
    runId,
    async () => ownerOf(id),
    async () => {
      const { art } = await read();
      return { value: art ?? null, ...(art ? { art } : {}) };
    },
    async () => {
      const { run, sticker } = await read();
      if (sticker.art?.state === "ready") return sticker.art;
      const connectionId = run.world.images.connectionId;
      if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
      const at = new Date().toISOString();
      const claimed = await saveArt(deps, runId, sticker, (current) =>
        current?.state === "ready" ? undefined : { state: "pending", at },
      );
      if (claimed)
        await paintSticker(deps, runId, sticker, at, connectionId, { debugMode, consent: true, edited, active });
      return (await read()).art ?? null;
    },
  );
}
