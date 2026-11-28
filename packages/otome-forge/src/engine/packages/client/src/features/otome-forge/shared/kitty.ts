// ──────────────────────────────────────────────
// Otome Hearth: Kitty Cards' rules, numbers and wire shapes, shared by both bundles (0.35.0)
// ──────────────────────────────────────────────
// Our version of Love and Deep Space's Kitty Cards: the Normal mode and his cheat, played on a date with one love
// interest. Pure TypeScript, and nothing in a game calls a model: the client plays it (C/screens/dates/KittyCards.tsx)
// with his pre-written lines, and the server pays it (S/minigames/kitty.ts), trusting the result within the day's caps.
//
// A game is a value, and a pure function of (seed, moves): deal lays out the deck, the hands and the cups, applyMove
// plays one move, and partnerMove picks his. Every random choice is a number of the Claw Machine's mulberry32 stream
// (C/lib/claw-physics.ts): the deal and the cheat moment from the game's seed, his turn from rollSeed(seed, moves
// made), and his cheat's rolls from their own salt. The same seed and the same moves always give the same game.
//
// The rules: 20 kitten cards, one per colour and value 1–5. 8 cups: 2 white and 6 coloured, every colour at least
// once. The first player draws 2 cards, the second 3. A turn plays one card into any empty cup, or draws one from the
// pile while it has any; a card drawn into a hand of KITTY_HAND_MAX is burned. A card scores for whoever played it:
// 2 × its value in its own colour's cup, its value in a white cup, nothing in another colour's. The game ends when
// every cup is filled or neither player can act, and the turn skips a player who cannot act while the other can.
//
// His cheat (bible.play.cheat, "steady" without a bible, as the Claw's): a game has one moment with KITTY_CHEAT_CHANCE,
// at the first of his turns, once KITTY_CHEAT_AFTER_CUPS cups are filled, where his cheat can act (cheatDue). It comes
// before his move and changes only the game (cups, hands, pile):
//   nudge      he swaps the kittens of two filled cups to his gain (nudgeSwap, swapCups); "Gotcha!" swaps them back
//   freeze     he dozes off and she may swap two filled cups' kittens; awake, he notices (cheatCaught) and swaps back
//   extra      he looks away and she may sneak one card (sneakCard), unless he turns back first (cheatCaught)
//   calculate  he offers one random card of his for one random card of hers, face down (tradeOffer, tradeCards)
//   steady     he lets her take back the card she played last and play again (takeBack)
// `caught` on a finish (KittyCheat) means the moment was found out: she caught his nudge, or he caught her (freeze,
// extra). Only those three can be caught.
//
// The cards' art is pre-made (packages/otome-forge/kitty/<card>.webp, a package asset). With images on, the protagonist
// and each love interest also get a painted kitten (S/art/kittens.ts), which kittenCards puts on the value-5 cards.
import { mulberry32 } from "../lib/claw-physics";
import type { ActivityGrant, ClawCheat, LiId, Paint } from "./api-types";
import type { ClawPlayer } from "./claw";

export const KITTY_COLOURS = ["rose", "sky", "lemon", "mint"] as const;
export type KittyColour = (typeof KITTY_COLOURS)[number];
export type KittyCupColour = KittyColour | "white";
export const KITTY_VALUES = [1, 2, 3, 4, 5] as const;
export type KittyValue = (typeof KITTY_VALUES)[number];
/** `<colour>-<value>`, also the name of its card's art (packages/otome-forge/kitty/<card>.webp). */
export type KittyCard = `${KittyColour}-${KittyValue}`;

/** The deck in order: each colour's 1 to 5. */
export const KITTY_DECK: readonly KittyCard[] = KITTY_COLOURS.flatMap((colour) =>
  KITTY_VALUES.map((value): KittyCard => `${colour}-${value}`),
);
export const KITTY_CUPS = 8;
export const KITTY_WHITE_CUPS = 2;
export const KITTY_HAND_MAX = 10;
/** The cards each player draws before the first turn. */
export const KITTY_OPENING: Readonly<Record<"first" | "second", number>> = { first: 2, second: 3 };
/** The most points a finish may name for either player (the server's check; a game makes at most 64). */
export const KITTY_POINTS_MAX = 80;
/** His turn plays his second-best play this often, so he is beatable. */
export const KITTY_SECOND_BEST = 0.25;
/** A game has his cheat moment this often. */
export const KITTY_CHEAT_CHANCE = 0.6;
/** His cheat moment waits until this many cups are filled. */
export const KITTY_CHEAT_AFTER_CUPS = 3;
/** A freeze or an extra is found out this often. */
export const KITTY_CAUGHT_CHANCE = 0.3;
/** How long each timed cheat lasts, in seconds: Gotcha! shows, he dozes, she holds Sneak a card. */
export const KITTY_CHEAT_SECONDS = { nudge: 3, freeze: 5, extra: 1.5 } as const;
/** The cheats that can be found out (KittyCheat.caught). */
export const KITTY_CATCHABLE: readonly ClawCheat[] = ["nudge", "freeze", "extra"];

