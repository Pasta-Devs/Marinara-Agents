// Otome Hearth's Kitty Cards (0.35.0). The rules are pure and deterministic for a seed: the deal's shape, the
// scoring, a card burned into a full hand, both ways a game ends and the turn skipping a player who cannot act, his move
// (always legal, the same for the same seed, his second best a quarter of the time, a draw when nothing scores) and
// each cheat's change to the game. The finish pays 20 Starlight and 30 affection a game and 20 more for a win, within
// the day's caps, once per game id (a replay, a 409 with another love interest), nothing while his grievance with her
// stands, and refuses a body these rules could not end in; it costs no model call. Each game is his private memory, in
// plain words; the state keeps each love interest's newest games; the play view brings his kitty lines by the claw
// lines' content rule, and none during a rupture.
import assert from "node:assert/strict";
import test from "node:test";
import type { ClawCheat } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { CLAW_ROUNDS_KEPT } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/claw.ts";
import {
  ACTIVITY_STARLIGHT_DAILY_CAP,
  OUTSIDE_AFFECTION_DAILY_CAP,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
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
  type KittyCard,
  type KittyCupColour,
  type KittyFinishResult,
  type KittyGame,
  type KittyMove,
  type KittyRound,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/kitty.ts";
import { mulberry32 } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/claw-physics.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  stateId,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { playView } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/claw.ts";
import { registerKittyRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/kitty.ts";
import {
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { KAI, MIR, bible, storyWorld } from "./fixtures/otome-forge-story.ts";

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
    "Ines and Mireille played Kitty Cards together, Ines going first. Mireille let Ines take back a card and play it again. It was a draw, 12 points each.",
  );
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
