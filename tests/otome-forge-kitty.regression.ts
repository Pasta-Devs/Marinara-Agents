// Otome Hearth's Kitty Cards (0.35.0). The rules are pure and deterministic for a seed: the deal's shape, the
// scoring, a card burned into a full hand, both ways a game ends and the turn skipping a player who cannot act, his move
// (always legal, the same for the same seed, his second best a quarter of the time, a draw when nothing scores) and
// each cheat's change to the game. The finish pays 20 Starlight and 30 affection a game and 20 more for a win, within
// the day's caps, once per game id (a replay, a 409 with another love interest), nothing while his grievance with her
// stands, and refuses a body these rules could not end in; it costs no model call. Each game is his private memory, in
// plain words; the state keeps each love interest's newest games; the play view brings his kitty lines by the claw
// lines' content rule, and none during a rupture. His lines: a new fixed pack (P15) holds the six kitty kinds by their
// counts and rules; a pack written before them gains only kitty lines from a background job GET /play queues (once, under
// the pack's own content stamp, with the line packs' cool-down), never touching comfort or claw; the catalog has a
// fallback line for every kind and every cheat style. The art: twenty transparent kitten cards in the package, each
// with its breed; with images on, GET /play paints her kitten and each love interest's one at a time in the low lane,
// shows each only once cut out, leaves them waiting for a tap under Ask or review (which paints once), rests after a
// failure, reads a restart's paint as stopped and paints nothing with images off; the kitten prompt keeps its rating
// and adult tags on an edit; and the kittens take rose 5 (hers), sky 5 (his) and lemon and mint 5 (the next two).
// 0.36.0: the Album lists the play view's painted, cut-out kittens (hers, then the cast's) and queues nothing; its
// Repaint paints one again in the low lane, one at a time, with the tap as the consent and a reviewed prompt kept, shows
// the old one (cut out) in the Album and Kitty Cards until the new one is cut out, keeps it on a failure, deletes the
// replaced original, and pays nothing with images off; Kitty Cards' own tap still never repaints a painted kitten.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type { ClawCheat } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  CLAW_ROUNDS_KEPT,
  type PlayView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/claw.ts";
