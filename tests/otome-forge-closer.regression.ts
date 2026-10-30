// Otome Hearth's Closer (#1938), the warm climax beside the Confrontation, on the same machinery:
// - a main chapter has exactly one climax node, a Confrontation or a Closer (the Lead in it), and after two main
//   chapters in a row ended alike the next must end with the other (requiredClimax); route, repair and Character
//   Story plans never take a Closer;
// - P12c's reply is normalized as P12's, with the Closer's answers (reassure, tease, mirror, ask), endings (opened,
//   almost, shut), its `guard` and a minor grievance; it is stored in the same slot with `kind: "closer"`, and a game
//   stored before it still reads as a Confrontation;
// - the guard runs on the composure line: 0 is Opened up (trust +1 and, the first time, a "first-opened-up" Love
//   Timeline entry), 4 is Shut out (trust −1 and a minor grievance they hold), anything else Almost (nothing); Mirror
//   records the disclosure; every effect lands once; a Confrontation's stance is refused on a Closer, saving nothing;
// - the view hides the guard and the answers not taken, and the canon says "closer", never "confrontation";
// - in an NSFW story P12c carries the partner's tastes (#1936) and lets Opened up turn intimate, with no limits of
//   its own; an SFW story's P12c carries neither.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  Chapter,
  ConfrontationView,
  LiState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  closerEndingFor,
  composureAfter,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/arcs.ts";
import {
  defaultContent,
  type ContentSettings,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import { normalizeStoryPlan } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/items/character-story.ts";
import {
  runDocTarget,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeBeat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { segmentLists } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import {
  canonicalSegments,
  readBeat,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import {
  normalizeChapterPlan,
  requiredClimax,
  type PlanContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/chapters.ts";
import {
  applyConfrontation,
  normalizeConfrontationReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/confrontation.ts";
import {
  CLOSER_INTIMATE_ENDING_MAX,
  type ConfrontationReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import {
  normalizeRepairPlan,
  normalizeRoutePlan,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/routes-plan.ts";
import {
  CAST,
  KAI,
  MIR,
  beatReply,
  closerPlanReply,
  closerReply,
  confrontationReply,
  isCloserPrompt,
  isConfrontationPrompt,
  json,
  planReply,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

type World = Awaited<ReturnType<typeof storyWorld>>;
type Messages = CapabilityLanguageModelMessage[];
type Answer = "reassure" | "tease" | "mirror" | "ask";

const system = (messages: Messages) => messages[0]!.content;
const beatPath = "/runs/:run/chapters/:key/beats/:i";
const node = (i: number) => ({ key: "main-1", i: String(i) });
const labels = (t: World, label: string) =>
  t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === label).length;
const INTIMACY = { preferences: ["PREF-MARK: being praised"], attractions: ["ATTR-MARK: strong hands"] };

/** A main chapter planned with Kai leading whose climax (node 6 of 7) is a Closer, answered by `game()`. */
async function closerWorld(
  runKey: string,
  {
    game = () => closerReply(),
    content,
    kai = {},
  }: { game?: () => Record<string, unknown>; content?: ContentSettings; kai?: Partial<LiState> } = {},
) {
  const replies = Array.from({ length: 60 }, () => (messages: Messages) => {
    if (system(messages).includes("chapter planner")) return json(closerPlanReply());
    if (isCloserPrompt(messages)) return json(game());
    if (isConfrontationPrompt(messages)) return json(confrontationReply());
    return json(beatReply());
  });
  const t = await storyWorld({ runKey, replies, lis: { [KAI]: kai }, ...(content ? { content } : {}) });
  // Kai's bible holds tastes in every story: an SFW one must still never send them.
  {
    await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
      ...unit,
      bible: { ...unit.bible!, intimacy: INTIMACY },
    }));
  }
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await t.call("POST", beatPath, {}, node(i))).status, 200);
    assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(i))).status, 200);
  }
  await t.settle();
  const served = await t.call("POST", beatPath, {}, node(5));
  assert.equal(served.status, 200, JSON.stringify(served.body));
  return { ...t, served };
}

const answer = (t: World, round: number, picked: string) =>
  t.call("POST", `${beatPath}/stance`, { round, stance: picked }, node(5));

async function play(t: World, answers: Answer[]) {
  const results = [];
  for (const [k, picked] of answers.entries()) {
    const result = await answer(t, k + 1, picked);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    results.push(result);
  }
  return results;
}

