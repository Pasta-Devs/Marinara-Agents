// Wordle rules and the daily record, run against the bundle the package actually ships: packages/wordle/server.mjs
// registers the engine through api.registerTurnGameEngine and the record route through registerPrivilegedRoutes.
// Run: node tests/wordle-engine.regression.mjs
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const server = resolve(import.meta.dirname, "../packages/wordle/server.mjs");
const { activate, selfCheck } = await import(pathToFileURL(server).href);

// In-memory stand-in for the Engine's persistence.documents.
const documents = new Map();
const persistence = {
  documents: {
    async getById(packageId, id) {
      if (id.endsWith("chat-broken")) throw new Error("storage is gone");
      return structuredClone(documents.get(`${packageId}/${id}`) ?? null);
    },
    async create(input) {
      const key = `${input.packageId}/${input.id}`;
      if (documents.has(key)) throw new Error("duplicate");
      const document = { ...structuredClone(input), revision: 1 };
      documents.set(key, document);
      return structuredClone(document);
    },
    async update(input) {
      const key = `${input.packageId}/${input.id}`;
      const current = documents.get(key);
      if (!current || current.revision !== input.expectedRevision) return null;
      const next = { ...current, ...structuredClone(input), revision: current.revision + 1 };
      delete next.expectedRevision;
      documents.set(key, next);
      return structuredClone(next);
    },
  },
};
const errors = [];
let engine = null;
let command = null;
const routes = new Map();
let prefix = null;
const cleanup = await activate({
  api: {
    runtime: { persistence, logger: { error: (error, message) => errors.push([message, error]) } },
    registerTurnGameEngine: (registered) => ((engine = registered), () => {}),
    registerConversationCommand: (registration) => ((command = registration), () => {}),
    registerPrivilegedRoutes: async (register, options) => {
      prefix = options.prefix;
      await register({ get: (path, handler) => routes.set(path, handler) });
      return () => {};
    },
  },
});
assert.equal(typeof cleanup, "function");
await selfCheck();
assert.equal(engine?.gameType, "wordle");
assert.equal(engine.hiddenInformation, true);
assert.deepEqual(
  { commandType: command?.commandType, tags: command?.tags },
  { commandType: "wordle", tags: ["wordle"] },
);
assert.equal(prefix, "/api/wordle");
assert.ok(routes.has("/:chatId/days/:day"));

const DAY_MS = 86_400_000;
const utcDay = (offset = 0) => new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
const TODAY = utcDay();
const SEATS = [
  { seatId: "you", kind: "human", displayName: "You" },
  { seatId: "bo", kind: "bot", characterId: "bo", displayName: "Bo" },
  { seatId: "mari", kind: "bot", characterId: "mari", displayName: "Mari" },
];
const settle = () => new Promise((done) => setTimeout(done, 20));
const fresh = (config = {}, seats = SEATS) =>
  engine.setup(engine.normalizeConfig({ day: TODAY, chatId: "chat-one", ...config }), seats, 7);
const withAnswer = (state, answer) => ({ ...structuredClone(state), answer });
const guess = (state, seatId, word) => {
  const result = engine.applyMove(state, seatId, { type: "guess", word });
  assert.ok(result.ok, `${seatId} ${word} failed: ${result.error}`);
  return result;
};
const marksOf = (state, seatId, row) => state.boards[seatId].guesses[row].marks;
const daily = async (chatId, day) => {
  let status = 200;
  const reply = { status: (code) => ((status = code), reply), send: (payload) => payload };
  const body = await routes.get("/:chatId/days/:day")({ params: { chatId, day } }, reply);
  return { status, body };
};

// ── the word of the day ──────────────────────────────────────────────────────
{
  const a = fresh();
  const b = fresh();
  assert.equal(a.answer, b.answer, "same chat and day give the same word");
  assert.match(a.answer, /^[a-z]{5}$/);
  const month = new Set();
  // setup directly: normalizeConfig would clamp these far-off days to today.
  for (let i = 0; i < 60; i++) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    month.add(engine.setup({ day, chatId: "chat-one", streaks: {} }, SEATS, 7).answer);
  }
  assert.equal(month.size, 60, "a chat sees no repeated word across 60 days");
  assert.notEqual(fresh({ chatId: "chat-two" }).answer, a.answer, "another chat has another word");
}

