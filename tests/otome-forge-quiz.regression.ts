// Otome Hearth (#2174): the personality quiz, played while a chapter is planned.
// - The 100 starting statements: stable ids, a category and an 18+ flag each, interleaved by category.
// - The maintainer's line format, "<statement>: <name> <score> | …", read leniently: numbering, brackets, an [18+] tag
//   wherever it sits (inside bold or quotes, at the end, before a colon; never a bare 18+), a colon inside the
//   statement, "Kai: 5" or "Kai (5)", titles and honorifics; a score outside 1–5 or a name that is no one (or two
//   namesakes) is skipped, and a statement the model reworded a little still matches.
// - GET /quiz queues one background call for the love interests' missing answers (the starters at first; a newcomer's
//   later, for them alone) and never waits for it; with Heat SFW an 18+ statement is never shown, sent or answered.
// - POST /quiz/answer keeps the first answer; the last open statement queues one refill of 50, given every statement
//   the player can see (under SFW no 18+ starter or written one), whose repeats (of hidden ones too) and (under SFW)
//   [18+] lines are dropped; the new ones are open next, with their answers. Under NSFW every one a refill writes is
//   18+, tagged or not.
// - A love interest's answers never reach another prompt (the chapter plan here; only the quiz's module reads its
//   document or sends its prompts), and the quiz's prompts are logged in debug mode.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type {
  OtomeReply,
  RouteDeps,
  RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import { runForeground } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import {
  quizId,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  matchQuizScores,
  newQuizStatements,
  normalizeQuiz,
  parseQuizLine,
  parseQuizLines,
  quizNameOf,
  QUIZ_RETRY_MS,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/quiz.ts";
import { QUIZ_STARTERS } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/quiz-statements.ts";
import { registerQuizRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/quiz.ts";
import { registerRunRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/runs.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  quizAgreement,
  type QuizView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/quiz.ts";
import { HE, KAI, MIR, SOL, bible, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";

const UNITS = [
  { id: KAI, name: "Kai" },
  { id: MIR, name: "Mireille" },
  { id: SOL, name: "Sol" },
];
const isScoring = (messages: Array<{ content: string }>) =>
  messages[0]!.content.startsWith("You answer a personality quiz");
const isRefill = (messages: Array<{ content: string }>) =>
  messages[0]!.content.includes("new statements for a personality quiz");
const statementsOf = (messages: Array<{ content: string }>) =>
  messages[1]!.content.split("THE STATEMENTS\n")[1]!.split("\n\nAnswer all")[0]!.split("\n");

/** A reply in the maintainer's format answering every statement the prompt asked, for each love interest it named. */
function answerAll(messages: Array<{ content: string }>, score = (index: number) => (index % 5) + 1) {
  const names = UNITS.filter((unit) => messages[1]!.content.includes(`\n${unit.name} (he/`)).map((unit) => unit.name);
  return statementsOf(messages)
    .map((statement, index) => `${statement}: ${names.map((name) => `${name} ${score(index)}`).join(" | ")}`)
    .join("\n");
}

/** A quizReply that answers each quiz call with the next of these, the last one again once they run out. */
const inTurn =
  (...replies: Array<(messages: Array<{ content: string }>) => string>) =>
  (messages: Array<{ content: string }>) =>
    (replies.length > 1 ? replies.shift()! : replies[0]!)(messages);

/** A forged world with the quiz routes and a background lane. */
async function quizWorld(runKey: string, options: Parameters<typeof storyWorld>[0] = { runKey }) {
  const t = await storyWorld({ ...options, runKey });
  const background = createBackgroundQueue(t.runtime);
  const deps: RouteDeps = { ...t.deps, background };
  const routes = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
  };
  registerQuizRoutes(router as never, deps);
  registerRunRoutes(router as never, deps);
  const ask = async (method: "GET" | "POST", path: string, body: object = {}) => {
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status: (code) => ((status = code), reply),
      send: (value) => ((payload = value), reply),
    };
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await routes.get(`${method} ${path}`)!(
      {
        method,
        url: path,
        params: { run: runKey },
        body: method === "POST" ? { ...fields, ...body } : undefined,
        query: method === "GET" ? fields : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as QuizView & { code?: string } };
  };
  const settle = async () => {
    for (let round = 0; round < 200; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      await runForeground(t.runId, async () => undefined);
    }
  };
  const quiz = async () => (await t.store.readDoc(quizId(t.runId), normalizeQuiz)) ?? normalizeQuiz(undefined);
  return { ...t, background, deps, ask, settle, quiz };
}

test("the 100 starting statements: stable ids, a category and an 18+ flag each, interleaved by category", () => {
  assert.equal(QUIZ_STARTERS.length, 100);
  assert.equal(new Set(QUIZ_STARTERS.map((statement) => statement.id)).size, 100);
  assert.equal(new Set(QUIZ_STARTERS.map((statement) => statement.text.toLowerCase())).size, 100, "no repeats");
  assert.equal(QUIZ_STARTERS.filter((statement) => statement.adult).length, 32);
  assert.ok(QUIZ_STARTERS.every((statement) => statement.adult === (statement.category === "intimacy")));
  assert.ok(QUIZ_STARTERS.every((statement) => /^[pilt]\d{2}$/.test(statement.id) && statement.text.length < 120));
  assert.deepEqual(
    QUIZ_STARTERS.slice(0, 4).map((statement) => statement.category),
    ["temperament", "love", "intimacy", "together"],
    "the first few cover every category",
  );
  assert.equal(QUIZ_STARTERS[0]!.id, "p01");
});

test("the line format is read leniently, and what cannot be read is skipped", () => {
  assert.deepEqual(parseQuizLine("I like taking risks.: Kai 5 | Mireille 2 | Sol 3"), {
    statement: "I like taking risks.",
    adult: false,
    scores: [
      { name: "Kai", score: 5 },
      { name: "Mireille", score: 2 },
      { name: "Sol", score: 3 },
    ],
  });
  // A colon inside the statement, numbering, brackets, a score after a colon, in brackets or out of five.
  const colon = parseQuizLine(
    "12. [Blindfolds, ice or wax: sensory play appeals to me.]: Kai: 4 | Mireille (2) | Sol 5/5",
  )!;
  assert.equal(colon.statement, "Blindfolds, ice or wax: sensory play appeals to me.");
  assert.deepEqual(
    colon.scores.map((score) => score.score),
    [4, 2, 5],
  );
  // An 18+ tag, bold names and a dash.
  const tagged = parseQuizLine("- [18+] I like rough sex more than gentle sex: **Kai** – 5 | Sol - 1")!;
  assert.equal(tagged.adult, true);
  assert.equal(tagged.statement, "I like rough sex more than gentle sex");
  assert.deepEqual(tagged.scores, [
    { name: "Kai", score: 5 },
    { name: "Sol", score: 1 },
  ]);
  // The tag wherever the model put it: inside bold or quotes, bold of its own, at the end, or before a colon.
  for (const variant of [
    "**[18+] I like rough sex.**: Kai 5",
    '"[18+] I like rough sex.": Kai 5',
    "“[18+] I like rough sex.”: Kai 5",
    "**[18+]** I like rough sex.: Kai 5",
    "I like rough sex. [18+]: Kai 5",
    "[18+]: I like rough sex.: Kai 5",
    "**[18+]**: I like rough sex.: Kai 5",
    "(18+) I like rough sex.: Kai 5",
    "[ 18 + ] I like rough sex.: Kai 5",
    "[[18+] I like rough sex.]: Kai 5",
    "*[18+]* I like rough sex.: Kai 5",
    "*[18+] I like rough sex.*: Kai 5",
    "**[18+] I like rough sex.: Kai 5",
  ]) {
    assert.deepEqual(
      parseQuizLine(variant),
      { statement: "I like rough sex.", adult: true, scores: [{ name: "Kai", score: 5 }] },
      variant,
    );
  }
  // Emphasis inside a statement is the model's own and stays: only the tag's emphasis, or a run left unpaired, goes.
  for (const statement of ["I love **bold** **moves**", "I love *italic words*", "**this** and **that**"]) {
    assert.equal(parseQuizLine(`${statement}: Kai 5`)!.statement, statement, statement);
  }
  const prose = parseQuizLine("I'd date someone 18+ years older than me: Kai 1")!;
  assert.equal(prose.adult, false, "a bare 18+ in the prose is no tag");
  assert.equal(prose.statement, "I'd date someone 18+ years older than me");
  assert.equal(parseQuizLine("[18+]: Kai 5"), null, "a tag alone is no statement");
  assert.equal(parseQuizLine("Here are the answers:"), null, "a preamble is no line");
  assert.equal(parseQuizLine("I like taking risks. Kai 5"), null, "no colon, no line");
  assert.equal(parseQuizLines("Sure! Here you go."), undefined, "nothing readable is a format failure");
  assert.equal(parseQuizLines("A: Kai 1\n\nnot a line\nB: Sol 2")!.lines.length, 2);
});

test("a written name finds its love interest through titles and honorifics, never a namesake", () => {
  const units = [...UNITS, { id: "li-kaito-zz11", name: "Lord Kaito Ren" }];
  assert.equal(quizNameOf("Kai", units), KAI);
  assert.equal(quizNameOf("kai-sama", units), KAI);
  assert.equal(quizNameOf("Kaito", units), "li-kaito-zz11", "the core of 'Lord Kaito Ren'");
  assert.equal(quizNameOf("Lord Kaito Ren", units), "li-kaito-zz11");
  assert.equal(quizNameOf("Nobody", units), null);
  const twins = [
    { id: "li-ren-aa11", name: "Ren Ito" },
    { id: "li-ren-bb22", name: "Ren Mori" },
  ];
  assert.equal(quizNameOf("Ren", twins), null, "two of them are Ren: never guessed");
  assert.equal(quizNameOf("Ren Mori", twins), "li-ren-bb22");
});

test("scores match the statements asked, even reworded a little; one out of range or no one's is skipped", async () => {
  const t = await quizWorld("r-quizmatch-aaaaaa");
  const units = (await Promise.all(UNITS.map((unit) => t.store.readDoc(unitId(t.runId, unit.id), normalizeUnit))))
    .filter(Boolean)
    .map((unit) => unit!);
  const asked = QUIZ_STARTERS.slice(0, 3);
  const reply = parseQuizLines(
    [
      `${asked[0]!.text}: Kai 5 | Mireille 9 | Nobody 2 | Sol 3`,
      `${asked[1]!.text.replace("I feel most loved", "I feel the most loved")}: Kai 2`,
      "Something nobody asked: Kai 4",
    ].join("\n"),
  )!;
  const matched = matchQuizScores(reply, asked, units);
  assert.deepEqual(matched.get(asked[0]!.id), { [KAI]: 5, [SOL]: 3 }, "Mireille's 9 and Nobody are skipped");
  assert.deepEqual(matched.get(asked[1]!.id), { [KAI]: 2 }, "a small rewording still matches");
  assert.equal(matched.size, 2);
  // A refill keeps new statements only: a repeat (case and punctuation aside) and a second copy are dropped.
  const fresh = newQuizStatements(
    parseQuizLines(
      [`${asked[2]!.text.toUpperCase()}: Kai 1`, "I hum when I cook: Kai 4", "i hum when i cook!: Sol 2"].join("\n"),
    )!,
    QUIZ_STARTERS,
    units,
    false,
  );
  assert.deepEqual(fresh, [{ text: "I hum when I cook", adult: false, scores: { [KAI]: 4 } }]);
  // Under NSFW Heat every new statement is 18+, tagged or not, so none shows once Heat is SFW; under SFW a tagged one
  // is dropped and an untagged one is kept as it is.
  const mixed = parseQuizLines(
    ["[18+] I like being told what to do in bed: Kai 5", "I like being kissed slowly at dawn: Kai 3"].join("\n"),
  )!;
  assert.deepEqual(
    newQuizStatements(mixed, QUIZ_STARTERS, units, true).map(({ text, adult }) => ({ text, adult })),
    [
      { text: "I like being told what to do in bed", adult: true },
      { text: "I like being kissed slowly at dawn", adult: true },
    ],
  );
  assert.deepEqual(
    newQuizStatements(mixed, QUIZ_STARTERS, units, false).map(({ text, adult }) => ({ text, adult })),
    [{ text: "I like being kissed slowly at dawn", adult: false }],
  );
});

test("GET /quiz queues the love interests' answers once, never waits, and keeps 18+ statements out under SFW", async () => {
  const t = await quizWorld("r-quizsfw-aaaaaa", { runKey: "", quizReply: (messages) => answerAll(messages) });
  // Hold the lane: the quiz still answers at once.
  let release!: () => void;
  t.background.ensure({
    key: "blocker",
    connectionId: "conn-text",
    run: () => new Promise<void>((r) => (release = r)),
  });
  const first = await t.ask("GET", "/runs/:run/quiz");
  assert.equal(first.status, 200);
  assert.equal(first.body.scoring, true, "their answers are being written");
  assert.equal(first.body.open.length, 68, "the 32 statements about sex and kinks are hidden under SFW");
  assert.ok(first.body.open.every((statement) => !statement.id.startsWith("i")));
  assert.deepEqual(first.body.open[0]!.scores, {}, "no answers yet");
  await t.ask("GET", "/runs/:run/quiz");
  release();
  await t.settle();
  const scoring = t.calls.filter((entry) => isScoring(entry.messages));
  assert.equal(scoring.length, 1, "one call, however often the quiz is read meanwhile");
  const asked = statementsOf(scoring[0]!.messages);
  assert.equal(asked.length, 68);
  assert.ok(!asked.some((text) => QUIZ_STARTERS.find((statement) => statement.text === text)?.adult));
  assert.match(scoring[0]!.messages[0]!.content, /<statement>: <name> <score> \| <name> <score> \| …/u);
  assert.match(scoring[0]!.messages[1]!.content, /Kai \(he\/him\/his\)\nBIBLE: \{/u, "each love interest's bible");
  const after = await t.ask("GET", "/runs/:run/quiz");
  assert.equal(after.body.scoring, false);
  assert.deepEqual(after.body.open[0]!.scores, { [KAI]: 1, [MIR]: 1, [SOL]: 1 });
  assert.ok(after.body.open.every((statement) => Object.keys(statement.scores).length === 3));
  const logged = t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === "quiz-scores");
  assert.ok(logged.length >= 1, "the prompt is logged in debug mode");
});

test("NSFW Heat shows, sends and answers the 18+ statements, with each love interest's tastes", async () => {
  const content = { ...defaultContent(), heat: "explicit" as const };
  const t = await quizWorld("r-quiznsfw-aaaaaa", { runKey: "", content, quizReply: (messages) => answerAll(messages) });
  await t.store.updateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: { ...unit.bible!, intimacy: { preferences: ["praise"], attractions: ["confidence"] } },
  }));
  const first = await t.ask("GET", "/runs/:run/quiz");
  assert.equal(first.body.open.length, 100);
  await t.settle();
  const prompt = t.calls.find((entry) => isScoring(entry.messages))!.messages;
  assert.equal(statementsOf(prompt).length, 100);
  assert.match(prompt[1]!.content, /Kai's tastes in sex and intimacy: into praise; drawn to confidence\./u);
  assert.doesNotMatch(prompt[1]!.content, /"intimacy":/u, "the tastes ride as their own line, never in the JSON");
});

test("a newcomer's answers are written for them alone, for every statement already answered by the others", async () => {
  const t = await quizWorld("r-quiznew-aaaaaa", {
    runKey: "",
    quizReply: inTurn(
      (messages) => answerAll(messages),
      (messages) => answerAll(messages, () => 4),
    ),
  });
  await t.ask("GET", "/runs/:run/quiz");
  await t.settle();
  const NEW = "li-noor-gh78";
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, NEW)), normalizeUnit, (unit) => ({
    ...unit,
    id: NEW,
    name: "Noor",
    pronouns: HE,
    bible: bible(),
  }));
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [NEW]: defaultLiState() },
  }));
  UNITS.push({ id: NEW, name: "Noor" });
  try {
    const before = await t.ask("GET", "/runs/:run/quiz");
    assert.equal(before.body.scoring, true);
    await t.settle();
    const second = t.calls.filter((entry) => isScoring(entry.messages))[1]!.messages;
    assert.match(second[1]!.content, /\nNoor \(he\/him\/his\)\nBIBLE:/u);
    assert.doesNotMatch(second[1]!.content, /\nKai \(he\/him\/his\)/u, "only who is missing answers");
    assert.equal(statementsOf(second).length, 68);
    const after = await t.ask("GET", "/runs/:run/quiz");
    assert.equal(after.body.open[0]!.scores[NEW], 4);
    assert.equal(after.body.open[0]!.scores[KAI], 1, "an existing answer is never replaced");
  } finally {
    UNITS.pop();
  }
});

