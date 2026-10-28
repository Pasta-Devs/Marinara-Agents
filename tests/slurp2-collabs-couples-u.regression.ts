/**
 * U (user, 2026-09-28): collabs are WORK, couples are LIFE. A collab is announced, drops on its day on
 * both pages with tags and the agreed split, may be a spicy shoot planned in DMs, and brings fans
 * across. A couple posts their own life with the partner as a cameo (no tag, no split, only a shared
 * page splits), with crushes before and exes after, jealousy over the other's collabs and fans who
 * take it personally. Plus the two I + J2 decisions built here: "Mark as posted" for an owed #ad, and
 * a held drop hour that wins over the player's idea. Old data reads back safely.
 */
import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import {
  readSlurpCreatorTies,
  slurpAgreeCollabInDm,
  slurpPostIncomeParts,
  SLURP_NO_TIES,
  type SlurpCollab,
  type SlurpCreatorTies,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import {
  SLURP_CROSSOVER_MAX,
  slurpAnnounceCollab,
  slurpCollabCrossover,
  slurpCollabDropAt,
  slurpCollabStep,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-collab-work.ts";
import {
  newSlurpCouple,
  slurpAdvanceCouples,
  slurpBreakUp,
  type SlurpCouple,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import { readSlurpCouples } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-read.ts";
// Moved with polyamory (0.3.5): the couple-page helpers live with the group rules.
import { slurpCoupleBuzz } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-group.ts";
import {
  SLURP_EX_DAYS,
  slurpRelationshipLine,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";
import { slurpCoupleBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-couple-beats.ts";
import { slurpTieBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-tie-beats.ts";
import { slurpDropClock } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-purpose.ts";
import { readSlurpTieStamp } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-tie-stamp.ts";
import { readSlurpDmCollab } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-response.ts";
import { slurpCoupleReactionBodies } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";
import { slurpSpiceAngle } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-spice.ts";
import {
  readSlurpBrandDeals,
  slurpDealOwesPost,
  slurpMarkDealPosted,
  type SlurpBrandDeal,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-brand-deals.ts";
import { SLP_DEFAULT_SPICE } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-spice.ts";

const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = Date.parse("2026-10-01T09:00:00Z");

const creator = (id: string, text: string, tags: string[], over: Partial<SlurpTieCreator> = {}): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  text,
  tags,
  automatic: true,
  followers: 1000,
  gender: null,
  cardPartners: [],
  ...over,
});
const mira = creator("mira", "Climbing coach, lives for bouldering and gym training.", ["fitness"]);
const kai = creator("kai", "Personal trainer, runs every morning and lifts at night.", ["fitness"]);
const rue = creator("rue", "Runner and yoga teacher, trains every day.", ["fitness"]);
const names = new Map([
  ["mira", "Mira"],
  ["kai", "Kai"],
  ["rue", "Rue"],
]);
const beatFor = (creatorId: string, ties: SlurpCreatorTies, at: Date, couples: SlurpCouple[] = [], sequence = 1) =>
  slurpTieBeat({
    creatorId,
    creatorText: "",
    sequence,
    ties,
    deals: [],
    couples,
    names,
    intents: ["casual", "set"],
    at,
  });

// --- 1. A collab is announced, then drops on its day -------------------------------------------
{
  const at = new Date(T0);
  const agreed = slurpAgreeCollabInDm(SLURP_NO_TIES, mira, kai, {
    at,
    id: "c1",
    idea: "a climbing day",
    hostShare: 60,
  });
  const collab = agreed.collabs[0]!;
  assert.equal(slurpCollabStep(collab, at), "announce", "an agreed collab is announced first");
  const announce = beatFor("mira", agreed, at)!;
  assert.equal(announce.beat.tie.announce, true);
  assert.match(
    announce.beat.line,
    // V: the announcement names the exact hour Slurp holds ("tomorrow at 7 pm"), like a teased drop.
    /^Announce your collab with Kai: a climbing day\. It drops (tomorrow|on \w+day) at [5-9] pm on both/u,
  );
  assert.match(announce.beat.line, /without showing it yet/u);
  assert.equal(beatFor("kai", agreed, at), null, "the partner does not announce it");
  // The announcement is one page's post: no split, not settled as the joint post.
  assert.deepEqual(slurpPostIncomeParts({ authorAccountId: "mira", metadata: { slurpTie: announce.beat.tie } }, 100), [
    { creatorId: "mira", amount: 100 },
  ]);
  assert.equal(readSlurpTieStamp({ slurpTie: announce.beat.tie })?.announce, true, "the stamp keeps it");

  // Planned: the drop time is stored, in the evening, a day or two later; the beat named the same day.
  const announced = slurpAnnounceCollab(agreed, "c1", at);
  const drop = new Date(announced.collabs[0]!.dropAt!);
  assert.equal(announced.collabs[0]!.dropAt, slurpCollabDropAt("c1", at));
  assert.ok(drop.getTime() - at.getTime() > 12 * HOUR && drop.getTime() - at.getTime() < 3 * DAY);
  assert.ok([18, 19, 20].includes(drop.getHours()) && drop.getMinutes() === 0);
  assert.ok(announce.beat.line.includes(slurpDropClock(drop.toISOString(), at)));
  assert.deepEqual(slurpAnnounceCollab(announced, "c1", new Date(T0 + DAY)), announced, "announced once");
  for (let index = 0; index < 40; index += 1) {
    const dropAt = new Date(slurpCollabDropAt(`c${index}`, at));
    const days = Math.round((dropAt.getTime() - at.getTime()) / DAY);
    assert.ok(days >= 1 && days <= 3, `drops a day or two later (${days})`);
  }

  // Before the drop the host's slots are ordinary; on the day the joint post goes up, split and tagged.
  assert.equal(slurpCollabStep(announced.collabs[0]!, new Date(drop.getTime() - HOUR)), "wait");
  assert.equal(beatFor("mira", announced, new Date(drop.getTime() - HOUR)), null);
  const post = beatFor("mira", announced, new Date(drop.getTime() + HOUR))!;
  assert.match(post.beat.line, /drops today, the one you announced/u);
  assert.match(post.beat.line, /both your pages and you tag each other/u);
  assert.match(post.beat.line, /60% of what it earns is yours and 40% goes to Kai/u);
  assert.equal(post.beat.tie.announce, undefined);
  assert.deepEqual(
    slurpPostIncomeParts({ authorAccountId: "mira", metadata: { slurpTie: post.beat.tie } }, 100),
    [
      { creatorId: "mira", amount: 60 },
      { creatorId: "kai", amount: 40 },
    ],
    "the joint post splits as agreed",
  );
  assert.doesNotMatch(post.beat.line, /business/u, "no couple line for two who are not together");

  // A couple can make a real collab too: it is still work.
  const couple = newSlurpCouple("k1", "mira", "kai", "player", at.toISOString(), "together");
  assert.match(
    beatFor("mira", announced, new Date(drop.getTime() + HOUR), [couple])!.beat.line,
    /You two are together, but this one is business: a real collab with a tag and a split, not a couple post\./u,
  );

  // A spicy shoot agreed in their DMs.
  const shootTies = slurpAnnounceCollab(
    slurpAgreeCollabInDm(SLURP_NO_TIES, mira, rue, { at, id: "s1", idea: "a rope set", hostShare: null, shoot: true }),
    "s1",
    new Date(T0 - 3 * DAY),
  );
  assert.equal(shootTies.collabs[0]!.shoot, true);
  const shoot = beatFor("mira", shootTies, at)!;
  assert.match(shoot.beat.line, /the spicy shoot you two planned in your DMs \(a rope set\)/u);
  assert.equal(shoot.beat.tie.shoot, true);
  assert.deepEqual(
    readSlurpDmCollab({ idea: "a rope set", yourShare: 50, shoot: true }, "p", (v) => v),
    {
      partnerId: "p",
      idea: "a rope set",
      hostShare: 50,
      shoot: true,
    },
  );
  assert.equal(readSlurpDmCollab({ idea: "x", yourShare: 50, shoot: false }, "p", (v) => v)?.shoot, undefined);
  // An open collab turned into a shoot in the DM keeps the flag.
  assert.equal(
    slurpAgreeCollabInDm(agreed, mira, kai, { at, id: "z", idea: "", hostShare: null, shoot: true }).collabs[0]!.shoot,
    true,
  );
}

// --- 2. Old collab data reads back safely (migration) --------------------------------------------
{
  const old = {
    collabs: [
      {
        id: "o1",
        hostId: "mira",
        partnerId: "kai",
        idea: "x",
        hostShare: 50,
        status: "agreed",
        origin: "world",
        askedAt: new Date(T0).toISOString(),
      },
      {
        id: "o2",
        hostId: "mira",
        partnerId: "rue",
        idea: "y",
        hostShare: 50,
        status: "posted",
        origin: "world",
        askedAt: new Date(T0).toISOString(),
        postId: "p1",
        postedAt: new Date(T0).toISOString(),
      },
    ],
    rivalries: [],
    blocked: [],
    advancedAt: null,
  };
  const read = readSlurpCreatorTies(old);
  assert.equal(read.collabs[0]!.announcedAt, undefined);
  assert.equal(slurpCollabStep(read.collabs[0]!, new Date(T0)), "announce", "an old agreed collab announces first");
  assert.equal(slurpCollabStep(read.collabs[1]!, new Date(T0)), "wait", "an old posted collab is done");
  const full: SlurpCollab = {
    ...read.collabs[0]!,
    announcedAt: new Date(T0).toISOString(),
    dropAt: new Date(T0 + DAY).toISOString(),
    shoot: true,
    crossover: { host: 4, partner: 2 },
  };
  assert.deepEqual(readSlurpCreatorTies(JSON.parse(JSON.stringify({ ...old, collabs: [full] }))).collabs[0], full);
  assert.deepEqual(
    readSlurpCreatorTies({ ...old, collabs: [{ ...full, crossover: { host: "many", partner: -3 } }] }).collabs[0]!
      .crossover,
    { host: 0, partner: 0 },
  );
  // An old joint couple post keeps its split: nothing changes for posts already up.
  const oldJoint = { kind: "couple", id: "b1", partnerId: "kai", moment: "launch", joint: true };
  assert.equal(slurpPostIncomeParts({ authorAccountId: "mira", metadata: { slurpTie: oldJoint } }, 10).length, 2);
  // Old couples without new moments read back unchanged; a moving-on moment reads back.
  const couple = slurpBreakUp(
    newSlurpCouple("b2", "mira", "kai", "world", new Date(T0).toISOString(), "together"),
    new Date(T0 + DAY),
  );
  const moved = {
    ...couple,
    moments: [
      ...couple.moments,
      { id: "m", kind: "movingOn" as const, at: new Date(T0 + 7 * DAY).toISOString(), detail: "" },
    ],
  };
  assert.deepEqual(readSlurpCouples(JSON.parse(JSON.stringify([moved]))), [moved]);
}

// --- 3. Collabs bring fans across -----------------------------------------------------------------
{
  const fans = Array.from({ length: 200 }, (_, index) => ({
    memberId: `m${index}`,
    stage: index < 20 ? "subscriber" : index < 150 ? "follower" : "liker",
  }));
  const already = new Set(["m0", "m1", "m30"]);
  const picked = slurpCollabCrossover(fans, already, "c1:host");
  // 147 eligible (followers and subscribers not following yet): about 8 %.
  assert.equal(picked.length, Math.round(147 * 0.08));
  assert.ok(
    picked.every((id) => !already.has(id)),
    "nobody who already follows",
  );
  assert.ok(
    picked.every((id) => Number(id.slice(1)) < 150),
    "no mere likers",
  );
  assert.ok(
    picked.slice(0, 11).every((id) => Number(id.slice(1)) < 20),
    "subscribers first: they care most",
  );
  assert.deepEqual(slurpCollabCrossover(fans, already, "c1:host"), picked, "a repeated settle picks the same people");
  const many = Array.from({ length: 5000 }, (_, index) => ({ memberId: `x${index}`, stage: "follower" }));
  assert.equal(slurpCollabCrossover(many, new Set(), "s").length, SLURP_CROSSOVER_MAX);
  assert.deepEqual(slurpCollabCrossover([], new Set(), "s"), []);
  const service = server("features/projects/slp-creator-ties-service.ts");
  assert.match(
    service,
    /for \(const collab of paid\?\.settled \?\? \[\]\)\s*await crossSlurpCollabFans\(db, collab\)/u,
  );
  assert.match(service, /advanceTie\(memberId, creatorId, \{ stage: "follower", interactions: 2 \}\)/u);
  assert.match(service, /!stamp\.announce && !found\.has\(stamp\.id\)/u, "the announcement is not the joint post");
  // V: the announcement stores the hour its line named.
  assert.match(
    service,
    /: tie\.announce\s*\? slurpAnnounceCollab\(document\.ties, tie\.id, input\.at, planned\.dropAt\)/u,
  );
}

// --- 4. A couple is life: their own posts, the partner as a cameo ----------------------------------
{
  const at = new Date(T0 + 2 * HOUR);
  const together: SlurpCouple = {
    ...newSlurpCouple("b1", "mira", "kai", "player", new Date(T0).toISOString(), "together"),
    togetherAt: new Date(T0).toISOString(),
  };
  const launch = {
    ...together,
    moments: [{ id: "l", kind: "launch" as const, at: new Date(T0).toISOString(), detail: "" }],
  };
  for (const creatorId of ["mira", "kai"]) {
    const beat = slurpCoupleBeat({ creatorId, sequence: 1, couples: [launch], names, at })!;
    assert.equal(beat.tie.moment, "launch", `${creatorId} posts their own launch`);
    assert.equal(beat.tie.joint, undefined);
    assert.match(beat.line, /your own post about your life, not a collab/u);
    assert.deepEqual(slurpPostIncomeParts({ authorAccountId: creatorId, metadata: { slurpTie: beat.tie } }, 50), [
      { creatorId, amount: 50 },
    ]);
  }
  // No couple beat is ever joint any more, over many slots and moments.
  const kinds = ["date", "launch", "anniversary", "reunion", "flirt", "fight", "makeup"] as const;
  for (const kind of kinds)
    for (let sequence = 0; sequence < 30; sequence += 1) {
      const couple = {
        ...together,
        moments: [{ id: kind, kind, at: new Date(T0).toISOString(), detail: "one month" }],
      };
      assert.notEqual(slurpCoupleBeat({ creatorId: "mira", sequence, couples: [couple], names, at })?.tie.joint, true);
    }
  // Cameos: about one ordinary slot in five while together or dating; coy while dating; none otherwise.
  const count = (couple: SlurpCouple) => {
    let cameos = 0;
    for (let sequence = 0; sequence < 400; sequence += 1) {
      const beat = slurpCoupleBeat({ creatorId: "kai", sequence, couples: [couple], names, at });
      if (beat?.tie.moment === "cameo") {
        cameos += 1;
        assert.deepEqual(beat.cast, ["Mira"]);
        assert.match(beat.line, /no tag/u);
        assert.equal(beat.tie.pageId, undefined);
      }
    }
    return cameos;
  };
  const cameos = count(together);
  assert.ok(cameos > 50 && cameos < 120, `about one slot in five (${cameos}/400)`);
  const dating = { ...together, stage: "dating" as const };
  assert.ok(count(dating) > 50);
  assert.match(
    [...Array(40).keys()]
      .map((sequence) => slurpCoupleBeat({ creatorId: "kai", sequence, couples: [dating], names, at }))
      .find((beat) => beat?.tie.moment === "cameo")!.line,
    /not official yet/u,
  );
  for (const stage of ["sparks", "rocky", "split"] as const)
    assert.equal(count({ ...together, stage, moments: [] }), 0, `no cameo while ${stage}`);
  // The partner in a cameo is untagged: the viewer label skips a couple's own posts.
  assert.match(
    server("features/viewer/slp-viewer-context.ts"),
    /if \(stamp\.kind === "couple" && !stamp\.joint && !stamp\.pageId\) return null;/u,
  );
  assert.equal(slurpCoupleBuzz({ slurpTie: { kind: "couple", id: "b", moment: "cameo" } }), 1.15);
}

// --- 5. Crushes before, exes after ------------------------------------------------------------------
{
  const creators = [mira, kai];
  const input = (at: Date) => ({
    creators,
    at,
    activity: 0,
    storylines: [],
    rivals: new Set<string>(),
    collabbedWith: new Map(),
    newId: () => "n",
  });
  const together = newSlurpCouple("e1", "mira", "kai", "player", new Date(T0).toISOString(), "together");
  const split = slurpBreakUp(together, new Date(T0 + DAY));
  let couples = [split];
  const seen: number[] = [];
  // Stop at the first moving-on post: later the world may get them back together (a reunion).
  for (let day = 1; day <= 20 && !seen.length; day += 1) {
    couples = slurpAdvanceCouples(couples, input(new Date(T0 + DAY + day * DAY)));
    if (couples[0]!.moments.some((moment) => moment.kind === "movingOn")) seen.push(day);
  }
  const first = seen[0]!;
  assert.ok(first >= 5 && first <= 10, `moving on a week or so after the breakup (${first})`);
  const nextLook = slurpAdvanceCouples(couples, input(new Date(T0 + DAY + (first + 1) * DAY)))[0]!;
  if (nextLook.stage === "split")
    assert.equal(nextLook.moments.filter((moment) => moment.kind === "movingOn").length, 1, "once");
  const moving = slurpCoupleBeat({
    creatorId: "mira",
    sequence: 2,
    couples,
    names,
    at: new Date(T0 + DAY + first * DAY + HOUR),
  });
  assert.equal(moving?.tie.moment, "movingOn");
  assert.match(moving!.line, /moving on/u);
  // A crush that went nowhere never gets a moving-on post.
  const fizzled = {
    ...newSlurpCouple("f1", "mira", "rue", "world", new Date(T0).toISOString()),
    stage: "split" as const,
    ending: "fizzled" as const,
  };
  let quiet = [fizzled];
  for (let day = 1; day <= 20; day += 1)
    quiet = slurpAdvanceCouples(quiet, { ...input(new Date(T0 + day * DAY)), creators: [mira, rue] });
  assert.ok(!quiet[0]!.moments.some((moment) => moment.kind === "movingOn"));
  // The briefs and DMs know: a crush, and an ex for a month.
  const crush = newSlurpCouple("s1", "mira", "kai", "world", new Date(T0).toISOString());
  assert.match(slurpRelationshipLine([crush], "mira", names, { at: new Date(T0) }), /^You have a crush on Kai/u);
  assert.match(
    slurpRelationshipLine([split], "mira", names, { at: new Date(T0 + 6 * DAY) }),
    /^Kai is your ex: you broke up 5 days ago\. It still comes up now and then, and fans may ask\./u,
  );
  assert.equal(
    slurpRelationshipLine([split], "mira", names, { at: new Date(T0 + DAY + (SLURP_EX_DAYS + 1) * DAY) }),
    "",
  );
  assert.equal(slurpRelationshipLine([split], "mira", names, { at: new Date(T0) }), "", "not before it happened");
  assert.equal(
    slurpRelationshipLine([{ ...fizzled }], "mira", names, { at: new Date(T0 + DAY) }),
    "",
    "a fizzled crush is no ex",
  );
  // A new partner wins over an ex in the briefs.
  const next = newSlurpCouple("n1", "mira", "rue", "world", new Date(T0 + 2 * DAY).toISOString(), "together");
  assert.match(
    slurpRelationshipLine([split, next], "mira", names, { at: new Date(T0 + 3 * DAY) }),
    /You are with Rue/u,
  );
  const source = server("data/creators/slp-flavour-source.ts");
  assert.match(source, /slurpRelationshipLine\(couples, creatorId, names, \{\s*\.\.\.options,/u);
}

// --- 6. Jealousy over the other's collabs, never over their own ----------------------------------------
{
  let jealous = 0;
  let calm = 0;
  for (let index = 0; index < 60; index += 1) {
    const couple = newSlurpCouple(`j${index}`, "mira", "kai", "player", new Date(T0).toISOString(), "together");
    const at = new Date(T0 + DAY);
    const input = {
      creators: [mira, kai, rue],
      at,
      activity: 0,
      storylines: [],
      rivals: new Set<string>(),
      newId: () => "n",
    };
    const withRue = slurpAdvanceCouples([couple], { ...input, collabbedWith: new Map([["kai", "rue"]]) })[0]!;
    const felt = withRue.moments.filter((moment) => moment.kind === "jealous");
    if (felt.length) {
      jealous += 1;
      assert.equal(felt[0]!.fromId, "mira", "the partner of the one who collabbed is jealous");
      assert.equal(felt[0]!.withId, "rue");
      assert.equal(withRue.stage, "together", "a sting, not a crisis");
      // Decided once per collab partner: the next look adds nothing.
      const again = slurpAdvanceCouples([withRue], {
        ...input,
        at: new Date(T0 + 2 * DAY),
        collabbedWith: new Map([["kai", "rue"]]),
      })[0]!;
      assert.equal(again.moments.filter((moment) => moment.kind === "jealous").length, 1);
    } else calm += 1;
    const own = slurpAdvanceCouples([couple], {
      ...input,
      collabbedWith: new Map([
        ["kai", "mira"],
        ["mira", "kai"],
      ]),
    })[0]!;
    assert.ok(!own.moments.some((moment) => moment.kind === "jealous"), "their own collab is work they share");
  }
  assert.ok(jealous > 8 && calm > 20, `some are jealous, most shrug (${jealous}/60)`);
}

// --- 7. Fans ship it, and some take it personally -------------------------------------------------------
{
  for (const moment of ["launch", "cameo", "date"])
    assert.ok(
      slurpCoupleReactionBodies("Mira", "Kai", moment).some((body) => /taken now|thought we had something/u.test(body)),
      moment,
    );
  assert.ok(!slurpCoupleReactionBodies("Mira", "Kai", "breakup").some((body) => /taken now/u.test(body)));
  assert.ok(slurpCoupleReactionBodies("Mira", "Kai", "movingOn").some((body) => /💔|take care/u.test(body)));
  assert.ok(
    slurpCoupleReactionBodies("Mira", "Kai", "launch").some((body) => /Mira and Kai/u.test(body)),
    "still shipping",
  );
}

// --- 8. Spice: intimate couples, negotiated collab shoots ------------------------------------------------
{
  const base = {
    level: "explicit" as const,
    ceiling: "explicit" as const,
    access: "locked" as const,
    teaser: false,
    creator: { accountId: "mira", text: "Climbing coach.", turnOns: [], hardNoes: [], anchors: null },
    spice: SLP_DEFAULT_SPICE,
    recent: [],
  };
  const partners = (over: Record<string, unknown>) =>
    Array.from({ length: 200 }, (_, sequence) => slurpSpiceAngle({ ...base, ...over, sequence })).filter(
      (angle) => angle?.partner,
    );
  const intimate = partners({ madeWith: "Kai", intimate: true });
  assert.ok(intimate.length > 0);
  assert.ok(intimate.every((angle) => angle!.partner!.kind === "couple" && angle!.partner!.name === "Kai"));
  assert.ok(intimate.every((angle) => /private and intimate, just the two of you, not a shoot/u.test(angle!.line)));
  const shoot = partners({ madeWith: "Rue" });
  assert.ok(shoot.every((angle) => angle!.partner!.kind === "collab"));
  assert.ok(
    shoot.every((angle) =>
      /a shoot with Rue, a Creator you collab with, planned in your DMs beforehand/u.test(angle!.line),
    ),
  );
  assert.match(
    server("features/feed/slp-post-spice.ts"),
    /\.\.\.\(tie\.kind === "couple" \? \{ intimate: true \} : \{\}\)/u,
  );
  assert.match(
    server("modules/messages/slp-dm-roles.ts"),
    /"shoot": true if it is a spicy shoot together you two negotiated here/u,
  );
  assert.match(server("base/prompting/slp-response-format.ts"), /required: \["idea", "yourShare", "shoot"\]/u);
}

// --- 9. "Mark as posted" for an owed #ad (I + J2 decision 2) ------------------------------------------
{
  const at = new Date(T0);
  const deal: SlurpBrandDeal = {
    id: "d1",
    adId: "ad",
    brand: "PeakFuel",
    product: "a shake",
    copy: "",
    creatorId: "me",
    fee: 90,
    status: "done",
    decline: null,
    offeredAt: at.toISOString(),
    answeredAt: at.toISOString(),
    plannedAt: null,
    postId: null,
    paidAt: at.toISOString(),
    toldFans: false,
  };
  const later = new Date(T0 + DAY);
  assert.equal(slurpDealOwesPost(deal, later), true);
  const marked = slurpMarkDealPosted([deal], "d1", later);
  assert.ok(Array.isArray(marked));
  assert.equal(marked[0]!.markedAt, later.toISOString());
  assert.equal(slurpDealOwesPost(marked[0]!, later), false, "the reminder goes");
  assert.equal(slurpMarkDealPosted(marked, "d1", later), "notOpen", "marked once");
  assert.equal(slurpMarkDealPosted([deal], "nope", later), "notFound");
  assert.equal(slurpMarkDealPosted([{ ...deal, status: "offered" }], "d1", later), "notOpen");
  assert.deepEqual(readSlurpBrandDeals(JSON.parse(JSON.stringify(marked))), marked);
  assert.equal(readSlurpBrandDeals([deal])[0]!.markedAt, undefined, "old deals read back unmarked");
  const routes = server("features/projects/slp-creator-ties-routes.ts");
  assert.match(routes, /app\.post\("\/slurp\/ties\/deals\/:id\/posted"/u);
  assert.match(routes, /slurpMarkDealPosted\(document\.deals, own\.deal\.id, new Date\(\)\)/u);
  assert.match(routes, /if \(!creatorBelongsToViewer\(creator, viewer\)\)/u, "only the page's own player");
}

// --- 10. A held drop hour wins over the player's idea (I + J2 decision 3) --------------------------------
{
  const generation = server("features/feed/slp-generation-service.ts");
  assert.match(
    generation,
    /input\.heldDrop \|\| input\.previewOnly \|\| input\.request\.noodlerPostGuide\?\.trim\(\) \? null : steering\?\.nudges\[0\]/u,
  );
  // The idea is removed only when a beat used it; a held slot never takes it, so it waits for the next slot.
  assert.match(generation, /const usedIdea = beat\?\.nudgeId \?\? \(classicIdea \? nudge\?\.id : undefined\);/u);
  assert.match(
    server("features/feed/reserve/slp-reserve-operation.ts"),
    /\.\.\.\(heldDrop \? \{ allowStory: false, heldDrop: true \} : \{\}\)/u,
  );
}

// --- 11. Studio: two areas, plain words ------------------------------------------------------------------
{
  const studio = client("app/screens/SlpScreenStudio.tsx");
  // 0.3.11 Stir overhaul: the Business and Relationships sheets became rows of "Now showing", below
  // the player's own relationship.
  assert.ok(
    studio.indexOf("<YourRelationship") >= 0 && studio.indexOf("<YourRelationship") < studio.indexOf("<NowShowing"),
    "Your relationship, then everything else that runs",
  );
  // W: the two areas moved into the Stir tab, which words them with `t` (0.3.11: "Now showing").
  assert.match(studio, /\{t\("ui\.slurp\.stir\.now\.title"\)\}/u);
  const panel = client("features/projects/SlpCollabsPanel.tsx");
  assert.doesNotMatch(
    panel.slice(0, panel.indexOf("export function SlpRelationshipsPanel")),
    /actions\.setUp|<SlpCouplesSection/u,
    "no couples in Business",
  );
  assert.match(panel, /couple\.stage === "split" && couple\.ending !== "fizzled"/u, "exes are breakups");
  assert.match(panel, /markPosted\.mutate\(deal\.id/u);
  const couples = client("features/projects/SlpCouples.tsx");
  assert.match(
    couples,
    /actions\.suggest\.mutate\(\s*\{ aId: couple\.aId, bId: couple\.bId \}/u,
    "a couple plans a real collab",
  );
  assert.match(
    client("modules/post/SlpPostPartnership.tsx"),
    /partnership\.announce\s*\?\s*"ui\.slurp\.post\.collabSoon"/u,
  );
  const en = JSON.parse(client("locales/en.json")) as Record<string, string>;
  for (const key of [
    "ui.slurp.ties.title",
    "ui.slurp.ties.life.title",
    "ui.slurp.ties.business.intro",
    "ui.slurp.ties.life.intro",
    "ui.slurp.ties.crushes",
    "ui.slurp.ties.exes",
    "ui.slurp.ties.collab.announced",
    "ui.slurp.ties.collab.across_other",
    "ui.slurp.ties.owed.mark",
    "ui.slurp.ties.couple.work",
    "ui.slurp.ties.moment.movingOn",
    "ui.slurp.post.collabSoon",
  ]) {
    assert.ok(en[key], key);
    assert.doesNotMatch(en[key]!, /\b(AI|simulat\w*|fake|model|LLM)\b|—/u, `${key} stays in-world`);
  }
  assert.equal(en["ui.slurp.ties.title"], "Business");
  assert.equal(en["ui.slurp.ties.life.title"], "Relationships");
}

// Merge P+Q × U: an open brand offer in Business shows the ad's 1.91:1 banner (feed picture for an old ad).
{
  const routes = server("features/projects/slp-creator-ties-routes.ts");
  assert.match(routes, /ad\.wideImageUrl \|\| ad\.imageUrl/u, "banner first, feed picture as the fallback");
  assert.match(routes, /bannerUrl: deal\.status === "offered"/u, "only open offers carry the banner");
  const panel = client("features/projects/SlpCollabsPanel.tsx");
  assert.match(panel, /deal\.bannerUrl &&[\s\S]*?aspectRatio: "1\.91 \/ 1"/u, "the offer card frames it at 1.91:1");
}

console.log("slurp2 collabs vs couples (U) regression passed");