const planContext = (changes: Partial<PlanContext> = {}): PlanContext => ({
  units: CAST,
  state: { ...normalizeState(undefined), lis: Object.fromEntries(CAST.map((li) => [li.id, defaultLiState()])) },
  world: { content: defaultContent() },
  number: 1,
  lead: KAI,
  ...changes,
});
const withClimax = (kind: string) => ({ nodes: [{ i: 5, kind, guide: "", cast: [KAI] }] }) as unknown as Chapter;

test("the guard runs on the composure line: 0 opens up, 4 shuts out, anything else is almost", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(closerEndingFor), ["opened", "almost", "almost", "almost", "shut"]);
  assert.equal(closerEndingFor(composureAfter([-1, -1, -1])), "opened");
  assert.equal(closerEndingFor(composureAfter([1, 1, 1])), "shut");
  assert.equal(closerEndingFor(composureAfter([-1, 0, 1])), "almost");
});

test("a main chapter has one climax; two alike in a row force the other; only main chapters take a Closer", () => {
  // The streak: two in a row of one kind forces the other; anything else leaves it to the planner.
  assert.equal(requiredClimax([]), null);
  assert.equal(requiredClimax([withClimax("confrontation")]), null);
  assert.equal(requiredClimax([withClimax("confrontation"), withClimax("confrontation")]), "closer");
  assert.equal(requiredClimax([withClimax("closer"), withClimax("closer")]), "confrontation");
  assert.equal(requiredClimax([withClimax("closer"), withClimax("confrontation")]), null);
  assert.equal(
    requiredClimax([withClimax("closer"), withClimax("confrontation"), withClimax("confrontation")]),
    "closer",
    "only the last two count",
  );

  const plan = closerPlanReply() as never;
  const ok = normalizeChapterPlan(plan, planContext());
  assert.ok(typeof ok === "object", String(ok));
  assert.equal(ok.nodes[5]!.kind, "closer");
  assert.ok(typeof normalizeChapterPlan(planReply() as never, planContext()) === "object", "a Confrontation still");
  // Exactly one climax, of either kind, near the end.
  const both = closerPlanReply();
  both.nodes[4] = { ...both.nodes[4], kind: "confrontation" };
  assert.match(String(normalizeChapterPlan(both as never, planContext())), /exactly one climax node/);
  const early = closerPlanReply();
  [early.nodes[1], early.nodes[5]] = [early.nodes[5], early.nodes[1]];
  assert.match(
    String(normalizeChapterPlan(early as never, planContext())),
    /closer must be the second-to-last or last/,
  );
  // The forced kind, named for the repair turn.
  assert.match(
    String(normalizeChapterPlan(planReply() as never, planContext({ number: 3, climax: "closer" }))),
    /this chapter's climax must be a closer node, not a confrontation/,
  );
  assert.ok(typeof normalizeChapterPlan(plan, planContext({ number: 3, climax: "closer" })) === "object");
  // A Closer is played with the Lead.
  const away = closerPlanReply();
  away.nodes[5] = { ...away.nodes[5], cast: [MIR] };
  assert.match(String(normalizeChapterPlan(away as never, planContext())), /the Lead must be in the closer node/);

  // Route, repair and Character Story plans share the schema, and never take a Closer.
  const arcNodes = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ kind: i === 1 ? "closer" : "beat", guide: "With Kai.", cast: [KAI] }));
  const arc = (n: number) => ({ ...planReply(), nodes: arcNodes(n) }) as never;
  const arcContext = { ...planContext(), li: KAI };
  assert.match(
    String(normalizeRoutePlan(arc(4), { ...arcContext, stage: 2, secrets: [] })),
    /a route or repair chapter has no closer node/,
  );
  assert.match(
    String(normalizeRepairPlan(arc(2), { ...arcContext, grievance: "g1", key: "repair-x-1" })),
    /a route or repair chapter has no closer node/,
  );
  assert.match(
    String(normalizeStoryPlan({ ...arc(3), voicedLine: "Stay." } as never, { ...arcContext, key: "story-x" } as never)),
    /a Character Story has no closer node/,
  );
});