/** `k-<time base36>-<6 [a-z0-9]>`: made by the client when a game starts; a finish sent again names the same one. */
export const KITTY_ROUND_ID = /^k-[0-9a-z]{1,12}-[0-9a-z]{6}$/;

export const cardColour = (card: KittyCard) => card.slice(0, card.indexOf("-")) as KittyColour;
export const cardValue = (card: KittyCard) => Number(card.slice(card.indexOf("-") + 1)) as KittyValue;
const other = (player: ClawPlayer): ClawPlayer => (player === "me" ? "partner" : "me");

/** A filled cup's kitten, and who played it (who its points go to). */
export interface KittyPlay {
  card: KittyCard;
  by: ClawPlayer;
}

export interface KittyCup {
  colour: KittyCupColour;
  played: KittyPlay | null;
}

export interface KittyGame {
  seed: number;
  first: ClawPlayer;
  /** The draw pile, top card first. */
  pile: KittyCard[];
  hands: Record<ClawPlayer, KittyCard[]>;
  cups: KittyCup[];
  /** Cards drawn into a full hand. */
  burned: KittyCard[];
  turn: ClawPlayer;
  /** Moves made so far: his turn's seed counts them. */
  moves: number;
  /** The cup her latest move filled, while that move was a play (a steady take-back empties it). */
  herLast: number | null;
  /** His cheat moment: "waiting" until it comes, then "done"; null in a game without one. */
  cheat: "waiting" | "done" | null;
}

export type KittyMove = { kind: "play"; card: KittyCard; cup: number } | { kind: "draw" };

/** The seed of one roll of the game seeded `seed`: his turn's (salt: the moves made), or a cheat's. */
export const rollSeed = (seed: number, salt: number) => (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
/** The seed for his turn now. */
export const turnSeed = (game: Pick<KittyGame, "seed" | "moves">) => rollSeed(game.seed, game.moves);
const CAUGHT_SALT = 1001;
const TRADE_SALT = 1002;

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [out[index], out[swap]] = [out[swap]!, out[index]!];
  }
  return out;
}

/** A new game: the shuffled pile, the cups, both opening hands, and whether his cheat moment comes. */
export function deal(seed: number, first: ClawPlayer): KittyGame {
  const next = mulberry32(seed);
  const pile = shuffled(KITTY_DECK, next);
  const extra = Array.from(
    { length: KITTY_CUPS - KITTY_WHITE_CUPS - KITTY_COLOURS.length },
    () => KITTY_COLOURS[Math.floor(next() * KITTY_COLOURS.length)]!,
  );
  const colours: KittyCupColour[] = [...KITTY_COLOURS, ...extra, ...Array<"white">(KITTY_WHITE_CUPS).fill("white")];
  const cups = shuffled(colours, next).map((colour): KittyCup => ({ colour, played: null }));
  const opening = pile.splice(0, KITTY_OPENING.first + KITTY_OPENING.second);
  const hands = {
    [first]: opening.slice(0, KITTY_OPENING.first),
    [other(first)]: opening.slice(KITTY_OPENING.first),
  } as Record<ClawPlayer, KittyCard[]>;
  return {
    seed: seed >>> 0,
    first,
    pile,
    hands,
    cups,
    burned: [],
    turn: first,
    moves: 0,
    herLast: null,
    cheat: next() < KITTY_CHEAT_CHANCE ? "waiting" : null,
  };
}

/** What `card` scores in a cup of `colour`. */
export function cupPoints(card: KittyCard, colour: KittyCupColour): number {
  const value = cardValue(card);
  return colour === cardColour(card) ? 2 * value : colour === "white" ? value : 0;
}

