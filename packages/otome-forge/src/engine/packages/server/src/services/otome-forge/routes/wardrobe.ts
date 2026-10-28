// ──────────────────────────────────────────────
// Otome Forge: the Wardrobe (plan M4 "Wardrobe"): complete looks for each love interest and the protagonist, Wear at
// home, Show {{name}}, couple sets and their pair portrait
// ──────────────────────────────────────────────
// GET  /runs/:run/wardrobe                                   → WardrobeView {him, me, couples, noticed, noticing}
// POST /runs/:run/wardrobe/wear {owner, look, li?}           → {wardrobe}; owner "me" or a love interest's id (also
//                                                               "player" or "li:<id>"); look "base" or an owned,
//                                                               painted look item. Her new look is noticed (P19, by `li`,
//                                                               else the love interest on Home) in the background; his
//                                                               new look gets its faces (M2b expressions), in the
//                                                               background
// POST /runs/:run/wardrobe/show {li, look}                   → ShowResult {line, face?, grants}; P24, and +20 affection
//                                                               the first time she shows him that look
// POST /runs/:run/wardrobe/pair {hers, prompt?, negativePrompt?} → {art}; paints the set's pair portrait (1 image)
// POST /runs/:run/wardrobe/pair/prompt {hers}                → {prompt, negativePrompt}
// A look is worn once painted: only its image can stand on Home. Wearing is idempotent. A Show is a model call each time;
// its affection lands once per look and love interest, in one revision-checked write of the state, within the day's
// activity cap (one the cap took entirely stays owed to a later Show). Two Shows of the same look to the same love
// interest at once share one call.
// Home (S/routes/home.ts) shows what is worn: wornLookUrl(unit) on him, cut out there as M3 cuts out every worn look,
// and wornLookUrl(player) on Me with `player.noticed` (P19, written here) under it; `noticingLooks` tells it the line
// is on its way.
import { forgeStoryExpressionCast } from "@forge-kit/story-expressions-server.mjs";
import { z } from "zod";
import type {
  LiId,
  Paint,
  Player,
  RunState,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { AFFECTION_EARNINGS } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { FACES, isFace, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  BASE_LOOK,
  NOTICED_WORDS_MAX,
  SHOW_WORDS_MAX,
  type CoupleSet,
  type LookView,
  type ShowResult,
  type WardrobeGrant,
  type WardrobeView,
} from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import {
  ITEM_RARITY,
  isItemId,
  isLookKind,
  type Item,
} from "../../../../../client/src/features/otome-forge/shared/wish.js";
import {
  addOutfit,
  hasArt,
  itemArtView,
  lookWearer,
  outfitOf,
  pairPrompt,
  pairView,
  paintPairNow,
} from "../art/outfits.js";
import { paintView, updateIfChanged } from "../art/paint.js";
import { generateJson, runForeground } from "../generation.js";
import { OtomeForgeError, debugModeOf, parseBody, runParam, type RegisterRoutes, type RouteDeps } from "../http.js";
import { isLiId, playerId, runDocTarget, stateId, unitId } from "../ids.js";
import { STORY_KINDS } from "../items/character-story.js";
import { couplesOf, ownedItems, readItem, readItems, readOwnedItem } from "../items/open.js";
import {
  LINE_TEMPERATURE,
  LINE_TOKENS,
  LineReplySchema,
  ShowReplySchema,
  checkLine,
  noticedMessages,
  showMessages,
} from "../items/prompts.js";
import { normalizePlayer } from "../schemas/player.js";
import { normalizeState, readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeUnit } from "../schemas/unit.js";
import { grant } from "../state/rewards.js";

const PROMPT_MAX = 4000;
const LookId = z.string().min(1).max(80);
const WearBody = z.object({ owner: z.string().min(1).max(84), look: LookId, li: z.string().max(80).optional() });
const ShowBody = z.object({ li: z.string().min(1).max(80), look: LookId });
const PairBody = z.object({
  hers: LookId,
  prompt: z.string().max(PROMPT_MAX).optional(),
  negativePrompt: z.string().max(PROMPT_MAX).optional(),
});
const PairPromptBody = z.object({ hers: LookId });

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const badRequest = (message: string) => new OtomeForgeError(400, message, "bad-request");

/** The `firsts` key that marks the first Show of a look to a love interest (its affection paid). */
export const showFirst = (look: string) => `show:${look}`;

/** The run's love interests that have a bible, in cast order. */
const castOf = (run: RunDocuments): Unit[] =>
  Object.keys(run.state.lis).flatMap((li) => run.units.filter((unit) => unit.id === li && unit.bible));

/** `owner` as the wardrobe names it: the protagonist, or one of the run's love interests (else a 404). */
function ownerOf(value: string, run: RunDocuments): { kind: "me" } | { kind: "li"; unit: Unit } {
  if (value === "me" || value === "player") return { kind: "me" };
  const li = value.startsWith("li:") ? value.slice(3) : value;
  const unit = isLiId(li) ? castOf(run).find((candidate) => candidate.id === li) : undefined;
  if (!unit) throw notFound("love interest");
  return { kind: "li", unit };
}

// ── The view ──

function baseLook(runId: string, owner: "me" | LiId, person: Unit | Player, worn: boolean): LookView {
  const art = paintView(runId, owner === "me" ? "player" : `li:${owner}`, person.art) ?? null;
  return {
    id: BASE_LOOK,
    owner,
    name: "",
    ...(person.portrait ? { url: person.portrait } : {}),
    art,
    worn,
    wearable: true,
    unopened: false,
  };
}

function itemLook(runId: string, item: Item, owner: "me" | LiId, worn: string | undefined, world: World): LookView {
  const outfit = outfitOf(item);
  return {
    id: item.id,
    owner,
    name: item.look?.name ?? item.title,
    item: { kind: item.kind, rarity: ITEM_RARITY[item.kind], title: item.title },
    ...(outfit ? { url: outfit.url } : {}),
    art: itemArtView(runId, item),
    worn: worn === item.id,
    wearable: !!outfit,
    unopened: (STORY_KINDS.has(item.kind) && !item.story) || (hasArt(item) && !item.art && !!world.images.connectionId),
    ...(item.kind === "his-look5" ? { story: item.story } : {}),
  };
}

/** His ready faces on `url`, while expressions are on (the kit's forgeStoryExpressionCast). */
function facesOn(world: World, unit: Unit, url: string | undefined): Partial<Record<Face, string>> | undefined {
  if (!url) return undefined;
  return forgeStoryExpressionCast(world.images, unit, url, FACES).expressions as
    Partial<Record<Face, string>> | undefined;
}

/** Love interests noticing her look right now, by `${runId}|${look}` (P19 runs in the background). */
const noticing = new Set<string>();

/**
 * The looks a love interest of the run is noticing right now. The Wardrobe and Home ask again until the one she wears
 * lands; a look she has left may still be queued, but no line can arrive for it (schemas/player.ts): not waited on.
 */
export const noticingLooks = (runId: string) =>
  [...noticing].filter((key) => key.startsWith(`${runId}|`)).map((key) => key.slice(runId.length + 1));

export async function wardrobeView(deps: Pick<RouteDeps, "store">, runId: string): Promise<WardrobeView> {
  // Asked before the reads: a line that lands while they run then answers "on its way", never "none and done".
  const noticingNow = noticingLooks(runId);
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  const allItems = await readItems(deps.store, runId);
  const looks = ownedItems(run, allItems).filter((item) => isLookKind(item.kind));
  const owned = new Set(run.state.owned.items);
  const him: WardrobeView["him"] = {};
  for (const unit of castOf(run)) {
    const views = [
      baseLook(runId, unit.id, unit, !unit.wornOutfit),
      ...looks
        .filter((item) => lookWearer(item) === `li:${unit.id}`)
        .map((item) => itemLook(runId, item, unit.id, unit.wornOutfit, run.world)),
    ];
    him[unit.id] = views.map((view) => {
      const faces = facesOn(run.world, unit, view.url);
      return faces ? { ...view, faces } : view;
    });
  }
  const shownTo = (look: string) =>
    Object.entries(run.state.lis)
      .filter(([, liState]) => !!liState.firsts[showFirst(look)])
      .map(([li]) => li);
  const me = [
    baseLook(runId, "me", run.player, !run.player.wornOutfit),
    ...looks
      .filter((item) => lookWearer(item) === "player")
      .map((item) => ({ ...itemLook(runId, item, "me", run.player.wornOutfit, run.world), shownTo: shownTo(item.id) })),
  ];
  const couples: CoupleSet[] = couplesOf(allItems)
    .filter(({ his, hers }) => owned.has(his.id) || owned.has(hers.id))
    .map(({ his, hers }) => {
      const hisOutfit = outfitOf(his);
      const herOutfit = outfitOf(hers);
      const complete = owned.has(his.id) && owned.has(hers.id);
      return {
        his: {
          id: his.id,
          li: his.li,
          name: his.look?.name ?? his.title,
          owned: owned.has(his.id),
          ...(hisOutfit ? { url: hisOutfit.url } : {}),
        },
        hers: {
          id: hers.id,
          name: hers.look?.name ?? hers.title,
          owned: owned.has(hers.id),
          ...(herOutfit ? { url: herOutfit.url } : {}),
        },
        complete,
        pair: pairView(runId, run.state.album.cgs, hers.id),
        canPaintPair: complete && !!hisOutfit && !!herOutfit && !!run.world.images.connectionId,
      };
    });
  return {
    him,
    me,
    couples,
    noticed: run.player.noticed,
    noticing: noticingNow.includes(run.player.wornOutfit ?? ""),
  };
}

// ── Wear at home ──

/** A look item `owner` may wear: owned, theirs, and painted (made wearable now if its image was not added yet). */
async function wearableItem(deps: RouteDeps, runId: string, look: string, wearer: "player" | `li:${string}`) {
  if (!isItemId(look)) throw notFound("look");
  const { item } = await readOwnedItem(deps, runId, look);
  if (!isLookKind(item.kind) || lookWearer(item) !== wearer) throw badRequest("That look is not theirs to wear.");
  const outfit = outfitOf(item);
  if (!outfit) throw new OtomeForgeError(409, "That look is not painted yet.", "conflict");
  await addOutfit(deps, runId, item);
  return { item, outfit };
}

/** Wears `look` ("base" or an outfit id it holds), or leaves the document as it is. */
function wearing<T extends { outfits: Array<{ id: string }>; wornOutfit?: string }>(current: T, look: string) {
  if (look === BASE_LOOK) {
    if (!current.wornOutfit) return undefined;
    const { wornOutfit: _worn, ...rest } = current;
    return rest as T;
  }
  if (current.wornOutfit === look || !current.outfits.some((outfit) => outfit.id === look)) return undefined;
  return { ...current, wornOutfit: look };
}

/**
 * Who notices her new look: `li` when it is one of the cast, else the love interest on Home (`state.home.li`, M3),
 * else the first in cast order (as Home shows the first when none was picked).
 */
export function whoNotices(run: RunDocuments, li?: string): Unit | undefined {
  const cast = castOf(run);
  const of = (id: string | null | undefined) => (id ? cast.find((candidate) => candidate.id === id) : undefined);
  return of(li) ?? of(run.state.home.li) ?? cast[0];
}

/** P19 in the background: the line a love interest says on noticing the look she wears now, once per look worn. */
function noticeLook(deps: RouteDeps, runId: string, look: string, li: string | undefined, debugMode: boolean) {
  const key = `${runId}|${look}`;
  if (noticing.has(key)) return;
  noticing.add(key);
  void runForeground(runId, async () => {
    // Read again in the queue: she may have changed again, or the line was written meanwhile.
    const run = await readRun(deps.store, runId);
    if (!run || run.player.wornOutfit !== look || run.player.noticed?.look === look) return;
    const item = await readItem(deps.store, runId, look);
    const unit = whoNotices(run, li);
    if (!item?.look || !unit) return;
    const { value } = await generateJson(deps, {
      runId,
      job: "chat",
      label: `noticed/${look}`,
      messages: noticedMessages({ world: run.world, player: run.player, unit, state: run.state, look: item.look }),
      schema: LineReplySchema,
      normalize: (reply) => checkLine(reply.text, NOTICED_WORDS_MAX),
      temperature: LINE_TEMPERATURE,
      maxTokens: LINE_TOKENS,
      debugMode,
      lane: "foreground",
    });
    const at = new Date().toISOString();
    await updateIfChanged(deps.store, runDocTarget("player", playerId(runId)), normalizePlayer, (current) =>
      current.wornOutfit === look && current.noticed?.look !== look
        ? { ...current, noticed: { li: unit.id, text: value.text, look, at } }
        : undefined,
    );
  })
    .catch((error: unknown) =>
      deps.runtime.logger.warn(
        "[otome-forge] noticing look %s stopped: %s",
        look,
        error instanceof Error ? error.message : String(error),
      ),
    )
    .finally(() => noticing.delete(key));
}

/** POST .../wardrobe/wear: see the header. */
export async function wearLook(
  deps: RouteDeps,
  runId: string,
  { owner, look, li }: { owner: string; look: string; li?: string },
  { debugMode }: { debugMode: boolean },
): Promise<void> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  const who = ownerOf(owner, run);
  const wearer = who.kind === "me" ? "player" : (`li:${who.unit.id}` as const);
  if (look !== BASE_LOOK) await wearableItem(deps, runId, look, wearer);
  if (who.kind === "me") {
    const saved = await updateIfChanged(
      deps.store,
      runDocTarget("player", playerId(runId)),
      normalizePlayer,
      (current) => wearing(current, look),
    );
    if (!saved) throw notFound("Otome Forge run");
    if (look !== BASE_LOOK && saved.value.noticed?.look !== look) noticeLook(deps, runId, look, li, debugMode);
    return;
  }
  const unit = who.unit;
  const saved = await updateIfChanged(
    deps.store,
    runDocTarget("unit", unitId(runId, unit.id)),
    normalizeUnit,
    (current) => wearing(current, look),
  );
  if (!saved) throw notFound("love interest");
  // His faces for the look he wears now (painted once per look, in the background, while expressions are on).
  deps.art?.queueExpressions(runId, { segments: [{ speaker: unit.name, text: "…" }], choices: [] }, { debugMode });
}