test("a scoring reply that skips statements leaves them for QUIZ_RETRY_MS, never a call on every read", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: 5_000_000 });
  // The first reply answers only the first half; the second, much later, answers the rest.
  const half = (messages: Array<{ content: string }>) => answerAll(messages).split("\n").slice(0, 34).join("\n");
  const t = await quizWorld("r-quizskip-aaaaaa", {
    runKey: "",
    quizReply: inTurn(half, (messages) => answerAll(messages)),
  });
  await t.ask("GET", "/runs/:run/quiz");
  await t.settle();
  const scoring = () => t.calls.filter((entry) => isScoring(entry.messages));
  assert.equal(scoring().length, 1);
  const read = await t.ask("GET", "/runs/:run/quiz");
  assert.equal(read.body.scoring, false, "nothing is queued within the cool-down");
  assert.equal(read.body.open.filter((statement) => Object.keys(statement.scores).length).length, 34);
  await t.settle();
  assert.equal(scoring().length, 1, "no second call yet");
  context.mock.timers.tick(QUIZ_RETRY_MS + 1);
  await t.ask("GET", "/runs/:run/quiz");
  await t.settle();
  assert.equal(scoring().length, 2);
  assert.equal(statementsOf(scoring()[1]!.messages).length, 34, "only what is still missing is asked");
});