import {
  ACTIVITY_STARLIGHT_DAILY_CAP,
  OUTSIDE_AFFECTION_DAILY_CAP,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  LINE_COUNTS,
  LINE_WORDS_MAX,
  wordCount,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/home.ts";
import {
  KITTEN_CARDS,
  KITTY_COLOURS,
  KITTY_DECK,
  KITTY_HAND_MAX,
  applyMove,
  canAct,
  cheatCaught,
  cheatDue,
  cupPoints,
  deal,
  endCheat,
  isOver,
  kittenCards,
  legalMoves,
  nudgeSwap,
  partnerMove,
  score,
  sneakCard,
  swapCups,
  takeBack,
  tradeCards,
  tradeOffer,
  turnSeed,
  type KittenView,
  type KittyCard,
  type KittyCupColour,
  type KittyFinishResult,
  type KittyGame,
  type KittyMove,
  type KittyRound,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/kitty.ts";
import { mulberry32 } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/claw-physics.ts";
import {
  KITTY_BREED_KEYS,
  kittyCardUrl,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/kitty-cards.ts";
import {
  cutoutsSettled,
  type CutoutClient,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cutout.ts";
import { createOtomeArt } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/expressions.ts";
import { queueKittens } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/kittens.ts";
import { paintSlot } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import {
  LINE_RETRY_MS,
  contentStamp,
  ensureKittyLines,
  normalizeLinePack,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/lines.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  playerId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { playView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/claw.ts";
import { registerAlbumRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/album.ts";
import { registerArtRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/art.ts";
import { registerClawRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/claw.ts";
import { registerKittyRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/kitty.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { LinePackReplySchema } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/home/replies.ts";
import {
  KITTEN_FRAMING,
  kittenPrompt,
  linePackMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { artWorld, routesOf, setImages, until } from "./fixtures/otome-forge-art.ts";
import { HE, KAI, MIR, SOL, at, bible, json, storyWorld } from "./fixtures/otome-forge-story.ts";

// ── The rules ──

const other = (player: "me" | "partner") => (player === "me" ? "partner" : "me");
const cardsIn = (game: KittyGame) => [
  ...game.pile,
  ...game.hands.me,
  ...game.hands.partner,
  ...game.burned,
  ...game.cups.flatMap((cup) => (cup.played ? [cup.played.card] : [])),
];

/** A game laid out by hand: the cups' colours, what is in them, and the rest. */
function laid(
  colours: KittyCupColour[],
  changes: Partial<KittyGame> = {},
  played: Record<number, { card: KittyCard; by: "me" | "partner" }> = {},
): KittyGame {
  return {
    seed: 7,
    first: "me",
    pile: [],
    hands: { me: [], partner: [] },
    cups: colours.map((colour, index) => ({ colour, played: played[index] ?? null })),
    burned: [],
    turn: "partner",
    moves: 0,
    herLast: null,
    cheat: null,
    ...changes,
  };
}
const CUPS: KittyCupColour[] = ["rose", "sky", "lemon", "mint", "white", "white", "rose", "sky"];

/** Plays a game to its end: her moves picked by `herSeed`'s stream from the legal ones, his by partnerMove. */
function playOut(seed: number, first: "me" | "partner", herSeed = seed + 1) {
  const pick = mulberry32(herSeed);
  let game = deal(seed, first);
  const moves: KittyMove[] = [];
  while (!isOver(game)) {
    const legal = legalMoves(game);
    assert.ok(legal.length, "a player whose turn it is can act");
    const move =
      game.turn === "partner" ? partnerMove(game, turnSeed(game)) : legal[Math.floor(pick() * legal.length)]!;
    assert.ok(
      legal.some((entry) => JSON.stringify(entry) === JSON.stringify(move)),
      `seed ${seed}: his move is legal`,
    );
    moves.push(move);
    game = applyMove(game, move);
    assert.equal(cardsIn(game).length, KITTY_DECK.length, "no card made or lost");
    assert.ok(game.hands.me.length <= KITTY_HAND_MAX && game.hands.partner.length <= KITTY_HAND_MAX);
  }
  return { game, moves };
}

test("the deal: a shuffled deck of twenty, 2 and 3 cards in hand, eight cups with two white and every colour", () => {
  assert.equal(KITTY_DECK.length, 20);
  assert.equal(new Set(KITTY_DECK).size, 20);
  const deals = new Set<string>();
  for (let seed = 0; seed < 300; seed += 1) {
    for (const first of ["me", "partner"] as const) {
      const game = deal(seed, first);
      assert.deepEqual(game, deal(seed, first), "the same seed deals the same game");
      assert.deepEqual([...cardsIn(game)].sort(), [...KITTY_DECK].sort(), "every card once");
      assert.equal(game.hands[first].length, 2, "the first player draws 2");
      assert.equal(game.hands[other(first)].length, 3, "the second 3");
      assert.equal(game.pile.length, 15);
      assert.equal(game.turn, first);
      assert.equal(game.cups.length, 8);
      assert.ok(game.cups.every((cup) => cup.played === null));
      const colours = game.cups.map((cup) => cup.colour);
      assert.equal(colours.filter((colour) => colour === "white").length, 2, "two white cups");
      for (const colour of KITTY_COLOURS) assert.ok(colours.includes(colour), `a ${colour} cup`);
      deals.add(JSON.stringify([game.pile, colours]));
    }
  }
  assert.ok(deals.size > 250, "seeds deal different games");
});

test("a card scores twice its value in its own colour's cup, its value in a white one, nothing elsewhere", () => {
  assert.equal(cupPoints("rose-4", "rose"), 8);
  assert.equal(cupPoints("rose-4", "white"), 4);
  assert.equal(cupPoints("rose-4", "sky"), 0);
  assert.equal(cupPoints("mint-1", "mint"), 2);
  const game = laid(
    CUPS,
    {},
    {
      0: { card: "rose-5", by: "me" },
      1: { card: "rose-3", by: "partner" },
      4: { card: "lemon-2", by: "partner" },
      7: { card: "sky-1", by: "me" },
    },
  );
  assert.deepEqual(score(game), { me: 10 + 2, partner: 0 + 2 }, "each cup's points go to whoever played it");
});

test("a card drawn into a full hand is burned; a draw needs a pile and a play an empty cup and a card in hand", () => {
  const full = laid(CUPS, {
    turn: "me",
    pile: ["mint-5", "mint-4"],
    hands: { me: KITTY_DECK.slice(0, KITTY_HAND_MAX), partner: ["sky-5"] },
  });
  const burned = applyMove(full, { kind: "draw" });
  assert.equal(burned.hands.me.length, KITTY_HAND_MAX);
  assert.deepEqual(burned.burned, ["mint-5"]);
  assert.deepEqual(burned.pile, ["mint-4"]);
  assert.equal(burned.turn, "partner");
  const drawn = applyMove(laid(CUPS, { turn: "me", pile: ["mint-5"] }), { kind: "draw" });
  assert.deepEqual([drawn.hands.me, drawn.burned], [["mint-5"], []]);

  assert.throws(() => applyMove(laid(CUPS, { turn: "me", hands: { me: ["rose-1"], partner: [] } }), { kind: "draw" }));
  const filled = laid(
    CUPS,
    { turn: "me", hands: { me: ["rose-1", "rose-2"], partner: [] } },
    {
      0: { card: "sky-1", by: "partner" },
    },
  );
  assert.throws(() => applyMove(filled, { kind: "play", card: "rose-1", cup: 0 }), RangeError, "a filled cup");
  assert.throws(() => applyMove(filled, { kind: "play", card: "rose-3", cup: 1 }), RangeError, "a card not in hand");
  assert.throws(() => applyMove(filled, { kind: "play", card: "rose-1", cup: 8 }), RangeError, "no such cup");
  assert.equal(legalMoves(filled).length, 2 * 7, "each card in each empty cup, and no draw from an empty pile");
});

test("the game ends with every cup filled or when neither can act; the turn skips a player who cannot act", () => {
  const seven = Object.fromEntries(
    KITTY_DECK.slice(0, 7).map((card, index) => [index, { card, by: index % 2 ? "me" : "partner" }]),
  ) as Record<number, { card: KittyCard; by: "me" | "partner" }>;
  const last = laid(CUPS, { turn: "me", pile: ["mint-5"], hands: { me: ["sky-5"], partner: ["lemon-5"] } }, seven);
  assert.equal(isOver(last), false);
  const ended = applyMove(last, { kind: "play", card: "sky-5", cup: 7 });
  assert.equal(isOver(ended), true, "every cup filled, though cards are left");
  assert.deepEqual(legalMoves(ended), []);
  assert.throws(() => applyMove(ended, { kind: "draw" }), RangeError);

  // Her hand and the pile are empty: he plays on alone, and once he has none either, the game is over.
  const alone = laid(CUPS, { turn: "partner", hands: { me: [], partner: ["rose-1", "sky-1"] } });
  assert.equal(canAct(alone, "me"), false);
  const his = applyMove(alone, { kind: "play", card: "rose-1", cup: 0 });
  assert.equal(his.turn, "partner", "her turn is skipped");
  const done = applyMove(his, { kind: "play", card: "sky-1", cup: 1 });
  assert.equal(isOver(done), true, "neither can act, with cups still empty");
  // A draw that leaves the other player able to act passes the turn as ever.
  assert.equal(
    applyMove(laid(CUPS, { turn: "me", pile: ["rose-2"], hands: { me: [], partner: ["sky-2"] } }), { kind: "draw" })
      .turn,
    "partner",
  );
});

test("his move: always legal and the same for the same seed; whole games end the same when replayed", () => {
  let mine = 0;
  let his = 0;
  for (let seed = 1; seed <= 400; seed += 1) {
    const first = seed % 2 ? "me" : "partner";
    const once = playOut(seed, first);
    const again = playOut(seed, first);
    assert.deepEqual(again.moves, once.moves, "replayed move for move");
    assert.deepEqual(again.game, once.game);
    const points = score(once.game);
    assert.ok(points.me + points.partner <= 64, "never more than the cups can hold");
    if (points.me > points.partner) mine += 1;
    if (points.partner > points.me) his += 1;
  }
  assert.ok(his > mine, "he plays to score: a player tapping at random loses more often than not");
});

test("his move scores best, but a quarter of the time the next best; with nothing to score he draws", () => {
  const hand: KittyCard[] = ["rose-5", "sky-1"];
  const game = laid(CUPS, { pile: ["mint-1"], hands: { me: ["lemon-1"], partner: hand } });
  const counts = new Map<string, number>();
  for (let seed = 0; seed < 4000; seed += 1) {
    const move = partnerMove(game, seed);
    assert.deepEqual(partnerMove(game, seed), move, "the same seed, the same move");
    counts.set(JSON.stringify(move), (counts.get(JSON.stringify(move)) ?? 0) + 1);
  }
  const best = counts.get(JSON.stringify({ kind: "play", card: "rose-5", cup: 0 })) ?? 0;
  const worse = 4000 - best;
  assert.ok(worse / 4000 > 0.2 && worse / 4000 < 0.3, `the second best ${worse} times in 4000`);
  // The second best is the next play down: rose 5 in the second rose cup (cup 6) scores the same 10, so it is
  // white's 5.
  assert.deepEqual([...counts.keys()].sort(), [
    JSON.stringify({ kind: "play", card: "rose-5", cup: 0 }),
    JSON.stringify({ kind: "play", card: "rose-5", cup: 4 }),
  ]);

  // Nothing scores (only cups of other colours are empty): he draws while he can.
  const blank = laid(
    ["sky", "sky", "white", "white", "sky", "sky", "sky", "sky"],
    { pile: ["mint-1"], hands: { me: [], partner: ["rose-3", "rose-1"] } },
    {
      2: { card: "lemon-1", by: "me" },
      3: { card: "lemon-2", by: "me" },
    },
  );
  assert.deepEqual(partnerMove(blank, 1), { kind: "draw" });
  // With no pile, or a full hand, he plays his lowest card where it scores most.
  assert.deepEqual(partnerMove({ ...blank, pile: [] }, 1), { kind: "play", card: "rose-1", cup: 0 });
  const fullHand = KITTY_DECK.filter((card) => card.startsWith("rose") || card.startsWith("lemon"));
  assert.deepEqual(partnerMove({ ...blank, hands: { me: [], partner: fullHand } }, 1), {
    kind: "play",
    card: "rose-1",
    cup: 0,
  });
  // An empty hand draws.
  assert.deepEqual(partnerMove({ ...blank, hands: { me: [], partner: [] } }, 1), { kind: "draw" });
});

test("a game has his cheat moment about 60% of the time, at his turn once three cups are filled, where it can act", () => {
  const withMoment = Array.from({ length: 1000 }, (_, seed) => deal(seed, "me").cheat === "waiting").filter(Boolean);
  assert.ok(withMoment.length > 550 && withMoment.length < 650, `${withMoment.length} games in 1000`);
  const caught = Array.from({ length: 1000 }, (_, seed) => cheatCaught({ seed })).filter(Boolean).length;
  assert.ok(caught > 250 && caught < 350, `found out ${caught} times in 1000`);

  const two = { 0: { card: "rose-5", by: "me" }, 1: { card: "rose-4", by: "partner" } } as const;
  const three = { ...two, 4: { card: "sky-1", by: "me" } } as const;
  const base = {
    cheat: "waiting" as const,
    pile: ["mint-1" as const],
    hands: { me: ["lemon-1" as const], partner: ["sky-2" as const] },
  };
  for (const kind of ["nudge", "freeze", "extra", "calculate"] as ClawCheat[]) {
    assert.equal(cheatDue(laid(CUPS, base, two), kind), false, `${kind}: two cups are not enough`);
    assert.equal(cheatDue(laid(CUPS, base, three), kind), true, `${kind}: three are`);
    assert.equal(cheatDue(laid(CUPS, { ...base, turn: "me" }, three), kind), false, `${kind}: only on his turn`);
    assert.equal(cheatDue(laid(CUPS, { ...base, cheat: "done" }, three), kind), false, `${kind}: once a game`);
    assert.equal(cheatDue(laid(CUPS, { ...base, cheat: null }, three), kind), false, `${kind}: not in a game without`);
  }
  assert.equal(cheatDue(endCheat(laid(CUPS, base, three)), "freeze"), false);
  // Each needs what it changes: a swap that gains him something, a card on the pile, two hands, her play to take back.
  assert.equal(
    cheatDue(
      laid(CUPS, base, {
        0: { card: "rose-5", by: "partner" },
        4: { card: "sky-1", by: "partner" },
        5: { card: "sky-2", by: "partner" },
      }),
      "nudge",
    ),
    false,
  );
  assert.equal(cheatDue(laid(CUPS, { ...base, pile: [] }, three), "extra"), false);
  assert.equal(cheatDue(laid(CUPS, { ...base, hands: { me: [], partner: ["sky-2"] } }, three), "calculate"), false);
  assert.equal(cheatDue(laid(CUPS, base, three), "steady"), false, "her latest move was no play");
  assert.equal(cheatDue(laid(CUPS, { ...base, herLast: 4 }, three), "steady"), true);
});

test("each cheat changes the game as it says, and only the game's cups, hands and pile", () => {
  const cups = {
    0: { card: "rose-5", by: "me" },
    1: { card: "rose-4", by: "partner" },
    4: { card: "sky-1", by: "me" },
  } as const;
  const game = laid(
    CUPS,
    {
      cheat: "waiting",
      pile: ["mint-1", "mint-2"],
      hands: { me: ["lemon-1", "lemon-2"], partner: ["sky-2", "sky-3"] },
      herLast: 4,
    },
    cups,
  );

  // nudge: the swap that gains him most (her rose 5 leaves its rose cup, his rose 4 goes in), and Gotcha! undoes it.
  const pair = nudgeSwap(game);
  assert.deepEqual(pair, [0, 1]);
  const nudged = swapCups(game, ...pair!);
  assert.deepEqual(score(game), { me: 11, partner: 0 });
  assert.deepEqual(score(nudged), { me: 1, partner: 8 });
  assert.deepEqual(nudged.cups[0]!.played, { card: "rose-4", by: "partner" }, "each kitten keeps who played it");
  assert.deepEqual(swapCups(nudged, ...pair!), game, "Gotcha! puts them back");
  assert.throws(() => swapCups(game, 0, 2), RangeError, "only filled cups swap");
  assert.throws(() => swapCups(game, 0, 0), RangeError);
  // freeze: she swaps any two, and his noticing swaps them back; her latest play follows its kitten.
  const frozen = swapCups(game, 4, 0);
  assert.equal(frozen.herLast, 0);
  assert.deepEqual(swapCups(frozen, 4, 0), game);

  // extra: one card out of turn, burned into a full hand.
  const sneaked = sneakCard(game);
  assert.deepEqual(
    [sneaked.hands.me, sneaked.pile, sneaked.turn],
    [["lemon-1", "lemon-2", "mint-1"], ["mint-2"], "partner"],
  );
  const full = sneakCard({ ...game, hands: { ...game.hands, me: KITTY_DECK.slice(0, KITTY_HAND_MAX) } });
  assert.deepEqual([full.hands.me.length, full.burned, full.pile], [KITTY_HAND_MAX, ["mint-1"], ["mint-2"]]);
  assert.throws(() => sneakCard({ ...game, pile: [] }), RangeError);

  // calculate: one of his for one of hers, picked from the seed.
  const offer = tradeOffer(game);
  assert.deepEqual(tradeOffer(game), offer);
  assert.ok(game.hands.partner.includes(offer.his) && game.hands.me.includes(offer.hers));
  const traded = tradeCards(game, offer);
  assert.ok(traded.hands.me.includes(offer.his) && !traded.hands.me.includes(offer.hers));
  assert.ok(traded.hands.partner.includes(offer.hers) && !traded.hands.partner.includes(offer.his));
  assert.equal(traded.hands.me.length, 2);
  const offers = new Set(Array.from({ length: 50 }, (_, seed) => JSON.stringify(tradeOffer({ ...game, seed }))));
  assert.ok(offers.size > 1, "random cards, not always the first");
  assert.throws(() => tradeCards(game, { his: "mint-5", hers: offer.hers }), RangeError);

  // steady: her latest play back in her hand, the cup empty, and her turn again.
  const back = takeBack(game);
  assert.equal(back.cups[4]!.played, null);
  assert.deepEqual([back.hands.me, back.turn, back.herLast], [["lemon-1", "lemon-2", "sky-1"], "me", null]);
  assert.throws(() => takeBack(back), RangeError, "once");
  // Her latest move is remembered while it is a play: a draw after it leaves nothing to take back.
  const played = applyMove({ ...game, turn: "me", herLast: null }, { kind: "play", card: "lemon-1", cup: 2 });
  assert.equal(played.herLast, 2);
  assert.equal(applyMove({ ...played, turn: "me" }, { kind: "draw" }).herLast, null);

  for (const changed of [nudged, frozen, sneaked, traded, back]) {
    assert.equal(cardsIn(changed).length, cardsIn(game).length, "no card made or lost");
    assert.deepEqual([changed.seed, changed.first, changed.moves], [game.seed, game.first, game.moves]);
  }
});

// ── The finish, the record and memory ──

const RUN = "r-kitty-abcdef";
const KITTY_LINES = {
  start: ["START: Deal me in."],
  good: ["GOOD: Nice cup."],
  cheat: ["CHEAT: Look over there."],
  caught: ["CAUGHT: Fine, fine."],
  win: ["WIN: You got me."],
  lose: ["LOSE: My game."],
};

async function kittyWorld() {
  const t = await storyWorld({ runKey: RUN });
  // Kai cheats by nudging and has kitty lines; Mireille plays steady, from a pack written before Kitty Cards.
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: bible({ play: { style: "Careful.", cheat: "nudge" } }),
    lines: {
      stages: {},
      fixed: {
        comfort: [],
        claw: { cheer: ["c"], cheat: ["x"], win: ["w"], miss: ["m"], plush: ["p"] },
        kitty: KITTY_LINES,
        at: "2026-10-28T09:00:00.000Z",
      },
    },
  }));
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, MIR)), normalizeUnit, (unit) => ({
    ...unit,
    bible: bible({ play: { style: "Steady.", cheat: "steady" } }),
    lines: {
      stages: {},
      fixed: {
        comfort: [],
        claw: { cheer: ["c"], cheat: ["x"], win: ["w"], miss: ["m"], plush: ["p"] },
        at: "2026-10-28T09:00:00.000Z",
      },
    },
  }));
  const routes = new Map<string, RouteHandler>();
  registerKittyRoutes(
    {
      get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
    },
    { store: t.store, handle: createHandle(t.runtime.logger) },
  );
  let games = 0;
  const finish = async (body: Record<string, unknown> = {}) => {
    const handler = routes.get("POST /runs/:run/kitty/finish");
    assert.ok(handler, "the finish is registered");
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const request = {
      li: KAI,
      round: `k-test${(games += 1).toString(36)}-abcdef`,
      first: "me",
      result: "lose",
      me: 12,
      partner: 20,
      cheat: null,
      ...body,
    };
    const result = await handler(
      {
        method: "POST",
        url: "/runs/:run/kitty/finish",
        body: { timeZone: "UTC", debugMode: false, ...request },
        params: { run: RUN },
        query: {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
  return { ...t, finish };
}

test("every game pays 20 Starlight and 30 affection, a win 20 Starlight more, within the caps, with no model call", async () => {
  const t = await kittyWorld();
  const lost = await t.finish();
  assert.equal(lost.status, 200);
  assert.deepEqual(lost.body as KittyFinishResult, {
    grants: [
      { source: "kitty", starlight: 20 },
      { source: "kitty", li: KAI, affection: 30 },
    ],
    capped: false,
    replay: false,
    starlight: 2020,
  });
  const drawn = await t.finish({ result: "draw", me: 16, partner: 16 });
  assert.deepEqual(drawn.body.grants[0], { source: "kitty", starlight: 20 });
  const won = await t.finish({ result: "win", me: 30, partner: 4 });
  assert.deepEqual(won.body.grants, [
    { source: "kitty", starlight: 40 },
    { source: "kitty", li: KAI, affection: 30 },
  ]);
  assert.equal((await t.state()).lis[KAI]!.points, 90);
  assert.equal((await t.state()).wallet.starlight, 2080);

  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    daily: {
      ...state.daily,
      starlight: ACTIVITY_STARLIGHT_DAILY_CAP - 10,
      affection: { [KAI]: OUTSIDE_AFFECTION_DAILY_CAP - 5 },
    },
  }));
  const capped = await t.finish({ result: "win", me: 30, partner: 4 });
  assert.deepEqual(capped.body.grants, [
    { source: "kitty", starlight: 10 },
    { source: "kitty", li: KAI, affection: 5 },
  ]);
  assert.equal(capped.body.capped, true);
  const full = await t.finish();
  assert.deepEqual([full.status, full.body.grants, full.body.capped], [200, [], true], "a capped game still saves");
  assert.equal((await t.state()).kitty.rounds.length, 5);
  // Another love interest has his own affection cap.
  assert.deepEqual((await t.finish({ li: MIR })).body.grants, [{ source: "kitty", li: MIR, affection: 30 }]);
  assert.equal(t.calls.length, 0, "no model call");
});

test("a game is paid once: sent again, at the same time, or over a stale revision; another love interest is a 409", async () => {
  const t = await kittyWorld();
  const body = { round: "k-once1-abcdef", result: "win", me: 20, partner: 10 };
  const first = await t.finish(body);
  const again = await t.finish(body);
  assert.deepEqual([first.body.replay, again.body.replay], [false, true]);
  assert.deepEqual(again.body.grants, first.body.grants, "the same answer");
  assert.equal((await t.state()).wallet.starlight, 2040);
  // A replay answers from the record, whatever the body now says.
  assert.equal((await t.finish({ ...body, result: "lose", me: 1, partner: 2 })).body.replay, true);

  const both = await Promise.all([t.finish({ round: "k-once2-abcdef" }), t.finish({ round: "k-once2-abcdef" })]);
  assert.deepEqual(both.map((answer) => answer.body.replay).sort(), [false, true]);
  assert.equal((await t.state()).wallet.starlight, 2060);

  t.fake.interfere(stateId(t.runId), (data: any) => ({ ...data, wallet: { starlight: data.wallet.starlight + 1 } }));
  assert.equal((await t.finish({ round: "k-once3-abcdef" })).status, 200);
  assert.equal((await t.state()).wallet.starlight, 2060 + 1 + 20);
  assert.equal((await t.state()).kitty.rounds.length, 3);

  const other = await t.finish({ ...body, li: MIR });
  assert.deepEqual([other.status, other.body.code], [409, "conflict"]);
});

test("while his grievance with her stands a game pays nothing and is not counted; hers with others go on", async () => {
  const t = await kittyWorld();
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: {
      ...state.lis,
      [KAI]: {
        ...state.lis[KAI]!,
        grievances: [
          { id: "g-1", li: KAI, by: "li", text: "She lied.", severity: "rupture", opened: "main-1/2", status: "open" },
        ],
        rupture: { grievanceId: "g-1", since: "2026-10-28T09:00:00.000Z" },
      },
    },
  }));
  const before = await t.state();
  const refused = await t.finish();
  assert.deepEqual([refused.status, refused.body.code], [409, "locked"]);
  assert.deepEqual(await t.state(), before, "nothing paid or kept");
  assert.equal((await t.finish({ li: MIR })).status, 200);
});

test("the finish refuses a body these rules could not have ended in, and changes nothing", async () => {
  const t = await kittyWorld();
  const before = await t.state();
  const cases: Array<[Record<string, unknown>, number, string]> = [
    [{ result: "win", me: 10, partner: 20 }, 400, "a win with fewer points"],
    [{ result: "lose", me: 20, partner: 10 }, 400, "a loss with more"],
    [{ result: "draw", me: 10, partner: 11 }, 400, "a draw with unequal points"],
    [{ result: "win", me: 20, partner: 10 + 0.5 }, 400, "a fraction"],
    [{ result: "win", me: 81, partner: 0 }, 400, "more than 80"],
    [{ result: "lose", me: -1, partner: 0 }, 400, "fewer than 0"],
    [{ result: "tie" }, 400, "an unknown result"],
    [{ me: "12" }, 400, "points as text"],
    [{ cheat: { kind: "freeze", caught: false } }, 400, "a cheat that is not his"],
    [{ li: MIR, cheat: { kind: "steady", caught: true } }, 400, "a steady hand is never caught"],
    [{ cheat: { kind: "nudge" } }, 400, "a cheat without caught"],
    [{ cheat: undefined }, 400, "no cheat field"],
    [{ first: "both" }, 400, "who went first"],
    [{ round: "c-1-abcdef" }, 400, "a Claw round's id"],
    [{ li: "li-ghost-zz99" }, 404, "a love interest the run lacks"],
  ];
  for (const [body, status, label] of cases) {
    const answer = await t.finish(body);
    assert.equal(answer.status, status, label);
  }
  assert.deepEqual(await t.state(), before);
  // His own cheat, caught or not, and her result as its points make it, are fine.
  assert.equal((await t.finish({ cheat: { kind: "nudge", caught: true } })).status, 200);
  assert.equal((await t.finish({ li: MIR, cheat: { kind: "steady", caught: false } })).status, 200);
  assert.equal((await t.finish({ result: "win", me: 80, partner: 0 })).status, 200);
  assert.equal((await t.finish({ result: "draw", me: 0, partner: 0 })).status, 200);
});

test("each game is his private memory, in plain words: who went first, the score, who won, his cheat", async () => {
  const t = await kittyWorld();
  await t.finish({ result: "win", me: 24, partner: 18, cheat: { kind: "nudge", caught: true } });
  await t.finish({ first: "partner", result: "lose", me: 1, partner: 9, cheat: { kind: "nudge", caught: false } });
  await t.finish({ li: MIR, result: "draw", me: 12, partner: 12, cheat: { kind: "steady", caught: false } });
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: bible({ play: { style: "Sleepy.", cheat: "freeze" } }),
  }));
  await t.finish({ result: "lose", me: 2, partner: 3, cheat: { kind: "freeze", caught: true } });
  const sources = (await readMemorySources(t.store, t.runId)).filter((source) => source.id.startsWith("kitty:"));
  assert.deepEqual(
    sources.map((source) => [source.kind, source.audience]),
    [
      ["chat", [KAI]],
      ["chat", [KAI]],
      ["chat", [MIR]],
      ["chat", [KAI]],
    ],
  );
  assert.equal(sources[0]!.title, "Kitty Cards with Kai (private: only Kai and the protagonist know how it went)");
  assert.equal(
    sources[0]!.content,
    "Ines and Kai played Kitty Cards together, Ines going first. Kai cheated, swapping the kittens of two cups, and Ines caught it in time, so the kittens went back. Ines won, 24 points to 18.",
  );
  assert.equal(
    sources[1]!.content,
    "Ines and Kai played Kitty Cards together, Kai going first. Kai cheated, swapping the kittens of two cups, and Ines never caught it. Kai won, 9 points to 1.",
  );
  assert.equal(
    sources[2]!.content,
    "Ines and Mireille played Kitty Cards together, Ines going first. Mireille offered to let Ines take back a card and play it again. It was a draw, 12 points each.",
  );
  // A steady game sends no choice of hers, so his memory never claims she took the card back (she may have kept it).
  assert.doesNotMatch(sources[2]!.content, /Mireille let Ines take back|Ines took back/u);
  assert.match(
    sources[3]!.content,
    /Kai dozed off for a moment so Ines could swap two cups' kittens, then woke, noticed and swapped them back\./u,
  );
  for (const source of sources) assert.doesNotMatch(source.content, /\b(?:he|him|his|she|her)\b/iu, "no pronouns");
  // A game without his moment says nothing of one.
  await t.finish({ round: "k-plain1-abcdef" });
  const plain = (await readMemorySources(t.store, t.runId)).find((source) => source.id === "kitty:k-plain1-abcdef");
  assert.equal(plain!.content, "Ines and Kai played Kitty Cards together, Ines going first. Kai won, 20 points to 12.");
  assert.equal(t.calls.length, 0, "a game's memory is its own record: no model call");
});