// ── Show {{name}} ──

/** One P24 call per `${runId}|${li}|${look}` at a time: a second Show while it runs shares its line. */
const showing = new Map<string, Promise<{ text: string; face?: Face }>>();

/** POST .../wardrobe/show: see the header. */
export async function showLook(
  deps: RouteDeps,
  runId: string,
  { li, look }: { li: string; look: string },
  { debugMode }: { debugMode: boolean },
): Promise<ShowResult> {
  if (look === BASE_LOOK) throw badRequest("Show a look won on Wish.");
  if (!isItemId(look)) throw notFound("look");
  const { run, item } = await readOwnedItem(deps, runId, look);
  const unit = castOf(run).find((candidate) => candidate.id === li);
  if (!unit) throw notFound("love interest");
  if (lookWearer(item) !== "player" || !item.look) throw badRequest("Only the protagonist's looks can be shown.");
  const key = `${runId}|${li}|${look}`;
  let reply = showing.get(key);
  if (!reply) {
    const itemLook = item.look;
    reply = runForeground(runId, async () => {
      const now = (await readRun(deps.store, runId)) ?? run;
      const { value } = await generateJson(deps, {
        runId,
        job: "chat",
        label: `show/${li}/${look}`,
        messages: showMessages({ world: now.world, player: now.player, unit, state: now.state, look: itemLook }),
        schema: ShowReplySchema,
        normalize: (raw) => {
          const line = checkLine(raw.text, SHOW_WORDS_MAX);
          return typeof line === "string" ? line : { text: line.text, face: raw.face };
        },
        temperature: LINE_TEMPERATURE,
        maxTokens: LINE_TOKENS,
        debugMode,
        lane: "foreground",
      });
      return { text: value.text, ...(isFace(value.face) ? { face: value.face } : {}) };
    }).finally(() => showing.delete(key));
    showing.set(key, reply);
  }
  const line = await reply;
  let grants: WardrobeGrant[] = [];
  const at = new Date().toISOString();
  const saved = await updateIfChanged(deps.store, runDocTarget("state", stateId(runId)), normalizeState, (current) => {
    grants = [];
    const liState = current.lis[li];
    if (!liState || liState.firsts[showFirst(look)]) return undefined;
    const paid = grant(current, { source: "show-him", li, affection: AFFECTION_EARNINGS.showHim });
    // The day's cap took it all: it stays owed, and a later Show pays it.
    if (!paid.granted.affection) return undefined;
    grants = [{ source: "show-him", li, affection: paid.granted.affection }];
    const next: RunState = paid.state;
    const his = next.lis[li]!;
    return { ...next, lis: { ...next.lis, [li]: { ...his, firsts: { ...his.firsts, [showFirst(look)]: at } } } };
  });
  if (!saved) throw notFound("Otome Forge run");
  return { line: line.text, ...(line.face ? { face: line.face } : {}), grants };
}