test("P12c's reply is normalized as P12's, with the Closer's answers, endings, guard and a minor grievance", () => {
  const state = { lis: { [KAI]: defaultLiState() } } as never;
  const lists = segmentLists({
    node: { i: 5, kind: "closer", guide: "", cast: [KAI] },
    units: [{ id: KAI, name: "Kai" }],
    state,
    last: false,
  });
  const shape = { li: KAI, node: { place: "The Lamp Room" }, cgOpen: false, climax: "closer" as const };
  const normalize = (reply: Record<string, unknown>) =>
    normalizeConfrontationReply(reply as unknown as ConfrontationReply, shape, lists);
  const good = normalize(closerReply());
  assert.ok(typeof good === "object", String(good));
  assert.equal(good.confrontation.kind, "closer");
  assert.equal(good.musicMood, "confession");
  assert.deepEqual(Object.keys(good.confrontation.rounds[0]!.options), ["reassure", "tease", "mirror", "ask"]);
  assert.equal(good.confrontation.rounds[2]!.options.ask!.composure, 1, "the guard is stored as the move");
  assert.deepEqual(Object.keys(good.confrontation.endings), ["opened", "almost", "shut"]);
  assert.deepEqual(good.confrontation.grievance, {
    text: "She laughed when he finally spoke of his mother.",
    severity: "minor",
  });
  assert.equal(good.confrontation.disclosure, "Ines said she is afraid of the dark.");
  // Its own moods only; anything else is tender.
  const tense = normalize({ ...closerReply(), musicMood: "tense" });
  assert.ok(typeof tense === "object" && tense.musicMood === "tender");
  // The repair turn names the Closer's own fields.
  const noGuard = closerReply();
  delete noGuard.rounds[0].options.tease.guard;
  assert.match(String(normalize(noGuard)), /rounds\[0\]\.options\.tease\.guard must be -1, 0 or 1/);
  assert.match(String(normalize(confrontationReply())), /options\.reassure needs a label/, "a Confrontation's shape");
  assert.match(String(normalize({ ...closerReply(), grievance: {} })), /what being shut out leaves between them/);
  assert.match(String(normalize({ ...closerReply(), disclosure: "" })), /shares of themselves in mirror/);
  // NSFW: Explicit (#1958): an opened ending that reaches sex may run to CLOSER_INTIMATE_ENDING_MAX; the others keep 6.
  const ending = (count: number) => Array.from({ length: count }, (_, i) => ({ speaker: "", text: `Line ${i + 1}.` }));
  const withEnding = (name: "opened" | "almost", count: number) => {
    const reply = closerReply();
    reply.endings[name] = ending(count);
    return reply;
  };
  const room = (reply: Record<string, unknown>) =>
    normalizeConfrontationReply(reply as unknown as ConfrontationReply, { ...shape, intimateRoom: true }, lists);
  assert.match(String(normalize(withEnding("opened", 7))), /endings\.opened has more than 6 segments/, "no room: 6");
  assert.equal(typeof room(withEnding("opened", CLOSER_INTIMATE_ENDING_MAX)), "object", "room: up to 20");
  assert.match(String(room(withEnding("opened", CLOSER_INTIMATE_ENDING_MAX + 1))), /more than 20 segments/);
  assert.match(String(room(withEnding("almost", 7))), /endings\.almost has more than 6 segments/, "only opened");
  // A Confrontation is read as before (no kind).
  const fight = normalizeConfrontationReply(
    confrontationReply() as unknown as ConfrontationReply,
    { ...shape, climax: undefined },
    lists,
  );
  assert.ok(typeof fight === "object" && fight.confrontation.kind === undefined && fight.musicMood === "angst");
});

test("a stored Closer reads back whole, a game stored before it is still a Confrontation, and a mixed one is dropped", () => {
  const lists = segmentLists({
    node: { i: 5, kind: "closer", guide: "", cast: [KAI] },
    units: [{ id: KAI, name: "Kai" }],
    state: { lis: { [KAI]: defaultLiState() } } as never,
    last: false,
  });
  const shape = { li: KAI, node: { place: "The Lamp Room" }, cgOpen: false };
  const closer = normalizeConfrontationReply(closerReply() as never, { ...shape, climax: "closer" }, lists);
  const fight = normalizeConfrontationReply(confrontationReply() as never, shape, lists);
  assert.ok(typeof closer === "object" && typeof fight === "object");
  const stored = (kind: string, game: unknown) => ({
    key: "main-1",
    i: 5,
    kind,
    segments: [{ speaker: "", text: "Opening." }],
    confrontation: game,
  });
  const game = { ...closer.confrontation, picks: ["mirror", "reassure", "reassure"], ending: "opened" };
  assert.deepEqual(normalizeBeat(stored("closer", game))!.confrontation, game);
  assert.equal(normalizeBeat(stored("closer", game))!.kind, "closer");
  assert.deepEqual(normalizeBeat(stored("confrontation", fight.confrontation))!.confrontation, fight.confrontation);
  // A Closer that holds a Confrontation's stance is no game at all, never half of each.
  assert.equal(
    normalizeBeat(stored("closer", { ...closer.confrontation, picks: ["press"] }))!.confrontation,
    undefined,
  );
});