test("the state keeps each love interest's newest games, trims older ones on read, and drops a damaged one", async () => {
  const t = await kittyWorld();
  await t.finish({ li: MIR });
  for (let index = 0; index <= CLAW_ROUNDS_KEPT; index += 1) await t.finish({ round: `k-keep${index}-abcdef` });
  const kept = (await t.state()).kitty.rounds;
  assert.equal(kept.filter((entry) => entry.li === KAI).length, CLAW_ROUNDS_KEPT, "his newest");
  assert.equal(kept.filter((entry) => entry.li === KAI)[0]!.id, "k-keep1-abcdef", "the oldest went");
  assert.equal(kept.filter((entry) => entry.li === MIR).length, 1, "Mireille's game is still hers");

  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    kitty: {
      rounds: [
        ...state.kitty.rounds,
        ...Array.from({ length: 3 }, (_, index): KittyRound => ({
          ...state.kitty.rounds.at(-1)!,
          id: `k-extra${index}-abcdef`,
        })),
        { ...state.kitty.rounds.at(-1)!, id: "k-broken-abcdef", me: 400 },
        { ...state.kitty.rounds.at(-1)!, id: "not-a-game" },
      ],
    },
  }));
  const trimmed = (await t.state()).kitty.rounds;
  assert.equal(trimmed.filter((entry) => entry.li === KAI).length, CLAW_ROUNDS_KEPT);
  assert.equal(trimmed.at(-1)!.id, "k-extra2-abcdef", "a damaged game reads as none");
  // A state from before Kitty Cards reads with none.
  assert.deepEqual(normalizeState({ lis: { [KAI]: {} } }).kitty, { rounds: [] });
});