// ── the day is the player's, within a day of the server ──────────────────────
{
  assert.equal(engine.normalizeConfig({ day: utcDay(1), chatId: "c" }).day, utcDay(1));
  assert.equal(engine.normalizeConfig({ day: utcDay(-1), chatId: "c" }).day, utcDay(-1));
  assert.equal(engine.normalizeConfig({ day: utcDay(5), chatId: "c" }).day, TODAY, "cannot skip ahead");
  assert.equal(engine.normalizeConfig({ day: "2026-02-30", chatId: "c" }).day, TODAY, "not a real date");
  assert.deepEqual(engine.normalizeConfig({ day: TODAY, chatId: "c", streaks: { you: 4.7, bo: -2, x: "9" } }).streaks, {
    you: 4,
    bo: 0,
  });
}

// ── only the chosen characters sit down ──────────────────────────────────────
{
  // The Engine seats every character when the start request names none, so the choice rides in the config.
  const seatsOf = (config) => fresh(config).order;
  assert.deepEqual(seatsOf({ players: [] }), ["you"], "an empty list is a solo game");
  assert.deepEqual(seatsOf({ players: ["mari"] }), ["you", "mari"]);
  assert.deepEqual(seatsOf({}), ["you", "bo", "mari"], "no list seats everyone, as before");
  assert.deepEqual(engine.normalizeConfig({ day: TODAY, chatId: "c", players: ["bo", "bo", 7, "mari"] }).players, [
    "bo",
    "mari",
  ]);
  assert.equal(engine.normalizeConfig({ day: TODAY, chatId: "c", players: "bo" }).players, null);
}

// ── scoring, duplicate letters included ──────────────────────────────────────
{
  let state = withAnswer(fresh({}, SEATS.slice(0, 1)), "hello");
  state = guess(state, "you", "llama").state;
  assert.deepEqual(marksOf(state, "you", 0), ["present", "present", "absent", "absent", "absent"]);
  state = withAnswer(fresh({}, SEATS.slice(0, 1)), "there");
  state = guess(state, "you", "eerie").state;
  assert.deepEqual(marksOf(state, "you", 0), ["present", "absent", "present", "absent", "correct"]);
}

// ── rejected guesses ─────────────────────────────────────────────────────────
{
  const state = withAnswer(fresh(), "crane");
  const short = engine.applyMove(state, "you", { type: "guess", word: "cran" });
  assert.equal(short.ok, false);
  const unknown = engine.applyMove(state, "you", { type: "guess", word: "xqzvk" });
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /not in the word list/);
  assert.ok(unknown.legalMoves.length > 0 && unknown.legalMoves.length <= 12);
  for (const example of unknown.legalMoves) assert.ok(engine.applyMove(state, "you", example).ok, example.word);
  // A rejected guess must not hint at the answer: the examples are the same whatever the word and the clues.
  let reign = withAnswer(fresh({}, SEATS.slice(0, 1)), "reign");
  let crane = withAnswer(fresh({}, SEATS.slice(0, 1)), "crane");
  for (const word of ["moist", "lunch"]) {
    reign = guess(reign, "you", word).state;
    crane = guess(crane, "you", word).state;
  }
  const hintA = engine.applyMove(reign, "you", { type: "guess", word: "zzzzz" }).legalMoves.map((m) => m.word);
  const hintB = engine.applyMove(crane, "you", { type: "guess", word: "zzzzz" }).legalMoves.map((m) => m.word);
  assert.deepEqual(hintA, hintB);
  assert.ok(!hintA.includes("reign"));
  assert.deepEqual(
    engine.describeForModel(reign, "you").legalMoves.map((m) => m.word),
    hintA,
  );
  const early = engine.applyMove(state, "bo", { type: "guess", word: "crane" });
  assert.equal(early.ok, false, "not Bo's turn yet");
  assert.equal(engine.parseToolCall("wordle_guess", { word: "  CRANE " }).word, "crane");
  assert.equal(engine.parseToolCall("other_tool", {}), null);
}