test("answers: the first is final; an unseen statement is a 404 and an answer outside 1–5 a 400", async () => {
  const t = await quizWorld("r-quizans-aaaaaa", { runKey: "", quizReply: (messages) => answerAll(messages) });
  await t.ask("GET", "/runs/:run/quiz");
  await t.settle();
  const first = await t.ask("POST", "/runs/:run/quiz/answer", { statement: "p01", answer: 4 });
  assert.equal(first.status, 200);
  assert.equal(first.body.answered[0]!.id, "p01");
  assert.equal(first.body.answered[0]!.answer, 4);
  assert.ok(!first.body.open.some((statement) => statement.id === "p01"));
  const again = await t.ask("POST", "/runs/:run/quiz/answer", { statement: "p01", answer: 1 });
  assert.equal(again.body.answered[0]!.answer, 4, "the first answer is final");
  assert.equal((await t.ask("POST", "/runs/:run/quiz/answer", { statement: "i01", answer: 3 })).status, 404);
  assert.equal((await t.ask("POST", "/runs/:run/quiz/answer", { statement: "p02", answer: 6 })).status, 400);
  assert.equal((await t.ask("POST", "/runs/:run/quiz/answer", { statement: "w9", answer: 3 })).status, 404);
  // How alike: Kai answered p01 with 1, the player 4: 1 − 3/4.
  assert.equal(quizAgreement(again.body.answered, KAI), 25);
});