/** Each player's points: every filled cup's, for whoever played its kitten. */
export function score(game: Pick<KittyGame, "cups">): Record<ClawPlayer, number> {
  const points = { me: 0, partner: 0 };
  for (const { colour, played } of game.cups) if (played) points[played.by] += cupPoints(played.card, colour);
  return points;
}

/** Her result from both scores. */
export const resultOf = (me: number, partner: number): KittyResult =>
  me > partner ? "win" : me < partner ? "lose" : "draw";

export const filledCups = (game: Pick<KittyGame, "cups">) => game.cups.filter((cup) => cup.played).length;
const emptyCups = (game: Pick<KittyGame, "cups">) => game.cups.flatMap((cup, index) => (cup.played ? [] : [index]));

/** True while `player` has a move: a cup is empty, and a card is in hand or on the pile. */
export function canAct(game: KittyGame, player: ClawPlayer): boolean {
  return filledCups(game) < game.cups.length && (game.hands[player].length > 0 || game.pile.length > 0);
}

/** Every cup filled, or neither player can act. */
export const isOver = (game: KittyGame) => !canAct(game, "me") && !canAct(game, "partner");

/** The moves the player whose turn it is may make: each card in each empty cup, and a draw while the pile has cards. */
export function legalMoves(game: KittyGame): KittyMove[] {
  if (isOver(game)) return [];
  const cups = emptyCups(game);
  const plays = game.hands[game.turn].flatMap((card) => cups.map((cup): KittyMove => ({ kind: "play", card, cup })));
  return game.pile.length ? [...plays, { kind: "draw" }] : plays;
}

function isLegal(game: KittyGame, move: KittyMove): boolean {
  if (isOver(game)) return false;
  if (move.kind === "draw") return game.pile.length > 0;
  return game.hands[game.turn].includes(move.card) && game.cups[move.cup]?.played === null;
}

/** The game after the player whose turn it is makes `move`. Throws a RangeError for a move legalMoves does not list. */
export function applyMove(game: KittyGame, move: KittyMove): KittyGame {
  if (!isLegal(game, move)) throw new RangeError(`Not a legal Kitty Cards move: ${JSON.stringify(move)}`);
  const player = game.turn;
  const hands = { ...game.hands };
  let { pile, cups, burned } = game;
  if (move.kind === "draw") {
    const [card, ...rest] = pile;
    pile = rest;
    if (hands[player].length >= KITTY_HAND_MAX) burned = [...burned, card!];
    else hands[player] = [...hands[player], card!];
  } else {
    hands[player] = hands[player].filter((card) => card !== move.card);
    cups = cups.map((cup, index) => (index === move.cup ? { ...cup, played: { card: move.card, by: player } } : cup));
  }
  const herLast = player === "partner" ? game.herLast : move.kind === "play" ? move.cup : null;
  const next: KittyGame = { ...game, pile, hands, cups, burned, herLast, moves: game.moves + 1 };
  // The turn passes, unless the other player cannot act while this one still can.
  const turn = canAct(next, other(player)) || !canAct(next, player) ? other(player) : player;
  return { ...next, turn };
}

/**
 * His move on his turn (no model): every (card, empty cup) pair by the points it makes, the best played, except that
 * with KITTY_SECOND_BEST (rolled from `seed`, turnSeed in play) the best pair scoring less. When his best play scores
 * nothing he draws while the pile has cards and his hand is below KITTY_HAND_MAX; else he plays his lowest card where
 * it scores most. Ties go to the earlier card in his hand, then the earlier cup.
 */
export function partnerMove(game: KittyGame, seed: number): KittyMove {
  const hand = game.hands.partner;
  const cups = emptyCups(game);
  const pairs = hand
    .flatMap((card) => cups.map((cup) => ({ card, cup, points: cupPoints(card, game.cups[cup]!.colour) })))
    .sort((a, b) => b.points - a.points);
  const best = pairs[0];
  if (!best) return { kind: "draw" };
  if (best.points === 0) {
    if (game.pile.length && hand.length < KITTY_HAND_MAX) return { kind: "draw" };
    const lowest = hand.reduce((low, card) => (cardValue(card) < cardValue(low) ? card : low));
    const where = pairs.find((pair) => pair.card === lowest)!;
    return { kind: "play", card: where.card, cup: where.cup };
  }
  const worse = pairs.find((pair) => pair.points < best.points);
  const pick = worse && mulberry32(seed)() < KITTY_SECOND_BEST ? worse : best;
  return { kind: "play", card: pick.card, cup: pick.cup };
}

// ── His cheat ──

