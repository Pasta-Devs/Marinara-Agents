/**
 * 3b: every post and Story has a reason, and the reasons connect over time. Purpose assigned for
 * every kind of plan, a free tease followed by its drop (campaign order, links both ways, the teased
 * spice kind), a Story poll whose winner comes back as a later post, and Stories that link through to
 * the post they are about. Plus the wiring pins for the planner, the publish paths and the viewer.
 */
import assert from "node:assert/strict";
import {
  SLURP_CAMPAIGN_TEMPLATE,
  SLURP_TEASE_CAMPAIGN_TEMPLATE,
  slurpNextCampaignStage,
  type SlurpCampaignStageView,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-campaign.ts";
import {
  SLURP_POLL_ANSWER_AFTER_MS,
  slurpPollAnswerBeat,
  slurpPollAnswerDue,
  slurpPollWinner,
  slurpPostPurpose,
  slurpPostPurposeLine,
  slurpPurposeLinks,
  slurpPurposeMetadata,
  slurpStoryCandidates,
  slurpStoryPoll,
  slurpStoryPurpose,
  type SlurpPurposePost,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-purpose.ts";
import {
  parseSlurpBeat,
  type SlurpCanonAnchors,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import {
  slurpSpiceAngle,
  type SlurpSpiceCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-spice.ts";
import { SLP_DEFAULT_SPICE } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-spice.ts";
import {
  readSlpPurpose,
  slpStoryPollTally,
  SLP_PURPOSE_KINDS,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-post-purpose.ts";
import { slurp2Source } from "./slurp2-source.ts";

const HOUR = 60 * 60_000;
const start = new Date("2026-09-28T09:00:00.000Z");
const later = (ms: number) => new Date(start.getTime() + ms);
const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);

const anchors = (over: Partial<SlurpCanonAnchors> = {}): SlurpCanonAnchors => ({
  people: [{ name: "Tess", relation: "girlfriend" }],
  places: ["the bouldering gym", "Tess's flat", "the roof terrace"],
  work: ["route setting"],
  objects: ["her hangboard", "the old thermos"],
  habits: ["icing her fingers", "night sessions"],
  runningJokes: [],
  palette: {},
  heat: { min: 1, max: 3 },
  ...over,
});
const post = (id: string, over: Partial<SlurpPurposePost> = {}): SlurpPurposePost => ({
  id,
  title: `Title ${id}`,
  content: `Content of ${id}`,
  access: "locked",
  createdAt: start.toISOString(),
  story: false,
  purpose: null,
  ...over,
});
const plainPhrase = (line: string) => {
  assert.doesNotMatch(line, /[{}[\]]|intent|delivery|campaign|metadata|=|_/u, `plain in-world words: ${line}`);
};

// --- 1. Every post gets a reason ------------------------------------------------------------------
const kinds = new Set<string>();
const facts = [
  { stageKind: "teaser" as const, tease: { campaignId: "c1", dropAt: later(3 * HOUR).toISOString() } },
  { stageKind: "set" as const, campaignId: "c1", drop: { teasePostId: "tease-1" } },
  { stageKind: "callback" as const },
  { intent: "behind_the_scenes" as const },
  { promise: true },
  { intent: "request" as const },
  {
    beat: {
      type: "routine_twist",
      anchorKind: "collab",
      anchor: "",
      line: "",
      cast: [],
      place: null,
      tie: { kind: "collab", id: "t" },
    },
  },
  {
    beat: {
      type: "routine_twist",
      anchorKind: "sponsor",
      anchor: "",
      line: "",
      cast: [],
      place: null,
      tie: { kind: "sponsor", id: "t", brand: "PeakFuel" },
    },
  },
  {
    beat: {
      type: "routine_twist",
      anchorKind: "couple",
      anchor: "",
      line: "",
      cast: [],
      place: null,
      tie: { kind: "couple", id: "t" },
    },
  },
  { beat: { type: "routine_twist", anchorKind: "arc", anchor: "", line: "", cast: [], place: null } },
  {
    beat: {
      type: "routine_twist",
      anchorKind: "life",
      anchor: "",
      line: "",
      cast: [],
      place: null,
      sharedId: "life:milestone:1000",
    },
  },
  { intent: "appreciation" as const },
  { pollAnswer: { pollPostId: "poll-1", answer: "the roof terrace" } },
  { intent: "casual" as const },
  {},
] as const;
for (const input of facts) {
  const purpose = slurpPostPurpose(input as Parameters<typeof slurpPostPurpose>[0]);
  assert.ok((SLP_PURPOSE_KINDS as readonly string[]).includes(purpose.kind), "a known purpose");
  kinds.add(purpose.kind);
}
for (const kind of [
  "tease",
  "drop",
  "behind_the_scenes",
  "promote",
  "storyline",
  "answer_fans",
  "thanks",
  "daily_life",
  "poll_answer",
])
  assert.ok(kinds.has(kind), `posts can be ${kind}`);
assert.equal(slurpPostPurpose({ beat: facts[7].beat as never }).subject, "brand", "a sponsored post promotes a brand");
assert.equal(slurpPostPurpose({}).kind, "daily_life", "no other reason: a moment from their day");
// A storyline post with no other reason reads as a storyline beat.
assert.deepEqual(
  slurpPurposeMetadata({ purpose: { kind: "daily_life" }, line: "" }, "x", { storyline: true }).slurpPurpose,
  {
    kind: "storyline",
  },
);
// The stored purpose reads back, junk does not.
assert.deepEqual(
  readSlpPurpose({ slurpPurpose: { kind: "tease", campaignId: "c1", dropAt: "2026-09-28T12:00:00.000Z" } }),
  {
    kind: "tease",
    campaignId: "c1",
    dropAt: "2026-09-28T12:00:00.000Z",
  },
);
assert.equal(readSlpPurpose({ slurpPurpose: { kind: "hype" } }), null);
assert.equal(readSlpPurpose({ slurpPurpose: "tease" }), null);

// --- 2. A tease is followed by its drop ------------------------------------------------------------
assert.deepEqual(
  SLURP_TEASE_CAMPAIGN_TEMPLATE.map((stage) => [stage.kind, stage.access]),
  [
    ["teaser", "public"],
    ["set", "locked"],
    ["callback", ""],
  ],
  "tease first (free), then the drop (locked), then the usual callback",
);
assert.deepEqual(
  SLURP_CAMPAIGN_TEMPLATE.map((stage) => stage.kind),
  ["set", "teaser", "callback"],
  "the set-first campaign is unchanged",
);
const teaseCampaign = (statuses: Record<string, SlurpCampaignStageView["status"]>): SlurpCampaignStageView[] =>
  SLURP_TEASE_CAMPAIGN_TEMPLATE.map((stage, position) => ({
    id: `c1-${stage.kind}`,
    campaignId: "c1",
    kind: stage.kind,
    position,
    access: stage.access,
    status: statuses[stage.kind] ?? (position === 0 ? "claimed" : "planned"),
    dueAt: later(stage.delayMs).toISOString(),
  }));
assert.equal(
  slurpNextCampaignStage(teaseCampaign({}), { at: later(4 * HOUR), access: "locked" }),
  null,
  "no drop before the tease is out",
);
const teased = teaseCampaign({ teaser: "completed" });
assert.equal(slurpNextCampaignStage(teased, { at: later(2 * HOUR), access: "locked" }), null, "not before it is due");
assert.equal(slurpNextCampaignStage(teased, { at: later(4 * HOUR), access: "public" }), null, "never a free drop");
assert.equal(
  slurpNextCampaignStage(teased, { at: later(4 * HOUR), access: "locked", story: true }),
  null,
  "a drop is a feed post, never a Story",
);
assert.equal(
  slurpNextCampaignStage(teased, { at: later(4 * HOUR), access: "locked" })?.kind,
  "set",
  "the next locked post is the drop",
);
// The tease says a drop is coming and when; the drop says it is what the tease promised.
const teasePurpose = slurpPostPurpose({ tease: { campaignId: "c1", dropAt: later(3 * HOUR).toISOString() } });
const teaseLine = slurpPostPurposeLine(teasePurpose, { at: start });
assert.match(teaseLine, /teases your next locked drop, due in about 3 hours/u);
plainPhrase(teaseLine);
const dropPurpose = slurpPostPurpose({ stageKind: "set", campaignId: "c1", drop: { teasePostId: "tease-1" } });
assert.deepEqual(dropPurpose, { kind: "drop", campaignId: "c1", teasePostId: "tease-1" });
const dropLine = slurpPostPurposeLine(dropPurpose, { at: later(4 * HOUR), teaseTitle: "something is coming tonight" });
assert.match(dropLine, /the drop you teased earlier \(“something is coming tonight”\)/u);
plainPhrase(dropLine);
// Once the drop is up it links its tease and the countdown Stories to itself, and itself to the tease.
const tease = post("tease-1", {
  access: "public",
  purpose: { kind: "tease", campaignId: "c1", dropAt: later(3 * HOUR).toISOString() },
});
const countdown = post("story-1", {
  story: true,
  purpose: { kind: "countdown", campaignId: "c1", dropAt: later(3 * HOUR).toISOString() },
});
const other = post("other", { purpose: { kind: "tease", campaignId: "c2" } });
const links = slurpPurposeLinks({ id: "drop-1", purpose: { kind: "drop", campaignId: "c1" }, story: false }, [
  tease,
  countdown,
  other,
]);
assert.deepEqual(
  links.map((link) => [
    link.postId,
    link.purpose.kind,
    link.purpose.postId ?? link.purpose.teasePostId,
    link.linkedPostId ?? null,
  ]),
  [
    ["tease-1", "tease", "drop-1", null],
    ["story-1", "countdown", "drop-1", "drop-1"],
    ["drop-1", "drop", "tease-1", null],
  ],
  "tease → drop, countdown Story → drop (with its link-through), drop → tease; other campaigns untouched",
);
assert.deepEqual(
  slurpPurposeLinks(
    { id: "drop-1", purpose: { kind: "drop", campaignId: "c1", teasePostId: "tease-1" }, story: false },
    [{ ...tease, purpose: { ...tease.purpose!, postId: "drop-1" } }],
  ),
  [],
  "nothing linked twice",
);
// A tease (or countdown) that goes up after its drop points straight at it.
assert.deepEqual(
  slurpPurposeLinks({ id: "story-2", purpose: { kind: "countdown", campaignId: "c1" }, story: true }, [
    post("drop-1", { purpose: { kind: "drop", campaignId: "c1" } }),
  ]),
  [{ postId: "story-2", purpose: { kind: "countdown", campaignId: "c1", postId: "drop-1" }, linkedPostId: "drop-1" }],
);
// The drop delivers the spicy kind its tease hinted at, when the Creator still allows it.
const spiceCreator: SlurpSpiceCreator = {
  accountId: "mira",
  text: "A climbing coach.",
  turnOns: [],
  hardNoes: [],
  anchors: anchors(),
};
const spiceBase = { ceiling: "explicit" as const, creator: spiceCreator, spice: SLP_DEFAULT_SPICE, recent: [] };
for (let sequence = 0; sequence < 40; sequence += 1) {
  const angle = slurpSpiceAngle({
    ...spiceBase,
    level: "explicit",
    access: "locked",
    teaser: false,
    sequence,
    teasedKind: "toys",
  });
  assert.equal(angle?.kind, "toys", "the teased kind comes back in the drop");
}
const flirtyDrop = slurpSpiceAngle({
  ...spiceBase,
  level: "suggestive",
  access: "locked",
  teaser: false,
  sequence: 3,
  teasedKind: "toys",
});
assert.notEqual(flirtyDrop?.kind, "toys", "a kind above the post's level is never forced in");

// --- 3. A Story poll's answer comes back in a later post ------------------------------------------
const poll = slurpStoryPoll("mira", 7, anchors(), { push: [], avoid: [] });
assert.ok(poll && poll.options.length === 2 && poll.options[0] !== poll.options[1], "two different choices");
const allChoices = [...anchors().places, ...anchors().objects, ...anchors().habits, ...anchors().work];
assert.ok(
  poll!.options.every((option) => allChoices.includes(option)),
  "choices come from the Creator's own life",
);
// Choices never include a topic the player left out, and steering topics are offered.
for (let sequence = 0; sequence < 60; sequence += 1) {
  const avoided = slurpStoryPoll("mira", sequence, anchors(), { push: [], avoid: ["Tess"] });
  assert.ok(!avoided?.options.some((option) => /Tess/u.test(option)), "a left-out topic never becomes a choice");
}
assert.ok(
  Array.from({ length: 40 }, (_, sequence) =>
    slurpStoryPoll("mira", sequence, null, { push: ["gym day", "baking day"], avoid: [] }),
  ).every((plan) => plan?.kind === "topics"),
  "without anchors, the topics the player asked to bring up more",
);
assert.equal(
  slurpStoryPoll("rue", 1, anchors({ places: [], objects: [], habits: [], work: [] }), null),
  null,
  "nothing to choose from: no poll",
);
// The question is the Story's own line (the Creator's voice and language); the choices are code's.
const pollMeta = slurpPurposeMetadata({ purpose: { kind: "poll" }, line: "", poll }, "Wohin als Nächstes? 👀");
assert.equal((pollMeta.poll as { question: string }).question, "Wohin als Nächstes? 👀");
assert.deepEqual(
  (pollMeta.poll as { options: { label: string }[] }).options.map((option) => option.label),
  poll!.options,
);
// The tally: real votes plus a small seeded crowd that grows, the same on the server and in the viewer.
const pollPost = { postId: "poll-1", createdAt: start.toISOString(), optionCount: 2 };
assert.deepEqual(slpStoryPollTally(pollPost, [0, 0], start), [0, 0], "no crowd at the start");
const grown = slpStoryPollTally(pollPost, [0, 0], later(12 * HOUR));
assert.deepEqual(
  grown,
  slpStoryPollTally(pollPost, [0, 0], later(20 * HOUR)),
  "the crowd stops growing after twelve hours",
);
assert.ok(grown[0]! + grown[1]! >= 6 && grown[0]! + grown[1]! <= 18, "a small crowd");
assert.deepEqual(
  slpStoryPollTally(pollPost, [1, 0], later(12 * HOUR)),
  [grown[0]! + 1, grown[1]!],
  "the player's vote counts",
);
assert.equal(slurpPollWinner(["a", "b"], [3, 5], "p"), "b");
assert.ok(["a", "b"].includes(slurpPollWinner(["a", "b"], [4, 4], "p")!), "a tie is settled");
// When the answer is taken up: not too early, not too late, once.
const pollPurpose = { kind: "poll" as const };
assert.equal(slurpPollAnswerDue({ createdAt: start.toISOString(), purpose: pollPurpose }, later(2 * HOUR)), false);
assert.equal(
  slurpPollAnswerDue({ createdAt: start.toISOString(), purpose: pollPurpose }, later(SLURP_POLL_ANSWER_AFTER_MS)),
  true,
);
assert.equal(slurpPollAnswerDue({ createdAt: start.toISOString(), purpose: pollPurpose }, later(80 * HOUR)), false);
assert.equal(
  slurpPollAnswerDue(
    { createdAt: start.toISOString(), purpose: { kind: "poll", answeredAt: later(7 * HOUR).toISOString() } },
    later(8 * HOUR),
  ),
  false,
  "answered once",
);
// The winner is the follow-up post's beat, and a retried slot finds the poll again through it.
const answerBeat = slurpPollAnswerBeat("the roof terrace", "poll-1", anchors(), ["casual"]);
assert.match(answerBeat.line, /Your followers picked this in your Story poll: the roof terrace\./u);
assert.equal(answerBeat.nudgeId, undefined, "not a player idea: nothing to use up");
assert.equal(parseSlurpBeat(JSON.stringify(answerBeat))?.sharedId, "poll:poll-1", "the stored beat keeps the poll");
const answer = slurpPostPurpose({ pollAnswer: { pollPostId: "poll-1", answer: "the roof terrace" } });
assert.deepEqual(answer, { kind: "poll_answer", pollPostId: "poll-1", answer: "the roof terrace" });
assert.match(slurpPostPurposeLine(answer, { at: start }), /picked “the roof terrace” in your Story poll/u);

// --- 4. Stories have jobs and link through ----------------------------------------------------------
const recent = [
  post("new-1", { title: "Moving day, part two", createdAt: later(-2 * HOUR).toISOString() }),
  post("story-a", { story: true, content: "coffee first, boxes later", createdAt: later(-3 * HOUR).toISOString() }),
];
const candidates = slurpStoryCandidates({
  posts: recent,
  comments: [{ postId: "new-1", handle: "jojo", text: "need the full tour!!", createdAt: later(-HOUR).toISOString() }],
  drops: [{ campaignId: "c1", dropAt: later(2 * HOUR).toISOString() }],
  poll,
  at: start,
});
assert.deepEqual(candidates.newPost, { postId: "new-1", title: "Moving day, part two" });
assert.equal(candidates.comment?.handle, "jojo");
assert.equal(candidates.comment?.postTitle, "Moving day, part two");
assert.deepEqual(candidates.countdown, { campaignId: "c1", dropAt: later(2 * HOUR).toISOString() });
assert.equal(candidates.earlier?.count, 1, "an earlier Story today");
const seen = new Map<string, number>();
for (let sequence = 0; sequence < 300; sequence += 1) {
  const plan = slurpStoryPurpose("mira", sequence, candidates, start);
  seen.set(plan.purpose.kind, (seen.get(plan.purpose.kind) ?? 0) + 1);
  if (plan.purpose.kind === "new_post") {
    assert.equal(plan.linkedPostId, "new-1", "a new-post Story links to the post");
    assert.equal(
      slurpPurposeMetadata(plan, "new post is up").noodlerLinkedPostId,
      "new-1",
      "stored as the Story's link",
    );
    assert.match(plan.line, /points your followers to your new post “Moving day, part two”/u);
  }
  if (plan.purpose.kind === "comment_reaction") {
    assert.equal(plan.linkedPostId, "new-1", "a comment reaction links to the post the comment was on");
    assert.deepEqual(plan.purpose.comment, { handle: "jojo", text: "need the full tour!!" });
  }
  if (plan.purpose.kind === "countdown")
    assert.match(plan.line, /counts down to your next drop, due in about 2 hours/u);
  if (plan.purpose.kind === "day_in_life") assert.equal(plan.purpose.part, 2);
  if (plan.line) plainPhrase(plan.line);
}
for (const kind of ["new_post", "countdown", "poll", "day_in_life", "comment_reaction", "daily_life"])
  assert.ok((seen.get(kind) ?? 0) > 0, `Stories can be ${kind}`);
assert.ok((seen.get("countdown") ?? 0) > (seen.get("daily_life") ?? 0), "a real reason beats a plain moment");
assert.equal(
  slurpStoryPurpose("mira", 3, {}, start).purpose.kind,
  "daily_life",
  "nothing going on: the Story is a moment from their day",
);
// Nothing is announced, counted down or answered twice; old posts and comments are not news.
const done = slurpStoryCandidates({
  posts: [
    post("story-b", {
      story: true,
      purpose: { kind: "new_post", postId: "new-1" },
      createdAt: later(-HOUR).toISOString(),
    }),
    post("story-c", {
      story: true,
      purpose: { kind: "countdown", campaignId: "c1" },
      createdAt: later(-HOUR).toISOString(),
    }),
    post("story-d", {
      story: true,
      purpose: { kind: "comment_reaction", comment: { handle: "jojo", text: "need the full tour!!" } },
      createdAt: later(-HOUR).toISOString(),
    }),
    post("story-e", { story: true, purpose: { kind: "poll" }, createdAt: later(-20 * HOUR).toISOString() }),
    post("new-1", { createdAt: later(-2 * HOUR).toISOString() }),
  ],
  comments: [{ postId: "new-1", handle: "jojo", text: "need the full tour!!", createdAt: later(-HOUR).toISOString() }],
  drops: [{ campaignId: "c1", dropAt: later(2 * HOUR).toISOString() }],
  poll,
  at: start,
});
assert.equal(done.newPost, null);
assert.equal(done.countdown, null);
assert.equal(done.comment, null);
assert.equal(done.poll, null, "one poll at a time");
const stale = slurpStoryCandidates({
  posts: [post("old", { createdAt: later(-30 * HOUR).toISOString() })],
  comments: [{ postId: "old", handle: "x", text: "hi", createdAt: later(-60 * HOUR).toISOString() }],
  drops: [],
  poll: null,
  at: start,
});
assert.equal(stale.newPost, null);
assert.equal(stale.comment, null);

// --- 5. Wiring ---------------------------------------------------------------------------------------
const plan = server("features/feed/slp-post-plan-service.ts");
assert.match(
  plan,
  /takeSlurpPollAnswer\(db, account\.id, \{ at, previewOnly \}\)/u,
  "the planner takes up a poll answer",
);
assert.match(
  plan,
  /!directed && !forced && !promise && !nudged && !storyVariation && !isTeaser/u,
  "after ideas, promises and stages; never on a Story or tease",
);
assert.match(
  plan,
  /openSlurpTease\(db, \{ creatorAccountId: account\.id, opportunityId: opportunity\.id, stages, at, dueAt \}\)/u,
);
assert.match(plan, /planSlurpStoryPurpose\(db, \{/u, "an automatic Story gets a job");
assert.match(plan, /story: storyVariation \}\)/u, "a Story slot never runs a drop");
assert.match(
  plan,
  /readSlurpCanonAnchorState\(db, account\.id, ctx\.beats\.canonText\)/u,
  "anchors from the cache only",
);
assert.doesNotMatch(plan, /slurpBeatAnchorsFor/u, "never a fresh card read (a model call) for a purpose");
assert.match(
  plan,
  /linkSlurpPurposePost\(db, \{\s+id: post\.id,\s+authorAccountId: post\.authorAccountId,\s+metadata: post\.metadata,\s+\}\)/u,
);
const generation = server("features/feed/slp-generation-service.ts");
assert.match(generation, /purpose\.line,/u, "the purpose line reaches the prompt");
assert.match(
  generation,
  /\.\.\.slurpPurposeMetadata\(purpose, protectedGenerated\.content, \{ storyline: Boolean\(project\) \}\)/u,
);
assert.match(generation, /teasedKind: purpose\.spiceKind/u);
assert.match(
  server("data/feed/reserve/slp-reserve-storage-2.ts"),
  /await linkSlurpPurposePost\(db, \{/u,
  "the reserve publish links too",
);
assert.match(
  server("features/viewer/slp-viewer-context.ts"),
  /typeof post\.metadata\.noodlerLinkedPostId === "string"/u,
);
assert.doesNotMatch(
  server("features/feed/slp-post-purpose-service.ts"),
  /createSlurpPostProvider|completeSlurp|generateCreatorPost/u,
  "no AI call",
);
const moments = client("app/screens/SlpScreenMoments.tsx");
assert.match(
  moments,
  /onClick=\{\(\) => seePost\(linkedPostIdForStory\(moment\.post\)!\)\}/u,
  "See post opens the post",
);
assert.match(moments, /<SlpCountdownSticker/u);
assert.match(moments, /<SlpPollSticker/u);
assert.match(moments, /<SlpCommentSticker/u);
assert.match(
  client("app/screens/SlpScreenHub.tsx"),
  /slpShowPostInPlace\(postId\) \|\| postCardCtx\.openAuthorProfile/u,
);
assert.match(client("modules/post/SlpPostCard.tsx"), /<SlpPostPurposeNote/u, "the post card shows where a post leads");
// M: the purpose is the first summary row's line ("Why it went up"), in the story model.
assert.match(client("modules/post/slp-deep-details-story.ts"), /slpPurposeSentence\(purpose, locale\) \?\?/u);
const en = JSON.parse(client("locales/en.json")) as Record<string, string>;
assert.equal(en["ui.slurp.moments.viewLinkedPost"], "See post");
for (const key of ["fromPoll", "dropIn", "dropUp", "seeDrop", "seeIt", "pollVotes", "commentFrom"])
  assert.ok(en[`ui.slurp.purpose.${key}`], key);
for (const value of Object.entries(en)
  .filter(([key]) => key.startsWith("ui.slurp.purpose."))
  .map(([, value]) => value))
  assert.doesNotMatch(value, /simulat|fake|AI |purpose|intent/iu, `in-world copy: ${value}`);

console.log("slurp2 post purpose regression passed");