// ── Routes ──

export const registerWardrobeRoutes: RegisterRoutes = (router, deps) => {
  const { handle } = deps;

  router.get(
    "/runs/:run/wardrobe",
    handle(async (request) => wardrobeView(deps, runParam(request).runId)),
  );

  router.post(
    "/runs/:run/wardrobe/wear",
    handle(async (request) => {
      const body = parseBody(WearBody, request.body);
      const { runId } = runParam(request);
      await wearLook(deps, runId, body, { debugMode: debugModeOf(request) });
      return { wardrobe: await wardrobeView(deps, runId) };
    }),
  );

  router.post(
    "/runs/:run/wardrobe/show",
    handle(async (request) => {
      const body = parseBody(ShowBody, request.body);
      const { runId } = runParam(request);
      return showLook(deps, runId, body, { debugMode: debugModeOf(request) });
    }),
  );

  router.post(
    "/runs/:run/wardrobe/pair",
    handle(async (request) => {
      const { hers, prompt, negativePrompt } = parseBody(PairBody, request.body);
      const { runId } = runParam(request);
      if (!isItemId(hers)) throw notFound("couple set");
      const art: Paint = await paintPairNow(deps, runId, hers, {
        debugMode: debugModeOf(request),
        edited: { prompt, negativePrompt },
      });
      return { art };
    }),
  );

  router.post(
    "/runs/:run/wardrobe/pair/prompt",
    handle(async (request) => {
      const { hers } = parseBody(PairPromptBody, request.body);
      const { runId } = runParam(request);
      if (!isItemId(hers)) throw notFound("couple set");
      return pairPrompt(deps, runId, hers);
    }),
  );
};