test("the play view brings his kitty lines by the claw lines' rule: none from an older pack, a rupture or NSFW left", async () => {
  const t = await kittyWorld();
  const view = async () => {
    const run = (await readRun(t.store, t.runId))!;
    return playView(run.state, run.units, run.world.content, "2026-10-28");
  };
  const now = await view();
  assert.deepEqual(now.lis[KAI]!.lines, {
    claw: { cheer: ["c"], cheat: ["x"], win: ["w"], miss: ["m"], plush: ["p"] },
    cold: [],
    kitty: KITTY_LINES,
  });
  assert.deepEqual([now.lis[KAI]!.cheat, now.lis[MIR]!.cheat], ["nudge", "steady"], "how each cheats");
  assert.equal(
    "kitty" in now.lis[MIR]!.lines,
    false,
    "a pack from before Kitty Cards has none (the client's fallback)",
  );

  // An NSFW pack the world's settings no longer match serves neither his claw nor his kitty lines.
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    lines: { ...unit.lines!, fixed: { ...unit.lines!.fixed!, contract: "nsfw:0123456789ab" } },
  }));
  assert.deepEqual([(await view()).lis[KAI]!.lines.claw, "kitty" in (await view()).lis[KAI]!.lines], [null, false]);
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    lines: { ...unit.lines!, fixed: { ...unit.lines!.fixed!, contract: "home" } },
  }));
  // During a rupture, none.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, rupture: { grievanceId: "g-1", since: "2026-10-28" } } },
  }));
  const cold = await view();
  assert.equal(cold.lis[KAI]!.rupture, true);
  assert.equal("kitty" in cold.lis[KAI]!.lines, false);
  assert.equal(t.calls.length, 0);
});

// ── His lines ──

type Messages = CapabilityLanguageModelMessage[];
const systemOf = (messages: Messages) =>
  messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
