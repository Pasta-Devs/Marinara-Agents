// ──────────────────────────────────────────────
// Otome Forge: banners (plan M4 "Wish server"): the 14-day rotation, Echoes, banner creation and banner art
// ──────────────────────────────────────────────
// Rotation = floor(days(world created → today) / 14), both days in the request's time zone. A rotation's three banners
// (Memories, His Wardrobe, My Wardrobe) are created only on POST .../wish/open, never by a read: GET .../wish lists
// what exists and which kinds are missing. Past banners stay as Echoes, pullable with the same pity, and nothing
// expires. A rotation nobody opened is never created.
// Creating a banner is one P20 call (S/wish/prompts.ts) in the run's foreground queue (readOrGenerate), so two opens at
// once write it once: the second finds it stored. Its items are written first and the banner last, so a banner that
// exists always has its items; ids follow the banner (`memories-3-f`), so a retry after a failed write rewrites the
// same documents. A run deleted meanwhile gets nothing back: what was written is removed again.
// The featured love interest is the one featured least recently in that kind (never featured first, then cast order);
// My Wardrobe features His Wardrobe's love interest of the same rotation, and its 5★ pairs with his 5★ look.
// A banner's art is its featured item's own image (a Memory's key image, a look on its wearer), painted when the banner
// is created through the paid-paint rules (art/paint.ts): with an image connection, at once in the background, or held
// for a tap with Ask before painting or while the player reviews image prompts; a failed one waits for Retry. Once
// ready it is also the featured item's art, so the item's first open (S/items/open.ts) pays for nothing more.
// Owned Snapshots are private memory: itemMemorySources gives each to the kit as a `chat` with audience [its love
// interest], so only that love interest recalls it (S/memory/sources.ts).
import type { ForgeMemorySource } from "@forge-kit/story-memory.mjs";
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import type {
  OtomeErrorCode,
  Paint,
  RunState,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { levelOf, MAX_LEVEL } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import {
  BANNER_ITEM_KINDS,
  BANNER_KINDS,
  bannerKey,
  itemIdOf,
  parseBannerKey,
  pityView,
  rotationOf,
  rotationWindow,
  type Banner,
  type BannerKind,
  type BannerView,
  type Item,
  type ItemSlot,
  type ItemView,
  type PityView,
  type SelectorView,
  type WishOpenResult,
  type WishView,
} from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { cgSubjects } from "../art/cg.js";
import type { ImageSubject, PaintedImage } from "../art/image-client.js";
import { bannerArtOwner, itemArtOwner } from "../art/outfits.js";
import {
  imagesOf,
  paintRecord,
  paintSettled,
  paintView,
  startPaint,
  tapPaint,
  updateIfChanged,
  type PaintCheck,
} from "../art/paint.js";
import { LOOK_SIZE, SCENE_SIZE, cgPrompt, lookPrompt, type ImagePrompt } from "../art/prompts.js";
import { generateJson, readOrGenerate } from "../generation.js";
import { itemView } from "../items/open.js";
import { OtomeForgeError, type RouteDeps } from "../http.js";
import { bannerId, itemId, mainChapterNumber, runDocTarget, stateId, unitId, worldId } from "../ids.js";
import { normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { normalizeBanner, normalizeItem } from "../schemas/wish.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";
import { cancellable } from "../story/beats.js";
import { recallText } from "../story/canon.js";
import {
  BANNER_PLAN_TEMPERATURE,
  BANNER_PLAN_TOKENS,
  BannerPlanSchema,
  bannerPlanMessages,
  normalizeBannerPlan,
  type BannerPlan,
} from "./prompts.js";

export type WishDeps = Pick<RouteDeps, "runtime" | "store" | "images" | "memory" | "cancellation">;

export { bannerArtOwner };

const runNotFound = () => new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
const bannerNotFound = () => new OtomeForgeError(404, "No such banner.", "not-found");

// ── Reading ──

/** Every banner of the run, oldest rotation first, kinds in BANNER_KINDS order. */
export async function readBanners(store: Pick<OtomeStore, "listRun">, runId: string): Promise<Banner[]> {
  return (await store.listRun("banner", runId))
    .map((record) => normalizeBanner(record.data))
    .filter(isComplete)
    .sort((a, b) => a.rotation - b.rotation || BANNER_KINDS.indexOf(a.kind) - BANNER_KINDS.indexOf(b.kind));
}

/** A banner whose key, kind and rotation agree and that holds a full set of items. */
function isComplete(banner: Banner): boolean {
  const parsed = parseBannerKey(banner.key);
  return (
    !!parsed &&
    parsed.kind === banner.kind &&
    parsed.rotation === banner.rotation &&
    banner.items.five.length > 0 &&
    banner.items.four.length > 0 &&
    banner.items.three.length > 0
  );
}

export async function readBanner(store: Pick<OtomeStore, "readDoc">, runId: string, key: string) {
  if (!parseBannerKey(key)) return null;
  const banner = await store.readDoc(bannerId(runId, key), normalizeBanner);
  return banner && banner.key === key && isComplete(banner) ? banner : null;
}

export async function readItem(store: Pick<OtomeStore, "readDoc">, runId: string, id: string) {
  const item = await store.readDoc(itemId(runId, id), normalizeItem);
  return item && item.id === id ? item : null;
}

/** The items named, by id; one that does not exist is left out. */
export async function readItems(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  ids: readonly string[],
): Promise<Map<string, Item>> {
  const items = await Promise.all([...new Set(ids)].map((id) => readItem(store, runId, id)));
  return new Map(items.filter((item): item is Item => !!item).map((item) => [item.id, item]));
}

/** Every item id a banner holds, the 5★ first. */
export const bannerItemIds = (banner: Pick<Banner, "items">) => [
  ...banner.items.five,
  ...banner.items.four,
  ...banner.items.three,
];

/** The current rotation in the request's time zone, counted from the world's creation day. */
export function currentRotation(world: { createdAt: string }, now = Date.now()) {
  const today = forgeDayKey(now);
  // The kit reads a number (an ISO string would read as now), so the creation time goes in as milliseconds.
  const created = Date.parse(world.createdAt);
  const createdDay = Number.isFinite(created) ? forgeDayKey(created) : today;
  const number = rotationOf(createdDay, today);
  return { number, createdDay, ...rotationWindow(createdDay, number) };
}

// ── Views ──

/** An item as the client sees it (S/items/open.ts itemView: no key image brief, a Snapshot's text only once owned). */
export const toItemView = (runId: string, item: Item, owned: ReadonlySet<string>): ItemView =>
  itemView(runId, item, owned.has(item.id));

const bannerArtView = (runId: string, banner: Banner): Paint | null =>
  paintView(runId, bannerArtOwner(banner.key), banner.art ?? undefined) ?? null;

/** The banner as the client sees it, or null while one of its items is missing. */
export function toBannerView(
  runId: string,
  banner: Banner,
  items: ReadonlyMap<string, Item>,
  owned: ReadonlySet<string>,
  rotation: number,
): BannerView | null {
  const views = (ids: readonly string[]) => ids.map((id) => items.get(id)).filter((item): item is Item => !!item);
  const [five] = views(banner.items.five);
  const four = views(banner.items.four);
  const three = views(banner.items.three);
  if (!five || four.length !== banner.items.four.length || three.length !== banner.items.three.length) return null;
  return {
    key: banner.key,
    kind: banner.kind,
    rotation: banner.rotation,
    startsDay: banner.startsDay,
    endsDay: banner.endsDay,
    featuredLi: banner.featuredLi,
    title: five.title,
    echo: banner.rotation < rotation,
    five: toItemView(runId, five, owned),
    four: four.map((item) => toItemView(runId, item, owned)),
    three: three.map((item) => toItemView(runId, item, owned)),
    art: bannerArtView(runId, banner),
  };
}

export function pityViews(state: Pick<RunState, "pity">): Record<BannerKind, PityView> {
  return Object.fromEntries(BANNER_KINDS.map((kind) => [kind, pityView(state.pity[kind])])) as Record<
    BannerKind,
    PityView
  >;
}

/**
 * Each love interest's Memory Selector, in cast order (S/wish/pull.ts claimSelector uses it): its choices are their
 * unowned Memories on Echoes, the banners of rotations before `rotation`.
 */
export function selectorViews(
  runId: string,
  state: RunState,
  items: Iterable<Item>,
  owned: ReadonlySet<string>,
  rotation: number,
): SelectorView[] {
  const all = [...items];
  const isEcho = (item: Item) => (parseBannerKey(item.banner)?.rotation ?? rotation) < rotation;
  return Object.keys(state.lis).map((li) => {
    const used = !!state.selector[li];
    const available = !used && levelOf(state.lis[li]!.points) >= MAX_LEVEL;
    const choices = available
      ? all
          .filter((item) => item.kind === "memory5" && item.li === li && !owned.has(item.id) && isEcho(item))
          .map((item) => toItemView(runId, item, owned))
      : [];
    return { li, available, used, choices };
  });
}

/** Runs whose banners are being created in this process, with how many opens are creating them. */
const creating = new Map<string, number>();

/**
 * GET /runs/:run/wish. Never creates anything.
 * ponytail: reads every banner's ten items on each view; the ceiling is a few hundred banners (years of two-week
 * rotations), and the upgrade path is the item fields a view needs copied onto the banner document.
 */
export async function wishView(deps: Pick<WishDeps, "store">, runId: string): Promise<WishView> {
  const { store } = deps;
  const [world, state, banners] = await Promise.all([
    store.readDoc(worldId(runId), normalizeWorld),
    store.readDoc(stateId(runId), normalizeState),
    readBanners(store, runId),
  ]);
  if (!world || !state) throw runNotFound();
  const rotation = currentRotation(world);
  const items = await readItems(store, runId, banners.flatMap(bannerItemIds));
  const owned = new Set(state.owned.items);
  const views = banners
    .map((banner) => toBannerView(runId, banner, items, owned, rotation.number))
    .filter((view): view is BannerView => !!view);
  const current = views.filter((view) => view.rotation === rotation.number);
  return {
    starlight: state.wallet.starlight,
    banners: current,
    echoes: views.filter((view) => view.rotation < rotation.number).reverse(),
    pity: pityViews(state),
    creating: (creating.get(runId) ?? 0) > 0,
    missing: BANNER_KINDS.filter((kind) => !current.some((view) => view.kind === kind)),
    rotation: { number: rotation.number, startsDay: rotation.startsDay, endsDay: rotation.endsDay },
    selectors: selectorViews(runId, state, items.values(), owned, rotation.number),
  };
}

// ── Creating a rotation's banners ──

/** The love interest featured least recently in `kind` (never featured first), ties in cast order. */
export function leastRecentlyFeatured(cast: readonly Unit[], banners: readonly Banner[], kind: BannerKind): Unit {
  const last = (li: string) =>
    banners.reduce(
      (latest, banner) =>
        banner.kind === kind && banner.featuredLi === li ? Math.max(latest, banner.rotation) : latest,
      -1,
    );
  return cast.reduce((best, unit) => (last(unit.id) < last(best.id) ? unit : best), cast[0]!);
}

/** The cast in setup order, each with a bible. */
const castOf = (run: RunDocuments) =>
  Object.keys(run.state.lis)
    .map((li) => run.units.find((unit) => unit.id === li && unit.bible))
    .filter((unit): unit is Unit => !!unit);

interface CreateOptions {
  debugMode: boolean;
  /** The run's Cancel (story-cancel-server): a Cancel stops the P20 call and every banner not written yet. */
  signal?: AbortSignal;
  /** The player reviews image prompts: the art waits for the tap, as with Ask before painting. */
  review: boolean;
  /** False once the package is torn down: nothing more is paid for. */
  active?: () => boolean;
}

/** The items a plan writes, in banner order (5★, 4★s, Snapshots). */
function itemsOf(
  key: string,
  kind: BannerKind,
  plan: BannerPlan,
  featured: Unit,
  coupleWith: string | undefined,
  at: string,
) {
  const kinds = BANNER_ITEM_KINDS[kind];
  const base = (slot: ItemSlot, itemKind: Item["kind"], li: string | null, title: string): Item => ({
    id: itemIdOf(key, slot),
    kind: itemKind,
    banner: key,
    li,
    title,
    art: null,
    story: null,
    createdAt: at,
  });
  const five: Item = {
    ...base("f", kinds.five, featured.id, plan.featured.title),
    ...(plan.featured.premise ? { premise: plan.featured.premise } : {}),
    ...(plan.featured.look ? { look: plan.featured.look } : {}),
    ...(plan.featured.cg ? { cg: plan.featured.cg } : {}),
    ...(coupleWith ? { coupleWith } : {}),
  };
  const four = plan.four.map((entry, index): Item => ({
    ...base(`a${index + 1}` as ItemSlot, kinds.four, entry.li, entry.title),
    ...(entry.premise ? { premise: entry.premise } : {}),
    ...(entry.look ? { look: entry.look } : {}),
  }));
  const three = plan.snapshots.map((entry, index): Item => ({
    ...base(`s${index + 1}` as ItemSlot, kinds.three, entry.li, entry.title),
    text: entry.text,
  }));
  return { five, four, three };
}

/** Writes the banner (after its items) unless one is stored already; null when the run was deleted meanwhile. */
async function saveBanner(deps: WishDeps, runId: string, banner: Banner, items: Item[]): Promise<Banner | null> {
  const { store } = deps;
  const exists = async () => !!(await store.readDoc(worldId(runId), normalizeWorld));
  if (!(await exists())) return null;
  for (const item of items) {
    await store.mutateDoc(runDocTarget("item", itemId(runId, item.id)), normalizeItem, () => item);
  }
  // ponytail: a second server writing the same banner at once would rewrite its items under the first one's banner;
  // the ceiling is one Engine process per data directory (the foreground queue serializes within it), and the upgrade
  // path is items written inside the banner's own revision-checked document.
  const saved = await store.mutateDoc(
    runDocTarget("banner", bannerId(runId, banner.key)),
    normalizeBanner,
    (current) => (current.key ? current : banner),
  );
  if (await exists()) return saved;
  // Deleted while this wrote: nothing of it stays.
  for (const id of [...items.map((item) => itemId(runId, item.id)), bannerId(runId, banner.key)]) {
    await store.removeDoc(id).catch(() => false);
  }
  return null;
}

/** P20 for one banner, then its documents; the art is painted in the background (or left waiting for the tap). */
async function createBanner(
  deps: WishDeps,
  runId: string,
  kind: BannerKind,
  rotation: number,
  options: CreateOptions,
): Promise<Banner> {
  const { store } = deps;
  const key = bannerKey(kind, rotation);
  const run = await readRun(store, runId);
  if (!run) throw runNotFound();
  if (run.world.forge.phase !== "ready") throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  const cast = castOf(run);
  if (!cast.length) throw new OtomeForgeError(409, "This story has no love interests yet.", "conflict");
  const banners = await readBanners(store, runId);

  let featured = leastRecentlyFeatured(cast, banners, kind);
  let partner: Item | null = null;
  if (kind === "my-wardrobe") {
    const his = banners.find((banner) => banner.key === bannerKey("his-wardrobe", rotation));
    partner = his ? await readItem(store, runId, his.items.five[0]!) : null;
    const wearer = partner && cast.find((unit) => unit.id === partner!.li);
    if (!partner?.look || !wearer) {
      throw new OtomeForgeError(409, "His Wardrobe's banner for this rotation is not ready yet.", "conflict");
    }
    featured = wearer;
  }

  // Shared canon only: recall as a scene with nobody in it, so no love interest's own chapter reaches the plan.
  const memory = await recallText(deps, runId, {
    job: "structured",
    cast: [],
    query: { plan: featured.bible?.want ?? "", speakers: cast.map((unit) => unit.name) },
    debugMode: options.debugMode,
    signal: options.signal,
  });
  const earlierTitles: string[] = [];
  const earlier = banners.filter((banner) => banner.kind === kind);
  const earlierItems = await readItems(
    store,
    runId,
    earlier.map((banner) => banner.items.five[0]!),
  );
  for (const banner of earlier) {
    const title = earlierItems.get(banner.items.five[0]!)?.title;
    if (title) earlierTitles.push(title);
  }
  const context = { kind, units: cast, featured };
  const { value, connectionId, model } = await generateJson(deps, {
    runId,
    job: "structured",
    label: `banner-plan/${key}`,
    messages: bannerPlanMessages({
      kind,
      world: run.world,
      player: run.player,
      units: cast,
      state: run.state,
      featured,
      ...(partner?.look ? { partnerLook: { ...partner.look, title: partner.title } } : {}),
      earlierTitles,
      memory,
    }),
    schema: BannerPlanSchema,
    normalize: (reply) => {
      const plan = normalizeBannerPlan(reply, context);
      return typeof plan === "string" ? plan : reply;
    },
    temperature: BANNER_PLAN_TEMPERATURE,
    maxTokens: BANNER_PLAN_TOKENS,
    debugMode: options.debugMode,
    lane: "foreground",
    signal: options.signal,
  });
  options.signal?.throwIfAborted();
  const plan = normalizeBannerPlan(value, context) as BannerPlan;
  const at = new Date().toISOString();
  const { five, four, three } = itemsOf(key, kind, plan, featured, partner?.id, at);
  const window = rotationWindow(currentRotation(run.world).createdDay, rotation);
  const imageConnection = run.world.images.connectionId;
  const wait = run.world.images.ask || options.review;
  const banner: Banner = {
    key,
    kind,
    rotation,
    ...window,
    featuredLi: featured.id,
    items: { five: [five.id], four: four.map((item) => item.id), three: three.map((item) => item.id) },
    art: imageConnection ? { state: wait ? "waiting-consent" : "pending", at } : null,
    createdAt: at,
    connectionId,
    model,
  };
  // Marked live before the pending record is saved, so no view ever reads it as stopped while it paints.
  const release = banner.art?.state === "pending" ? startPaint(runId, bannerArtOwner(key)) : null;
  let saved: Banner | null = null;
  try {
    saved = await saveBanner(deps, runId, banner, [five, ...four, ...three]);
  } catch (error) {
    release?.();
    throw error;
  }
  if (!saved) {
    release?.();
    throw runNotFound();
  }
  if (release) {
    if (saved.createdAt === at && imageConnection) {
      void paintBanner(deps, runId, key, at, imageConnection, { ...options, consent: false })
        .catch((error: unknown) =>
          deps.runtime.logger.warn(
            "[otome-forge] banner art %s stopped: %s",
            key,
            error instanceof Error ? error.message : String(error),
          ),
        )
        .finally(release);
    } else {
      release();
    }
  }
  return saved;
}

/**
 * POST /runs/:run/wish/open: creates the current rotation's missing banners, one P20 call each, in BANNER_KINDS order
 * (My Wardrobe pairs with His Wardrobe's 5★, so it waits for that banner). A kind that fails is reported by its code
 * and created on the next open; the rest are kept. Opening again once every banner exists calls no model.
 */
export async function openWish(
  deps: WishDeps,
  runId: string,
  options: Omit<CreateOptions, "signal">,
): Promise<WishOpenResult> {
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  if (!world) throw runNotFound();
  const rotation = currentRotation(world).number;
  const existing = new Set((await readBanners(deps.store, runId)).map((banner) => banner.key));
  const missing = BANNER_KINDS.filter((kind) => !existing.has(bannerKey(kind, rotation)));
  const failed: WishOpenResult["failed"] = [];
  if (missing.length) {
    creating.set(runId, (creating.get(runId) ?? 0) + 1);
    try {
      // In the run's Cancel scope, as story writes are: a Cancel is a 409 and nothing after it is written.
      await cancellable(deps, runId, async (signal) => {
        for (const kind of missing) {
          signal?.throwIfAborted();
          const his = failed.find((entry) => entry.kind === "his-wardrobe");
          if (kind === "my-wardrobe" && his) {
            failed.push({ kind, code: his.code });
            continue;
          }
          const key = bannerKey(kind, rotation);
          try {
            await readOrGenerate(
              runId,
              () => readBanner(deps.store, runId, key),
              () => createBanner(deps, runId, kind, rotation, { ...options, signal }),
            );
          } catch (error) {
            if (!(error instanceof OtomeForgeError) || !error.code || error.code === "not-found") throw error;
            failed.push({ kind, code: error.code as OtomeErrorCode });
          }
        }
      });
    } finally {
      const left = (creating.get(runId) ?? 1) - 1;
      if (left > 0) creating.set(runId, left);
      else creating.delete(runId);
    }
  }
  return { wish: await wishView(deps, runId), failed };
}

// ── The banner's art ──

/** The prompt and the paid call for a banner's art, built from the documents as they stand now. */
async function buildBannerArt(deps: WishDeps, runId: string, banner: Banner, edited: Partial<ImagePrompt> = {}) {
  const run = await readRun(deps.store, runId);
  if (!run) throw runNotFound();
  const five = await readItem(deps.store, runId, banner.items.five[0] ?? "");
  if (!five) throw bannerNotFound();
  const images = imagesOf(deps);
  const style = await images.styleProfile(run.world.images.styleProfileId);
  if (banner.kind === "memories") {
    const subjects = cgSubjects(five.cg?.cast ?? [], run.units, run.player);
    const prompt = cgPrompt(
      {
        brief: five.cg?.brief ?? five.title,
        people: subjects.map((subject) => subject.person),
        world: run.world,
        style,
        // Banner art stays clothed (at most Suggestive): its Character Story is not written yet.
        use: "clothed",
      },
      edited,
    );
    return {
      ...prompt,
      paint: (connectionId: string, debugMode: boolean): Promise<PaintedImage> =>
        images.generateBannerArt({
          connectionId,
          // The Engine matches the override as `avatar:<slug of the first person's first name>`.
          name: subjects[0]?.person.name.split(/\s+/)[0] || "Memory",
          units: subjects.flatMap((subject) => (subject.image ? [subject.image] : [])),
          prompt: prompt.prompt,
          negativePrompt: prompt.negativePrompt,
          ...SCENE_SIZE,
          debugMode,
        }),
    };
  }
  // A look on its wearer: his (His Wardrobe) or the protagonist's (My Wardrobe), with the look's outfit line.
  const unit = banner.kind === "his-wardrobe" ? run.units.find((candidate) => candidate.id === five.li) : undefined;
  if (banner.kind === "his-wardrobe" && !unit) throw bannerNotFound();
  const person = unit
    ? {
        name: unit.name,
        identityLine: unit.identityLine || unit.bible?.look.identityLine || "",
        presentation: unit.bible?.look.presentation ?? ("person" as const),
      }
    : {
        name: run.player.name || "Protagonist",
        identityLine: run.player.look.identityLine,
        presentation: "person" as const,
      };
  const subject: ImageSubject = unit
    ? {
        kind: "character",
        ...(unit.cardId ? { cardId: unit.cardId } : {}),
        ...(unit.portrait ? { portrait: unit.portrait } : {}),
      }
    : {
        kind: "character",
        personaId: run.player.personaId,
        ...(run.player.portrait ? { portrait: run.player.portrait } : {}),
      };
  const prompt = lookPrompt({ ...person, outfitLine: five.look?.outfitLine ?? "", world: run.world, style }, edited);
  return {
    ...prompt,
    paint: (connectionId: string, debugMode: boolean): Promise<PaintedImage> =>
      images.generatePortrait({
        connectionId,
        name: person.name,
        unit: subject,
        prompt: prompt.prompt,
        negativePrompt: prompt.negativePrompt,
        ...LOOK_SIZE,
        debugMode,
      }),
  };
}

/** POST .../wish/art/prompt: what the art's paid call would send (the review dialog shows and edits it). */
export async function bannerArtPromptFor(deps: WishDeps, runId: string, key: string): Promise<ImagePrompt> {
  const banner = await readBanner(deps.store, runId, key);
  if (!banner) throw bannerNotFound();
  const { prompt, negativePrompt } = await buildBannerArt(deps, runId, banner);
  return { prompt, negativePrompt };
}

/** Paints the art of banner `key`, whose record the caller marked pending at `at`; resolves the record as left. */
function paintBanner(
  deps: WishDeps,
  runId: string,
  key: string,
  at: string,
  connectionId: string,
  options: { debugMode: boolean; consent: boolean; edited?: Partial<ImagePrompt>; active?: () => boolean },
): Promise<Paint | null> {
  const target = runDocTarget("banner", bannerId(runId, key));
  const mine = (banner: Banner | null) =>
    banner?.key === key && banner.art?.state === "pending" && banner.art.at === at;
  const save = async (art: Paint) => {
    const saved = await updateIfChanged(deps.store, target, normalizeBanner, (banner) =>
      mine(banner) ? { ...banner, art } : undefined,
    );
    if (!saved?.changed) return false;
    // The banner's art is its featured item's own picture: the item takes it while its own is not painted, so its
    // first open (S/items/open.ts) finds it painted, and a claim of its own still waiting stops before paying. Still in
    // the slot, and never thrown: the banner's art is saved already, and its image must stay.
    const five = saved.value.items.five[0];
    if (art.state === "ready" && five) {
      await updateIfChanged(deps.store, runDocTarget("item", itemId(runId, five)), normalizeItem, (item) =>
        item.id === five && item.art?.state !== "ready" ? { ...item, art } : undefined,
      ).catch((error: unknown) =>
        deps.runtime.logger.warn(
          "[otome-forge] sharing banner %s's art with its item failed: %s",
          key,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
    return true;
  };
  return paintRecord(deps, {
    connectionId,
    label: `banner ${key}`,
    active: options.active,
    async check(): Promise<PaintCheck> {
      const [banner, world] = await Promise.all([
        readBanner(deps.store, runId, key),
        deps.store.readDoc(worldId(runId), normalizeWorld),
      ]);
      if (!world || !banner || !mine(banner)) return "gone";
      // Its featured item's art (the same picture) is painted: it is the banner's art too, and nothing more is paid.
      const five = banner.items.five[0];
      const featured = five ? await readItem(deps.store, runId, five) : null;
      if (featured?.art?.state === "ready") {
        await save(featured.art);
        return "gone";
      }
      if (world.images.connectionId !== connectionId) return "stopped";
      if (!options.consent && world.images.ask) return "waiting-consent";
      return "paint";
    },
    async paint() {
      // Built now, so the rating, the 18+ gate and everyone's looks are the ones in force at the paid call.
      const banner = await readBanner(deps.store, runId, key);
      if (!banner) throw bannerNotFound();
      const built = await buildBannerArt(deps, runId, banner, options.edited);
      return built.paint(connectionId, options.debugMode);
    },
    save,
  });
}

/**
 * POST /runs/:run/wish/art: the tap that paints a banner's art now (its consent, or Retry). A ready one is returned as
 * it is; a tap while it paints waits for that paint, so no tap pays twice.
 */
export async function paintBannerArtNow(
  deps: WishDeps,
  runId: string,
  key: string,
  options: { debugMode: boolean; edited?: Partial<ImagePrompt>; active?: () => boolean },
): Promise<Paint | null> {
  const read = async () => {
    const banner = await readBanner(deps.store, runId, key);
    if (!banner) throw bannerNotFound();
    return banner;
  };
  const owner = bannerArtOwner(key);
  // The featured item's art is the same picture: a tap while that paints waits for it (it then becomes this art).
  const five = (await read()).items.five[0];
  if (five) await paintSettled(runId, itemArtOwner(five));
  return tapPaint(
    runId,
    async () => owner,
    async () => {
      const art = bannerArtView(runId, await read());
      return { value: art, art: art ?? undefined };
    },
    async () => {
      const banner = await read();
      if (banner.art?.state === "ready") return banner.art;
      const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
      if (!world) throw runNotFound();
      const connectionId = world.images.connectionId;
      if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
      const at = new Date().toISOString();
      const saved = await updateIfChanged(
        deps.store,
        runDocTarget("banner", bannerId(runId, key)),
        normalizeBanner,
        (current) =>
          current.key === key && current.art?.state !== "ready"
            ? { ...current, art: { state: "pending" as const, at } }
            : undefined,
      );
      if (!saved?.value.key) throw bannerNotFound();
      if (saved.changed) await paintBanner(deps, runId, key, at, connectionId, { ...options, consent: true });
      return bannerArtView(runId, await read());
    },
  );
}

// ── Memory ──

/**
 * Owned Snapshots as memory sources (S/memory/sources.ts): each a `chat` with audience [its love interest], so only
 * they recall it, placed in story order at the time it was won (its timeline entry), after the main chapters completed
 * before then.
 */
export async function itemMemorySources(
  store: Pick<OtomeStore, "readDoc">,
  runId: string,
  state: RunState,
): Promise<ForgeMemorySource[]> {
  // Snapshots hold the `s1`–`s6` slots, so no other owned item is read.
  const ids = state.owned.items.filter((id) => /-s[1-6]$/.test(id));
  const snapshots = [...(await readItems(store, runId, ids)).values()].filter(
    (item) => item.kind === "snapshot3" && item.li && state.lis[item.li] && item.text?.trim(),
  );
  if (!snapshots.length) return [];
  const mainDone = Object.entries(state.chapters)
    .filter(([key, progress]) => progress.completed && mainChapterNumber(key) !== null)
    .map(([, progress]) => progress.completed!);
  const names = new Map<string, string>();
  for (const li of new Set(snapshots.map((item) => item.li!))) {
    const unit = await store.readDoc(unitId(runId, li), normalizeUnit);
    names.set(li, unit?.name || "a love interest");
  }
  return snapshots.map((item) => {
    const won =
      state.timeline.find((entry) => entry.kind === "snapshot" && entry.ref === item.id)?.at ?? item.createdAt;
    const before = mainDone.filter((completed) => completed < won).length;
    const name = names.get(item.li!)!;
    return {
      id: item.id,
      kind: "chat" as const,
      title: `${name}'s own Snapshot "${item.title}" (private: only ${name} and the protagonist know it)`,
      content: item.text!,
      order: before * 10000 + 5000 + (Date.parse(won) || 0) / 1e13,
      audience: [item.li!],
    };
  });
}
