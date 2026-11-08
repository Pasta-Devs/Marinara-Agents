// ──────────────────────────────────────────────
// Otome Hearth: the Tarot deck (#2151), each card painted once, the first time it is drawn, and kept
// ──────────────────────────────────────────────
// `${R}:deck` (kind "deck", one per story) maps a card's deckKey (SH/tarot.ts) to who it shows, for whom, and its paint
// record. The protagonist's cards and the cards of nobody are one set for the story; a card of the love interest, or of
// the two of them, is cast for each love interest (`<card>@<li>`), so Ren's Lovers never shows Kai. An entry is made
// only when the card is claimed for painting, so cost stays bound to the cards drawn, and the paint follows the paid
// work rules (S/art/paint.ts, as a Shop figurine's, S/art/figurine.ts):
// - A new reading claims its drawn cards that have no entry (claimDeckCards) in one revision-checked write: `pending`,
//   or `waiting-consent` under Ask before painting or the Engine's prompt review, and paints the pending ones in the
//   background, one image at a time per image connection. Without an image connection, or once the art service is
//   torn down, nothing is claimed, and a card left unclaimed is claimed the next time it is drawn. A run deleted
//   meanwhile keeps no deck.
// - Right before the paid call the entry is checked again (the same pending entry, the same connection, consent still
//   given), and the image is saved only onto that entry. A failure is kept with its error and painted again only by a
//   tap (POST /runs/:run/art/tarot: consent, a reviewed prompt or Retry, which never pays twice); a pending entry with
//   no live paint in this process reads as stopped. A ready card is never painted again: there is no repaint.
// - The picture (S/prompts.ts tarotCardPrompt) is the illustration only, at a story CG's size: its people as a picture
//   kept outside the story (at most Suggestive), with each person's likeness as a keepsake sends it (cgSubjects by id
//   and role, so a likeness whose pictures fail to load stops before the paid call), or a card of nobody as a place.
// - Tarot night shows a love interest the shared set and their own cards (deckView), the Album every card (albumCards).
// Opening Tarot night or the Album, or reading the deck, never paints.
import type { LiId, Paint, Unit } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  ARCANA,
  ARCANA_FIGURES,
  deckKey,
  type Arcana,
  type ArcanaFigure,
  type TarotDeckCard,
} from "../../../../../client/src/features/otome-forge/shared/tarot.js";
import type { AlbumCard } from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import { OtomeForgeError } from "../http.js";
import { runDocTarget, worldId } from "../ids.js";
import { type ImagePrompt, SCENE_SIZE, tarotCardPrompt } from "../prompts.js";
import { PaintSchema, isRecord } from "../schemas/common.js";
import { readRun } from "../schemas/state.js";
import { normalizeWorld } from "../schemas/world.js";
import { withPersonaImageAppearance } from "../setup/cast.js";
import type { OtomeStore } from "../store.js";
import { cgReferences, cgSubjects } from "./cg.js";
import { worldStyle } from "./image-client.js";
import type { ItemArtDeps, ItemPaintOptions } from "./outfits.js";
import {
  imagesOf,
  paintRecord,
  paintView,
  startPaint,
  tapPaint,
  updateIfChanged,
  type PaintCheck,
  type PaintOwner,
} from "./paint.js";

export interface DeckCard {
  card: Arcana;
  figure: ArcanaFigure;
  /** The love interest a card of them (or of the two of them) was cast for. */
  li?: LiId;
  art: Paint;
}

/** `${R}:deck` */
export interface TarotDeck {
  version: 1;
  cards: Record<string, DeckCard>;
}

export const deckId = (runId: string) => `${runId}:deck`;
const deckTarget = (runId: string) => runDocTarget("deck", deckId(runId));
/** The live-paint owner of a deck card. */
export const tarotOwner = (key: string): PaintOwner => `tarot:${key}`;