test("the view hides the guard and the answers not taken; a stance of the other game saves nothing", async () => {
  const t = await closerWorld("r-closerview-aaaaaa");
  const view = t.served.body.confrontation as ConfrontationView;
  assert.equal(t.served.body.beat.kind, "closer");
  assert.equal(t.served.body.beat.confrontation, undefined, "the stored game never reaches the client");
  assert.equal(view.kind, "closer");
  assert.deepEqual(Object.keys(view.rounds[0]!.options), ["reassure", "tease", "mirror", "ask"]);
  const text = JSON.stringify(view);
  for (const hidden of ["composure", "guard", "REPLY-", "ENDING-", "She laughed", "afraid of the dark"]) {
    assert.ok(!text.includes(hidden), `the view never shows ${hidden}`);
  }
  // P12c: one call, its own label, the scene contract, no Confrontation wording.
  assert.equal(labels(t, "closer/main-1/5"), 1);
  assert.equal(labels(t, "confrontation/main-1/5"), 0);
  const [call] = t.calls.filter((entry) => isCloserPrompt(entry.messages));
  assert.match(system(call!.messages), /CONTENT CONTRACT/);
  assert.match(system(call!.messages), /follow naturally from ANY of the four answers/);
  assert.doesNotMatch(system(call!.messages), /stance game/);

  // A Confrontation's stance on a Closer: 400, nothing saved.
  const wrong = await answer(t, 1, "press");
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, "bad-request");
  assert.deepEqual((await readBeat(t.store, t.runId, "main-1", 5))!.confrontation!.picks, []);
  // Nothing past it is written before it ends.
  await t.settle();
  assert.equal(labels(t, "beat/main-1/6"), 0);

  const [first] = await play(t, ["tease"]);
  assert.equal(first!.body.round.picked, "tease");
  assert.equal(first!.body.round.options.tease.segments[0].text, "REPLY-tease-1");
  assert.equal(first!.body.round.options.reassure.segments, undefined);
  assert.ok(!JSON.stringify(first!.body).includes("guard"));
  assert.equal((await answer(t, 1, "ask")).body.code, "locked", "a round is played once");
});

test("Opened up earns trust and one Love Timeline first; Mirror is told once; replays change nothing", async () => {
  const t = await closerWorld("r-closeropen-aaaaaa");
  const before = (await t.state()).lis[KAI]!;
  const results = await play(t, ["mirror", "reassure", "reassure"]);
  assert.equal(results[0]!.body.remembered, true, "Mirror is remembered");
  assert.deepEqual(results[2]!.body.ending.kind, "opened");
  const state = await t.state();
  const kai = state.lis[KAI]!;
  assert.equal(kai.trust, before.trust + 1, "Opened up: trust +1");
  assert.equal(kai.grievances.length, 0);
  assert.deepEqual(
    kai.disclosures.map(({ text, ref }) => ({ text, ref })),
    [{ text: "Ines said she is afraid of the dark.", ref: "main-1/5" }],
  );
  assert.ok(kai.firsts["opened-up"], "the first, dated");
  const firsts = state.timeline.filter((entry) => entry.kind === "first-opened-up");
  assert.equal(firsts.length, 1);
  assert.deepEqual(
    { li: firsts[0]!.li, text: firsts[0]!.text, ref: firsts[0]!.ref },
    {
      li: KAI,
      text: "The Dark Quay",
      ref: "main-1",
    },
  );
  assert.ok(state.chapters["main-1"]!.applied.includes("5/stance-1"));
  assert.ok(state.chapters["main-1"]!.applied.includes("5/closer"));
  // Replaying every round changes nothing more.
  for (const [k, picked] of (["mirror", "reassure", "reassure"] as const).entries()) await answer(t, k + 1, picked);
  assert.deepEqual(await t.state(), state);

  // Its canon says what it was; the lookahead writes the next node from its ending.
  const beat = (await readBeat(t.store, t.runId, "main-1", 5))!;
  const canon = canonicalSegments(beat, "Ines")!.map((segment) => segment.text);
  assert.ok(canon.some((line) => line.includes("Canonical player answer by Ines, round 1 of the closer: mirror")));
  assert.ok(!canon.some((line) => /confrontation|stance/.test(line)));
  assert.equal(canon.at(-1), "ENDING-OPENED: I've never told anyone that.");
  await t.settle();
  assert.equal(labels(t, "beat/main-1/6"), 1, "the ending queued the next node");

  // A second Opened up (another state, same love interest) never marks the first again, and when its trust +1 is
  // clamped away nothing is remembered.
  const capped = {
    ...state,
    lis: { ...state.lis, [KAI]: { ...kai, trust: 3 } },
    chapters: { ...state.chapters, "main-1": { ...state.chapters["main-1"]!, applied: [] } },
  };
  const again = applyConfrontation(
    capped,
    { key: "main-1", nodes: [], title: "Another night" },
    { ...beat, confrontation: { ...beat.confrontation!, picks: ["reassure", "reassure", "reassure"] } },
    "2026-11-01T00:00:00.000Z",
  );
  assert.equal(again.state.timeline.filter((entry) => entry.kind === "first-opened-up").length, 1);
  assert.equal(again.state.lis[KAI]!.firsts["opened-up"], kai.firsts["opened-up"]);
  assert.deepEqual([again.remembered, again.rememberedBy], [false, []], "nothing changed, so nothing is remembered");
});

