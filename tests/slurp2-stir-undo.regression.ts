/**
 * 0.3.1 — Stir's Undo leaves the world whole, and the plays and suggestions are honest:
 * - a tie Undo refuses when the world moved on (a partner with someone new, a page opened since, a
 *   collab already planned), keeps a couple's page, and blocks a pair again that the play unblocked;
 * - push-collab, cool-rivalry and opening a shared page can be taken back;
 * - a steering Undo leaves a later change alone;
 * - a play never runs as a dry run (`preview: true`), and the planner is not told about one;
 * - suggestions skip couple pages, rank several of each kind, offer a pair that would click, and
 *   leave out what the player put away;
 * - the planner hears the player's answer, their last plays and one line per Creator.
 */
import assert from "node:assert/strict";
import {
  SLURP_NO_TIES,
  slurpPairKey,
  type SlurpCollab,
  type SlurpRivalry,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import {
  newSlurpCouple,
  slurpCoupleMatches,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import {
  slurpPreviewTieLever,
  slurpUndoTie,
  slurpUnblockedBy,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-stir-tie-preview.ts";
import {
  slpSortStirSteps,
  slpStirPlayInput,
  slpUndoPatch,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-stir-play.ts";
import {
  slpStirSuggestions,
  type SlpStirLiveInput,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-stir-live.ts";
import { buildSlpStirPlanMessages } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/assist/slp-stir-plan.ts";
import { SLP_ACTION_META, SLP_ACTIONS } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions.ts";
import {
  slpStirDeckNeed,
  slpStirLiveLever,
  slpStirPlayTarget,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/stir/slp-stir-screen-model.ts";

const AT = new Date("2026-10-01T12:00:00Z");
const STAMP = AT.toISOString();

const collab = (fields: Partial<SlurpCollab>): SlurpCollab => ({
  id: "c1",
  hostId: "mira",
  partnerId: "kai",
  idea: "a cook-off",
  hostShare: 50,
  status: "asked",
  origin: "player",
  askedAt: STAMP,
  answeredAt: null,
  plannedAt: null,
  postId: null,
  postedAt: null,
  decline: null,
  ...fields,
});
const rivalry = (fields: Partial<SlurpRivalry>): SlurpRivalry => ({
  id: "r1",
  fromId: "mira",
  toId: "kai",
  cause: "a stolen trend",
  stage: "feud",
  startedAt: STAMP,
  stageAt: STAMP,
  ending: null,
  told: [],
  ...fields,
});
const creator = (id: string, fields: Partial<SlurpTieCreator> = {}): SlurpTieCreator => ({
  id,
  name: id,
  text: "",
  tags: [],
  automatic: true,
  followers: 100,
  ...fields,
});

// --- 1. Tie Undo ------------------------------------------------------------------------------------
{
  const ties = { ...SLURP_NO_TIES, collabs: [collab({})], blocked: [] };
  const key = slurpPairKey("mira", "kai");
  const removed = slurpUndoTie({ ties, couples: [] }, { kind: "removeCollab", id: "c1", blocked: key });
  assert.deepEqual(removed?.ties.collabs, [], "the suggested collab goes");
  assert.deepEqual(removed?.ties.blocked, [key], "a pair the play unblocked is blocked again");
  assert.equal(
    slurpUndoTie(
      { ties: { ...ties, collabs: [collab({ status: "planned" })] }, couples: [] },
      { kind: "removeCollab", id: "c1" },
    ),
    null,
    "a collab already being made stays",
  );
  assert.equal(slurpUnblockedBy({ ...SLURP_NO_TIES, blocked: [key] }, "kai", "mira"), key);
  assert.equal(slurpUnblockedBy(SLURP_NO_TIES, "kai", "mira"), null);

  const asked = collab({});
  const pushed = { ...SLURP_NO_TIES, collabs: [collab({ status: "agreed", answeredAt: STAMP })] };
  assert.equal(
    slurpUndoTie({ ties: pushed, couples: [] }, { kind: "restoreCollab", collab: asked })?.ties.collabs[0]?.status,
    "asked",
    "push-collab can be taken back while they have only agreed",
  );
  assert.equal(
    slurpUndoTie(
      { ties: { ...pushed, collabs: [collab({ status: "planned" })] }, couples: [] },
      { kind: "restoreCollab", collab: asked },
    ),
    null,
  );

  const feud = rivalry({});
  const cooling = { ...SLURP_NO_TIES, rivalries: [rivalry({ stage: "cooling", ending: "calmed" })] };
  assert.equal(
    slurpUndoTie({ ties: cooling, couples: [] }, { kind: "restoreRivalry", rivalry: feud })?.ties.rivalries[0]?.stage,
    "feud",
    "cool-rivalry can be taken back while it is cooling",
  );
  assert.equal(
    slurpUndoTie(
      { ties: { ...SLURP_NO_TIES, rivalries: [rivalry({ stage: "over" })] }, couples: [] },
      { kind: "restoreRivalry", rivalry: feud },
    ),
    null,
    "a rivalry that already ended stays ended",
  );

  // A couple: Undo keeps the page opened since, and refuses when a partner is with someone new.
  const before = { ...newSlurpCouple("k1", "mira", "kai", "player", STAMP), stage: "together" as const };
  const page = { accountId: "page-1", openedAt: STAMP, closedAt: null };
  const split = { ...before, stage: "split" as const, ending: "breakup" as const, page };
  const restored = slurpUndoTie({ ties: SLURP_NO_TIES, couples: [split] }, { kind: "restoreCouple", couple: before });
  assert.equal(restored?.couples[0]?.stage, "together");
  assert.deepEqual(restored?.couples[0]?.page, page, "the shared page stays as it is now");
  const moved = { ...newSlurpCouple("k2", "mira", "rue", "player", STAMP), stage: "dating" as const };
  assert.equal(
    slurpUndoTie({ ties: SLURP_NO_TIES, couples: [split, moved] }, { kind: "restoreCouple", couple: before }),
    null,
    "Mira is with Rue now: the breakup is not taken back into two couples",
  );
  assert.equal(
    slurpUndoTie({ ties: SLURP_NO_TIES, couples: [{ ...before, page }] }, { kind: "removeCouple", id: "k1" }),
    null,
    "a couple that opened a page since is not removed (the page would lose its owner)",
  );
  assert.deepEqual(
    slurpUndoTie({ ties: SLURP_NO_TIES, couples: [before] }, { kind: "removeCouple", id: "k1" })?.couples,
    [],
  );

  // The preview says what the run keeps.
  const world = {
    creators: [creator("mira"), creator("kai")],
    avatars: new Map<string, string | null>(),
    ties: SLURP_NO_TIES,
    couples: [{ ...before, page }],
  };
  assert.equal(
    slurpPreviewTieLever(world, "steer-couple", { coupleId: "k1", steer: "breakUp" }, AT).reversible,
    false,
    "a breakup with an open page is not offered as reversible",
  );
  assert.equal(slurpPreviewTieLever(world, "couple-page", { coupleId: "k1", open: false }, AT).reversible, false);
  assert.ok(SLP_ACTION_META["push-collab"].reversible && SLP_ACTION_META["cool-rivalry"].reversible);
  assert.ok(SLP_ACTION_META["steer-storyline"].reversible);
}

// --- 2. Steering Undo and dry runs --------------------------------------------------------------------
{
  assert.deepEqual(
    slpUndoPatch({ mood: "angry", pace: "busy" }, { mood: "sad", pace: "usual" }, { mood: "happy", pace: "busy" }),
    { pace: "usual" },
    "the mood changed again since, so only the pace goes back",
  );
  assert.deepEqual(slpUndoPatch({ mood: "angry" }, { mood: "sad" }, undefined), { mood: "sad" }, "an old entry");
  assert.deepEqual(slpStirPlayInput({ accountId: "mira", preview: true, happen: true }), {
    accountId: "mira",
    happen: true,
  });
  assert.deepEqual(
    slpSortStirSteps([{ action: "offer-brand-deal", input: { accountId: "mira", preview: true } }]).plays[0]?.input,
    { accountId: "mira" },
    "the card shows the input that will run",
  );
}

// --- 3. Suggestions --------------------------------------------------------------------------------
{
  const person = (id: string, fields: Partial<SlpStirLiveInput["creators"][number]> = {}) => ({
    id,
    name: id,
    avatarUrl: null,
    automatic: true,
    lastPostAt: "2026-09-01T00:00:00Z",
    pace: "usual",
    ideas: 0,
    ...fields,
  });
  const input: SlpStirLiveInput = {
    at: AT,
    creators: [person("page", { couplePage: true, lastPostAt: null }), person("mira"), person("kai"), person("rue")],
    couples: [
      { id: "k1", aId: "a", bId: "b", stage: "rocky", stageAt: STAMP },
      { id: "k2", aId: "c", bId: "d", stage: "rocky", stageAt: STAMP },
    ],
    collabs: [],
    rivalries: [],
    events: [],
    owed: [],
    firstVisit: false,
    matches: [{ aId: "mira", bId: "kai" }],
  };
  const shown = slpStirSuggestions(input);
  assert.deepEqual(
    shown.map((entry) => entry.kind),
    ["rocky", "match", "quiet"],
    "one of each kind first, love first",
  );
  assert.ok(!shown.some((entry) => entry.who.some((who) => who.id === "page")), "a couple page is never quiet");
  assert.deepEqual(shown[1]?.step, { action: "set-up-couple", input: { aId: "mira", bId: "kai" } });
  const later = slpStirSuggestions({ ...input, dismissed: new Set(["rocky:k1", "match:mira:kai"]) });
  assert.deepEqual(
    later.map((entry) => entry.id),
    ["rocky:k2", "quiet:mira", "quiet:kai"],
    "what the player put away stays away; the next of each kind moves up",
  );
  const first = slpStirSuggestions({ ...input, couples: [], firstVisit: true });
  assert.equal(first[0]?.id, "first:mira:kai", "the first visit offers the best match");
  assert.ok(!first.some((entry) => entry.kind === "match"), "and not the same two again as a match");
  const putAway = slpStirSuggestions({
    ...input,
    couples: [],
    firstVisit: true,
    dismissed: new Set(["first:mira:kai"]),
  });
  assert.ok(
    !putAway.some((entry) => entry.id === "match:mira:kai"),
    "the first-visit pair put away does not come back as a match",
  );
  const noMatch = slpStirSuggestions({ ...input, couples: [], firstVisit: true, matches: [] });
  assert.equal(noMatch[0]?.id, "first:mira:kai", "without a match, the first two Creators, never a couple page");

  const matches = slurpCoupleMatches(
    [
      creator("mira", { tags: ["cooking", "travel"] }),
      creator("kai", { tags: ["cooking", "travel"] }),
      creator("rue", { tags: ["cooking", "travel"], automatic: false }),
    ],
    new Set(),
  );
  assert.deepEqual(
    matches.map(({ a, b }) => [a.id, b.id]),
    [["mira", "kai"]],
    "only free Creators Slurp posts for, with chemistry",
  );
  assert.deepEqual(slurpCoupleMatches([creator("mira"), creator("kai")], new Set()), [], "no chemistry, no match");
}

// --- 4. The planner ----------------------------------------------------------------------------------
{
  const [system, user] = buildSlpStirPlanMessages({
    text: "set her up",
    creators: [
      { id: "mira", name: "Mira", handle: "mira", automatic: true, card: "Loud chef; tags: cooking" },
      { id: "me", name: "Me", handle: "me", automatic: false, own: true },
      { id: "them", name: "Them", handle: "them", automatic: false, own: false },
    ],
    world: { couples: [], collabs: [], rivalries: [], events: [], storylines: [] },
    recent: [{ action: "set-up-couple", who: ["mira"], undone: true }],
    followUp: { question: "Who is 'her'?", answer: "Mira" },
  });
  assert.match(user!.content, /mira: Mira \(@mira\): Loud chef; tags: cooking/u);
  assert.match(user!.content, /me: Me \(@me\) — the player's own page/u);
  assert.match(user!.content, /them: Them \(@them\) — another player's page/u);
  assert.match(user!.content, /- set-up-couple \(Mira\), taken back/u);
  assert.match(
    user!.content,
    /# You asked \(quoted\)\nWho is 'her'\?\n# The player's answer \(quoted content\)\nMira/u,
  );
  assert.doesNotMatch(user!.content, /preview: True/u, "the planner never hears of a dry run");
  assert.match(system!.content, /Undo in Recent plays/u);
}

// --- 5. The Stir tab's rules and the new levers --------------------------------------------------------
{
  const who = [{ id: "mira", name: "Mira", avatarUrl: null }];
  const live = (kind: string, state: string, id: string) =>
    ({ id, kind, who, state, label: null, until: null }) as Parameters<typeof slpStirLiveLever>[0];
  assert.deepEqual(slpStirLiveLever(live("couple", "dating", "couple:k1")), { action: "steer-couple", pick: "k1" });
  assert.deepEqual(slpStirLiveLever(live("collab", "asked", "collab:c1")), { action: "push-collab", pick: "c1" });
  assert.equal(slpStirLiveLever(live("collab", "planned", "collab:c1")), null, "nothing to push once planned");
  assert.equal(slpStirLiveLever(live("rivalry", "cooling", "rivalry:r1")), null);
  assert.deepEqual(slpStirLiveLever(live("ideas", "queued", "ideas:mira")), { action: "add-idea", who: ["mira"] });
  assert.equal(slpStirLiveLever(live("event", "running", "event:slurpcon")), null);

  const empty = { couples: [], collabs: [], rivalries: [], storylines: [], events: [] } as never;
  assert.equal(slpStirDeckNeed("steer-couple", empty), "couple");
  assert.equal(slpStirDeckNeed("start-event", empty), "event");
  assert.equal(slpStirDeckNeed("set-up-couple", empty), null, "a pair needs nothing but two Creators");
  assert.equal(
    slpStirDeckNeed("couple-page", { ...(empty as object), couples: [{ stage: "sparks" }] } as never),
    "datingCouple",
    "a crush is not enough for a shared page, and the card says so",
  );
  assert.equal(slpStirDeckNeed("invent-event", empty), null, "a made-up event needs nothing");
  assert.equal(slpStirDeckNeed("steer-couple", undefined), null, "no view yet: nothing is greyed out");

  const play = {
    id: "p1",
    at: STAMP,
    origin: "deck" as const,
    undoable: false,
    undone: false,
    steps: [{ action: "write-post", input: { accountId: "mira" }, ok: true, error: null, ref: { postId: "post-1" } }],
  };
  assert.deepEqual(slpStirPlayTarget(play), { accountId: "mira", postId: "post-1" }, "a written post opens itself");
  assert.equal(slpStirPlayTarget({ ...play, steps: [{ ...play.steps[0]!, input: { eventId: "e" } }] }), null);

  for (const name of ["start-storyline", "set-tip-goal", "new-look", "invent-event"] as const)
    assert.ok(SLP_ACTION_META[name].deck && SLP_ACTION_META[name].reversible, `${name} is a deck card with Undo`);
  assert.deepEqual(SLP_ACTIONS["invent-event"].schema.parse({ name: "Heatwave" }), {
    name: "Heatwave",
    guidance: "",
    days: 1,
  });
  assert.equal(SLP_ACTIONS["invent-event"].schema.safeParse({ name: "x", days: 30 }).success, false, "at most 14 days");
  assert.equal(
    SLP_ACTIONS["start-storyline"].schema.safeParse({ accountId: "a", title: "t", withIds: ["b", "c", "d"] }).success,
    false,
    "a crossover shares at most three Creators",
  );
  assert.equal(
    SLP_ACTIONS["set-tip-goal"].schema.safeParse({ accountId: "a", label: "cam", target: 0 }).success,
    false,
  );
}

console.log("slurp2-stir-undo: ok");