/** The deck as stored; an entry whose key is not its card's deckKey, or that is damaged, is dropped. */
export function normalizeDeck(data: unknown): TarotDeck {
  const cards: Record<string, DeckCard> = {};
  const raw = isRecord(data) && isRecord(data.cards) ? data.cards : {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value) || !(ARCANA as readonly unknown[]).includes(value.card)) continue;
    const card = value.card as Arcana;
    const li = typeof value.li === "string" && value.li.length <= 80 ? value.li : undefined;
    const art = PaintSchema.safeParse(value.art);
    const cast = ARCANA_FIGURES[card] === "him" || ARCANA_FIGURES[card] === "both";
    if (!art.success || (cast && !li) || key !== deckKey(card, li ?? "")) continue;
    cards[key] = { card, figure: ARCANA_FIGURES[card], ...(cast ? { li } : {}), art: art.data };
  }
  return { version: 1, cards };
}

export async function readDeck(store: Pick<OtomeStore, "readDoc">, runId: string): Promise<TarotDeck> {
  return (await store.readDoc(deckId(runId), normalizeDeck)) ?? normalizeDeck(undefined);
}

/** The cards a love interest's readings show (the shared set and their own), each paint as the client sees it. */
export function deckView(runId: string, deck: TarotDeck, li: LiId): Record<string, TarotDeckCard> {
  return Object.fromEntries(
    Object.entries(deck.cards)
      .filter(([, entry]) => !entry.li || entry.li === li)
      .map(([key, entry]) => [
        key,
        { card: entry.card, art: paintView(runId, tarotOwner(key), entry.art) ?? entry.art },
      ]),
  );
}

/**
 * The Album's cards (GET /runs/:run/album): every deck entry, each paint as the client sees it, in Arcana order, then
 * by love interest in `cast` order (one no longer in the cast goes last).
 */
export function albumCards(runId: string, deck: TarotDeck, cast: readonly LiId[]): AlbumCard[] {
  const rank = (li: LiId | undefined) => {
    const index = li ? cast.indexOf(li) : -1;
    return index < 0 ? cast.length : index;
  };
  return Object.entries(deck.cards)
    .map(([key, entry]): AlbumCard => ({
      key,
      card: entry.card,
      ...(entry.li ? { li: entry.li } : {}),
      art: paintView(runId, tarotOwner(key), entry.art) ?? entry.art,
    }))
    .sort((a, b) => ARCANA.indexOf(a.card) - ARCANA.indexOf(b.card) || rank(a.li) - rank(b.li));
}

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const locked = () => new OtomeForgeError(409, "This card has not been drawn yet.", "locked");
const activeOf = (deps: ItemArtDeps) => () => !deps.art || deps.art.active();

/** The prompt and the paid call for a deck card, from the documents as they are now. */
async function buildCard(deps: ItemArtDeps, runId: string, key: string, edited: Partial<ImagePrompt>) {
  const [run, deck] = await Promise.all([readRun(deps.store, runId), readDeck(deps.store, runId)]);
  if (!run) throw notFound("Otome Forge run");
  const entry = deck.cards[key];
  if (!entry) throw locked();
  const unit: Unit | undefined = entry.li ? run.units.find((item) => item.id === entry.li) : undefined;
  if (entry.li && (!unit?.bible || !run.state.lis[entry.li])) throw notFound("love interest");
  // By id and role, never by name (S/art/cg.ts cgSubjects), as a keepsake names the two of them.
  const cast: string[] = { you: ["protagonist"], him: [entry.li!], both: [entry.li!, "protagonist"], none: [] }[
    entry.figure
  ];
  const player = cast.includes("protagonist") ? await withPersonaImageAppearance(deps.runtime, run.player) : run.player;
  const subjects = cast.length ? cgSubjects(cast, unit ? [unit] : [], player) : [];
  const { units, labels } = cgReferences(subjects);
  const images = imagesOf(deps);
  const style = await worldStyle(images, run.world.images);
  const prompt = tarotCardPrompt(
    {
      card: entry.card,
      people: subjects.map((subject) => subject.person),
      references: labels,
      world: run.world,
      style,
    },
    edited,
  );
  const name = `tarot-${entry.card}`;
  return {
    ...prompt,
    paint: async (connectionId: string, debugMode: boolean) => {
      const request = { connectionId, name, ...prompt, ...SCENE_SIZE, debugMode };
      if (subjects.length) {
        return images.generateBannerArt({
          ...request,
          // The Engine matches the override as `avatar:<slug of the first person's first name>`.
          name: subjects[0]!.person.name.split(/\s+/)[0] || name,
          units,
        });
      }
      const image = await images.generateImage(request);
      return images.uploadToGallery({ image, name, prompt: prompt.prompt });
    },
  };
}