// ── letters stay private until the game is over ──────────────────────────────
{
  let state = withAnswer(fresh({ chatId: "chat-private" }), "crane");
  const first = guess(state, "you", "slate");
  state = first.state;
  for (const event of first.events) assert.doesNotMatch(event.message, /slate/i, "events carry colors, not letters");
  state = guess(state, "bo", "crate").state;
  const view = engine.publicView(state, "you");
  assert.equal(view.seats.find((s) => s.seatId === "you").rows[0].word, "slate", "you see your own letters");
  assert.equal(view.seats.find((s) => s.seatId === "bo").rows[0].word, null, "you never see Bo's letters mid-game");
  assert.equal(view.answer, null);
  assert.deepEqual(view.yourLetters, { s: "absent", l: "absent", a: "correct", t: "absent", e: "correct" });
  assert.doesNotMatch(engine.spectatorSummary(state), /slate|crate|crane/i);
  const bo = engine.participantSummary(state, "bo");
  assert.match(bo, /CRATE/, "Bo knows his own guess");
  assert.doesNotMatch(bo, /SLATE|CRANE/, "but not yours, nor the word");
  const model = engine.describeForModel(state, "mari");
  assert.match(model.boardSummary, /No guesses yet/);
  assert.doesNotMatch(model.boardSummary, /slate|crate|crane/i);
}