const isKittyOnly = (messages: Messages) => systemOf(messages).includes("pre-written Kitty Cards lines of");
const nameOf = (messages: Messages) => /Kitty Cards lines of ([^,]+),/.exec(systemOf(messages))?.[1] ?? "Kai";
const some = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}.`);
const kittyReply = (name: string) =>
  Object.fromEntries(
    Object.entries(LINE_COUNTS.kitty).map(([kind, count]) => [kind, some(`${name} kitty ${kind}`, count)]),
  );
const times = (prefix: string) => ({ morning: some(prefix, 3), day: some(prefix, 3), night: some(prefix, 3) });
const packReply = () => ({
  tap: { head: times("head"), cheek: times("cheek"), heart: times("heart"), hand: times("hand") },
  annoyed: some("Enough", 4),
  cold: some("Cold", 6),
  comfort: some("Rest", 8),
  claw: {
    cheer: some("Go", 4),
    cheat: some("Tilt", 3),
    win: some("Won", 3),
    miss: some("Miss", 3),
    plush: some("Plush", 3),
  },
  kitty: kittyReply("Kai"),
});

test("a new fixed pack holds his kitty lines: six kinds by their counts, the pick rules, and a repair when one is short", () => {
  // P15 asks for them with the claw lines, in his cheat's words; a later stage's pack asks for none.
  const world = { ...normalizeWorld({}), language: "English", setting: "A harbour city." };
  const unit = { name: "Kai", pronouns: HE, bible: bible({ play: { style: "Careful.", cheat: "extra" } }) };
  const prompt = (withFixed: boolean) =>
    systemOf(
      linePackMessages({ world, player: { name: "Ines", pronouns: HE }, unit, stage: 1, withFixed }) as Messages,
    );
  assert.ok(prompt(true).includes("pre-written Home lines"), "still the Home pack the fakes detect");
  assert.match(
    prompt(true),
    /"plush": \["\.\.\."\]\}, "kitty": \{"start": \["\.\.\."\], "good": \["\.\.\."\], "cheat": \["\.\.\."\], "caught": \["\.\.\."\], "win": \["\.\.\."\], "lose": \["\.\.\."\]\}\}/,
  );
  assert.match(
    prompt(true),
    /- kitty: lines for Kitty Cards, [^\n]*start \(2, as a game begins\), good \(3, when the protagonist puts a kitten into a cup of its own colour\), cheat \(3, when Kai cheats by looking away so the protagonist can sneak an extra card\), caught \(2, when Kai turns back and catches the protagonist sneaking a card\), win \(3, when the protagonist wins\), lose \(3, when Kai wins\)\./,
  );
  assert.ok(!prompt(false).includes("kitty"), "a later stage's pack writes none");
  // The reply schema keeps them (an unknown key would be stripped before the check).
  assert.deepEqual(LinePackReplySchema.parse(packReply()).kitty, kittyReply("Kai"));

  const at = "2026-10-28T10:00:00.000Z";
  const content = defaultContent();
  const pack = normalizeLinePack(packReply(), { stage: 1, withFixed: true, at, content });
  assert.ok(typeof pack !== "string", String(pack));
  assert.deepEqual(LINE_COUNTS.kitty, { start: 2, good: 3, cheat: 3, caught: 2, win: 3, lose: 3 });
  for (const [kind, count] of Object.entries(LINE_COUNTS.kitty)) {
    assert.equal(pack.fixed!.kitty![kind as keyof typeof LINE_COUNTS.kitty].length, count, kind);
  }
  assert.equal(pack.fixed!.kitty!.lose[0], "Kai kitty lose 1.");
  const asks = packReply();
  asks.kitty.good = ["Nice cup?", "Good match.", "Double points.", "Clever."];
  assert.ok(
    typeof normalizeLinePack(asks, { stage: 1, withFixed: true, at, content }) !== "string",
    "one extra covers it",
  );
  asks.kitty.good = ["Nice cup?", "Good match.", "Double points."];
  assert.match(
    String(normalizeLinePack(asks, { stage: 1, withFixed: true, at, content })),
    /kitty\.good needs 3 distinct lines .* never ask a question \(got 2\)/,
  );
  const long = packReply();
  long.kitty.start[1] = "This line keeps going on and on far past the fourteen word limit that every line keeps.";
  assert.match(String(normalizeLinePack(long, { stage: 1, withFixed: true, at, content })), /kitty\.start needs 2/);
  assert.match(
    String(normalizeLinePack({ ...packReply(), kitty: null }, { stage: 1, withFixed: true, at, content })),
    /kitty\.start needs 2/,
    "a new pack without them gets the repair turn",
  );
});

/**
 * A forged world with the Claw routes (GET /play) and a background lane; Kai and Mireille hold pre-0.35.0 packs. The
 * kitty-lines calls take `kitty`'s replies in turn (then a fresh pack for whoever it is for); GET /play's plush calls get
 * a reply that is never kept.
 */
async function linesWorld(runKey: string, kitty: string[] = []) {
  const answer = (messages: Messages) => {
    if (!isKittyOnly(messages)) return "{}";
    return kitty.shift() ?? json({ kitty: kittyReply(nameOf(messages)) });
  };
  const t = await storyWorld({ runKey, replies: Array.from({ length: 80 }, () => answer) });
  const old = (name: string) => ({
    stages: {},
    fixed: {
      comfort: some(`${name} comfort`, 8),
      claw: { cheer: some("c", 4), cheat: some("x", 3), win: some("w", 3), miss: some("m", 3), plush: some("p", 3) },
      at: "2026-10-28T09:00:00.000Z",
    },
  });
  for (const [li, name, cheat] of [
    [KAI, "Kai", "nudge"],
    [MIR, "Mireille", "freeze"],
  ] as const) {
    await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({
      ...unit,
      bible: bible({ play: { style: "Careful.", cheat } }),
      lines: old(name),
    }));
  }
  const background = createBackgroundQueue(t.runtime);
  const routes = new Map<string, RouteHandler>();
  registerClawRoutes(
    { get: (path: string, handler: RouteHandler) => routes.set(path, handler), post: () => undefined } as never,
    { ...t.deps, background },
  );
  const play = async () => {
    let payload: unknown;
    const reply: OtomeReply = { status: () => reply, send: (value) => ((payload = value), reply) };
    const result = await routes.get("/runs/:run/play")!(
      { method: "GET", url: "", params: { run: runKey }, query: { timeZone: "UTC", debugMode: true } },
      reply,
    );
    return (result === reply ? payload : result) as { lis: Record<string, { lines: Record<string, unknown> }> };
  };
  const settle = async () => {
    for (let round = 0; round < 200; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      await runForeground(t.runId, async () => undefined);
    }
  };
  const unit = async (li: string) => (await t.store.readDoc(unitId(t.runId, li), normalizeUnit))!;
  const kittyCalls = () => t.calls.filter((entry) => isKittyOnly(entry.messages as Messages));
  return { ...t, background, play, settle, unit, kittyCalls, old };
}

test("GET /play writes only the kitty lines of a love interest whose fixed pack predates them, once, in the background", async () => {
  const t = await linesWorld("r-kittyl-aaaaaa");
  const before = await t.unit(KAI);
  // Sol has no fixed pack at all: his line-pack job (Home) writes the kitty lines with the rest, so none is queued here.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  t.background.ensure({ key: "blocker", connectionId: "conn-text", run: () => gate });
  const first = await t.play();
  assert.equal("kitty" in first.lis[KAI]!.lines, false, "GET /play never waits for them");
  await t.play();
  release();
  await t.settle();
  assert.equal(t.kittyCalls().length, 2, "one call each for Kai and Mireille, though GET /play was read twice");
  assert.ok(
    t.kittyCalls().every((entry) => entry.connectionId === "conn-text"),
    "on the structured job's connection (narration here)",
  );

  const kai = await t.unit(KAI);
  assert.deepEqual(kai.lines!.fixed!.kitty, kittyReply("Kai"));
  assert.deepEqual(kai.lines!.fixed!.comfort, before.lines!.fixed!.comfort, "comfort is untouched");
  assert.deepEqual(kai.lines!.fixed!.claw, before.lines!.fixed!.claw, "claw is untouched");
  assert.equal(kai.lines!.fixed!.at, before.lines!.fixed!.at);
  assert.equal((await t.unit(MIR)).lines!.fixed!.kitty!.start[0], "Mireille kitty start 1.");
  assert.equal((await t.unit(SOL)).lines, undefined, "Sol's pack is the line-pack job's to write");
  assert.deepEqual((await t.play()).lis[KAI]!.lines.kitty, kittyReply("Kai"), "served once kept");
  await t.settle();
  assert.equal(t.kittyCalls().length, 2, "lines already kept are never written again");

  // The prompt: his cheat, the six kinds and their counts, the rules, the SFW home contract, and no Home taps.
  const prompt = t.kittyCalls().find((entry) => nameOf(entry.messages as Messages) === "Kai")!.messages as Messages;
  const sent = systemOf(prompt);
  assert.match(
    sent,
    /\{"kitty": \{"start": \["\.\.\."\], "good": \["\.\.\."\], "cheat": \["\.\.\."\], "caught": \["\.\.\."\], "win": \["\.\.\."\], "lose": \["\.\.\."\]\}\}/,
  );
  assert.match(
    sent,
    /start \(2, as a game begins\), good \(3, [^)]*\), cheat \(3, when Kai cheats by secretly swapping the kittens of two filled cups/,
  );
  assert.match(sent, /caught \(2, when the protagonist catches Kai's swap/);
  assert.match(sent, /win \(3, when the protagonist wins\), lose \(3, when Kai wins\)/);
  assert.match(
    systemOf(t.kittyCalls().find((entry) => nameOf(entry.messages as Messages) === "Mireille")!.messages as Messages),
    /cheats by dozing off mid-game/,
  );
  assert.match(sent, new RegExp(`Every line is ${LINE_WORDS_MAX} words or fewer`));
  assert.match(sent, /no line has a question mark\./);
  assert.match(sent, /CONTENT CONTRACT[\s\S]*Heat: SFW\./);
  assert.ok(!/"tap"|- tap:|- comfort:|- claw:|touches/.test(sent), "nothing but the kitty lines");
  assert.match(prompt.at(-1)!.content, /Write Kai's Kitty Cards lines for stage 1 now\./);
  assert.ok(
    t.logs.some((entry) => entry.level === "debugOverride" && entry.args[0] === "kitty-lines"),
    "logged in debug mode",
  );
});

test("the kitty job keeps a pack's stamp true, waits out a failure, and never overwrites lines kept meanwhile", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-28T10:00:00.000Z") });
  // Kai's first reply asks a question in every good line: the repair turn is declined too, and nothing is kept.
  const bad = json({ kitty: { ...kittyReply("Kai"), good: ["Nice?", "Again?", "Really?"] } });
  const t = await linesWorld("r-kittyf-aaaaaa", [bad, bad]);
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, MIR)), normalizeUnit, (unit) => ({
    ...unit,
    lines: { stages: {}, fixed: null },
  }));
  await t.play();
  await t.settle();
  assert.equal(t.kittyCalls().length, 2, "the call and its repair turn");
  assert.match(t.kittyCalls()[1]!.messages.at(-1)!.content, /kitty\.good needs 3 distinct lines/);
  assert.equal((await t.unit(KAI)).lines!.fixed!.kitty, undefined);
  await t.play();
  await t.settle();
  assert.equal(t.kittyCalls().length, 2, "left alone within the cool-down");
  context.mock.timers.setTime(Date.parse("2026-10-28T10:00:00.000Z") + LINE_RETRY_MS + 1);
  await t.play();
  await t.settle();
  assert.equal(t.kittyCalls().length, 3, "tried again after it");
  assert.equal((await t.unit(KAI)).lines!.fixed!.kitty!.win[0], "Kai kitty win 1.");

  // Under NSFW Heat: an SFW pack's kitty lines are written SFW (its stamp says home), an NSFW pack's under its own.
  const explicit = { ...defaultContent(), heat: "explicit" as const };
  await t.store.updateDoc(runDocTarget("world", worldId(t.runId)), normalizeWorld, (world) => ({
    ...world,
    content: explicit,
  }));
  const reset = async (li: string, contract?: string) =>
    t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, li)), normalizeUnit, (unit) => ({
      ...unit,
      lines: {
        stages: {},
        fixed: { ...t.old(li === KAI ? "Kai" : "Mireille").fixed, ...(contract ? { contract } : {}) },
      },
    }));
  await reset(KAI);
  await reset(MIR, contentStamp(explicit));
  await t.play();
  await t.settle();
  const calls = t.kittyCalls().slice(3);
  assert.equal(calls.length, 2);
  const forName = (name: string) =>
    systemOf(calls.find((entry) => nameOf(entry.messages as Messages) === name)!.messages as Messages);
  assert.match(forName("Kai"), /CONTENT CONTRACT[\s\S]*Heat: SFW\./, "an SFW pack stays SFW in every line");
  assert.match(forName("Mireille"), /Heat: NSFW/, "an NSFW pack's lines follow its own settings");
  assert.equal((await t.unit(KAI)).lines!.fixed!.contract, undefined, "the stamp is unchanged");
  assert.equal((await t.unit(MIR)).lines!.fixed!.contract, contentStamp(explicit));

  // A pack the world's settings no longer serve is the line-pack job's to replace: no kitty job for it.
  await reset(KAI, "nsfw:0123456789ab");
  const deps = { ...t.deps, background: t.background };
  assert.deepEqual(await ensureKittyLines(deps, t.runId, [KAI, MIR], { debugMode: false }), [], "none queued");
  await t.play();
  await t.settle();
  assert.equal(t.kittyCalls().length, 5, "nothing written for a pack that may not be served");

  // Lines kept between the job's reply and its write (a new P15 pack, say) are never overwritten.
  await reset(KAI);
  const ours = { ...kittyReply("Kai"), start: ["Ours 1.", "Ours 2."] };
  const updateDoc = t.store.updateDoc;
  t.store.updateDoc = (async (...args: Parameters<typeof updateDoc>) => {
    t.store.updateDoc = updateDoc;
    await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
      ...unit,
      lines: { ...unit.lines!, fixed: { ...unit.lines!.fixed!, kitty: ours } },
    }));
    return updateDoc(...args);
  }) as typeof updateDoc;
  await t.play();
  await t.settle();
  assert.equal(t.kittyCalls().length, 6);
  assert.equal(t.store.updateDoc, updateDoc, "the job's write came after ours");
  assert.deepEqual((await t.unit(KAI)).lines!.fixed!.kitty, ours);
});

test("the catalog has a fallback for every kitty line kind and every cheat style, each a line a pack could hold", () => {
  const catalog: Record<string, string> = JSON.parse(
    readFileSync(
      new URL(
        "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/locales/en.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const prefix = "ui.otomeForge.fallback.kitty";
  const keys = Object.keys(catalog).filter((key) => key.startsWith(prefix));
  const styles: ClawCheat[] = ["steady", "nudge", "extra", "freeze", "calculate"];
  const cap = (word: string) => word[0]!.toUpperCase() + word.slice(1);
  const expected = [
    ...(["start", "good", "win", "lose"] as const).flatMap((kind) =>
      Array.from({ length: LINE_COUNTS.kitty[kind] }, (_, index) => `${prefix}${cap(kind)}${index + 1}`),
    ),
    ...styles.flatMap((style) => [1, 2].map((index) => `${prefix}Cheat${cap(style)}${index}`)),
    // Only these three can be caught (SH/kitty.ts); steady and calculate never show a caught line.
    ...(["nudge", "freeze", "extra"] as const).flatMap((style) =>
      [1, 2].map((index) => `${prefix}Caught${cap(style)}${index}`),
    ),
  ];
  assert.deepEqual([...keys].sort(), [...expected].sort());
  for (const key of keys) {
    const text = catalog[key]!;
    assert.ok(text.trim() && wordCount(text) <= LINE_WORDS_MAX, `${key}: ${LINE_WORDS_MAX} words or fewer`);
    assert.ok(!/[?？¿؟]/u.test(text), `${key}: no question`);
    assert.ok(!/\b(?:he|him|his|she|her|hers|they|them|their)\b/i.test(text), `${key}: no pronoun for anyone`);
  }
});

// ── The cards' art, and their painted kittens ──

const BREEDS: Record<string, string[]> = {
  rose: ["Scottish Fold", "Ragdoll", "Persian", "Sphynx", "Turkish Angora"],
  sky: ["Russian Blue", "Siamese", "British Shorthair", "Birman", "Devon Rex"],
  lemon: ["Orange Tabby", "Maine Coon", "Abyssinian", "Bengal", "Exotic Shorthair"],
  mint: ["Norwegian Forest Cat", "Munchkin", "Tuxedo", "Japanese Bobtail", "Egyptian Mau"],
};

test("the cards: twenty transparent kittens in the package, one per card, each named for its breed", () => {
  const dir = new URL("../packages/otome-forge/kitty/", import.meta.url);
  assert.deepEqual(
    readdirSync(dir).sort(),
    KITTY_DECK.map((card) => `${card}.webp`).sort(),
    "one file per card, nothing else",
  );
  const catalog: Record<string, string> = JSON.parse(
    readFileSync(
      new URL(
        "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/locales/en.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const card of KITTY_DECK) {
    const file = new URL(`${card}.webp`, dir);
    assert.ok(existsSync(file), `${card}'s kitten is in the package`);
    const bytes = readFileSync(file);
    // RIFF....WEBPVP8X with the alpha flag: a WebP with transparency, as the cut-out kittens beside them are.
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "RIFF", card);
    assert.equal(bytes.subarray(8, 16).toString("latin1"), "WEBPVP8X", card);
    assert.ok((bytes[20]! & 0x10) !== 0, `${card} is transparent`);
    const [colour, value] = card.split("-") as [string, string];
    assert.equal(catalog[KITTY_BREED_KEYS[card]], BREEDS[colour]![Number(value) - 1], `${card}'s breed`);
  }
  assert.equal(new Set(Object.values(KITTY_BREED_KEYS)).size, KITTY_DECK.length, "a key of its own for each card");
  assert.equal(catalog["ui.otomeForge.kitty.asKitten"], "{{name}} as a kitten");
  // Fetched from the Engine's package assets, the version making an update's art a new URL.
  assert.equal(
    kittyCardUrl("rose-5", "0.35.0"),
    "/api/capability-packages/otome-forge/assets/kitty/rose-5.webp?v=0.35.0",
  );
  assert.equal(kittyCardUrl("mint-1", null), "/api/capability-packages/otome-forge/assets/kitty/mint-1.webp");
  // The committed manifest serves each one (else the Engine answers 404) and pins its bytes.
  const manifest = JSON.parse(readFileSync(new URL("../packages/otome-forge/manifest.json", import.meta.url), "utf8"));
  const served = new Set<string>(manifest.contributions?.assets?.paths ?? []);
  const pinned = new Map<string, number>(
    manifest.files.map((file: { path: string; bytes: number }) => [file.path, file.bytes]),
  );
  for (const card of KITTY_DECK) {
    const path = `kitty/${card}.webp`;
    assert.ok(served.has(path), `${path} is served (manifest contributions.assets.paths)`);
    assert.equal(pinned.get(path), readFileSync(new URL(`${card}.webp`, dir)).length, `${path} is pinned in files[]`);
  }
});