test("Shut out costs trust and leaves a minor grievance they hold; Almost changes nothing", async () => {
  // Above the floor of his level, so being harmed can cost him affection; at the trust where a walkout ruptures.
  const shut = await closerWorld("r-closershut-aaaaaa", { kai: { points: 40, trust: -2 } });
  const before = (await shut.state()).lis[KAI]!;
  const [, , last] = await play(shut, ["ask", "ask", "ask"]);
  assert.equal(last!.body.ending.kind, "shut");
  const kai = (await shut.state()).lis[KAI]!;
  assert.equal(kai.trust, before.trust - 1, "Shut out: trust −1");
  assert.deepEqual(
    kai.grievances.map(({ by, text, severity, status }) => ({ by, text, severity, status })),
    [{ by: "li", text: "She laughed when he finally spoke of his mother.", severity: "minor", status: "open" }],
  );
  assert.equal(kai.rupture, null, "a minor grievance never opens a rupture");
  assert.equal(kai.firsts["opened-up"], undefined);
  assert.equal(kai.points, before.points - 15, "being harmed costs affection");
  // Once only.
  const after = await shut.state();
  await play(shut, ["ask", "ask", "ask"]);
  assert.deepEqual(await shut.state(), after);

  const almost = await closerWorld("r-closeralmost-aaaaaa");
  const start = (await almost.state()).lis[KAI]!;
  const [, , end] = await play(almost, ["tease", "tease", "tease"]);
  assert.equal(end!.body.ending.kind, "almost");
  const still = (await almost.state()).lis[KAI]!;
  assert.deepEqual(
    { trust: still.trust, tension: still.tension, grievances: still.grievances, firsts: still.firsts },
    { trust: start.trust, tension: start.tension, grievances: start.grievances, firsts: start.firsts },
  );
});

test("a Closer's answer sent to a Confrontation is a 400 that saves nothing", async () => {
  const replies = Array.from({ length: 60 }, () => (messages: Messages) => {
    if (system(messages).includes("chapter planner")) return json(planReply());
    if (isConfrontationPrompt(messages)) return json(confrontationReply());
    return json(beatReply());
  });
  const t = await storyWorld({ runKey: "r-closerwrong-aaaaaa", replies });
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await t.call("POST", beatPath, {}, node(i))).status, 200);
    assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(i))).status, 200);
  }
  await t.settle();
  assert.ok((await t.call("POST", beatPath, {}, node(5))).body.confrontation, "a Confrontation is served");
  const wrong = await answer(t, 1, "mirror");
  assert.equal(wrong.status, 400);
  assert.deepEqual((await readBeat(t.store, t.runId, "main-1", 5))!.confrontation!.picks, []);
});

test("an NSFW story's P12c carries the partner's tastes and lets Opened up turn intimate; an SFW story's never", async () => {
  const nsfw = await closerWorld("r-closernsfw-aaaaaa", { content: { ...defaultContent(), heat: "fade" } });
  const [hot] = nsfw.calls.filter((entry) => isCloserPrompt(entry.messages));
  const prompt = hot!.messages.map((message) => message.content).join("\n");
  assert.match(prompt, /Kai's tastes in sex and intimacy: into PREF-MARK: being praised; drawn to ATTR-MARK/);
  assert.match(prompt, /opened may turn intimate when the moment and where they stand call for it/);
  // No limits of its own: the content contract (the player's toggles) decides.
  assert.doesNotMatch(prompt, /non-graphic|with consent|never consent|consensual|vanilla/i);

  const sfw = await closerWorld("r-closersfw-aaaaaa");
  const [mild] = sfw.calls.filter((entry) => isCloserPrompt(entry.messages));
  const plain = mild!.messages.map((message) => message.content).join("\n");
  assert.doesNotMatch(plain, /tastes in sex|turn intimate|PREF-MARK/);
});