// ── turns skip finished seats, the fewest guesses win, a tie shares it ───────
{
  let state = withAnswer(fresh({ chatId: "chat-race" }), "crane");
  const yours = guess(state, "you", "crane"); // you solve in 1
  state = yours.state;
  // The Engine names a human seat with no persona "You", and the log reads in the plural for it.
  assert.deepEqual(
    yours.events.map((event) => event.message),
    ["You guess 🟩🟩🟩🟩🟩 (1/6).", "You solve today's Wordle in 1!"],
  );
  assert.equal(engine.currentSeat(state), "bo");
  assert.match(engine.spectatorSummary(state), /Bo is guessing next/);
  const bos = guess(state, "bo", "crane"); // Bo ties
  state = bos.state;
  assert.match(bos.events[0].message, /^Bo guesses /);
  state = guess(state, "mari", "slate").state;
  assert.equal(engine.currentSeat(state), "mari", "only Mari is left");
  const mid = engine.participantSummary(state, "you");
  assert.match(mid, /never say today's word/);
  assert.equal(engine.publicView(state, "you").answer, "crane", "a finished player sees the word");
  for (const word of ["trace", "brace", "grace", "space", "place"]) state = guess(state, "mari", word).state;
  assert.equal(state.boards.mari.status, "failed");
  assert.equal(engine.currentSeat(state), null);
  assert.deepEqual(state.winnerSeatIds, ["you", "bo"]);
  assert.deepEqual(engine.isTerminal(state), { done: true });
  const over = engine.publicView(state, "you");
  assert.equal(over.seats.find((s) => s.seatId === "mari").rows[0].word, "slate", "all letters show at the end");
  assert.match(engine.spectatorSummary(state), /The word was CRANE/);
  assert.match(engine.spectatorSummary(state), /You and Bo share the win with 1 guess\./);
}
{
  let state = withAnswer(fresh({}, SEATS.slice(0, 1)), "crane");
  state = guess(state, "you", "slate").state;
  const won = guess(state, "you", "crane");
  assert.equal(won.events.at(-1).message, "You win with 2 guesses. The word was CRANE.");
}

// ── a fallback guess always fits the seat's own clues ────────────────────────
{
  let state = withAnswer(fresh({ chatId: "chat-fallback" }, SEATS.slice(0, 2)), "crane");
  state = guess(state, "you", "slate").state;
  state = guess(state, "bo", "audio").state;
  state = guess(state, "you", "crate").state;
  const fallback = engine.pickFallbackMove(state, "bo");
  const applied = guess(state, "bo", fallback.word);
  const marks = applied.state.boards.bo.guesses[1].marks;
  // AUDIO left only A, in some spot other than the 1st: the fallback must contain an A, and not at the start.
  assert.ok(fallback.word.includes("a") && fallback.word[0] !== "a", `fallback ${fallback.word} ignores its clues`);
  assert.ok(!/[udio]/.test(fallback.word), `fallback ${fallback.word} reuses a ruled-out letter`);
  assert.equal(marks.length, 5);
}

// ── a solo game in a crowded chat ────────────────────────────────────────────
{
  // With no characters named, the Engine seats every character in the chat and checks maxPlayers before setup.
  const crowd = [
    SEATS[0],
    ...Array.from({ length: 12 }, (_, i) => ({
      seatId: `c${i}`,
      kind: "bot",
      characterId: `c${i}`,
      displayName: `C${i}`,
    })),
  ];
  assert.ok(engine.maxPlayers >= crowd.length);
  assert.deepEqual(fresh({ players: [] }, crowd).order, ["you"]);
  assert.deepEqual(fresh({ players: ["c3", "c9"] }, crowd).order, ["you", "c3", "c9"]);
  assert.equal(fresh({ players: null }, crowd).order.length, 8, "an unnamed start still seats at most eight");
}

// ── every accepted guess is saved to the chat's daily record ─────────────────
{
  const chatId = "chat-record";
  let state = fresh({ chatId, day: TODAY, streaks: { you: 1 } });
  const answer = state.answer;
  const wrong = answer === "slate" ? "crane" : "slate";
  state = guess(state, "you", wrong).state;
  await settle();
  let { body } = await daily(chatId, TODAY);
  assert.deepEqual(body.results.you, { name: "You", status: "playing", guesses: 1 }, "an unfinished go still counts");
  state = guess(state, "bo", answer).state;
  state = guess(state, "mari", wrong).state;
  guess(state, "you", answer);
  await settle();
  ({ body } = await daily(chatId, TODAY));
  assert.deepEqual(body.results.you, { name: "You", status: "solved", guesses: 2 });
  assert.deepEqual(body.results.bo, { name: "Bo", status: "solved", guesses: 1 });
  assert.equal(body.standings.you.current, 1);
  assert.equal(body.standings.you.before, 0);

  // A finished result is final: a second game the same day cannot overwrite it.
  const again = fresh({ chatId, day: TODAY });
  guess(again, "you", wrong);
  await settle();
  ({ body } = await daily(chatId, TODAY));
  assert.equal(body.results.you.status, "solved");

  // Streaks: yesterday solved plus today solved is two in a row; tomorrow starts with two before it.
  const yesterday = fresh({ chatId, day: utcDay(-1) }, SEATS.slice(0, 1));
  guess(yesterday, "you", yesterday.answer);
  await settle();
  ({ body } = await daily(chatId, TODAY));
  assert.equal(body.standings.you.current, 2);
  assert.equal(body.standings.you.best, 2);
  assert.equal(body.standings.you.solved, 2);
  ({ body } = await daily(chatId, utcDay(1)));
  assert.deepEqual(body.results, {});
  assert.equal(body.standings.you.before, 2);

  // A failed day ends the streak at once.
  const failChat = "chat-fail";
  const solvedYesterday = fresh({ chatId: failChat, day: utcDay(-1) }, SEATS.slice(0, 1));
  guess(solvedYesterday, "you", solvedYesterday.answer);
  let failing = fresh({ chatId: failChat, day: TODAY }, SEATS.slice(0, 1));
  const misses = ["slate", "crane", "audio", "pilot", "mound", "chirp", "brick", "fuzzy"].filter(
    (w) => w !== failing.answer,
  );
  failing = guess(failing, "you", misses[0]).state;
  await settle();
  ({ body } = await daily(failChat, TODAY));
  assert.equal(body.standings.you.current, 1, "a day still being played keeps the streak");
  for (const word of misses.slice(1, 6)) failing = guess(failing, "you", word).state;
  await settle();
  ({ body } = await daily(failChat, TODAY));
  assert.equal(body.results.you.status, "failed");
  assert.equal(body.standings.you.current, 0);
  assert.equal(body.standings.you.before, 1);

  // A rewind never gives guesses back, and a finished result stays final.
  const rewindChat = "chat-rewind";
  let long = fresh({ chatId: rewindChat, day: TODAY }, SEATS.slice(0, 2));
  const rewound = long;
  for (const word of misses.slice(0, 3)) long = guess(guess(long, "you", word).state, "bo", word).state;
  guess(guess(rewound, "you", rewound.answer).state, "bo", misses[0]);
  await settle();
  ({ body } = await daily(rewindChat, TODAY));
  assert.deepEqual(body.results.you, { name: "You", status: "solved", guesses: 3 });
  assert.deepEqual(body.results.bo, { name: "Bo", status: "playing", guesses: 3 });

  // A day far off is clamped to the server's day, and a bad chat id is refused.
  ({ body } = await daily(chatId, "2999-01-01"));
  assert.equal(body.day, TODAY);
  assert.equal((await daily("", TODAY)).status, 400);
}

// ── a character's [wordle] tag starts a game set up like the setup screen's ──
{
  assert.equal(engine.silentBotMoves, true, "character guesses post no chat line each");
  assert.equal(typeof command.startConfig, "function");
  const tagChat = "chat-tag";
  const context = {
    chatId: tagChat,
    characterId: "bo",
    botCharacterIds: ["bo", "mari"],
    humanSeatId: "you",
    timeZone: "UTC",
  };
  let start = await command.startConfig(context);
  assert.deepEqual(start, {
    config: { day: TODAY, chatId: tagChat, streaks: { you: 0, bo: 0, mari: 0 }, players: ["bo", "mari"] },
    botCharacterIds: ["bo", "mari"],
  });
  // The setup's config seats exactly those players, and a guess lands in this chat's record.
  let state = engine.setup(engine.normalizeConfig(start.config), SEATS, 3);
  assert.deepEqual(state.order, ["you", "bo", "mari"]);
  state = guess(state, "you", state.answer === "slate" ? "crane" : "slate").state;
  guess(state, "bo", state.answer);
  await settle();
  // Bo has played today, so a tag for a player who hasn't (another persona's seat) seats only Mari.
  start = await command.startConfig({ ...context, humanSeatId: "persona-x" });
  assert.deepEqual(start.botCharacterIds, ["mari"]);
  assert.deepEqual(start.config.players, ["mari"]);
  assert.deepEqual(Object.keys(start.config.streaks), ["persona-x", "mari"]);
  // You have had your go (one guess counts), so your tag starts nothing.
  assert.equal(await command.startConfig(context), null);
  // A chat whose own clock runs a day behind your browser: you already played the next day's word from /wordle, so a
  // tag on the chat's day starts nothing instead of a second game with the day before's word.
  const ahead = fresh({ chatId: "chat-ahead", day: utcDay(1) }, SEATS.slice(0, 1));
  guess(ahead, "you", ahead.answer === "slate" ? "crane" : "slate");
  await settle();
  assert.equal(await command.startConfig({ ...context, chatId: "chat-ahead" }), null, "no second go a day behind");
  assert.notEqual(await command.startConfig({ ...context, chatId: "chat-ahead", humanSeatId: "persona-x" }), null);
  // A record that cannot be read declines the start and logs why, instead of rejecting.
  const loggedBefore = errors.length;
  assert.equal(await command.startConfig({ ...context, chatId: "chat-broken" }), null);
  assert.equal(errors.length, loggedBefore + 1);
  assert.match(errors.at(-1)[0], /could not read the record to start a game/);
  errors.length = loggedBefore;
  // The day follows the chat's time zone, and an unknown zone falls back to the server's local day.
  const kiritimati = await command.startConfig({ ...context, chatId: "chat-zone", timeZone: "Pacific/Kiritimati" });
  assert.equal(
    kiritimati.config.day,
    new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Kiritimati" }).format(Date.now()),
  );
  const unknown = await command.startConfig({ ...context, chatId: "chat-zone", timeZone: "Not/AZone" });
  const local = new Date();
  const localDay = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  assert.equal(unknown.config.day, localDay);
}

// ── the streak a seat brings in shows in its own summary ─────────────────────
{
  let state = withAnswer(fresh({ chatId: "chat-streak", streaks: { you: 5 } }, SEATS.slice(0, 1)), "crane");
  assert.match(engine.participantSummary(state, "you"), /5-day streak going into today/);
  state = guess(state, "you", "crane").state;
  assert.match(engine.participantSummary(state, "you"), /streak is now 6 days/);
}

assert.deepEqual(errors, []);
await cleanup();
console.log("wordle engine regression: ok");