/** The two filled cups whose kittens swapped gain him the most over her, or null when no swap gains him anything. */
export function nudgeSwap(game: Pick<KittyGame, "cups">): [number, number] | null {
  // His points minus hers, from one cup's kitten in a cup of `colour`.
  const lead = (play: KittyPlay, colour: KittyCupColour) =>
    (play.by === "partner" ? 1 : -1) * cupPoints(play.card, colour);
  let best: [number, number] | null = null;
  let bestGain = 0;
  for (let i = 0; i < game.cups.length; i += 1) {
    for (let j = i + 1; j < game.cups.length; j += 1) {
      const a = game.cups[i]!;
      const b = game.cups[j]!;
      if (!a.played || !b.played) continue;
      const gain =
        lead(a.played, b.colour) + lead(b.played, a.colour) - lead(a.played, a.colour) - lead(b.played, b.colour);
      if (gain > bestGain) {
        best = [i, j];
        bestGain = gain;
      }
    }
  }
  return best;
}

/** True when his cheat moment comes now: the start of his turn, with enough cups filled, where `cheat` can act. */
export function cheatDue(game: KittyGame, cheat: ClawCheat): boolean {
  if (game.cheat !== "waiting" || game.turn !== "partner" || isOver(game)) return false;
  if (filledCups(game) < KITTY_CHEAT_AFTER_CUPS) return false;
  switch (cheat) {
    case "nudge":
      return nudgeSwap(game) !== null;
    case "freeze":
      return true;
    case "extra":
      return game.pile.length > 0;
    case "calculate":
      return game.hands.me.length > 0 && game.hands.partner.length > 0;
    case "steady":
      return game.herLast !== null && game.cups[game.herLast]?.played?.by === "me";
  }
}

/** The moment is over: it never comes again this game. */
export const endCheat = (game: KittyGame): KittyGame => ({ ...game, cheat: "done" });

/** Whether he finds out a freeze or an extra (KITTY_CAUGHT_CHANCE, from the game's seed). */
export const cheatCaught = (game: Pick<KittyGame, "seed">) =>
  mulberry32(rollSeed(game.seed, CAUGHT_SALT))() < KITTY_CAUGHT_CHANCE;

/** The game with the kittens of two filled cups swapped, each keeping who played it (nudge, Gotcha!, freeze). */
export function swapCups(game: KittyGame, a: number, b: number): KittyGame {
  const first = game.cups[a]?.played;
  const second = game.cups[b]?.played;
  if (a === b || !first || !second) throw new RangeError(`Kitty Cards swaps two filled cups, not ${a} and ${b}`);
  const cups = game.cups.map((cup, index) =>
    index === a ? { ...cup, played: second } : index === b ? { ...cup, played: first } : cup,
  );
  const herLast = game.herLast === a ? b : game.herLast === b ? a : game.herLast;
  return { ...game, cups, herLast };
}

/** Extra: she draws the top card out of turn (burned into a full hand); whose turn it is does not change. */
export function sneakCard(game: KittyGame): KittyGame {
  const [card, ...pile] = game.pile;
  if (!card) throw new RangeError("Kitty Cards has no card left to sneak");
  return game.hands.me.length >= KITTY_HAND_MAX
    ? { ...game, pile, burned: [...game.burned, card] }
    : { ...game, pile, hands: { ...game.hands, me: [...game.hands.me, card] } };
}

/** Calculate: the trade he offers, one random card of his hand for one random card of hers (from the game's seed). */
export function tradeOffer(game: Pick<KittyGame, "seed" | "hands">): { his: KittyCard; hers: KittyCard } {
  const next = mulberry32(rollSeed(game.seed, TRADE_SALT));
  const { me, partner } = game.hands;
  if (!me.length || !partner.length) throw new RangeError("Kitty Cards trades only between two hands with cards");
  return { his: partner[Math.floor(next() * partner.length)]!, hers: me[Math.floor(next() * me.length)]! };
}

/** The game after a trade she accepted: his card goes to her hand and hers to his. */
export function tradeCards(game: KittyGame, { his, hers }: { his: KittyCard; hers: KittyCard }): KittyGame {
  if (!game.hands.partner.includes(his) || !game.hands.me.includes(hers)) {
    throw new RangeError("Kitty Cards trades cards that are in the hands");
  }
  return {
    ...game,
    hands: {
      me: [...game.hands.me.filter((card) => card !== hers), his],
      partner: [...game.hands.partner.filter((card) => card !== his), hers],
    },
  };
}