test("the kittens take rose 5 (hers), sky 5 (his), lemon and mint 5 (the next two after him who have one)", () => {
  const shown = (owner: string): KittenView => ({ owner, url: `/k/${owner}.png` });
  const cast: KittenView[] = [
    shown("player"),
    shown("li-a-0001"),
    shown("li-b-0002"),
    { owner: "li-c-0003", art: { state: "waiting-consent", at } },
    shown("li-d-0004"),
  ];
  const owners = (li: string, kittens = cast) =>
    Object.fromEntries(Object.entries(kittenCards(kittens, li)).map(([card, kitten]) => [card, kitten!.owner]));
  assert.deepEqual(KITTEN_CARDS, ["rose-5", "sky-5", "lemon-5", "mint-5"]);
  // With B: C has none yet, so D and then A (round to the start of the cast).
  assert.deepEqual(owners("li-b-0002"), {
    "rose-5": "player",
    "sky-5": "li-b-0002",
    "lemon-5": "li-d-0004",
    "mint-5": "li-a-0001",
  });
  assert.deepEqual(kittenCards(cast, "li-a-0001")["rose-5"], { owner: "player", url: "/k/player.png" });
  // His own still waiting: sky 5 keeps its breed; so does rose 5 without hers, and every card with none at all.
  assert.deepEqual(owners("li-c-0003"), { "rose-5": "player", "lemon-5": "li-d-0004", "mint-5": "li-a-0001" });
  assert.deepEqual(owners("li-a-0001", cast.slice(1)), {
    "sky-5": "li-a-0001",
    "lemon-5": "li-b-0002",
    "mint-5": "li-d-0004",
  });
  assert.deepEqual(kittenCards([], KAI), {});
});