test("the last open statement queues one refill of 50, whose repeats and 18+ lines under SFW are dropped", async () => {
  // Written once while Heat was NSFW: hidden now, never listed, and still never written again.
  const HIDDEN = "I want to be pinned down and teased slowly";
  const adultStarter = QUIZ_STARTERS.find((statement) => statement.adult)!;
  const refill = (messages: Array<{ content: string }>) => {
    assert.match(messages[0]!.content, /You write 50 new statements/u);
    assert.match(messages[0]!.content, /This story keeps sex, kinks and intimacy out of the quiz/u);
    assert.match(messages[1]!.content, /STATEMENTS ALREADY ASKED \(never again\)\n/u);
    assert.ok(messages[1]!.content.includes(QUIZ_STARTERS[0]!.text), "every statement the player can see is listed");
    const adultListed = QUIZ_STARTERS.filter(
      (statement) => statement.adult && messages[1]!.content.includes(statement.text),
    );
    assert.deepEqual(adultListed, [], "no 18+ starter is sent under SFW");
    assert.ok(!messages[1]!.content.includes(HIDDEN), "nor an 18+ statement written earlier");
    return [
      `${QUIZ_STARTERS[0]!.text}: Kai 3`,
      `${adultStarter.text}: Kai 4`,
      `${HIDDEN}: Sol 2`,
      "[18+] I'd like a partner to take charge tonight: Kai 5 | Sol 2",
      ...Array.from(
        { length: 12 },
        (_, index) => `I collect postcards from place number ${index + 1}: Kai 2 | Mireille 4 | Sol 5`,
      ),
    ].join("\n");
  };
  const t = await quizWorld("r-quizrefill-aaaaaa", {
    runKey: "",
    quizReply: inTurn((messages) => answerAll(messages), refill),
  });
  await t.ask("GET", "/runs/:run/quiz");
  await t.settle();
  // Every visible statement but one answered already.
  const visible = QUIZ_STARTERS.filter((statement) => !statement.adult);
  await t.store.mutateDoc(runDocTarget("quiz", quizId(t.runId)), normalizeQuiz, (quiz) => ({
    ...quiz,
    written: [{ id: "w1", text: HIDDEN, adult: true }],
    answers: Object.fromEntries(visible.slice(1).map((statement) => [statement.id, 3 as const])),
  }));
  const last = await t.ask("POST", "/runs/:run/quiz/answer", { statement: visible[0]!.id, answer: 5 });
  assert.equal(last.body.open.length, 0);
  assert.equal(last.body.refilling, true, "new statements are being written");
  await t.ask("GET", "/runs/:run/quiz");
  await t.settle();
  assert.equal(t.calls.filter((entry) => isRefill(entry.messages)).length, 1, "one refill");
  const quiz = await t.quiz();
  assert.equal(quiz.written.length, 13, "the repeats (of hidden ones too) and the 18+ line are dropped");
  assert.deepEqual(quiz.written[1], { id: "w2", text: "I collect postcards from place number 1", adult: false });
  const after = await t.ask("GET", "/runs/:run/quiz");
  assert.equal(after.body.refilling, false);
  assert.equal(after.body.open.length, 12, "the new ones are open next");
  assert.deepEqual(after.body.open[0]!.scores, { [KAI]: 2, [MIR]: 4, [SOL]: 5 });
  await t.settle();
  assert.equal(t.calls.filter((entry) => isRefill(entry.messages)).length, 1, "statements open: no refill");
});