/** Paints the card its caller marked pending at `at`, in the connection's lane; resolves its record as left. */
function paintDeckCard(
  deps: ItemArtDeps,
  runId: string,
  key: string,
  at: string,
  connectionId: string,
  { debugMode, consent, edited = {} }: { debugMode: boolean; consent: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint | null> {
  return paintRecord(deps, {
    connectionId,
    label: `tarot card ${key}`,
    active: activeOf(deps),
    async check(): Promise<PaintCheck> {
      const [deck, world] = await Promise.all([
        readDeck(deps.store, runId),
        deps.store.readDoc(worldId(runId), normalizeWorld),
      ]);
      const art = deck.cards[key]?.art;
      if (!world || art?.state !== "pending" || art.at !== at) return "gone";
      if (world.images.connectionId !== connectionId) return "stopped";
      if (!consent && world.images.ask) return "waiting-consent";
      return "paint";
    },
    // Built now, so the looks, the rating and the 18+ gate are the ones in force at the paid call.
    paint: async () => (await buildCard(deps, runId, key, edited)).paint(connectionId, debugMode),
    save: async (art) =>
      !!(
        await updateIfChanged(deps.store, deckTarget(runId), normalizeDeck, (current) => {
          const entry = current.cards[key];
          return entry?.art.state === "pending" && entry.art.at === at
            ? { ...current, cards: { ...current.cards, [key]: { ...entry, art } } }
            : undefined;
        })
      )?.changed,
  });
}

/**
 * A new reading's claim (see the header): each drawn card without a deck entry is cast and claimed once, then the
 * pending ones paint in the background. Never waits for a paint. Resolves the keys claimed now ([] for none).
 */
export async function claimDeckCards(
  deps: ItemArtDeps,
  runId: string,
  li: LiId,
  cards: readonly Arcana[],
  { debugMode, review }: ItemPaintOptions,
): Promise<string[]> {
  const world = await deps.store.readDoc(worldId(runId), normalizeWorld);
  const connectionId = world?.images.connectionId;
  if (!world || !connectionId || !activeOf(deps)()) return [];
  const deck = await readDeck(deps.store, runId);
  const wanted = new Map(cards.map((card) => [deckKey(card, li), card] as const));
  // Each card's live paint is held from its claim to its end, so a pending entry never reads as stopped meanwhile and
  // two readings drawing the same card claim it once.
  const releases = new Map<string, () => void>();
  for (const key of wanted.keys()) {
    if (deck.cards[key]) continue;
    const release = startPaint(runId, tarotOwner(key));
    if (release) releases.set(key, release);
  }
  const handed = new Set<string>();
  try {
    if (!releases.size) return [];
    const wait = world.images.ask || review === true;
    const at = new Date().toISOString();
    let claimed: string[] = [];
    await deps.store.mutateDoc(deckTarget(runId), normalizeDeck, (current) => {
      claimed = [...releases.keys()].filter((key) => !current.cards[key]);
      const added = claimed.map((key): [string, DeckCard] => {
        const card = wanted.get(key)!;
        const figure = ARCANA_FIGURES[card];
        const art: Paint = { state: wait ? "waiting-consent" : "pending", at };
        return [key, { card, figure, ...(figure === "him" || figure === "both" ? { li } : {}), art }];
      });
      return { ...current, cards: { ...current.cards, ...Object.fromEntries(added) } };
    });
    // The run's delete sweeps its documents after it removes the world; a deck saved after the sweep goes too.
    if (!(await deps.store.readDoc(worldId(runId), normalizeWorld))) {
      await deps.store.removeDoc(deckId(runId)).catch(() => false);
      return [];
    }
    if (wait) return claimed;
    for (const key of claimed) {
      handed.add(key);
      void paintDeckCard(deps, runId, key, at, connectionId, { debugMode, consent: false })
        .catch((error: unknown) =>
          deps.runtime.logger.warn(
            "[otome-forge] painting the tarot card %s stopped: %s",
            key,
            error instanceof Error ? error.message : String(error),
          ),
        )
        .finally(releases.get(key));
    }
    return claimed;
  } finally {
    for (const [key, release] of releases) if (!handed.has(key)) release();
  }
}

/** A love interest the run has, or a 404; then their deck card for `card`, or 409 `locked` before it was drawn. */
async function readEntry(deps: Pick<ItemArtDeps, "store">, runId: string, li: LiId, card: Arcana) {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  if (!run.state.lis[li] || !run.units.some((unit) => unit.id === li)) throw notFound("love interest");
  const key = deckKey(card, li);
  const entry = (await readDeck(deps.store, runId)).cards[key];
  if (!entry) throw locked();
  return { run, key, entry };
}

/** POST /runs/:run/art/tarot/prompt {li, card}: the prompt the card's paint would send (the review dialog shows it). */
export async function tarotCardArtPrompt(
  deps: ItemArtDeps,
  runId: string,
  li: LiId,
  card: Arcana,
): Promise<ImagePrompt> {
  const { key } = await readEntry(deps, runId, li, card);
  const { prompt, negativePrompt } = await buildCard(deps, runId, key, {});
  return { prompt, negativePrompt };
}

/**
 * POST /runs/:run/art/tarot {li, card, prompt?, negativePrompt?}: the tap that paints a drawn card now (Ask's consent,
 * a reviewed prompt, or Retry). Waits for the paint and resolves its record as left; a ready card is returned as it
 * is, and a tap while it paints waits for that paint, so no tap pays twice. 409 `locked` for a card never drawn with
 * them, 503 `no-connection` without an image connection.
 */
export async function paintTarotCardNow(
  deps: ItemArtDeps,
  runId: string,
  li: LiId,
  card: Arcana,
  { debugMode, edited }: { debugMode: boolean; edited?: Partial<ImagePrompt> },
): Promise<Paint> {
  const key = deckKey(card, li);
  const shown = async () => {
    const { entry } = await readEntry(deps, runId, li, card);
    return paintView(runId, tarotOwner(key), entry.art) ?? entry.art;
  };
  return tapPaint(
    runId,
    async () => tarotOwner(key),
    async () => {
      const art = await shown();
      return { value: art, art };
    },
    async () => {
      const { run, entry } = await readEntry(deps, runId, li, card);
      if (entry.art.state === "ready") return entry.art;
      const connectionId = run.world.images.connectionId;
      if (!connectionId) throw new OtomeForgeError(503, "This world has no image connection.", "no-connection");
      const at = new Date().toISOString();
      const claimed = await updateIfChanged(deps.store, deckTarget(runId), normalizeDeck, (current) => {
        const latest = current.cards[key];
        return latest && latest.art.state !== "ready"
          ? { ...current, cards: { ...current.cards, [key]: { ...latest, art: { state: "pending" as const, at } } } }
          : undefined;
      });
      if (!claimed) throw notFound("Otome Forge run");
      if (claimed.changed)
        await paintDeckCard(deps, runId, key, at, connectionId, { debugMode, consent: true, edited });
      return shown();
    },
  );
}