/** Steady: her latest play comes back to her hand, its cup is empty again, and it is her turn to play again. */
export function takeBack(game: KittyGame): KittyGame {
  const cup = game.herLast;
  const played = cup === null ? null : game.cups[cup]?.played;
  if (cup === null || played?.by !== "me") throw new RangeError("Kitty Cards has no play of hers to take back");
  return {
    ...game,
    hands: { ...game.hands, me: [...game.hands.me, played.card] },
    cups: game.cups.map((entry, index) => (index === cup ? { ...entry, played: null } : entry)),
    turn: "me",
    herLast: null,
  };
}

// ── The finish ──

export type KittyResult = "win" | "lose" | "draw";

/** His cheat moment in a finished game: the kind, and whether it was found out (only KITTY_CATCHABLE can be). */
export interface KittyCheat {
  kind: ClawCheat;
  caught: boolean;
}

/** POST /runs/:run/kitty/finish: her result and both scores; `cheat` is null in a game without his moment. */
export interface KittyFinishInput {
  li: LiId;
  round: string;
  first: ClawPlayer;
  result: KittyResult;
  me: number;
  partner: number;
  cheat: KittyCheat | null;
}

/** One finished game as `state.kitty.rounds` keeps it: answered again on a replay, and his private memory of it. */
export interface KittyRound {
  id: string;
  li: LiId;
  /** His name when it was played, so his memory of it keeps its first wording after a rename. */
  name: string;
  at: string;
  first: ClawPlayer;
  result: KittyResult;
  me: number;
  partner: number;
  cheat: KittyCheat | null;
  paid: { starlight: number; affection: number };
  /** The daily cap took some of what the game would have paid. */
  capped: boolean;
}

/** What POST .../kitty/finish answers, the same again for a game already paid (`replay`). */
export interface KittyFinishResult {
  grants: ActivityGrant[];
  capped: boolean;
  replay: boolean;
  /** The wallet after the game. */
  starlight: number;
}

// ── Their painted kittens ──

/** Whose painted kitten: the protagonist's, or a love interest's. */
export type KittenOwner = "player" | LiId;

/**
 * One painted kitten as GET /runs/:run/play shows it (S/art/kittens.ts), with images on only. `url`: the kitten once it
 * is painted and cut out (the painted picture when its cut-out failed). Until then `art` is its paint as the client
 * should see it: `waiting-consent` (Paint our kittens), `pending` (painting, or being cut out), `failed` or `stopped`
 * (Try again); neither while it waits for its turn to be claimed. 0.36.0: while the Album's Repaint paints one again,
 * `url` stays the picture it paints over and `art` is `pending` until the new one is cut out. The Album lists those with
 * a `url` (AlbumView.kittens).
 */
export interface KittenView {
  owner: KittenOwner;
  url?: string;
  art?: Paint;
}

/** The cards painted kittens take, in kittenCards' order: hers, his, then two more love interests'. */
export const KITTEN_CARDS: readonly KittyCard[] = ["rose-5", "sky-5", "lemon-5", "mint-5"];

/**
 * Which cards a game with `li` shows as painted kittens: rose 5 the protagonist, sky 5 him, lemon 5 and mint 5 the next
 * two love interests after him in cast order (round to the start) who have one. `kittens` is the play view's: the
 * protagonist, then the cast in order. Only a kitten with a `url` takes a card; any other card keeps its breed's art.
 */
export function kittenCards(
  kittens: readonly KittenView[],
  li: LiId,
): Partial<Record<KittyCard, { owner: KittenOwner; url: string }>> {
  const shown = (owner: KittenOwner | undefined) => {
    const url = kittens.find((kitten) => kitten.owner === owner)?.url;
    return owner && url ? { owner, url } : undefined;
  };
  const cast = kittens.flatMap((kitten) => (kitten.owner === "player" ? [] : [kitten.owner]));
  const at = cast.indexOf(li);
  const after = at < 0 ? [] : [...cast.slice(at + 1), ...cast.slice(0, at)];
  const others = after.map(shown).filter((kitten) => kitten !== undefined);
  const owners = [shown("player"), shown(at < 0 ? undefined : li), ...others];
  return Object.fromEntries(
    KITTEN_CARDS.flatMap((card, index) => (owners[index] ? [[card, owners[index]]] : [])),
  ) as Partial<Record<KittyCard, { owner: KittenOwner; url: string }>>;
}
