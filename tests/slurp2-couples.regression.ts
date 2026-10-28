/**
 * 7b-couples: two Creators with their own pages who get together. Fit (never against either card),
 * the lifecycle on the world clock, the story beats (one post per moment each, joint posts on both
 * pages), the opt-in shared page (its own posts, the split, closing on a breakup), the partner
 * scene hook, the DM role header and the fans' reactions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  newSlurpCouple,
  slurpAdvanceCouples,
  slurpBreakUp,
  slurpCloseCouplePage,
  slurpCoupleActive,
  slurpCoupleFor,
  slurpCoupleOfPage,
  slurpCouplePageOpenable,
  slurpCouplePostIdsFor,
  slurpCoupleTold,
  slurpOpenCouplePage,
  slurpSetUpCouple,
  slurpSettleCouplePost,
  slurpSteerCouple,
  type SlurpCouple,
  type SlurpCouplesInput,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import { readSlurpCouples } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-read.ts";
import { slurpCoupleFit } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-fit.ts";
// Moved with polyamory (0.3.5): the couple-page helpers live with the group rules.
import {
  slurpCoupleBuzz,
  slurpCouplePageSplit,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-group.ts";
// U: the relationship line moved out of the couples module (import path only).
import { slurpRelationshipLine } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";
import {
  slurpPairKey,
  slurpPostIncomeParts,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import { readSlurpTieStamp } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-tie-stamp.ts";
import { slurpCoupleBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-couple-beats.ts";
import { slurpTieBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-tie-beats.ts";
import { parseSlurpBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import { slurpSpiceAngle } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-spice.ts";
import { slurpDmRoleHeader } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles.ts";
import { compileSlurpFlavourBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-flavour.ts";
import { slurpCoupleReactionBodies } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";
import { SLP_DEFAULT_SPICE } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-spice.ts";

const creator = (id: string, text: string, tags: string[], over: Partial<SlurpTieCreator> = {}): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1) + " Vale",
  text,
  tags,
  automatic: true,
  followers: 1000,
  gender: null,
  cardPartners: [],
  ...over,
});
const mira = creator(
  "mira",
  "Climbing coach. A hopeless romantic, lives for bouldering and gym training.",
  ["fitness"],
  {
    gender: "female",
  },
);
const kai = creator("kai", "Personal trainer, flirty, runs every morning and lifts at night.", ["fitness"], {
  gender: "male",
});
const rue = creator("rue", "Tattoo artist. Draws all day. Single and fine with it.", ["art"], { gender: "female" });
const tess = creator("tess", "Painter and illustrator, lesbian, romantic about everything.", ["art"], {
  gender: "female",
});
const jonas = creator("jonas", "Baker. Has a girlfriend, Lena, and a sourdough starter.", ["food"], {
  gender: "male",
  cardPartners: ["Lena"],
});
const zen = creator("zen", "Yoga teacher. Never dates anyone, it is not for them.", ["fitness"], { gender: "other" });
const ace = creator("ace", "An ace climber who never dates fans. Loves bouldering.", ["fitness"], { gender: "male" });
const me = creator("me", "Gym girl who loves lifting.", ["fitness"], { automatic: false, gender: "female" });
const cast = [mira, kai, rue, tess, jonas, zen, ace, me];
const names = new Map<string, string>([
  ...cast.map((entry) => [entry.id, entry.name] as const),
  ["page-1", "Mira & Kai"],
]);
let counter = 0;
const newId = () => `c-${(counter += 1)}`;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const T0 = Date.parse("2026-10-01T09:00:00Z");
const root = join(fileURLToPath(new URL("..", import.meta.url)), "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const input = (at: number, over: Partial<SlurpCouplesInput> = {}): SlurpCouplesInput => ({
  creators: cast,
  at: new Date(at),
  activity: 1,
  storylines: [],
  rivals: new Set(),
  collabbedWith: new Map(),
  newId,
  ...over,
});

// --- 1. Fit: only where both cards allow it ------------------------------------------------------
{
  const fit = slurpCoupleFit(mira, kai);
  assert.ok(fit.fits, "two gym people, one of them romantic, fit");
  assert.ok(fit.chemistry >= 3, "shared tag (2) + interest + romance");
  assert.equal(slurpCoupleFit(mira, jonas).misfit, "taken", "a card with a partner is taken");
  const lena = creator("lena", "Florist.", [], { gender: "female" });
  const withLena = slurpCoupleFit({ ...jonas, cardPartners: ["Lena Berg"] }, lena);
  assert.ok(withLena.fits && withLena.cards, "the card's own partner on Slurp: the cards make them a couple");
  assert.equal(slurpCoupleFit(zen, mira).misfit, "noDating", "a card that never dates is never paired");
  assert.ok(slurpCoupleFit(ace, mira).fits, "'never dates fans' is about fans, and 'ace climber' is not asexual");
  assert.equal(slurpCoupleFit(creator("x", "Asexual and proud, loves climbing.", ["fitness"]), mira).misfit, "notInto");
  assert.equal(slurpCoupleFit(tess, kai).misfit, "orientation", "a lesbian card is not paired with a man");
  assert.ok(slurpCoupleFit(tess, rue).fits, "a lesbian card with a woman fits");
  // 0.3.17: the player's romance setting, per Creator: off, or only with some Creators.
  assert.ok(slurpCoupleFit(mira, kai).fits, "no setting changes nothing");
  assert.deepEqual(
    slurpCoupleFit({ ...mira, romance: { off: true, only: [] } }, kai),
    { fits: false, misfit: "romance", chemistry: 0, cards: false },
    "romance off keeps a Creator out of every couple",
  );
  assert.equal(slurpCoupleFit(kai, { ...mira, romance: { off: false, only: ["someone-else"] } }).misfit, "romance");
  assert.ok(slurpCoupleFit({ ...mira, romance: { off: false, only: [kai.id] } }, kai).fits, "the picked one fits");
  assert.ok(
    slurpCoupleFit({ ...mira, romance: { off: true, only: [] } }, { ...kai, automatic: false }).fits,
    "a crush on the player's own page is not held to it",
  );
  assert.equal(
    slurpCoupleFit(tess, { ...rue, gender: null }).misfit,
    "orientation",
    "stated orientation and unknown gender: not guessed",
  );
  assert.ok(slurpCoupleFit(rue, { ...kai, gender: null }).fits, "no stated orientation takes anyone");
  assert.equal(slurpCoupleFit(mira, mira).misfit, "same");
}

// --- 2. Storage round trip ------------------------------------------------------------------------
{
  const couple = slurpOpenCouplePage(
    slurpCoupleTold(newSlurpCouple("c-x", "mira", "kai", "player", new Date(T0).toISOString()), ["mira:m1"]),
    "page-1",
    new Date(T0 + HOUR),
  );
  const [back] = readSlurpCouples(JSON.parse(JSON.stringify([couple, { id: "bad" }, "junk"])));
  assert.deepEqual(back, couple, "a couple survives storage; junk is dropped");
  assert.deepEqual(readSlurpCouples(null), []);
}

// --- 3. Lifecycle on the world clock (120 days, looks every 6 hours) ------------------------------
function run(days: number, over: Partial<SlurpCouplesInput> = {}, start: SlurpCouple[] = []) {
  counter = 0; // same ids, same world
  let couples = start;
  const stages = new Set<string>();
  const kinds = new Map<string, number>();
  for (let at = T0; at < T0 + days * DAY; at += 6 * HOUR) {
    couples = slurpAdvanceCouples(couples, input(at, over));
    const live = couples.filter(slurpCoupleActive);
    const people = live.flatMap((couple) => [couple.aId, couple.bId]);
    assert.equal(new Set(people).size, people.length, "one active couple per Creator");
    assert.ok(live.filter((couple) => couple.origin === "world").length <= 2, "at most two world couples");
    for (const couple of couples) {
      stages.add(couple.stage);
      assert.ok(couple.reunions <= 2);
      for (const moment of couple.moments) kinds.set(moment.kind, (kinds.get(moment.kind) ?? 0) + 1);
    }
  }
  return { couples, stages, kinds };
}
{
  const first = run(120);
  const again = run(120);
  assert.deepEqual(
    first.couples.map((couple) => [couple.aId, couple.bId, couple.stage]),
    again.couples.map((couple) => [couple.aId, couple.bId, couple.stage]),
    "deterministic",
  );
  for (const couple of first.couples) {
    const a = cast.find((entry) => entry.id === couple.aId)!;
    const b = cast.find((entry) => entry.id === couple.bId)!;
    const fit = slurpCoupleFit(a, b);
    assert.ok(fit.fits, `${a.id}+${b.id} fit both cards`);
    if (couple.origin === "world") {
      assert.ok(fit.chemistry >= 2 && a.automatic && b.automatic, "the world starts couples only with chemistry");
    }
  }
  assert.ok(!first.couples.some((couple) => [couple.aId, couple.bId].includes("jonas")), "taken is never paired");
  assert.ok(!first.couples.some((couple) => [couple.aId, couple.bId].includes("zen")), "a no-dating card never");
  assert.ok(
    !first.couples.some((couple) => [couple.aId, couple.bId].includes("me")),
    "the world never picks your page",
  );
  assert.equal(run(60, { activity: 0 }).couples.length, 0, "activity off starts nothing");

  // One couple's whole story, over many seeds: every beat type shows up somewhere.
  const kinds = new Map<string, number>();
  let breakups = 0;
  let reunions = 0;
  let fizzled = 0;
  for (let seed = 0; seed < 40; seed += 1) {
    const start = [newSlurpCouple(`s-${seed}`, "mira", "kai", "player", new Date(T0).toISOString())];
    const story = run(200, { activity: 0 }, start);
    for (const [kind, count] of story.kinds) kinds.set(kind, (kinds.get(kind) ?? 0) + count);
    const couple = story.couples.find((entry) => entry.id === `s-${seed}`)!;
    if (couple.moments.some((moment) => moment.kind === "breakup")) breakups += 1;
    if (couple.reunions > 0) reunions += 1;
    if (couple.ending === "fizzled") fizzled += 1;
  }
  for (const kind of ["flirt", "date", "launch", "anniversary", "fight", "makeup", "breakup"])
    assert.ok((kinds.get(kind) ?? 0) > 0, `the story includes ${kind}`);
  assert.ok(breakups > 0 && breakups < 40, `some couples break up, not all (${breakups}/40)`);
  assert.ok(reunions > 0, "now and then they get back together");
  assert.ok(fizzled < 20, "with chemistry most sparks turn into dating");

  // The cards make a couple from the start; a romance storyline starts one.
  const lena = creator("lena", "Florist who loves flowers.", [], { gender: "female" });
  const withCards = slurpAdvanceCouples(
    [],
    input(T0, { creators: [{ ...jonas, cardPartners: ["Lena"] }, lena], activity: 0 }),
  );
  assert.equal(withCards[0]?.stage, "together");
  assert.equal(withCards[0]?.origin, "card");
  const story = slurpAdvanceCouples([], input(T0, { activity: 0, storylines: [["rue", "kai"]] }));
  assert.equal(story[0]?.origin, "storyline");
  assert.equal(story[0]?.stage, "sparks");
  assert.equal(
    slurpAdvanceCouples([], input(T0, { activity: 0, storylines: [["tess", "kai"]] })).length,
    0,
    "a storyline never overrides a card",
  );
  // Jealousy over a collab with someone else: the one whose partner made it posts it.
  let jealous: SlurpCouple | null = null;
  for (let seed = 0; seed < 40 && !jealous; seed += 1) {
    const start = { ...newSlurpCouple(`j-${seed}`, "mira", "kai", "player", new Date(T0).toISOString(), "together") };
    const next = slurpAdvanceCouples(
      [start],
      input(T0 + 40 * DAY, { activity: 0, collabbedWith: new Map([["kai", "rue"]]) }),
    );
    const moment = next[0]!.moments.find((entry) => entry.withId === "rue");
    if (moment) {
      assert.equal(moment.fromId, "mira", "Mira is the jealous one");
      jealous = next[0]!;
    }
  }
  assert.ok(jealous, "a collab with someone else can make the partner jealous");
}

// --- 4. The player's steering ---------------------------------------------------------------------
{
  const at = new Date(T0);
  // Slice I (user, 2026-09-28): the player can force a couple against a card; the card colors it.
  const forcedType = slurpSetUpCouple([], tess, kai, { at, id: "x" });
  assert.ok(Array.isArray(forcedType), "the player can set them up against a card");
  assert.deepEqual(forcedType[0]!.forced, { misfit: "orientation", byId: "tess" }, "and the card that says no is kept");
  const forcedTaken = slurpSetUpCouple([], mira, jonas, { at, id: "x" });
  assert.ok(Array.isArray(forcedTaken) && forcedTaken[0]!.forced?.misfit === "taken");
  assert.equal(slurpSetUpCouple([], me, { ...kai, automatic: false }, { at, id: "x" }), "noHost");
  const setUp = slurpSetUpCouple([], mira, kai, { at, id: "p1" });
  assert.ok(Array.isArray(setUp) && setUp[0]!.stage === "sparks" && setUp[0]!.moments[0]!.kind === "flirt");
  assert.equal(slurpSetUpCouple(setUp as SlurpCouple[], mira, rue, { at, id: "p2" }), "busy");
  const withMe = slurpSetUpCouple([], me, kai, { at, id: "p3" });
  assert.ok(Array.isArray(withMe), "your own page can be set up with a Creator Slurp posts for");
  let couples = setUp as SlurpCouple[];
  const steer = (value: Parameters<typeof slurpSteerCouple>[2]) => {
    const next = slurpSteerCouple(couples, "p1", value, { at, creators: cast });
    assert.ok(Array.isArray(next), `${value} works here`);
    couples = next as SlurpCouple[];
    return couples[0]!;
  };
  assert.equal(steer("date").moments.at(-1)!.kind, "date");
  assert.equal(slurpSteerCouple(couples, "p1", "patchUp", { at, creators: cast }), "notOpen");
  couples = [{ ...couples[0]!, stage: "together", togetherAt: at.toISOString() }];
  assert.equal(steer("drama").stage, "rocky");
  assert.equal(steer("patchUp").stage, "together");
  assert.equal(steer("breakUp").stage, "split");
  assert.equal(couples[0]!.ending, "breakup");
  const back = steer("reunite");
  assert.equal(back.stage, "dating");
  assert.equal(back.reunions, 1);
  assert.equal(back.moments.at(-1)!.kind, "reunion");
}

// --- 5. Beats: one post per moment each; joint posts on both pages; the shared page ----------------
{
  const at = new Date(T0 + 2 * HOUR);
  let couple: SlurpCouple = {
    ...newSlurpCouple("b1", "mira", "kai", "player", new Date(T0).toISOString(), "together"),
    togetherAt: new Date(T0).toISOString(),
  };
  couple = { ...couple, moments: [{ id: "launch:1", kind: "launch", at: new Date(T0).toISOString(), detail: "" }] };
  const beat = slurpCoupleBeat({ creatorId: "mira", sequence: 1, couples: [couple], names, at })!;
  assert.ok(beat, "a launch always takes the next ordinary slot");
  assert.match(beat.line, /official now/u);
  // U (user: couple = life, collab = work): each posts their own launch; no joint post, no tag, no split.
  assert.doesNotMatch(beat.line, /both your pages/u, "a launch is their own post");
  assert.match(beat.line, /not a collab/u);
  assert.equal(beat.tie.kind, "couple");
  assert.equal(beat.tie.joint, undefined);
  assert.equal(beat.tie.partnerId, "kai");
  assert.deepEqual(beat.cast, ["Kai Vale"]);
  assert.ok(!/[{}[\]]|:\s*"/u.test(beat.line), "plain words, no JSON");
  const parsed = parseSlurpBeat(JSON.stringify(beat));
  assert.deepEqual(parsed?.tie, beat.tie, "the stored plan parses back with its stamp");
  // Told once each; a joint one is told for both.
  const told = slurpCoupleTold(couple, ["mira:launch:1", "kai:launch:1"]);
  assert.equal(slurpCoupleBeat({ creatorId: "kai", sequence: 2, couples: [told], names, at }), null);
  // Teasers never take it.
  assert.equal(
    slurpTieBeat({
      creatorId: "mira",
      creatorText: "",
      sequence: 1,
      ties: { collabs: [], rivalries: [], blocked: [], advancedAt: null },
      deals: [],
      couples: [couple],
      names,
      intents: ["teaser"],
      at,
    }),
    null,
  );
  // Small moments only now and then; jealousy only for the jealous one.
  const small: SlurpCouple = {
    ...couple,
    moments: [{ id: "jealous:1", kind: "jealous", at: new Date(T0).toISOString(), detail: "x", fromId: "kai" }],
  };
  // U: an everyday cameo of the partner can take other slots; only the jealous moment is counted here.
  let kaiPosts = 0;
  for (let sequence = 0; sequence < 40; sequence += 1) {
    assert.notEqual(
      slurpCoupleBeat({ creatorId: "mira", sequence, couples: [small], names, at })?.tie.moment,
      "jealous",
    );
    if (slurpCoupleBeat({ creatorId: "kai", sequence, couples: [small], names, at })?.tie.moment === "jealous")
      kaiPosts += 1;
  }
  assert.ok(kaiPosts > 8 && kaiPosts < 32, `a small moment now and then (${kaiPosts}/40)`);
  // Old news is let go (U: a cameo may still take the slot, never the old launch).
  assert.notEqual(
    slurpCoupleBeat({ creatorId: "mira", sequence: 1, couples: [couple], names, at: new Date(T0 + 6 * DAY) })?.tie
      .moment,
    "launch",
  );

  // The shared page: opt-in, its first post, page turns, posts that belong to the page.
  assert.ok(slurpCouplePageOpenable(couple));
  assert.ok(!slurpCouplePageOpenable({ ...couple, stage: "sparks" }), "no page for a flirt");
  const opened = slurpOpenCouplePage(told, "page-1", new Date(T0 + HOUR));
  assert.ok(!slurpCouplePageOpenable(opened), "one open page");
  const hello = slurpCoupleBeat({ creatorId: "mira", sequence: 3, couples: [opened], names, at })!;
  assert.equal(hello.tie.moment, "pageOpen");
  assert.equal(hello.tie.pageId, "page-1");
  assert.equal(hello.tie.hostId, "mira");
  assert.match(hello.line, /Mira & Kai, the page you two share/u);
  const quiet = slurpCoupleTold(opened, ["mira:" + opened.moments.at(-1)!.id, "kai:" + opened.moments.at(-1)!.id]);
  let pageTurns = 0;
  for (let sequence = 0; sequence < 200; sequence += 1) {
    const turn = slurpCoupleBeat({ creatorId: "kai", sequence, couples: [quiet], names, at });
    // U: the other beats here are everyday cameos on their own page.
    if (turn && turn.tie.moment !== "cameo") {
      assert.equal(turn.tie.pageId, "page-1");
      pageTurns += 1;
    }
  }
  assert.ok(pageTurns > 30 && pageTurns < 75, `about one slot in four goes to the shared page (${pageTurns}/200)`);
  // A joint moment while the page is open goes to the page.
  const anniversary: SlurpCouple = {
    ...quiet,
    moments: [
      ...quiet.moments,
      { id: "anniversary:1", kind: "anniversary", at: at.toISOString(), detail: "one month" },
    ],
  };
  const onPage = slurpCoupleBeat({ creatorId: "mira", sequence: 1, couples: [anniversary], names, at })!;
  assert.equal(onPage.tie.pageId, "page-1");
  assert.match(onPage.line, /^One month with Kai Vale today/u);

  // A breakup closes the page gracefully: a goodbye post on the page, the breakup on their own pages.
  const split = slurpBreakUp(quiet, new Date(T0 + 3 * HOUR));
  assert.equal(split.stage, "split");
  assert.ok(split.page?.closedAt, "the page closes");
  const kindsAfter = split.moments.slice(-2).map((moment) => moment.kind);
  assert.deepEqual(kindsAfter, ["breakup", "pageClose"]);
  const goodbye = slurpCoupleBeat({
    creatorId: "kai",
    sequence: 1,
    couples: [split],
    names,
    at: new Date(T0 + 4 * HOUR),
  })!;
  assert.ok(goodbye.tie.moment === "pageClose" || goodbye.tie.moment === "breakup");
  const both = slurpCoupleTold(split, [`kai:${split.moments.at(-1)!.id}`, `mira:${split.moments.at(-1)!.id}`]);
  const breakup = slurpCoupleBeat({
    creatorId: "kai",
    sequence: 1,
    couples: [both],
    names,
    at: new Date(T0 + 4 * HOUR),
  })!;
  assert.equal(breakup.tie.moment, "breakup");
  assert.equal(breakup.tie.pageId, undefined, "the breakup goes on their own page");
  assert.equal(slurpCloseCouplePage(split, new Date()), split, "closing twice changes nothing");
  assert.equal(slurpCoupleOfPage([split], "page-1")?.id, split.id);
}

// --- 6. Money: joint posts split like a collab; a shared page pays both --------------------------
{
  const joint = { kind: "couple", id: "b1", partnerId: "kai", moment: "launch", momentId: "m", joint: true };
  assert.deepEqual(slurpPostIncomeParts({ authorAccountId: "mira", metadata: { slurpTie: joint } }, 101), [
    { creatorId: "mira", amount: 51 },
    { creatorId: "kai", amount: 50 },
  ]);
  const page = { kind: "couple", id: "b1", partnerId: "kai", pageId: "page-1", hostId: "mira" };
  assert.deepEqual(
    slurpPostIncomeParts({ authorAccountId: "page-1", metadata: { slurpTie: page } }, 40),
    [{ creatorId: "page-1", amount: 40 }],
    "a page post pays the page; the page's earnings are split below",
  );
  const own = { kind: "couple", id: "b1", partnerId: "kai", moment: "fight" };
  assert.deepEqual(slurpPostIncomeParts({ authorAccountId: "mira", metadata: { slurpTie: own } }, 40), [
    { creatorId: "mira", amount: 40 },
  ]);
  for (const amount of [0, 1, 7, 100, 999]) {
    const [a, b] = slurpCouplePageSplit(amount);
    assert.equal(a + b, amount, "no coin lost or made");
    assert.ok(a - b === 0 || a - b === 1);
  }
  assert.deepEqual(readSlurpTieStamp({ slurpTie: page }), page, "the stamp keeps page and writer");
  // Joint posts show on the partner's page.
  const settled = slurpSettleCouplePost(
    newSlurpCouple("b2", "mira", "kai", "player", new Date(T0).toISOString()),
    "post-9",
  );
  assert.deepEqual(slurpCouplePostIdsFor([settled], "kai"), ["post-9"]);
  assert.deepEqual(slurpCouplePostIdsFor([settled], "rue"), []);
  assert.equal(slurpSettleCouplePost(settled, "post-9"), settled, "settled once");
}

// --- 7. Partner scenes: the couple partner, within both levels and hard noes ----------------------
{
  const spiceCreator = {
    accountId: "mira",
    text: "Climbing coach.",
    turnOns: [],
    hardNoes: [],
    anchors: null,
  };
  const partners = new Set<string>();
  for (let sequence = 0; sequence < 300; sequence += 1) {
    const angle = slurpSpiceAngle({
      level: "explicit",
      ceiling: "explicit",
      access: "locked",
      teaser: false,
      creator: spiceCreator,
      spice: SLP_DEFAULT_SPICE,
      collabs: ["Rue Vale"],
      couple: "Kai Vale",
      recent: [],
      sequence,
    });
    if (angle?.partner) partners.add(`${angle.partner.kind}:${angle.partner.name}`);
  }
  assert.ok(partners.has("couple:Kai Vale"), "the couple partner is the partner in partner scenes");
  assert.ok(![...partners].some((entry) => entry.startsWith("collab")), "taken: no collab partner scenes");
  const noPartner = new Set<string>();
  for (let sequence = 0; sequence < 300; sequence += 1) {
    const angle = slurpSpiceAngle({
      level: "explicit",
      ceiling: "explicit",
      access: "locked",
      teaser: false,
      creator: spiceCreator,
      spice: SLP_DEFAULT_SPICE,
      collabs: ["Rue Vale"],
      couple: null,
      recent: [],
      sequence,
    });
    if (angle?.partner) noPartner.add(angle.partner.kind);
  }
  assert.deepEqual([...noPartner], ["unnamed"], "a partner who would not: only someone unnamed");
  const spiceSource = read("server/src/slp/features/feed/slp-post-spice.ts");
  assert.match(
    spiceSource,
    /tie\?\.kind === "collab" \|\| tie\?\.kind === "couple" \? tie\.partnerId/u,
    "lower of both levels",
  );
  assert.match(spiceSource, /readSlurpCouplePartner\(db, creatorId\)/u);
  assert.match(spiceSource, /"fight", "jealous", "breakup", "pageClose"/u, "no spicy angle on a fight or breakup");
}

// --- 8. DMs know the relationship ------------------------------------------------------------------
{
  const together: SlurpCouple = {
    ...newSlurpCouple("d1", "mira", "kai", "player", new Date(T0).toISOString(), "together"),
  };
  assert.match(slurpRelationshipLine([together], "mira", names, { withId: "kai" }), /^Kai Vale is your partner/u);
  assert.match(slurpRelationshipLine([together], "mira", names), /You are with Kai Vale, another Creator on Slurp/u);
  const ex = slurpBreakUp(together, new Date(T0 + 3 * DAY));
  assert.match(
    slurpRelationshipLine([ex], "mira", names, { withId: "kai", at: new Date(T0 + 5 * DAY) }),
    /your ex\. You broke up 2 days ago/u,
  );
  // U (user: exes show up in posts and DMs): the ex stays in the briefs for a month, then goes.
  assert.match(slurpRelationshipLine([ex], "mira", names, { at: new Date(T0 + 10 * DAY) }), /Kai Vale is your ex/u);
  assert.equal(
    slurpRelationshipLine([ex], "mira", names, { at: new Date(T0 + 40 * DAY) }),
    "",
    "a month after a breakup it is no longer part of every brief",
  );
  assert.equal(slurpRelationshipLine([together], "rue", names), "");
  const header = slurpDmRoleHeader({
    writer: "creator",
    creator: { name: "Mira Vale", handle: "mira" },
    viewer: { name: "Kai", handle: "kai_p" },
    viewerPage: {
      name: "Kai Vale",
      handle: "kai",
      relationship: "Kai Vale is your partner: you two are together, and your fans know.",
      partner: true,
    },
    history: [],
  });
  assert.match(
    header,
    /runs a Creator page on Slurp too[\s\S]*\nKai Vale is your partner/u,
    "the role header says who they are to each other",
  );
  const brief = compileSlurpFlavourBrief(
    {
      accountId: "mira",
      name: "Mira",
      card: { description: "Climbing coach." },
      relationship: "You are with Kai Vale, another Creator on Slurp.",
    },
    { use: "post", sequence: 1 },
  );
  assert.match(brief.text, /You are with Kai Vale/u);
  const flavourSource = read("server/src/slp/data/creators/slp-flavour-source.ts");
  assert.match(
    flavourSource,
    /input\.chat\?\.with === "staff" \|\| input\.chat\?\.partnerId\s*\?\s*""\s*:\s*await readSlurpRelationshipLine/u,
    "Support gets no love life",
  );
  assert.match(
    flavourSource,
    /input\.chat\?\.partnerId\s*\? await partnerLevel/u,
    "their partner gets the lower level, no tease",
  );
  assert.match(
    read("server/src/slp/features/messages/slp-message-generation-service.ts"),
    /slurpCoupleDmPage\(input\.db, viewerPageAccount/u,
  );
}

// --- 9. Fans react; big news draws the crowd -------------------------------------------------------
{
  assert.ok(slurpCoupleReactionBodies("Mira", "Kai", "launch").some((body) => /Mira and Kai/u.test(body)));
  assert.ok(slurpCoupleReactionBodies("Mira", "Kai", "breakup").some((body) => /💔/u.test(body)));
  assert.ok(slurpCoupleReactionBodies("Mira", "Kai", "fight").some((body) => /trouble in paradise/u.test(body)));
  assert.ok(slurpCoupleReactionBodies("Mira", "Kai", "flirt").some((body) => /ship/u.test(body)));
  assert.equal(slurpCoupleBuzz({}), 1);
  assert.equal(slurpCoupleBuzz({ slurpTie: { kind: "rival", id: "r" } }), 1);
  assert.ok(slurpCoupleBuzz({ slurpTie: { kind: "couple", id: "c", moment: "breakup" } }) > 1.5);
  assert.ok(slurpCoupleBuzz({ slurpTie: { kind: "couple", id: "c", moment: "date" } }) > 1);
  const actions = read("server/src/slp/features/world/slp-world-actions.ts");
  assert.match(actions, /slurpCoupleReactionBodies\(sides\.self, sides\.rival, sides\.moment\)/u);
  assert.match(
    read("server/src/slp/features/world/slp-world-operation.ts"),
    /creator\.followers \* slurpCoupleBuzz\(post\.metadata\)/u,
  );
}

// --- 10. Wiring pins --------------------------------------------------------------------------------
{
  assert.match(
    read("server/src/slp/features/feed/slp-generation-service.ts"),
    /authorAccountId: beat\?\.tie\?\.pageId \?\? account\.id/u,
  );
  const reserve = read("server/src/slp/data/feed/reserve/slp-reserve-storage-2.ts");
  assert.match(reserve, /authorAccountId: author\.id/u, "a prepared page post publishes on the page");
  assert.match(reserve, /snapshotForAccount\(author\)/u);
  const context = read("server/src/slp/data/host/slp-storage-context.ts");
  assert.match(
    context,
    /slurpCouplePageSplit\(amount, members\.length\)/u,
    "a shared page's earnings go to every member",
  );
  const service = read("server/src/slp/features/projects/slp-creator-ties-service.ts");
  assert.match(service, /slurpAdvanceCouples\(document\.couples/u, "couples move on the ties' clock");
  assert.match(service, /closeSlurpCouplePages\(db, before\.couples, after\.couples\)/u);
  assert.match(service, /slurpCouplePostIdsFor\(couples, creatorId\)/u, "joint posts on the partner's page");
  assert.match(service, /!slurpIsCouplePage\(account\)/u, "a shared page is not a Creator to pair");
  const couplesService = read("server/src/slp/features/projects/slp-creator-couples-service.ts");
  assert.match(couplesService, /autoPosting: \{ enabled: false/u, "the shared page never posts on its own");
  assert.match(couplesService, /storage\.unsubscribe\(subscription\.viewerAccountId, couple\.page\.accountId\)/u);
  assert.ok(
    !/\b(complete|chat|generate)\w*\(/u.test(couplesService.replace(/generateSlurp\w*/gu, "")),
    "no model call",
  );
  const routes = read("server/src/slp/features/projects/slp-creator-ties-routes.ts");
  for (const route of ['"/slurp/ties/couples"', '"/slurp/ties/couples/:id/steer"', '"/slurp/ties/couples/:id/page"'])
    assert.ok(routes.includes(route), route);
  const panel = read("client/src/slp/features/projects/SlpCollabsPanel.tsx");
  assert.match(panel, /<SlpCouplesSection/u, "Studio: couples next to collabs and rivalries");
  assert.match(panel, /!creator\.couplePage/u);
  assert.match(read("client/src/slp/app/screens/SlpScreenProfile.tsx"), /<SlpProfileCoupleLine/u, "the couple badge");
  assert.match(
    read("client/src/slp/modules/post/SlpPostPartnership.tsx"),
    /data-slurp-partnership=\{couple \? "couple" : "collab"\}/u,
  );
  // In-world copy only.
  const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;
  const copy = Object.entries(en).filter(([key]) =>
    /^ui\.slurp\.(ties\.(couple|moment|setUp)|profile\.couple|post\.coupleBy)/u.test(key),
  );
  assert.ok(copy.length >= 40);
  for (const [key, value] of copy) {
    assert.ok(!/\b(AI|simulat\w*|fake|model|LLM)\b|—/u.test(value), `${key} stays in-world`);
  }
  assert.equal(slurpPairKey("b", "a"), "a|b");
  assert.equal(slurpCoupleFor([], "x"), null);
}

console.log("slurp2 couples regression passed");