test("the kitten prompt: a chibi kitten on the look's matte, with her colours and accessories, kept safe on an edit", async () => {
  const t = await artWorld({ runKey: "r-kitprompt-aaaaaa" });
  const world = (await readRun(t.store, t.runId))!.world;
  const style = { styleText: "soft watercolor", positiveTags: "pastel", negativeTags: "blurry" };
  const input = {
    name: "Kai",
    identityLine: "tall man, green eyes, black hair",
    outfitLine: "navy coat, silver earring",
    presentation: "man" as const,
    world,
    style,
  };
  const built = kittenPrompt(input);
  assert.ok(built.prompt.startsWith("soft watercolor, Kai as a kitten, a cat breed whose fur and eyes echo"));
  assert.ok(built.prompt.includes("Kai's look: tall man, green eyes, black hair; navy coat, silver earring"));
  assert.ok(built.prompt.includes(KITTEN_FRAMING), built.prompt);
  assert.match(built.prompt, /plain flat solid chroma magenta #FF00FF background/, "green and blue are named: magenta");
  // A person-less picture's tags at SFW, and the adult and rating negatives every picture keeps.
  assert.match(built.prompt, /safe for work, fully clothed, adults only/);
  assert.match(built.prompt, /use it only for Kai's colours/, "the avatar reference is for colours only");
  assert.match(built.negativePrompt, /^human, humanoid, person/);
  assert.match(built.negativePrompt, /child, childlike, minor, underage/);
  assert.match(built.negativePrompt, /nudity, nsfw/);
  assert.match(built.negativePrompt, /cast shadow/, "the matte's negatives");
  assert.match(built.negativePrompt, /blurry/);
  // Above SFW it stays a clothed, never explicit, picture.
  const explicit = { ...world, images: { ...world.images, rating: "explicit" as const } };
  const above = kittenPrompt({ ...input, world: explicit });
  assert.match(above.prompt, /clothed, adults only/);
  assert.doesNotMatch(above.prompt, /explicit/);
  assert.match(above.negativePrompt, /child, childlike, minor, underage, school uniform, nudity, explicit sexual/);
  // An edit keeps its wording and gets every required tag back; a tag profile gets no sentence about the reference.
  const edited = kittenPrompt(input, { prompt: "a kitten in a navy coat", negativePrompt: "text" });
  assert.match(edited.prompt, /^a kitten in a navy coat, safe for work, fully clothed, adults only$/);
  assert.match(edited.negativePrompt, /^text, child, childlike, minor/);
  assert.doesNotMatch(kittenPrompt({ ...input, style: { ...style, tagged: true } }).prompt, /reference picture/);
  assert.doesNotMatch(kittenPrompt({ ...input, identityLine: "", outfitLine: "" }).prompt, /Kai's look:/);
});

/** A free cut-out that lands at once, or (held, or from `hold()` on) once `release()` is called. */
function freeCutouts(held: boolean) {
  let release = () => {};
  let gate = Promise.resolve();
  const hold = () => {
    gate = new Promise<void>((resolve) => (release = resolve));
  };
  if (held) hold();
  const calls: string[] = [];
  const client: CutoutClient = {
    async cutOut(url) {
      calls.push(url);
      await gate;
      return { url: `${url}.cut.png`, id: `cut-${url.length}` };
    },
    deleteGalleryImage: async () => true,
  };
  return { client, calls, hold, release: () => release() };
}

/** The art world with GET /play, the art routes and the Album, the art service and free cut-outs. */
async function kittenWorld(
  runKey: string,
  {
    ask = false,
    held = false,
    before,
    engineDeletes,
  }: Pick<Parameters<typeof artWorld>[0], "before" | "engineDeletes"> & { ask?: boolean; held?: boolean } = {},
) {
  const t = await artWorld({ runKey, images: { ask }, before, engineDeletes });
  const cut = freeCutouts(held);
  const deps = { ...t.deps, cutouts: cut.client };
  const full = { ...deps, art: createOtomeArt(deps) };
  const play = routesOf(registerClawRoutes, full, runKey);
  const arts = routesOf(registerArtRoutes, full, runKey);
  const albumRoutes = routesOf(registerAlbumRoutes, full, runKey);
  const view = async (query: object = {}) => {
    const result = await play("GET", "/runs/:run/play", query);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body as PlayView;
  };
  /** GET /runs/:run/album's kittens (0.36.0). */
  const album = async () => {
    const result = await albumRoutes("GET", "/runs/:run/album");
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.kittens as KittenView[];
  };
  /** Reads the play view until no kitten may land without a tap (each read starts what is owed). */
  const settle = async () => {
    for (let round = 0; round < 80; round += 1) {
      const shown = await view();
      await cutoutsSettled();
      if (!shown.kittensPending) return;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.fail("the kittens never settled");
  };
  const kittenPaints = () => t.paid.filter((call) => call.request.prompt.includes(KITTEN_FRAMING));
  const record = async (owner: string) =>
    owner === "player"
      ? (await t.store.readDoc(playerId(t.runId), normalizePlayer))!.kitten
      : (await t.store.readDoc(unitId(t.runId, owner), normalizeUnit))!.kitten;
  const states = async () =>
    Promise.all(["player", KAI, MIR, SOL].map(async (owner) => (await record(owner))?.state ?? null));
  return { ...t, cut, arts, view, album, settle, kittenPaints, record, states };
}

test("images on: GET /play paints her kitten and each of theirs, one at a time in the low lane, shown once cut out", async () => {
  const t = await kittenWorld("r-kitten-aaaaaa");
  let live = 0;
  let most = 0;
  const original = t.images.generatePortrait;
  t.images.generatePortrait = async (request) => {
    live += 1;
    most = Math.max(most, live);
    await new Promise((resolve) => setTimeout(resolve, 5));
    live -= 1;
    return original(request);
  };
  // In the low lane: a scene paint queued while the connection is busy goes before her kitten.
  const order: string[] = [];
  let release!: () => void;
  const busy = paintSlot("conn-image", () => new Promise<void>((resolve) => (release = resolve)), "high");
  // Released however this ends: a lane left busy would hold back every later paint in this file.
  try {
    const first = await t.view();
    assert.deepEqual(
      first.kittens!.map((kitten) => kitten.owner),
      ["player", KAI, MIR, SOL],
      "hers, then the cast in order",
    );
    assert.equal(first.kittensPending, true);
    await until(async () => (await t.record("player"))?.state === "pending", "her kitten waits for the lane");
    const scene = paintSlot("conn-image", async () => void order.push("scene"), "high");
    const paint = t.images.generatePortrait;
    t.images.generatePortrait = async (request) => (order.push("kitten"), paint(request));
    // While it waits, more reads claim nothing else: a restart now would stop this one kitten only.
    await Promise.all([t.view(), t.view(), t.view()]);
    for (let round = 0; round < 100; round += 1) await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(await t.states(), ["pending", null, null, null], "one kitten in flight per run");
    release();
    await scene;
  } finally {
    release();
  }
  await busy;
  await t.settle();
  assert.deepEqual(order, ["scene", "kitten", "kitten", "kitten", "kitten"]);
  assert.equal(most, 1);
  // Each through the portrait path (the avatar as the likeness reference), square, as a kitten of that person.
  const paints = t.kittenPaints();
  assert.deepEqual(
    paints.map((call) => [call.method, call.request.name, call.request.width, call.request.height]),
    ["Ines", "Kai", "Mireille", "Sol"].map((name) => ["generatePortrait", name, 1024, 1024]),
  );
  assert.ok(
    paints.every((call, index) =>
      call.request.prompt.includes(`${["Ines", "Kai", "Mireille", "Sol"][index]} as a kitten`),
    ),
  );
  // Shown cut out; more reads paint nothing more.
  const shown = await t.view();
  assert.equal(shown.kittensPending, undefined);
  assert.ok(
    shown.kittens!.every((kitten) => kitten.url?.endsWith(".cut.png") && !kitten.art),
    JSON.stringify(shown),
  );
  await t.settle();
  assert.equal(t.kittenPaints().length, 4);
});

test("a kitten shows only once its cut-out settles; with images off there are none and nothing is painted", async () => {
  const t = await kittenWorld("r-kitcut-aaaaaa", { held: true });
  try {
    await t.view();
    await until(async () => (await t.states()).every((state) => state === "ready"), "every kitten is painted");
    const held = await t.view();
    assert.equal(held.kittensPending, true, "the client reads again");
    assert.ok(
      held.kittens!.every((kitten) => !kitten.url && kitten.art?.state === "pending"),
      "painted, not cut out yet: painting",
    );
  } finally {
    t.cut.release();
  }
  await t.settle();
  assert.ok((await t.view()).kittens!.every((kitten) => kitten.url?.endsWith(".cut.png")));

  const u = await kittenWorld("r-kitoff-aaaaaa");
  await setImages(u.store, u.runId, { connectionId: null });
  const off = await u.view();
  assert.deepEqual(["kittens" in off, "kittensPending" in off], [false, false]);
  await u.settle();
  assert.deepEqual([await u.states(), u.paid.length], [[null, null, null, null], 0]);
});

test("Ask before painting or prompt review leaves every kitten waiting for the tap, which paints once", async () => {
  const t = await kittenWorld("r-kitask-aaaaaa", { ask: true });
  await t.settle();
  assert.deepEqual(await t.states(), ["waiting-consent", "waiting-consent", "waiting-consent", "waiting-consent"]);
  assert.equal(t.paid.length, 0, "nothing paid before the tap");
  const waiting = await t.view();
  assert.deepEqual(
    waiting.kittens!.map((kitten) => kitten.art?.state),
    ["waiting-consent", "waiting-consent", "waiting-consent", "waiting-consent"],
    "Paint our kittens (4 images)",
  );
  const prompt = await t.arts("POST", "/runs/:run/art/kitten/prompt", { owner: KAI });
  assert.ok(prompt.body.prompt.includes(KITTEN_FRAMING), JSON.stringify(prompt.body));
  const [one, two] = await Promise.all([
    t.arts("POST", "/runs/:run/art/kitten", { owner: KAI }),
    t.arts("POST", "/runs/:run/art/kitten", { owner: KAI }),
  ]);
  assert.deepEqual([one.body.art.state, two.body.art.state], ["ready", "ready"]);
  assert.equal(t.kittenPaints().length, 1, "two taps pay once");
  const again = await t.arts("POST", "/runs/:run/art/kitten", { owner: KAI });
  assert.deepEqual([again.body.art.state, t.kittenPaints().length], ["ready", 1], "a painted kitten is not repainted");
  assert.equal((await t.arts("POST", "/runs/:run/art/kitten", { owner: "li-nobody-zz99" })).status, 404);
  await setImages(t.store, t.runId, { connectionId: null });
  const off = await t.arts("POST", "/runs/:run/art/kitten", { owner: "player" });
  assert.deepEqual([off.status, (await t.record("player"))!.state], [503, "waiting-consent"]);
  assert.equal(t.paid.length, 1);

  // Review mode from a GET does the same with Ask off.
  const u = await kittenWorld("r-kitreview-aaaaaa");
  await u.view({ reviewImagePrompts: "true" });
  await until(async () => !!(await u.record("player")), "her kitten is claimed");
  assert.equal((await u.record("player"))!.state, "waiting-consent");
  assert.equal(u.paid.length, 0);
});

test("a failed kitten rests the chain and waits for Try again; a restart's paint reads as stopped", async () => {
  const t = await kittenWorld("r-kitfail-aaaaaa");
  const original = t.images.generatePortrait;
  let tries = 0;
  t.images.generatePortrait = async (request) => {
    tries += 1;
    await original(request);
    throw new Error("the image connection is down");
  };
  await t.settle();
  await Promise.all([t.view(), t.view(), t.view()]);
  await t.settle();
  assert.equal(tries, 1, "one kitten fails, not every one owed");
  assert.deepEqual(await t.states(), ["failed", null, null, null]);
  const rested = await t.view();
  assert.deepEqual([rested.kittensPending, rested.kittens![0]!.art?.state], [undefined, "failed"]);
  t.images.generatePortrait = original;
  const retry = await t.arts("POST", "/runs/:run/art/kitten", { owner: "player" });
  assert.equal(retry.body.art.state, "ready");
  assert.deepEqual([t.kittenPaints().length, (await t.states()).slice(1)], [2, [null, null, null]]);

  // A paint left pending by a restart reads as stopped and is never painted again by itself.
  const u = await kittenWorld("r-kitstop-aaaaaa");
  await u.store.updateDoc(runDocTarget("unit", unitId(u.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    kitten: { state: "pending", at },
  }));
  await u.settle();
  assert.deepEqual(await u.states(), ["ready", "pending", "ready", "ready"]);
  assert.equal((await u.view()).kittens!.find((kitten) => kitten.owner === KAI)!.art?.state, "stopped");
  assert.equal(u.kittenPaints().length, 3);
});

test("a kitten claim that does not stay ends the chain instead of claiming that kitten again", async () => {
  const t = await kittenWorld("r-kitlost-aaaaaa");
  // Her document keeps no kitten record (as one dropped on read would): each claim of hers is lost.
  const updateDoc = t.store.updateDoc.bind(t.store);
  let claims = 0;
  let on = true;
  t.store.updateDoc = ((target, normalize, change, options) =>
    updateDoc(
      target,
      normalize,
      async (current) => {
        const next = (await change(current)) as { kitten?: unknown };
        if (target.id !== playerId(t.runId) || !next.kitten) return next as typeof current;
        claims += 1;
        // Without the chain's guard it would claim her forever: stop it, so the test fails instead of hanging.
        if (claims > 3) on = false;
        const { kitten: _lost, ...rest } = next;
        return rest as typeof current;
      },
      options,
    )) as typeof t.store.updateDoc;
  const chain = queueKittens(t.deps, t.runId, { debugMode: false, active: () => on });
  const ended = await Promise.race([chain.then(() => true), new Promise((resolve) => setTimeout(resolve, 500, false))]);
  on = false;
  await chain;
  assert.deepEqual([ended, claims, t.paid.length], [true, 1, 0], "claimed once, and nothing paid");
});

// ── 0.36.0: the Album's Kittens and their Repaint ──

/** A kitten as a view lists it: [url, its paint's state], or null when it is not listed. */
const listed = (kittens: readonly KittenView[] | undefined, owner: string) => {
  const kitten = kittens?.find((entry) => entry.owner === owner);
  return kitten ? [kitten.url ?? null, kitten.art?.state ?? null] : null;
};
const settleTicks = async () => {
  for (let round = 0; round < 50; round += 1) await new Promise((resolve) => setImmediate(resolve));
};

test("the Album's kittens are the play view's painted, cut-out ones, hers then the cast's; reading it queues nothing", async () => {
  const t = await kittenWorld("r-kitalbum-aaaaaa", { held: true });
  // Before Kitty Cards was ever opened: none, and reading the Album claims, paints and cuts out nothing.
  assert.deepEqual(await Promise.all([t.album(), t.album(), t.album()]), [[], [], []]);
  await settleTicks();
  assert.deepEqual([await t.states(), t.paid.length, t.cut.calls.length], [[null, null, null, null], 0, 0]);
  try {
    await t.view();
    await until(async () => (await t.states()).every((state) => state === "ready"), "every kitten is painted");
    assert.deepEqual(await t.album(), [], "painted, not cut out yet: not listed");
  } finally {
    t.cut.release();
  }
  await t.settle();
  const shown = (await t.view()).kittens!;
  const kittens = await t.album();
  assert.deepEqual(
    kittens.map((kitten) => kitten.owner),
    ["player", KAI, MIR, SOL],
    "hers, then the cast in order",
  );
  assert.deepEqual(kittens, shown, "the play view's own kittens, with the same urls");
  assert.ok(
    kittens.every((kitten) => kitten.url?.endsWith(".cut.png") && !kitten.art),
    JSON.stringify(kittens),
  );

  // A newly painted kitten whose cut-out nothing has queued: the Album neither lists it nor queues its cut-out.
  const calls = t.cut.calls.length;
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, SOL)), normalizeUnit, (unit) => ({
    ...unit,
    kitten: { state: "ready", at, url: "/api/global-gallery/file/sol-kitten-new.png" },
  }));
  assert.deepEqual(
    (await t.album()).map((kitten) => kitten.owner),
    ["player", KAI, MIR],
  );
  await settleTicks();
  assert.equal(t.cut.calls.length, calls, "the Album queued no cut-out");
  assert.equal(t.paid.length, 4, "nor any paint");

  // With images off there are none.
  await setImages(t.store, t.runId, { connectionId: null });
  assert.deepEqual(await t.album(), []);
});

test("the Album's Repaint paints a painted kitten again: the old one shows until the new one is cut out, and stays on a failure", async () => {
  let fails = false;
  let hold: Promise<void> | undefined;
  const t = await kittenWorld("r-kitrepaint-aaaaaa", {
    engineDeletes: true,
    before: async () => {
      await hold;
      if (fails) throw new Error("provider down");
    },
  });
  await t.settle();
  const first = (await t.record(KAI))!;
  assert.equal(first.state, "ready");
  const old = `${first.url}.cut.png`;
  const inPlay = async () => listed((await t.view()).kittens, KAI);
  const inAlbum = async () => listed(await t.album(), KAI);
  assert.deepEqual(
    [await inPlay(), await inAlbum()],
    [
      [old, null],
      [old, null],
    ],
  );
  const paid = t.kittenPaints().length;
  const deleted = t.deleted.length;

  // In the low lane: a scene paint queued while the connection is busy goes first.
  const order: string[] = [];
  const paint = t.images.generatePortrait;
  t.images.generatePortrait = async (request) => (order.push("kitten"), paint(request));
  let free!: () => void;
  const busy = paintSlot("conn-image", () => new Promise<void>((resolve) => (free = resolve)), "high");
  let release = () => {};
  hold = new Promise<void>((resolve) => (release = resolve));
  let tap: ReturnType<typeof t.arts> | undefined;
  let scene: Promise<void> | undefined;
  // Released however this ends: a lane left busy would hold back every later paint in this file.
  try {
    tap = t.arts("POST", "/runs/:run/art/kitten", { owner: KAI, repaint: true });
    await until(async () => (await t.record(KAI))?.state === "pending", "the repaint is claimed");
    // Claimed in its document before the paid call, keeping the picture it paints over.
    assert.equal((await t.record(KAI))!.url, first.url);
    // Its paint is in its lane before the scene's is queued.
    await settleTicks();
    scene = paintSlot("conn-image", async () => void order.push("scene"), "high");
    free();
    await until(() => order.length === 2, "the scene and the kitten start");
    assert.deepEqual(order, ["scene", "kitten"]);
    await until(() => t.kittenPaints().length > paid, "the repaint is paid for");
    assert.deepEqual(await inPlay(), [old, "pending"], "Kitty Cards' card keeps the old kitten while it paints");
    assert.deepEqual(await inAlbum(), [old, "pending"]);
  } finally {
    free();
    hold = undefined;
    release();
  }
  await Promise.all([busy, scene]);
  // Its new picture is cut out after it is saved (queued by the tap itself): held here, so the old one still shows.
  t.cut.hold();
  let repainted: { state: string; url: string };
  try {
    repainted = (await tap!).body.art;
    assert.equal(repainted.state, "ready", JSON.stringify(repainted));
    assert.notEqual(repainted.url, first.url);
    assert.equal(t.kittenPaints().length, paid + 1, "a repaint is one more image");
    assert.deepEqual(await inAlbum(), [old, "pending"], "the Album shows it painting over the old one");
    assert.deepEqual(await inPlay(), [old, "pending"]);
    assert.deepEqual(
      t.deleted.slice(deleted),
      [first.ref!.slice("global-gallery:".length)],
      "the old original goes; its cut-out stays",
    );
  } finally {
    t.cut.release();
  }
  await cutoutsSettled();
  // The Album alone (it queues nothing) shows the new one once cut out.
  assert.deepEqual(await inAlbum(), [`${repainted.url}.cut.png`, null]);
  assert.deepEqual(await inPlay(), [`${repainted.url}.cut.png`, null]);

  // A failed repaint keeps the kitten it painted over, shown as painted everywhere (Repaint again), deleting nothing.
  fails = true;
  const failed = (await t.arts("POST", "/runs/:run/art/kitten", { owner: KAI, repaint: true })).body.art;
  assert.deepEqual([failed.state, failed.url], ["failed", repainted.url]);
  assert.deepEqual(
    [await inAlbum(), await inPlay()],
    [
      [`${repainted.url}.cut.png`, null],
      [`${repainted.url}.cut.png`, null],
    ],
  );
  assert.equal(t.deleted.length, deleted + 1);
  // Kitty Cards' own tap (Paint our kittens, Try again) never repaints one, not even after a failed repaint.
  fails = false;
  const count = t.paid.length;
  const asIs = (await t.arts("POST", "/runs/:run/art/kitten", { owner: KAI })).body.art;
  assert.deepEqual([asIs.state, asIs.url, t.paid.length], ["failed", repainted.url, count]);
  const her = (await t.arts("POST", "/runs/:run/art/kitten", { owner: "player" })).body.art;
  assert.deepEqual([her.state, t.paid.length], ["ready", count], "a painted kitten is answered as it is");
  // The Album's Repaint again: the new one replaces it.
  const again = (await t.arts("POST", "/runs/:run/art/kitten", { owner: KAI, repaint: true })).body.art;
  assert.equal(again.state, "ready");
  assert.equal(t.paid.length, count + 1);
  await cutoutsSettled();
  assert.deepEqual(await inAlbum(), [`${again.url}.cut.png`, null]);

  // Without images nothing repaints, and the Album lists none.
  await setImages(t.store, t.runId, { connectionId: null });
  const off = await t.arts("POST", "/runs/:run/art/kitten", { owner: KAI, repaint: true });
  assert.deepEqual([off.status, (await t.record(KAI))!.url, t.paid.length], [503, again.url, count + 1]);
  assert.deepEqual(await t.album(), []);
});

test("the Album's Repaint is its own consent, keeps a reviewed prompt, and paints one kitten at a time, once per tap", async () => {
  const t = await kittenWorld("r-kitrepaint2-aaaaaa");
  await t.settle();
  // Under Ask before painting the tap is the consent.
  await setImages(t.store, t.runId, { ask: true });
  let live = 0;
  let most = 0;
  const original = t.images.generatePortrait;
  t.images.generatePortrait = async (request) => {
    live += 1;
    most = Math.max(most, live);
    await new Promise((resolve) => setTimeout(resolve, 5));
    live -= 1;
    return original(request);
  };
  const before = (await t.record(KAI))!.url;
  const paid = t.paid.length;
  const [kai, again, mir] = await Promise.all([
    t.arts("POST", "/runs/:run/art/kitten", { owner: KAI, repaint: true }),
    t.arts("POST", "/runs/:run/art/kitten", { owner: KAI, repaint: true }),
    t.arts("POST", "/runs/:run/art/kitten", { owner: MIR, repaint: true }),
  ]);
  assert.deepEqual([kai.body.art.state, again.body.art.state, mir.body.art.state], ["ready", "ready", "ready"]);
  assert.equal(again.body.art.url, kai.body.art.url, "a second tap while it paints takes that same paint");
  assert.notEqual(kai.body.art.url, before);
  assert.equal(t.paid.length, paid + 2, "two kittens, two images");
  assert.equal(most, 1, "one at a time");
  // Prompt review: the prompt shown for the review, and the edited one sent, keeping the kitten's required tags.
  const prompt = await t.arts("POST", "/runs/:run/art/kitten/prompt", { owner: KAI });
  assert.ok(prompt.body.prompt.includes(KITTEN_FRAMING), JSON.stringify(prompt.body));
  const edited = await t.arts("POST", "/runs/:run/art/kitten", {
    owner: KAI,
    repaint: true,
    prompt: "a kitten in a navy coat",
    negativePrompt: "text",
  });
  assert.equal(edited.body.art.state, "ready");
  const sent = t.paid.at(-1)!.request;
  assert.match(sent.prompt, /^a kitten in a navy coat, safe for work, fully clothed, adults only$/);
  assert.match(sent.negativePrompt ?? "", /^text, child, childlike, minor/);
  assert.equal(t.paid.length, paid + 3);
});