test("a love interest's quiz answers never reach another prompt (the chapter plan)", async () => {
  const t = await quizWorld("r-quizleak-aaaaaa", {
    runKey: "",
    replies: [json(planReply())],
  });
  await t.store.mutateDoc(runDocTarget("quiz", quizId(t.runId)), normalizeQuiz, () =>
    normalizeQuiz({
      written: [{ id: "w1", text: "QUIZ-LEAK-STATEMENT about lanterns", adult: false }],
      scores: { w1: { [KAI]: 5 }, p01: { [KAI]: 2 } },
      answers: { p01: 4 },
    }),
  );
  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const sent = t.calls.flatMap((entry) => entry.messages.map((message) => message.content)).join("\n");
  assert.ok(t.calls.length >= 2, "the arc and the chapter plan were sent");
  assert.doesNotMatch(sent, /QUIZ-LEAK-STATEMENT|personality quiz/u);
});

test("only the quiz's own module reads its document or sends its prompts", () => {
  const root = "packages/otome-forge/src/engine/packages/server/src/services/otome-forge";
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".ts"));
  const users = (pattern: RegExp) =>
    files.filter((file) => pattern.test(readFileSync(join(root, file), "utf8"))).sort();
  assert.deepEqual(users(/\bquizId\(/u), ["minigames/quiz.ts"]);
  assert.deepEqual(users(/\b(?:readQuiz|normalizeQuiz)\(/u), ["minigames/quiz.ts"]);
  assert.deepEqual(users(/\bquiz(?:Score|Refill)Messages\(/u), ["minigames/quiz.ts", "prompts.ts"]);
});

test("opening a story from before the quiz queues its love interests' answers once, and never again (#2174)", async () => {
  const t = await quizWorld("r-quizopen-aaaaaa", { runKey: "", quizReply: (messages) => answerAll(messages) });
  const open = () => t.ask("GET", "/runs/:run");
  const scoring = () => t.calls.filter((entry) => isScoring(entry.messages)).length;
  // Hold the lane: the story opens at once, and opening it again while the call waits queues nothing more.
  let release!: () => void;
  t.background.ensure({
    key: "blocker",
    connectionId: "conn-text",
    run: () => new Promise<void>((r) => (release = r)),
  });
  assert.equal((await open()).status, 200, "the open never waits for the quiz");
  await open();
  release();
  await t.settle();
  assert.equal(scoring(), 1, "one call for every love interest");
  const quiz = await t.quiz();
  assert.equal(Object.keys(quiz.scores).length, 68, "every statement an SFW story shows, answered by opening it");
  assert.deepEqual(quiz.scores.p01, { [KAI]: 1, [MIR]: 1, [SOL]: 1 });
  // The scores exist: opening it again queues nothing.
  await open();
  await t.settle();
  assert.equal(scoring(), 1);
});

test("opening a story with no bibles yet, or one still being forged, queues no quiz call", async () => {
  const bare = await quizWorld("r-quizbare-aaaaaa", { runKey: "" });
  for (const unit of UNITS) {
    await bare.store.updateDoc(runDocTarget("unit", unitId(bare.runId, unit.id)), normalizeUnit, (current) => {
      const { bible: _bible, ...rest } = current;
      return rest as typeof current;
    });
  }
  assert.equal((await bare.ask("GET", "/runs/:run")).status, 200);
  await bare.settle();
  assert.equal(bare.calls.filter((entry) => isScoring(entry.messages)).length, 0, "no bible, no answers to write");

  const forging = await quizWorld("r-quizforging-aaaaaa", { runKey: "" });
  await forging.store.updateDoc(runDocTarget("world", worldId(forging.runId)), normalizeWorld, (world) => ({
    ...world,
    forge: { phase: "forging", steps: [] },
  }));
  await forging.ask("GET", "/runs/:run");
  await forging.settle();
  assert.equal(forging.calls.filter((entry) => isScoring(entry.messages)).length, 0, "the forge queues its own");
});
