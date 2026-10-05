/**
 * Slice I (the user's answers, 2026-09-28) and J2 (Professor Mari, Slurp side). One block per item:
 * public posts stop below nudity, the player's own page and forced couples, ties at about 4 % of
 * posts, rivals may target the player's page, the owed #ad reminder, teases with an exact held drop
 * time, the player's poll vote decides, Story job sliders, mixed chat pictures for subscribers, the
 * camera mix, and the `mari-actions` service.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { slurp2Source } from "./slurp2-source";
import {
  slurpPostSexualLevel,
  slurpPublicSexualLevel,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-guidance.ts";
import {
  slurpAdvanceCouples,
  slurpSetUpCouple,
  slurpSteerCouple,
  type SlurpCouple,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import { readSlurpCouples } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-read.ts";
import { slurpCoupleMisfitOf } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-fit.ts";
// U: the relationship line moved out of the couples module (import path only).
import { slurpRelationshipLine } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";
import {
  readSlurpCreatorTies,
  slurpAdvanceCreatorTies,
  slurpCollabFit,
  slurpEchoCollab,
  slurpPlanCollab,
  slurpPostIncomeParts,
  slurpRivalryFits,
  slurpSettleCollab,
  slurpTellRivalry,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import { readSlurpTieStamp } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-tie-stamp.ts";
import {
  SLURP_COLLAB_ECHO_DAYS,
  slurpTieBeat,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-tie-beats.ts";
import {
  SLURP_OWED_POST_DAYS,
  slurpAdvanceBrandDeals,
  slurpAnswerDeal,
  slurpDealOwesPost,
  slurpPlanDeal,
  slurpPostPaysOwedDeal,
  slurpSettleDeal,
  slurpSettleOwedDeal,
  slurpToldFansAboutDeal,
  type SlurpBrandDeal,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-brand-deals.ts";
import {
  slurpHeldDropStage,
  slurpHeldDropTime,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-campaign.ts";
import {
  slurpDropClock,
  slurpPollWinner,
  slurpPostPurpose,
  slurpPostPurposeLine,
  slurpStoryPurpose,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-purpose.ts";
import {
  SLURP_STORY_JOB_DEFAULTS,
  readSlpPurpose,
  slpStoryPollTally,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-post-purpose.ts";
import {
  resolveSlurpMediaOffer,
  slurpDmPictureSpicy,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-media-offer.ts";
import { readSlurpDmReply } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-response.ts";
import {
  SLURP_CAMERA_SOURCES,
  slurpCameraSourceInstruction,
  slurpPostCameraSource,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import {
  SLP_ACTIONS,
  slpActionCatalog,
  slpActionServiceKeys,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions.ts";
import { FLAVOUR_FIXTURES } from "./slurp2-flavour-fixtures.ts";
import * as beatModule from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import * as life from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-life-moments.ts";

const repo = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = new Date("2026-10-01T08:00:00Z");

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

// --- I1. Public posts stop below nudity; nudity is behind the lock --------------------------------
{
  const levels = ["none", "suggestive", "nudity", "explicit"] as const;
  for (const level of levels) {
    const pub = slurpPostSexualLevel({ level, access: "public" });
    assert.ok(pub === "none" || pub === "suggestive", `${level}: a public post never shows nudity (${pub})`);
    assert.equal(slurpPostSexualLevel({ level, access: "locked" }), level, "a locked post delivers the level");
  }
  assert.equal(slurpPublicSexualLevel("explicit"), "suggestive", "an Explicit Creator's public posts tease");
  assert.equal(slurpPublicSexualLevel("nudity"), "suggestive");
  assert.equal(slurpPublicSexualLevel("suggestive"), "none", "one step under the Creator, as before");
  assert.equal(slurpPublicSexualLevel("none"), "none");
  // A profile picture or cover is public too.
  assert.match(server("features/assist/slp-assist-service.ts"), /slurpPublicSexualLevel\(spice\.level\)/u);
}

// --- I2/I3. The player's own page can be in a couple; a forced couple is colored by the card ------
{
  const at = T0;
  const me = creator("me", "Gym girl who loves lifting.", ["fitness"], { automatic: false, gender: "female" });
  const kai = creator("kai", "Personal trainer, flirty, runs every morning.", ["fitness"], { gender: "male" });
  const tess = creator("tess", "Painter, lesbian, romantic about everything.", ["art"], { gender: "female" });
  const jonas = creator("jonas", "Baker. Has a girlfriend, Lena.", ["food"], {
    gender: "male",
    cardPartners: ["Lena"],
  });
  const zen = creator("zen", "Yoga teacher. Never dates anyone, it is not for them.", ["fitness"], { gender: "other" });
  const aro = creator("aro", "Streamer, aromantic and proud of it.", ["games"], { gender: "male" });

  const own = slurpSetUpCouple([], me, kai, { at, id: "own" });
  assert.ok(Array.isArray(own) && !own[0]!.forced, "your own page and a Creator Slurp posts for: a plain couple");

  assert.deepEqual(slurpCoupleMisfitOf(tess, kai), { misfit: "orientation", byId: "tess" });
  assert.deepEqual(slurpCoupleMisfitOf(kai, jonas), { misfit: "taken", byId: "jonas" });
  assert.deepEqual(slurpCoupleMisfitOf(zen, kai), { misfit: "noDating", byId: "zen" });
  assert.deepEqual(slurpCoupleMisfitOf(kai, aro), { misfit: "notInto", byId: "aro" });
  assert.equal(slurpCoupleMisfitOf(me, kai), null, "both cards allow it: nothing to color");

  for (const [a, b] of [
    [tess, kai],
    [kai, jonas],
    [zen, kai],
    [kai, aro],
  ] as const) {
    const next = slurpSetUpCouple([], a, b, { at, id: `f-${a.id}-${b.id}` });
    assert.ok(Array.isArray(next), `${a.id} × ${b.id}: the player can force it`);
    assert.equal(next[0]!.forced?.byId, slurpCoupleMisfitOf(a, b)!.byId);
    assert.equal(next[0]!.stage, "sparks");
  }
  assert.equal(slurpSetUpCouple([], kai, kai, { at, id: "x" }), "same", "never with themself");
  const taken = slurpSetUpCouple([], tess, kai, { at, id: "t1" }) as SlurpCouple[];
  assert.equal(
    slurpSetUpCouple(taken, kai, zen, { at, id: "t2" }),
    "busy",
    "someone already seeing someone stays busy",
  );

  // Stored and read back.
  const back = readSlurpCouples(JSON.parse(JSON.stringify(taken)));
  assert.deepEqual(back[0]!.forced, { misfit: "orientation", byId: "tess" });
  assert.equal(readSlurpCouples([{ ...taken[0], forced: { misfit: "nope", byId: "tess" } }])[0]!.forced, undefined);

  // The player forced it, so it sticks (sparks become dating) whatever the chemistry.
  let couples = taken;
  for (let day = 1; day <= 6; day += 1)
    couples = slurpAdvanceCouples(couples, {
      creators: [tess, kai],
      at: new Date(T0.getTime() + day * DAY),
      activity: 0,
      newId: () => `n${day}`,
      storylines: [],
      rivals: new Set(),
      collabbedWith: new Map(),
    });
  assert.notEqual(couples[0]!.stage, "split", "a forced couple does not fizzle at sparks");
  assert.ok(couples[0]!.forced, "and stays colored");

  // The card colors how it feels, from both sides, in every brief.
  const names = new Map([
    ["tess", "Tess Vale"],
    ["kai", "Kai Vale"],
  ]);
  const hers = slurpRelationshipLine(couples, "tess", names, { at: T0 });
  const his = slurpRelationshipLine(couples, "kai", names, { at: T0 });
  assert.match(hers, /not who you usually go for.*awkward/u);
  assert.match(his, /You are not who Tess Vale usually goes for/u);
  const takenLine = slurpRelationshipLine(
    slurpSetUpCouple([], kai, jonas, { at, id: "j" }) as SlurpCouple[],
    "jonas",
    new Map([["kai", "Kai Vale"]]),
    { at },
  );
  assert.match(takenLine, /complicated/u, "taken: complicated");
  const plain = slurpRelationshipLine(own as SlurpCouple[], "kai", new Map([["me", "Me Vale"]]), { at });
  assert.doesNotMatch(plain, /awkward|complicated|reluctant/u, "a couple that fits is not colored");

  // Getting back together after a breakup: the player's forced pair may, the fit check does not stop it.
  const split = slurpSteerCouple(couples, couples[0]!.id, "breakUp", { at, creators: [tess, kai] }) as SlurpCouple[];
  const again = slurpSteerCouple(split, split[0]!.id, "reunite", { at, creators: [tess, kai] });
  assert.ok(Array.isArray(again), "a forced couple can get back together");
}

// --- I4/I5. Ties at about 4 % of posts; the partner posts their side; rivals may target your page --
{
  // A posted collab: the partner posts their own side once, within a few days, and it pays them alone.
  let ties = readSlurpCreatorTies({
    collabs: [
      {
        id: "c1",
        hostId: "anna",
        partnerId: "lio",
        idea: "a cooking night, one dish each",
        hostShare: 50,
        status: "agreed",
        origin: "world",
        askedAt: T0.toISOString(),
        answeredAt: T0.toISOString(),
      },
    ],
  });
  ties = slurpSettleCollab(slurpPlanCollab(ties, "c1", T0), "c1", { id: "p1", createdAt: T0.toISOString() });
  const names = new Map([
    ["anna", "Anna Berg"],
    ["lio", "Lio Brandt"],
  ]);
  const beat = (at: Date, id = "lio") =>
    slurpTieBeat({
      creatorId: id,
      creatorText: "",
      sequence: 1,
      ties,
      deals: [],
      names,
      intents: ["casual"],
      at,
    })?.beat;
  const echo = beat(new Date(T0.getTime() + DAY))!;
  assert.equal(echo.tie.kind, "collab");
  assert.equal(echo.tie.echo, true, "the partner's own side");
  assert.match(echo.line, /Your collab with Anna Berg is up on both your pages/u);
  assert.equal(beat(new Date(T0.getTime() + DAY), "anna"), undefined, "the host does not post it twice");
  assert.equal(beat(new Date(T0.getTime() + (SLURP_COLLAB_ECHO_DAYS + 1) * DAY)), undefined, "old news");
  const stamp = readSlurpTieStamp({ slurpTie: echo.tie })!;
  assert.equal(stamp.echo, true, "the stamp keeps it");
  assert.deepEqual(slurpPostIncomeParts({ authorAccountId: "lio", metadata: { slurpTie: echo.tie } }, 10), [
    { creatorId: "lio", amount: 10 },
  ]);
  ties = slurpEchoCollab(ties, "c1");
  assert.equal(beat(new Date(T0.getTime() + DAY)), undefined, "once");
  assert.equal(readSlurpCreatorTies(JSON.parse(JSON.stringify(ties))).collabs[0]!.echoed, true, "stored");
  // The settle ignores the echo (the joint post is the host's).
  assert.match(server("features/projects/slp-creator-ties-service.ts"), /!stamp\.declined && !stamp\.echo/u);

  // Rivals can target a page the player runs; the one who starts it is always a Creator Slurp posts for.
  const zoe = creator("zoe", "Fitness model and bouldering nerd. Petty, sassy, keeps receipts.", ["fitness"]);
  const me = creator("me", "Gym girl who loves lifting.", ["fitness"], { automatic: false });
  assert.equal(slurpRivalryFits(zoe, me), true, "shade can land on your page");
  assert.equal(slurpRivalryFits(me, zoe), false, "Slurp never throws shade for you");
  let world = readSlurpCreatorTies(null);
  let found = false;
  for (let step = 0; step < 80 && !found; step += 1) {
    world = slurpAdvanceCreatorTies(world, {
      creators: [zoe, me],
      at: new Date(T0.getTime() + step * 6 * HOUR),
      activity: 1,
      paired: [],
      newId: () => `r${step}`,
    });
    found = world.rivalries.some((rivalry) => rivalry.fromId === "zoe" && rivalry.toId === "me");
  }
  assert.ok(found, "the world starts a rivalry that targets your page");

  // The pace: 90 days × 4 ordinary slots, the flavour fixtures + two who share a niche (the 7b-c measure).
  const ADS = [
    {
      id: "ad1",
      brand: "PeakFuel",
      product: "a protein shake",
      copy: "",
      categories: ["fitness"],
      contextTags: ["gym"],
    },
    {
      id: "ad2",
      brand: "InkWell",
      product: "aftercare balm",
      copy: "",
      categories: ["tattoo", "art"],
      contextTags: [],
    },
    { id: "ad3", brand: "Mehlwerk", product: "flour", copy: "", categories: ["baking", "food"], contextTags: [] },
  ];
  const fixtures = FLAVOUR_FIXTURES.map((fixture: (typeof FLAVOUR_FIXTURES)[number], index: number) => ({
    fixture,
    tie: creator(
      fixture.id,
      [fixture.card.description, fixture.card.personality, fixture.card.backstory].join("\n"),
      fixture.tags ?? [],
      { followers: [4200, 1800, 900, 300][index] ?? 500 },
    ),
  }));
  const extras = [
    creator("extra-zoe", "Fitness model and bouldering nerd. Petty, sassy, keeps receipts.", ["fitness"], {
      followers: 2600,
    }),
    creator("extra-lio", "Bäcker aus Hamburg, backen um vier Uhr. Ruhig und herzlich.", ["baking"], { followers: 700 }),
  ];
  const creators = [...fixtures.map((entry) => entry.tie), ...extras];
  const everyone = [
    ...fixtures,
    ...extras.map((tie) => ({
      tie,
      fixture: {
        id: tie.id,
        anchors: {
          people: [],
          places: ["home"],
          work: ["work"],
          objects: [],
          habits: [],
          runningJokes: [],
          palette: {},
          heat: { min: 0, max: 1 },
        },
      },
    })),
  ];
  let paceTies = readSlurpCreatorTies(null);
  let offers: SlurpBrandDeal[] = [];
  let last: string | null = null;
  let n = 0;
  const idOf = () => `m${(n += 1)}`;
  let total = 0;
  let tiePosts = 0;
  const history = new Map<string, { recentOwn: string[]; recentAnchors: string[]; used: string[] }>();
  const names2 = new Map(creators.map((entry) => [entry.id, entry.name]));
  for (let day = 0; day < 90; day += 1)
    for (let slot = 0; slot < 4; slot += 1) {
      const at = new Date(T0.getTime() + day * DAY + slot * 6 * HOUR);
      paceTies = slurpAdvanceCreatorTies(paceTies, { creators, at, activity: 1, paired: [], newId: idOf });
      offers = slurpAdvanceBrandDeals(offers, { creators, ads: ADS, at, activity: 1, lastLook: last, newId: idOf });
      last = paceTies.advancedAt;
      for (const { tie: entry, fixture } of everyone) {
        const sequence = day * 4 + slot;
        const own = history.get(entry.id) ?? { recentOwn: [], recentAnchors: [], used: [] };
        history.set(entry.id, own);
        const planned = slurpTieBeat({
          creatorId: entry.id,
          creatorText: entry.text,
          sequence,
          ties: paceTies,
          deals: offers,
          names: names2,
          intents: ["casual", "set", "behind_the_scenes", "appreciation", "business"],
          at,
        })?.beat;
        total += 1;
        if (planned) {
          tiePosts += 1;
          const tie = planned.tie;
          if (tie.kind === "collab" && tie.echo) paceTies = slurpEchoCollab(paceTies, tie.id);
          else if (tie.kind === "collab")
            paceTies = slurpSettleCollab(slurpPlanCollab(paceTies, tie.id, at), tie.id, {
              id: `post-${tie.id}`,
              createdAt: at.toISOString(),
            });
          if (tie.kind === "sponsor" && !tie.declined)
            offers = slurpSettleDeal(
              slurpPlanDeal(offers, tie.id, at),
              tie.id,
              { id: `post-${tie.id}`, createdAt: at.toISOString() },
              at,
            );
          if (tie.kind === "sponsor" && tie.declined) offers = slurpToldFansAboutDeal(offers, tie.id);
          if (tie.kind === "rival") paceTies = slurpTellRivalry(paceTies, tie.id, entry.id);
          continue;
        }
        // Ordinary posts go on as in the measure (life moments and card beats); they only count here.
        const beatHistory = {
          recentOwn: own.recentOwn,
          recentAnchors: own.recentAnchors,
          globalCounts: {},
          sharedToday: {},
        };
        const ordinary =
          life.slurpLifeBeat(
            entry.id,
            sequence,
            { text: entry.text, anchors: fixture.anchors },
            life.SLURP_NO_LIFE_SIGNALS,
            beatHistory,
            own.used,
            ["casual"],
          ) ?? beatModule.selectSlurpBeat(entry.id, sequence, fixture.anchors, beatHistory, ["casual"]);
        if (ordinary) own.recentOwn.unshift(ordinary.type);
      }
    }
  const share = tiePosts / total;
  assert.ok(share > 0.03 && share < 0.06, `ties are about 4 % of posts, got ${(share * 100).toFixed(1)} %`);
  // No unfit pair was used by the world.
  for (const collab of paceTies.collabs.filter((entry) => entry.origin === "world"))
    assert.ok(
      slurpCollabFit(
        creators.find((c) => c.id === collab.hostId)!,
        creators.find((c) => c.id === collab.partnerId)!,
      ).fits,
      `${collab.hostId} × ${collab.partnerId} fit`,
    );
}

// --- I6. Studio reminds the player of a sponsored post their own page owes ------------------------
{
  const offered: SlurpBrandDeal = {
    id: "d1",
    adId: "ad1",
    brand: "PeakFuel",
    product: "a protein shake",
    copy: "",
    creatorId: "me",
    fee: 90,
    status: "offered",
    decline: null,
    offeredAt: T0.toISOString(),
    answeredAt: null,
    plannedAt: null,
    postId: null,
    paidAt: null,
    toldFans: false,
  };
  const took = slurpAnswerDeal([offered], "d1", true, T0) as SlurpBrandDeal[];
  const deal = took[0]!;
  assert.equal(slurpDealOwesPost(deal, new Date(T0.getTime() + DAY)), true, "yes on your own page: a post is owed");
  assert.equal(slurpDealOwesPost(offered, T0), false, "an offer owes nothing yet");
  assert.equal(
    slurpDealOwesPost(deal, new Date(T0.getTime() + (SLURP_OWED_POST_DAYS + 1) * DAY)),
    false,
    "the reminder lets go after two weeks",
  );
  const declined = slurpAnswerDeal([offered], "d1", false, T0) as SlurpBrandDeal[];
  assert.equal(slurpDealOwesPost(declined[0]!, T0), false, "no is no");
  const after = new Date(T0.getTime() + HOUR).toISOString();
  assert.equal(slurpPostPaysOwedDeal(deal, { content: "leg day done 💪 #ad", createdAt: after }), true, "#ad");
  assert.equal(slurpPostPaysOwedDeal(deal, { content: "Loving my peakfuel shake", createdAt: after }), true, "brand");
  assert.equal(
    slurpPostPaysOwedDeal(deal, { content: "#adventure time", createdAt: after }),
    false,
    "#adventure is not #ad",
  );
  assert.equal(
    slurpPostPaysOwedDeal(deal, { content: "old #ad", createdAt: new Date(T0.getTime() - HOUR).toISOString() }),
    false,
    "a post from before the yes does not count",
  );
  const settled = slurpSettleOwedDeal(took, "d1", "post-9");
  assert.equal(slurpDealOwesPost(settled[0]!, new Date(T0.getTime() + DAY)), false, "the post went up: no reminder");
  // Wiring: the tick settles it, the Studio view says it, the Studio shows it.
  assert.match(
    server("features/projects/slp-creator-ties-service.ts"),
    /await settleSlurpOwedPosts\(db, deals, at\);/u,
  );
  assert.match(
    server("features/projects/slp-creator-ties-routes.ts"),
    /owesPost: slurpDealOwesPost\(deal, new Date\(\)\)/u,
  );
  const panel = client("features/projects/SlpCollabsPanel.tsx");
  assert.match(panel, /deal\.creatorId === creatorId && deal\.owesPost/u);
  assert.match(panel, /ui\.slurp\.ties\.owed\.title/u);
}

// --- I7. A tease names an exact drop time, and Slurp holds that slot ------------------------------
{
  const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
  // At least three hours, the next full hour.
  assert.deepEqual(
    slurpHeldDropTime({ teaseAt: local(2026, 10, 1, 14, 20), minGapMs: 3 * HOUR, busy: [], spacingMs: 2 * HOUR }),
    local(2026, 10, 1, 18),
  );
  // The Creator's own spacing wins when it is longer.
  assert.deepEqual(
    slurpHeldDropTime({ teaseAt: local(2026, 10, 1, 9), minGapMs: 3 * HOUR, busy: [], spacingMs: 6 * HOUR }),
    local(2026, 10, 1, 15),
  );
  // Never in the night: a late tease drops the next morning.
  assert.deepEqual(
    slurpHeldDropTime({ teaseAt: local(2026, 10, 1, 21), minGapMs: 3 * HOUR, busy: [], spacingMs: 2 * HOUR }),
    local(2026, 10, 2, 7),
  );
  // Clear of this Creator's other slots.
  assert.deepEqual(
    slurpHeldDropTime({
      teaseAt: local(2026, 10, 1, 12),
      minGapMs: 3 * HOUR,
      busy: [local(2026, 10, 1, 15, 30).getTime()],
      spacingMs: 2 * HOUR,
    }),
    local(2026, 10, 1, 18),
  );
  // The held stage is found by its exact time; a Story slot and other times are not it.
  const stages = [
    {
      id: "s1",
      campaignId: "c",
      kind: "teaser" as const,
      position: 0,
      access: "public",
      status: "claimed" as const,
      dueAt: local(2026, 10, 1, 14).toISOString(),
    },
    {
      id: "s2",
      campaignId: "c",
      kind: "set" as const,
      position: 1,
      access: "locked",
      status: "planned" as const,
      dueAt: local(2026, 10, 1, 18).toISOString(),
    },
  ];
  assert.equal(slurpHeldDropStage(stages, local(2026, 10, 1, 18))?.id, "s2", "the held slot runs the drop");
  assert.equal(slurpHeldDropStage(stages, local(2026, 10, 1, 19)), null);
  assert.equal(slurpHeldDropStage(stages, null), null);
  assert.equal(slurpHeldDropStage([{ ...stages[1]!, status: "claimed" as const }], local(2026, 10, 1, 18)), null);
  // The time in words.
  assert.equal(slurpDropClock(local(2026, 10, 1, 21).toISOString(), local(2026, 10, 1, 17)), "tonight at 9 pm");
  assert.equal(slurpDropClock(local(2026, 10, 1, 15, 30).toISOString(), local(2026, 10, 1, 11)), "today at 3:30 pm");
  assert.equal(slurpDropClock(local(2026, 10, 2, 10).toISOString(), local(2026, 10, 1, 22)), "tomorrow at 10 am");
  assert.match(slurpDropClock(local(2026, 10, 4, 12).toISOString(), local(2026, 10, 1, 22)), /^on \w+day at 12 pm$/u);
  // The tease names it; a tease without a held slot keeps the rough words.
  const heldTease = slurpPostPurpose({
    tease: { campaignId: "c", dropAt: local(2026, 10, 1, 21).toISOString(), held: true },
  });
  assert.equal(heldTease.held, true);
  assert.equal(readSlpPurpose({ slurpPurpose: heldTease })?.held, true, "stored");
  assert.match(
    slurpPostPurposeLine(heldTease, { at: local(2026, 10, 1, 17) }),
    /goes up tonight at 9 pm \(in about 4 hours\)\. Name that time/u,
  );
  const roughTease = slurpPostPurpose({ tease: { campaignId: "c", dropAt: local(2026, 10, 1, 21).toISOString() } });
  assert.match(slurpPostPurposeLine(roughTease, { at: local(2026, 10, 1, 17) }), /due in about 4 hours/u);
  // Wiring: the slot is booked when the tease is planned, the drop takes it locked as a feed post.
  const purposeService = server("features/feed/slp-post-purpose-service.ts");
  assert.match(
    purposeService,
    /await storage\.createNoodlerScheduledPost\(\{\s*creatorAccountId,\s*publishAt: dropAt\.toISOString\(\)/u,
  );
  assert.match(purposeService, /held: Boolean\(heldAt\)/u);
  const reserve = server("features/feed/reserve/slp-reserve-operation.ts");
  assert.match(reserve, /access: heldDrop \? "locked"/u);
  // U (orchestrator decision on I + J2): the held slot also keeps the player's idea for the next slot.
  assert.match(reserve, /\.\.\.\(heldDrop \? \{ allowStory: false, heldDrop: true \} : \{\}\)/u);
  assert.match(server("features/feed/slp-post-plan-service.ts"), /slurpHeldDropStage\(stages, dueAt\) \?\?/u);
}

// --- I8. The player's poll vote decides -----------------------------------------------------------
{
  const start = new Date("2026-10-01T10:00:00Z");
  const later = new Date(start.getTime() + 12 * HOUR);
  for (let index = 0; index < 40; index += 1) {
    const poll = { postId: `poll-${index}`, createdAt: start.toISOString(), optionCount: 2 };
    const crowd = slpStoryPollTally(poll, [0, 0], later);
    const smaller = crowd[0]! <= crowd[1]! ? 0 : 1;
    const votes = [0, 0];
    votes[smaller] = 1;
    const tally = slpStoryPollTally(poll, votes, later);
    assert.ok(tally[smaller]! > tally[1 - smaller]!, `${poll.postId}: the player's pick leads (${tally})`);
    assert.equal(slurpPollWinner(["a", "b"], tally, poll.postId), smaller === 0 ? "a" : "b", "and wins");
    assert.equal(tally[0]! + tally[1]! >= crowd[0]! + crowd[1]! + 1, true, "the crowd is still there");
    // Right after the Story went up the player's vote alone decides too.
    assert.deepEqual(slpStoryPollTally(poll, votes, start), votes);
  }
  const three = { postId: "p3", createdAt: start.toISOString(), optionCount: 3 };
  const t3 = slpStoryPollTally(three, [0, 0, 1], later);
  assert.ok(t3[2]! > Math.max(t3[0]!, t3[1]!), "with three choices too");
}

// --- I9. Story jobs: one slider per job, balanced defaults ----------------------------------------
{
  assert.deepEqual(SLURP_STORY_JOB_DEFAULTS, { countdown: 8, newPost: 6, comment: 4, poll: 3, earlier: 3, plain: 3 });
  // The setting: 0-10 per job, balanced by default, and an older or partial value keeps the balance.
  // (The settings module needs the Engine's logger, so its shape is read, not run.)
  const settings = server("modules/settings/slp-settings.ts");
  assert.match(
    settings,
    /storyJobs: z\s*\.object\(\s*Object\.fromEntries\(\s*Object\.keys\(SLURP_STORY_JOB_DEFAULTS\)\.map\(\(key\) => \[key, z\.number\(\)\.int\(\)\.min\(0\)\.max\(10\)\]\)/u,
  );
  assert.match(settings, /storyJobs: \{ \.\.\.SLURP_STORY_JOB_DEFAULTS \},/u);
  assert.match(
    settings,
    /candidate\.storyJobs = \{ \.\.\.DEFAULT_SLURP_SETTINGS\.storyJobs, \.\.\.parseRecord\(rawRecord\.storyJobs\) \};/u,
  );
  const at = new Date("2026-10-01T12:00:00Z");
  const candidates = {
    countdown: { campaignId: "c", dropAt: new Date(at.getTime() + 3 * HOUR).toISOString() },
    newPost: { postId: "p", title: "Ridge loop" },
    comment: { postId: "p", postTitle: "Ridge loop", handle: "night_owl", text: "where is this" },
    poll: { question: "", options: ["ridge loop", "lake run"] },
    earlier: { line: "morning run", count: 1 },
  } as Parameters<typeof slurpStoryPurpose>[2];
  const kinds = (weights?: Parameters<typeof slurpStoryPurpose>[4]) => {
    const counts = new Map<string, number>();
    for (let sequence = 0; sequence < 400; sequence += 1) {
      const kind = slurpStoryPurpose("creator-a", sequence, candidates, at, weights).purpose.kind;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return counts;
  };
  const balanced = kinds();
  assert.ok(
    (balanced.get("countdown") ?? 0) > (balanced.get("daily_life") ?? 0),
    "balanced: a real reason beats a plain moment",
  );
  const noCountdown = kinds({ ...SLURP_STORY_JOB_DEFAULTS, countdown: 0 });
  assert.equal(noCountdown.get("countdown") ?? 0, 0, "0 = never");
  const pollHeavy = kinds({ ...SLURP_STORY_JOB_DEFAULTS, poll: 10, countdown: 1 });
  assert.ok((pollHeavy.get("poll") ?? 0) > (balanced.get("poll") ?? 0) * 2, "a slider moves the mix");
  const allOff = kinds({ countdown: 0, newPost: 0, comment: 0, poll: 0, earlier: 0, plain: 0 });
  assert.equal(allOff.get("daily_life"), 400, "everything off: a plain moment, never an error");
  // Wiring: the planner reads the setting; Settings › Posting shows one slider per job.
  assert.match(server("features/feed/slp-post-purpose-service.ts"), /slurpStoryPurpose\([^)]*storyJobs\)/u);
  const panel = client("features/feed/SlpPublishingPanel.tsx");
  assert.match(panel, /settingKey="storyJobs"/u);
  assert.match(panel, /Object\.keys\(SLURP_STORY_JOB_DEFAULTS\)/u);
  assert.match(panel, /update\("storyJobs", \{ \.\.\.settings\.storyJobs, \[job\]: value \}\)/u);
}

// --- I10. Chat pictures to subscribers: casual free, spicy PPV ------------------------------------
{
  const offer = (spicy: boolean | undefined, rapportTier: "acquaintance" | "regular" | "whale", subscribed = true) =>
    resolveSlurpMediaOffer({ intent: "friendly", rapportTier, subscribed, configuredPrice: 12, spicy });
  for (const tier of ["acquaintance", "regular", "whale"] as const) {
    assert.equal(offer(false, tier).price, 0, `${tier} subscriber: a casual picture is free`);
    assert.equal(offer(true, tier).price, 12, `${tier} subscriber: a spicy one is PPV`);
  }
  assert.equal(offer(false, "acquaintance", false).price, 12, "non-subscribers keep the old rules");
  assert.equal(offer(true, "regular", false).price, 0, "a regular's free picture stays a tease (level below)");
  assert.equal(
    resolveSlurpMediaOffer({
      intent: "hostile",
      rapportTier: "whale",
      subscribed: true,
      configuredPrice: 12,
      spicy: true,
    }).price,
    0,
  );
  assert.equal(slurpDmPictureSpicy({ prompt: "a mirror selfie in new lingerie" }), true);
  assert.equal(slurpDmPictureSpicy({ prompt: "her latte art on a rainy morning" }), false);
  assert.equal(slurpDmPictureSpicy({ prompt: "a striped shirt at the market" }), false, "stripes are not stripping");
  assert.equal(slurpDmPictureSpicy({ prompt: "lingerie", spicy: false }), false, "the reply's own flag decides first");
  const reply = readSlurpDmReply({
    content: "for you 😘",
    image: { prompt: "topless on the bed", caption: "", spicy: true },
  });
  assert.equal(reply.image?.spicy, true);
  assert.equal(readSlurpDmReply({ content: "x", image: { prompt: "cat pic", spicy: "yes" } }).image?.spicy, undefined);
  const operation = server("features/messages/slp-message-operation.ts");
  assert.match(operation, /spicy: slurpDmPictureSpicy\(image\)/u);
  assert.match(
    server("features/messages/slp-message-generation-service.ts"),
    /"spicy": true when the picture shows nudity/u,
  );
}

// --- I11. Camera mix: timer shots about 15-20 %, more variety -------------------------------------
{
  const mix = (intents: string[], efforts: string[]) => {
    const counts = new Map<string, number>();
    let total = 0;
    for (let c = 0; c < 8; c += 1)
      for (let post = 0; post < 300; post += 1) {
        const source = slurpPostCameraSource(`creator-${c}`, post, {
          companyCanHoldCamera: post % 4 === 0,
          intent: intents[(post * 7 + c) % intents.length],
          effort: efforts[(post * 3 + c) % efforts.length],
        });
        counts.set(source, (counts.get(source) ?? 0) + 1);
        total += 1;
      }
    return (source: string) => (counts.get(source) ?? 0) / total;
  };
  const mixed = mix(
    ["set", "teaser", "callback", "behind_the_scenes", "business", "casual", "appreciation", "casual"],
    ["low", "medium", "medium", "high"],
  );
  const setHeavy = mix(["set", "set", "teaser", "set", "casual", "behind_the_scenes"], ["medium", "high", "high"]);
  assert.ok(
    mixed("tripod") >= 0.1 && mixed("tripod") <= 0.2,
    `timer shots ${(mixed("tripod") * 100).toFixed(0)} % of a mixed feed`,
  );
  assert.ok(
    setHeavy("tripod") <= 0.25,
    `a set-heavy feed keeps timer shots at ${(setHeavy("tripod") * 100).toFixed(0)} %`,
  );
  assert.ok(mixed("desk") > 0.08, "the desk camera is a real part of the mix");
  for (const source of SLURP_CAMERA_SOURCES) assert.ok(mixed(source) <= 0.27, `${source} at most about a quarter`);
  assert.match(slurpCameraSourceInstruction("desk"), /live stream or a video call/u);
}

// --- J2. Professor Mari: `mari-actions:slurp2` ----------------------------------------------------
{
  assert.deepEqual(slpActionServiceKeys(["chat-read", "routes"]), ["slurp2:actions"], "older Engines: no Mari key");
  assert.deepEqual(slpActionServiceKeys(undefined), ["slurp2:actions"]);
  assert.deepEqual(slpActionServiceKeys(["routes", "mari-actions"]), ["slurp2:actions", "mari-actions:slurp2"]);
  // The catalog passes the Engine's own checks (capability-mari-actions.service.ts in PR #6800).
  const catalog = slpActionCatalog();
  assert.ok(catalog.length <= 50);
  for (const action of catalog) {
    assert.match(action.name, /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u);
    assert.ok(action.summary.length <= 300, `${action.name} summary fits`);
    const inputs = Object.entries(action.inputs);
    assert.ok(inputs.length <= 40);
    for (const [key, text] of inputs) assert.ok(typeof text === "string" && text.length <= 300 && key.length <= 80);
  }
  assert.ok(
    catalog.some((action) => action.name === "list-creators"),
    "Mari can find the Creator ids",
  );
  assert.equal(SLP_ACTIONS["list-creators"].schema.safeParse({}).success, true);
  assert.equal(SLP_ACTIONS["list-creators"].schema.safeParse({ extra: 1 }).success, false, "strict");
  // The service is the catalog plus the one validated runner (Engine shape { ok, value } | { ok: false, error }).
  // W: plus `preview`, which writes nothing (the Engine calls only list and run; an extra key is harmless).
  const runner = server("features/assist/slp-action-runner.ts");
  assert.match(
    runner,
    /return \{\s+list: slpActionCatalog,\s+run: \(name: string, input: unknown\) => runSlpAction\(db, name, input\),\s+preview: \(name: string, input: unknown\) => previewSlpAction\(db, name, input\),\s+\};/u,
  );
  assert.match(runner, /case "list-creators":\s*return \{\s*ok: true,/u);
  // The server feature-detects from its own manifest.
  const entry = server("slp-server-entry.ts");
  assert.match(entry, /slpActionServiceKeys\(installed\?\.manifest\?\.permissions\)/u);
  assert.match(entry, /package: installed,/u);
  // The builder emits the permission only with Capability API 1.50, which the Engine requires for it.
  const builder = readFileSync(join(repo, "scripts/build-feature-packages.mjs"), "utf8");
  assert.match(
    builder,
    /optionalPermissions: \[\s*\{ permission: "mari-actions", capabilityApi: \{ major: 1, minor: 50 \} \}/u,
  );
  assert.match(builder, /permissions: featurePermissions\(feature\),/u);
  const manifest = JSON.parse(readFileSync(join(repo, "packages/slurp2/manifest.json"), "utf8")) as {
    permissions: string[];
    capabilityApi: { major: number; minor: number };
  };
  const api = manifest.capabilityApi;
  const has150 = api.major > 1 || (api.major === 1 && api.minor >= 50);
  assert.equal(
    manifest.permissions.includes("mari-actions"),
    has150,
    "the permission comes with Capability API 1.50, never without",
  );
}

console.log("slurp2 slice I + J2 regression passed");
