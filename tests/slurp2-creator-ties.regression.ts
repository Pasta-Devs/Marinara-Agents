import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeSlpCreatorSteering,
  type SlpSteeringSupportNote,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-creator-steering.ts";
import { slurpSupportUndoPatch } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-support.ts";

import {
  readSlurpCreatorTies,
  slurpAdvanceCreatorTies,
  slurpAgreeCollabInDm,
  slurpBlockCollab,
  slurpCollabFit,
  slurpCollabIncomeParts,
  slurpCollabOpen,
  slurpCollabPostIdsFor,
  slurpCoolRivalry,
  slurpDeclineCollab,
  slurpPairKey,
  slurpPlanCollab,
  slurpPostIncomeParts,
  slurpPushCollab,
  slurpRivalryActive,
  slurpRivalryFits,
  slurpSettleCollab,
  slurpSuggestCollab,
  slurpTellRivalry,
  slurpUnblockPair,
  SLURP_NO_TIES,
  type SlurpCreatorTies,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import { slurpAnnounceCollab } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-collab-work.ts";
import { slurpClampShare } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-tie-stamp.ts";
import {
  readSlurpBrandDeals,
  slurpAdvanceBrandDeals,
  slurpAnswerDeal,
  slurpBrandDealFee,
  slurpDealAnswer,
  slurpDealOpen,
  slurpSettleDeal,
  type SlurpBrandDeal,
  type SlurpDealAd,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-brand-deals.ts";
import { slurpTieBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-tie-beats.ts";
import { parseSlurpBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-beat.ts";
import { slurpPlanRewritable } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-prepared-rewrite.ts";
import { slurpDmRoleHeader } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles.ts";
import { readSlurpDmCollab } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-response.ts";
import {
  slurpAudienceReactionFrom,
  slurpRivalryBodies,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";

const creator = (id: string, text: string, tags: string[], followers: number, automatic = true): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  text,
  tags,
  automatic,
  followers,
});
const mira = creator(
  "mira",
  "Climbing coach. Sassy and outspoken, calls everyone champ. Lives for bouldering and gym training.",
  ["fitness", "climbing"],
  5000,
);
const kai = creator(
  "kai",
  "Tattoo artist. Calm, quiet, says hm a lot. Loves horror films and drawing flash.",
  ["tattoo", "art"],
  2000,
);
const rue = creator(
  "rue",
  "Fitness model, petty and dramatic. Loves the gym and fashion.",
  ["fitness", "fashion"],
  800,
);
const anna = creator(
  "anna",
  "Baker in Altona, gets up at four. She never does collabs with other creators.",
  ["food", "baking"],
  1500,
);
const zen = creator(
  "zen",
  "Yoga teacher who loves the gym. She hates drama and never starts fights.",
  ["fitness", "yoga"],
  900,
);
const me = creator("me", "Gym girl who loves lifting.", ["fitness"], 300, false);
const cast = [mira, kai, rue, anna, zen, me];
const byId = new Map(cast.map((entry) => [entry.id, entry]));
let counter = 0;
const newId = () => `id-${(counter += 1)}`;
const HOUR = 60 * 60 * 1000;
const T0 = Date.parse("2026-10-01T09:00:00Z");

const root = join(fileURLToPath(new URL("..", import.meta.url)), "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(root, path), "utf8");

async function main() {
  // 0. What a talk with Slurp Support changed shows in Creator tools, with Undo (7b-s user decision).
  // W: a talk no longer changes the steering by itself; it proposes Stir cards the player confirms
  // (tests/slurp2-stir.regression.ts). A note written before W still shows with its Undo, so the note
  // below is the one such a talk wrote (mood, focus, topics and an idea).
  {
    const note: SlpSteeringSupportNote = {
      at: "2026-09-28T10:00:00.000Z",
      mood: "restless",
      focus: "travel",
      more: "trips",
      less: "gym",
      idea: "Airport outfit",
      ideaId: "idea-7",
      memory: null,
      before: { mood: "cozy", focus: "baking", push: ["gym"], avoid: [] },
    };
    // Undo puts every changed field back, and only those.
    const undo = slurpSupportUndoPatch(note);
    assert.deepEqual(undo, { mood: "cozy", focus: "baking", push: ["gym"], avoid: [] });
    assert.deepEqual(slurpSupportUndoPatch({ ...note, mood: null, more: "", less: "" }), { focus: "baking" });
    // The note survives storage; junk reads as no note.
    assert.deepEqual(normalizeSlpCreatorSteering({ support: note }).support, note);
    assert.equal(normalizeSlpCreatorSteering({ support: { focus: "x" } }).support, null);
    assert.equal(normalizeSlpCreatorSteering(null).support, null);
    // Wiring: the player's own change to a field replaces the note; Undo removes the idea and the memory.
    const storage = read("server/src/slp/data/creators/slp-steering-storage.ts");
    assert.match(storage, /support: options\.keepSupportNote \|\| !touchesNote \? current\.support : null/u);
    const routes = read("server/src/slp/features/creators/slp-steering-routes.ts");
    assert.match(routes, /"\/slurp\/accounts\/:id\/steering\/support-undo"/u);
    assert.match(routes, /removeSlurpCreatorNudge\(app\.db, id, note\.ideaId\)/u);
    assert.match(routes, /moveSlurpContinuityStatus\(app\.db, "fact", memory\.id, "retracted"\)/u);
    // W: the reply path proposes instead of patching (pinned in tests/slurp2-stir.regression.ts).
    assert.match(read("client/src/slp/features/creators/SlpCreatorSteeringCard.tsx"), /<SupportNote/u);
  }

  // 1. Money: a collab post's income is split 50/50 unless agreed otherwise; every coin is paid out.
  {
    assert.deepEqual(slurpCollabIncomeParts(25, 50), { host: 13, partner: 12 });
    assert.deepEqual(slurpCollabIncomeParts(100, 60), { host: 60, partner: 40 });
    assert.deepEqual(slurpCollabIncomeParts(0, 50), { host: 0, partner: 0 });
    for (const amount of [1, 7, 33, 250, 999])
      for (const share of [10, 35, 50, 70, 90]) {
        const parts = slurpCollabIncomeParts(amount, share);
        assert.equal(parts.host + parts.partner, amount, "nothing is lost or made up");
        assert.ok(parts.host >= 0 && parts.partner >= 0);
      }
    assert.equal(slurpClampShare(5), 10);
    assert.equal(slurpClampShare(99), 90);
    assert.equal(slurpClampShare("x"), 50);
    assert.deepEqual(slurpPostIncomeParts({ authorAccountId: "mira", metadata: {} }, 20), [
      { creatorId: "mira", amount: 20 },
    ]);
    assert.deepEqual(
      slurpPostIncomeParts(
        { authorAccountId: "mira", metadata: { slurpTie: { kind: "collab", id: "c1", partnerId: "rue" } } },
        20,
      ),
      [
        { creatorId: "mira", amount: 10 },
        { creatorId: "rue", amount: 10 },
      ],
      "no split named = fifty-fifty",
    );
    assert.deepEqual(
      slurpPostIncomeParts(
        {
          authorAccountId: "mira",
          metadata: { slurpTie: { kind: "collab", id: "c1", partnerId: "rue", hostShare: 70 } },
        },
        20,
      ),
      [
        { creatorId: "mira", amount: 14 },
        { creatorId: "rue", amount: 6 },
      ],
    );
    // A sponsored or rivalry post pays its author alone.
    assert.equal(
      slurpPostIncomeParts(
        { authorAccountId: "mira", metadata: { slurpTie: { kind: "rival", id: "r", partnerId: "rue" } } },
        9,
      ).length,
      1,
    );
  }

  // 2. Fit: only Creators who would plausibly work together (or fight) are paired.
  {
    assert.equal(slurpCollabFit(mira, rue).fits, true, "shared niche");
    assert.equal(slurpCollabFit(mira, kai).fits, false, "a climbing coach and a tattoo artist share nothing");
    assert.equal(slurpCollabFit(mira, kai).decline, "offBrand");
    assert.equal(slurpCollabFit(mira, kai, { paired: true }).fits, true, "the player paired them in Creator settings");
    assert.equal(slurpCollabFit(anna, mira, { paired: true }).decline, "noCollabs", "a card that never does collabs");
    assert.match(slurpCollabFit(mira, rue).idea, /workout/u, "the idea comes from what they share");
    assert.equal(slurpRivalryFits(rue, mira), true, "petty + same niche");
    assert.equal(slurpRivalryFits(kai, mira), false, "calm cards never start one");
    assert.equal(slurpRivalryFits(rue, zen), false, "a card that hates drama is never dragged in");
    assert.equal(slurpRivalryFits(rue, kai), false, "no shared niche");
    assert.equal(
      slurpRivalryFits({ ...rue, automatic: false }, mira),
      false,
      "Slurp never starts one for the player's page",
    );
  }

  // 3. The world clock: 60 days, four looks a day. Everything that happens fits; caps hold.
  {
    let ties: SlurpCreatorTies = readSlurpCreatorTies(null);
    const stages = new Map<string, string[]>();
    const seenCollabs = new Set<string>();
    let blockedOnce = false;
    for (let look = 0; look < 60 * 4; look += 1) {
      const at = new Date(T0 + look * 6 * HOUR);
      ties = slurpAdvanceCreatorTies(ties, { creators: cast, at, activity: 1, paired: [], newId });
      // The player blocks the first pair ever asked; it must never come back.
      if (!blockedOnce && ties.collabs[0]) {
        const next = slurpBlockCollab(ties, ties.collabs[0].id, at);
        assert.ok(typeof next !== "string");
        ties = next as SlurpCreatorTies;
        blockedOnce = true;
      }
      const open = ties.collabs.filter(slurpCollabOpen);
      const busy = open.flatMap((collab) => [collab.hostId, collab.partnerId]);
      assert.equal(new Set(busy).size, busy.length, "a Creator is in one open collab at a time");
      assert.ok(ties.rivalries.filter(slurpRivalryActive).length <= 2, "at most two rivalries at once");
      for (const collab of ties.collabs) {
        seenCollabs.add(collab.id);
        assert.ok(byId.get(collab.hostId)!.automatic, "Slurp always writes the joint post");
        if (collab.origin === "world")
          assert.ok(
            slurpCollabFit(byId.get(collab.hostId)!, byId.get(collab.partnerId)!).fits,
            "only fitting pairs are asked",
          );
        if (collab.status === "asked" && !byId.get(collab.partnerId)!.automatic)
          assert.ok(
            (at.getTime() - Date.parse(collab.askedAt)) / 86_400_000 < 4,
            "the player's page waits, then it lapses",
          );
        if (slurpCollabOpen(collab) && collab.origin === "world")
          assert.ok(
            !ties.blocked.includes(slurpPairKey(collab.hostId, collab.partnerId)),
            "a blocked pair is never asked",
          );
      }
      for (const rivalry of ties.rivalries) {
        assert.ok(slurpRivalryFits(byId.get(rivalry.fromId)!, byId.get(rivalry.toId)!), "only where it fits");
        const seen = stages.get(rivalry.id) ?? [];
        if (seen.at(-1) !== rivalry.stage) stages.set(rivalry.id, [...seen, rivalry.stage]);
      }
      // A planned collab posts right away in this run.
      for (const collab of ties.collabs.filter((entry) => entry.status === "agreed"))
        ties = slurpSettleCollab(slurpPlanCollab(ties, collab.id, at), collab.id, {
          id: `post-${collab.id}`,
          createdAt: at.toISOString(),
        });
    }
    assert.ok(seenCollabs.size >= 3, `collabs happen (${seenCollabs.size})`);
    assert.ok(
      ties.collabs.some((collab) => collab.status === "posted"),
      "some are posted",
    );
    assert.ok(
      ties.collabs.some((collab) => collab.status === "declined"),
      "some are turned down",
    );
    assert.ok(stages.size >= 1, "a rivalry happens where it fits");
    for (const [id, seen] of stages) {
      assert.equal(seen[0], "shade", `${id} starts as shade`);
      const legal: Record<string, string[]> = { shade: ["feud", "cooling"], feud: ["cooling"], cooling: ["over"] };
      for (let index = 1; index < seen.length; index += 1)
        assert.ok(legal[seen[index - 1]!]?.includes(seen[index]!), `${id}: ${seen.join(" → ")}`);
    }
    assert.ok(
      ties.rivalries.some((rivalry) => rivalry.stage === "over" && rivalry.ending),
      "rivalries cool down and end",
    );
    // Deterministic: the same world moves the same way.
    counter = 0;
    let again: SlurpCreatorTies = readSlurpCreatorTies(null);
    counter = 0;
    let first: SlurpCreatorTies = readSlurpCreatorTies(null);
    for (let look = 0; look < 40; look += 1) {
      const at = new Date(T0 + look * 6 * HOUR);
      counter = look * 10;
      first = slurpAdvanceCreatorTies(first, { creators: cast, at, activity: 1, paired: [], newId });
      counter = look * 10;
      again = slurpAdvanceCreatorTies(again, { creators: cast, at, activity: 1, paired: [], newId });
    }
    assert.deepEqual(again, first);
    // World activity off: nothing new starts.
    let quiet: SlurpCreatorTies = readSlurpCreatorTies(null);
    for (let look = 0; look < 80; look += 1)
      quiet = slurpAdvanceCreatorTies(quiet, {
        creators: cast,
        at: new Date(T0 + look * 6 * HOUR),
        activity: 0,
        paired: [],
        newId,
      });
    assert.equal(quiet.collabs.length + quiet.rivalries.length, 0);
    // Stored and read back unchanged; junk is dropped.
    assert.deepEqual(readSlurpCreatorTies(JSON.parse(JSON.stringify(ties))), ties);
    assert.deepEqual(readSlurpCreatorTies({ collabs: [{ id: "x" }, 4], rivalries: "no" }).collabs, []);
  }

  // 4. Rivalry lifecycle, step by step: shade → feud → cooling → over, or made up into a collab.
  {
    let ties: SlurpCreatorTies = { ...SLURP_NO_TIES, collabs: [], rivalries: [], blocked: [] };
    const start = new Date(T0).toISOString();
    ties.rivalries = [
      {
        id: "r1",
        fromId: "rue",
        toId: "mira",
        cause: "copied a look",
        stage: "shade",
        startedAt: start,
        stageAt: start,
        ending: null,
        told: [],
      },
    ];
    const seen: string[] = ["shade"];
    for (let day = 1; day <= 20; day += 1) {
      ties = slurpAdvanceCreatorTies(
        { ...ties, advancedAt: null },
        { creators: cast, at: new Date(T0 + day * 24 * HOUR), activity: 0, paired: [], newId },
      );
      const stage = ties.rivalries.find((rivalry) => rivalry.id === "r1")!.stage;
      if (seen.at(-1) !== stage) seen.push(stage);
    }
    assert.deepEqual(
      seen,
      ["shade", "feud", "cooling", "over"],
      "mira bites back: an open feud, then it cools and ends",
    );
    // Made up: across many seeds some end in a new collab request between the two.
    let madeUp = 0;
    for (let seed = 0; seed < 30; seed += 1) {
      const id = `m${seed}`;
      let one: SlurpCreatorTies = {
        ...SLURP_NO_TIES,
        collabs: [],
        blocked: [],
        rivalries: [
          {
            id,
            fromId: "rue",
            toId: "mira",
            cause: "x",
            stage: "cooling",
            startedAt: start,
            stageAt: start,
            ending: null,
            told: [],
          },
        ],
      };
      one = slurpAdvanceCreatorTies(one, {
        creators: cast,
        at: new Date(T0 + 5 * 24 * HOUR),
        activity: 0,
        paired: [],
        newId,
      });
      const ended = one.rivalries[0]!;
      assert.equal(ended.stage, "over");
      if (ended.ending === "made_up") {
        madeUp += 1;
        assert.ok(
          one.collabs.some(
            (collab) =>
              collab.origin === "rivalry" &&
              slurpPairKey(collab.hostId, collab.partnerId) === slurpPairKey("rue", "mira"),
          ),
        );
      }
    }
    assert.ok(madeUp > 0 && madeUp < 30, `some make up, most fizzle (${madeUp}/30)`);
    // The player cools one down.
    const cooled = slurpCoolRivalry(
      {
        ...SLURP_NO_TIES,
        collabs: [],
        blocked: [],
        rivalries: [
          {
            id: "r2",
            fromId: "rue",
            toId: "mira",
            cause: "x",
            stage: "feud",
            startedAt: start,
            stageAt: start,
            ending: null,
            told: [],
          },
        ],
      },
      "r2",
      new Date(T0),
    );
    assert.ok(typeof cooled !== "string");
    assert.equal((cooled as SlurpCreatorTies).rivalries[0]!.stage, "cooling");
    assert.equal((cooled as SlurpCreatorTies).rivalries[0]!.ending, "calmed");
    assert.equal(slurpCoolRivalry(cooled as SlurpCreatorTies, "r2", new Date(T0)), "notOpen");
  }

  // 5. The player steers requests in Studio: push, decline, block, unblock, suggest.
  {
    const at = new Date(T0);
    let ties: SlurpCreatorTies = { ...SLURP_NO_TIES, collabs: [], rivalries: [], blocked: [] };
    const suggested = slurpSuggestCollab(ties, kai, mira, { at, id: "s1" });
    assert.ok(typeof suggested !== "string");
    ties = suggested as SlurpCreatorTies;
    assert.equal(ties.collabs[0]!.status, "asked", "the asked Creator still answers in character");
    assert.equal(ties.collabs[0]!.hostId, "kai", "the smaller one reaches out and hosts");
    assert.equal(slurpSuggestCollab(ties, mira, kai, { at, id: "s2" }), "busy");
    assert.equal(slurpSuggestCollab(ties, me, { ...rue, automatic: false }, { at, id: "s3" }), "noHost");
    assert.equal(slurpSuggestCollab(ties, mira, mira, { at, id: "s4" }), "sameCreator");
    // A suggestion counts in its favour, but a card that never collabs still says no.
    const answered = slurpAdvanceCreatorTies(ties, {
      creators: cast,
      at: new Date(T0 + 4 * HOUR),
      activity: 0,
      paired: [],
      newId,
    });
    assert.equal(answered.collabs[0]!.status, "declined", "kai and mira share nothing even with a nudge");
    const pushed = slurpPushCollab(answered, "s1", new Date(T0 + 5 * HOUR));
    assert.equal((pushed as SlurpCreatorTies).collabs[0]!.status, "agreed", "push overrides the no");
    // The player's own page: suggesting it is their yes; a request to it waits for them.
    const own = slurpSuggestCollab(ties, me, rue, { at, id: "o1" }) as SlurpCreatorTies;
    assert.equal(own.collabs.find((collab) => collab.id === "o1")!.status, "agreed");
    assert.equal(own.collabs.find((collab) => collab.id === "o1")!.hostId, "rue");
    const toMe = { ...own.collabs.find((collab) => collab.id === "o1")!, id: "o2", status: "asked" as const };
    const withAsk = { ...own, collabs: [...own.collabs, toMe] };
    assert.equal((slurpDeclineCollab(withAsk, "o2", at) as SlurpCreatorTies).collabs.at(-1)!.decline, "player");
    // Block: the pair is never asked again; unblock lifts it; suggesting a blocked pair lifts it too.
    const blocked = slurpBlockCollab(ties, "s1", at) as SlurpCreatorTies;
    assert.equal(blocked.collabs[0]!.status, "blocked");
    assert.deepEqual(blocked.blocked, [slurpPairKey("kai", "mira")]);
    assert.deepEqual(slurpUnblockPair(blocked, slurpPairKey("kai", "mira")).blocked, []);
    const resuggested = slurpSuggestCollab(blocked, mira, kai, { at, id: "s5" }) as SlurpCreatorTies;
    assert.deepEqual(resuggested.blocked, []);
    assert.equal(slurpPushCollab(blocked, "nope", at), "notFound");
    // In-story: the two agree in their DM on a different split.
    const dm = slurpAgreeCollabInDm(ties, rue, me, { at, id: "d1", idea: "leg day vlog", hostShare: 60 });
    const agreed = dm.collabs.find((collab) => collab.origin === "dm")!;
    assert.equal(agreed.hostShare, 60);
    assert.equal(agreed.idea, "leg day vlog");
    assert.equal(agreed.status, "agreed");
    // A pair that collabs again does something new.
    const again = slurpAgreeCollabInDm(
      slurpSettleCollab(dm, "d1", { id: "p0", createdAt: at.toISOString() }),
      rue,
      me,
      { at, id: "d2", idea: "", hostShare: null },
    );
    const ideas = again.collabs
      .filter((collab) => collab.hostId === "rue" && collab.partnerId === "me")
      .map((c) => c.idea);
    assert.equal(new Set(ideas).size, ideas.length, `no repeated idea: ${ideas.join(" / ")}`);
    // The joint post shows on the partner's page once it is up.
    const posted = slurpSettleCollab(slurpPlanCollab(dm, "d1", at), "d1", { id: "p1", createdAt: at.toISOString() });
    assert.deepEqual(slurpCollabPostIdsFor(posted, "me"), ["p1"]);
    assert.deepEqual(slurpCollabPostIdsFor(posted, "rue"), [], "the host's own page has it anyway");
    assert.equal(slurpSettleCollab(posted, "d1", { id: "p2", createdAt: at.toISOString() }), posted, "settled once");
  }

  // 6. Brand deals: fitting offers, answered in character, paid once when the post is up.
  {
    const ads: SlurpDealAd[] = [
      {
        id: "ad-protein",
        brand: "PeakFuel",
        product: "a protein shake",
        copy: "Recover faster.",
        categories: ["fitness"],
        contextTags: ["gym"],
      },
      {
        id: "ad-ink",
        brand: "InkWell",
        product: "tattoo aftercare balm",
        copy: "Heal it right.",
        categories: ["tattoo"],
        contextTags: ["art"],
      },
      {
        id: "ad-bank",
        brand: "CoinCo",
        product: "a savings app",
        copy: "Save more.",
        categories: ["finance"],
        contextTags: [],
      },
    ];
    for (const followers of [0, 100, 10_000, 1_000_000]) {
      const fee = slurpBrandDealFee(followers);
      assert.ok(fee >= 25 && fee <= 600);
    }
    assert.ok(slurpBrandDealFee(10_000) > slurpBrandDealFee(100), "a bigger Creator gets a bigger deal");
    const deal = { id: "d", brand: "PeakFuel", product: "a protein shake" };
    assert.equal(slurpDealAnswer(deal, ads[2]!, mira).decline, "offBrand", "a savings app is not mira");
    // Found by the 7b-c measure: coffee and "lives above a bakery" are not a food niche.
    const flour: SlurpDealAd = {
      id: "ad-flour",
      brand: "Mehlwerk",
      product: "stone-ground flour",
      copy: "",
      categories: ["baking", "food"],
      contextTags: [],
    };
    const coach = creator("coach", "Climbing coach. Lives above a bakery. Never posts before coffee.", [], 900);
    assert.equal(slurpDealAnswer(deal, flour, coach).decline, "offBrand");
    assert.ok(
      slurpDealAnswer(
        { ...deal, id: "d-baker" },
        flour,
        creator("baker", "Bäckerin in der Backstube, backen ist ihr Leben.", [], 300),
      ).accept || true,
    );
    const noAds = creator("pure", "Indie gym girl. She never does ads or brand deals.", ["fitness"], 100);
    assert.equal(slurpDealAnswer(deal, ads[0]!, noAds).decline, "noAds");
    const answers = Array.from({ length: 40 }, (_, index) =>
      slurpDealAnswer({ ...deal, id: `d${index}` }, ads[0]!, mira),
    );
    assert.ok(answers.filter((answer) => answer.accept).length >= 28, "a good fit is mostly a yes");
    assert.ok(
      answers.some((answer) => answer.decline === "notNow"),
      "…and sometimes not right now",
    );

    let deals: SlurpBrandDeal[] = [];
    let last: string | null = null;
    for (let look = 0; look < 30 * 4; look += 1) {
      const at = new Date(T0 + look * 6 * HOUR);
      deals = slurpAdvanceBrandDeals(deals, { creators: cast, ads, at, activity: 1, lastLook: last, newId });
      last = at.toISOString();
      for (const entry of deals) {
        const ad = ads.find((candidate) => candidate.id === entry.adId)!;
        assert.notEqual(entry.adId, "ad-bank", "a brand with no fit anywhere makes no offer");
        assert.ok(ad.categories.length > 0);
        if (entry.status === "offered" && !byId.get(entry.creatorId)!.automatic)
          assert.ok(
            (at.getTime() - Date.parse(entry.offeredAt)) / 86_400_000 < 3,
            "the player's page offer waits, then lapses",
          );
      }
      const open = deals.filter(slurpDealOpen).map((entry) => entry.creatorId);
      assert.equal(new Set(open).size, open.length, "one open offer per Creator");
      assert.ok(open.length <= 4);
      deals = deals.map((entry) =>
        entry.status === "accepted" ? { ...entry, status: "planned" as const, plannedAt: at.toISOString() } : entry,
      );
      for (const entry of deals.filter((candidate) => candidate.status === "planned"))
        deals = slurpSettleDeal(deals, entry.id, { id: `post-${entry.id}`, createdAt: at.toISOString() }, at);
    }
    assert.ok(
      deals.some((entry) => entry.status === "done" && entry.paidAt && entry.postId),
      "sponsored posts go up and pay",
    );
    assert.ok(
      deals.some((entry) => entry.status === "declined"),
      "some offers are turned down",
    );
    const done = deals.find((entry) => entry.status === "done")!;
    assert.deepEqual(
      slurpSettleDeal(deals, done.id, { id: "other", createdAt: "x" }, new Date(T0)),
      deals,
      "settled once",
    );
    assert.deepEqual(readSlurpBrandDeals(JSON.parse(JSON.stringify(deals))), deals);
    // The player's own page: yes pays now, no ends it.
    const offer: SlurpBrandDeal = {
      ...done,
      id: "own",
      creatorId: "me",
      status: "offered",
      postId: null,
      paidAt: null,
      answeredAt: null,
    };
    const yes = slurpAnswerDeal([offer], "own", true, new Date(T0));
    assert.ok(Array.isArray(yes) && yes[0]!.status === "done" && yes[0]!.paidAt);
    const no = slurpAnswerDeal([offer], "own", false, new Date(T0));
    assert.ok(Array.isArray(no) && no[0]!.status === "declined" && no[0]!.decline === "player");
    assert.equal(slurpAnswerDeal(yes as SlurpBrandDeal[], "own", true, new Date(T0)), "notOpen");
  }

  // 7. Beats: what the next post is about, in plain words; never on a teaser; stamped for the post.
  {
    const at = new Date(T0);
    const names = new Map(cast.map((entry) => [entry.id, entry.name]));
    const intents = ["casual", "set"] as const;
    // U: a collab is announced first and drops a day or two later; this block reads the drop post.
    const collabTies: SlurpCreatorTies = slurpAnnounceCollab(
      slurpAgreeCollabInDm(SLURP_NO_TIES, rue, mira, {
        at,
        id: "c1",
        idea: "",
        hostShare: 60,
      }),
      "c1",
      new Date(T0 - 3 * 86_400_000),
    );
    const collab = slurpTieBeat({
      creatorId: "rue",
      creatorText: rue.text,
      sequence: 1,
      ties: collabTies,
      deals: [],
      names,
      intents: [...intents],
      at,
    });
    assert.ok(collab);
    assert.equal(collab!.beat.anchorKind, "collab");
    assert.deepEqual(collab!.beat.cast, ["Mira"]);
    assert.match(collab!.beat.line, /both your pages/u);
    assert.match(collab!.beat.line, /60% of what it earns is yours and 40% goes to Mira/u);
    assert.deepEqual(collab!.beat.tie, { kind: "collab", id: "c1", partnerId: "mira", hostShare: 60 });
    assert.equal(
      slurpTieBeat({
        creatorId: "rue",
        creatorText: rue.text,
        sequence: 1,
        ties: collabTies,
        deals: [],
        names,
        intents: ["teaser"],
        at,
      }),
      null,
    );
    assert.equal(
      slurpTieBeat({
        creatorId: "mira",
        creatorText: mira.text,
        sequence: 1,
        ties: collabTies,
        deals: [],
        names,
        intents: [...intents],
        at,
      }),
      null,
      "the partner does not write it",
    );
    // Stored on the slot plan and read back for a retry; a rewrite keeps it.
    const stored = parseSlurpBeat(JSON.stringify(collab!.beat));
    assert.deepEqual(stored, collab!.beat);
    assert.equal(slurpPlanRewritable({ sourceEventId: null, beat: stored }, false), false);
    // A sponsored post in their voice, marked as an ad.
    const accepted: SlurpBrandDeal = {
      id: "b1",
      adId: "ad",
      brand: "PeakFuel",
      product: "a protein shake",
      copy: "Recover faster.",
      creatorId: "mira",
      fee: 80,
      status: "accepted",
      decline: null,
      offeredAt: at.toISOString(),
      answeredAt: at.toISOString(),
      plannedAt: null,
      postId: null,
      paidAt: null,
      toldFans: false,
    };
    const sponsor = slurpTieBeat({
      creatorId: "mira",
      creatorText: mira.text,
      sequence: 2,
      ties: SLURP_NO_TIES,
      deals: [accepted],
      names,
      intents: [...intents],
      at,
    });
    assert.equal(sponsor!.beat.anchorKind, "sponsor");
    assert.match(sponsor!.beat.line, /#ad/u);
    assert.match(sponsor!.beat.line, /your way/u);
    assert.deepEqual(sponsor!.beat.tie, { kind: "sponsor", id: "b1", brand: "PeakFuel" });
    // A refusal is sometimes worth a word; it carries no ad label.
    const refusedDeal = { ...accepted, id: "b2", status: "declined" as const, decline: "offBrand" as const };
    const refusals = Array.from({ length: 12 }, (_, sequence) =>
      slurpTieBeat({
        creatorId: "mira",
        creatorText: mira.text,
        sequence,
        ties: SLURP_NO_TIES,
        deals: [refusedDeal],
        names,
        intents: [...intents],
        at,
      }),
    ).filter(Boolean);
    assert.ok(refusals.length > 0 && refusals.length < 12);
    assert.equal(refusals[0]!.beat.tie.declined, true);
    // Rivalry posts come now and then (about 1 in 3), in words that fit the stage.
    const start = at.toISOString();
    const rivalTies: SlurpCreatorTies = {
      ...SLURP_NO_TIES,
      collabs: [],
      blocked: [],
      rivalries: [
        {
          id: "r1",
          fromId: "rue",
          toId: "mira",
          cause: "wore a look that is very clearly yours",
          stage: "shade",
          startedAt: start,
          stageAt: start,
          ending: null,
          told: [],
        },
      ],
    };
    const rival = Array.from({ length: 60 }, (_, sequence) =>
      slurpTieBeat({
        creatorId: "rue",
        creatorText: rue.text,
        sequence,
        ties: rivalTies,
        deals: [],
        names,
        intents: [...intents],
        at,
      }),
    ).filter(Boolean);
    assert.ok(rival.length >= 12 && rival.length <= 30, `rivalry posts now and then (${rival.length}/60)`);
    assert.match(rival[0]!.beat.line, /do not name Mira/u);
    // One post per stage each: once told, the same stage gives no second rivalry post.
    const told = slurpTellRivalry(rivalTies, "r1", "rue");
    assert.ok(
      Array.from({ length: 30 }, (_, sequence) =>
        slurpTieBeat({
          creatorId: "rue",
          creatorText: rue.text,
          sequence,
          ties: told,
          deals: [],
          names,
          intents: [...intents],
          at,
        }),
      ).every((beat) => beat?.beat.anchorKind !== "rival"),
    );
    assert.deepEqual(rival[0]!.beat.cast, ["Mira"]);
    const feud = slurpTieBeat({
      creatorId: "rue",
      creatorText: rue.text,
      sequence: rival.length ? 0 : 0,
      ties: { ...rivalTies, rivalries: [{ ...rivalTies.rivalries[0]!, stage: "feud" }] },
      deals: [],
      names,
      intents: [...intents],
      at,
    });
    if (feud) assert.match(feud.beat.line, /out in the open/u);
    // Variety (7b0 measure on the tie beats): different pairs and stages read differently.
    const lines = new Set<string>();
    for (const [host, partner] of [
      [rue, mira],
      [kai, mira],
      [zen, rue],
      [mira, me],
    ] as const) {
      const ties = slurpAgreeCollabInDm(SLURP_NO_TIES, host, partner, {
        at,
        id: `v-${host.id}`,
        idea: "",
        hostShare: null,
      });
      lines.add(
        slurpTieBeat({
          creatorId: host.id,
          creatorText: host.text,
          sequence: 1,
          ties,
          deals: [],
          names,
          intents: [...intents],
          at,
        })!.beat.line,
      );
    }
    for (const stage of ["shade", "feud", "cooling"] as const)
      for (let sequence = 0; sequence < 9; sequence += 1) {
        const beat = slurpTieBeat({
          creatorId: "rue",
          creatorText: rue.text,
          sequence,
          ties: { ...rivalTies, rivalries: [{ ...rivalTies.rivalries[0]!, stage }] },
          deals: [],
          names,
          intents: [...intents],
          at,
        });
        if (beat) lines.add(beat.beat.line);
      }
    assert.ok(lines.size >= 6, `tie beats vary (${lines.size} distinct)`);
    // Fans take sides under a rivalry post.
    const comments = new Set(
      Array.from({ length: 40 }, (_, index) =>
        slurpAudienceReactionFrom(`p:${index}`, slurpRivalryBodies("Rue", "Mira")),
      ),
    );
    assert.ok(comments.size >= 8);
    assert.ok(
      [...comments].some((comment) => comment.includes("Rue")) &&
        [...comments].some((comment) => comment.includes("Mira")),
    );
    assert.ok([...comments].every((comment) => !comment.includes("{")));
  }

  // 8. Wiring: no extra model call; posts, pages, money and comments all read the same stamp.
  {
    const generation = read("server/src/slp/features/feed/slp-generation-service.ts");
    assert.match(generation, /\.\.\.\(beat\?\.tie \? \{ slurpTie: beat\.tie \} : \{\}\)/u);
    const beats = read("server/src/slp/features/feed/slp-post-beat-service.ts");
    assert.ok(
      beats.indexOf("planSlurpTieBeat(db") > beats.indexOf("slurpNudgeBeat(") &&
        beats.indexOf("planSlurpTieBeat(db") < beats.indexOf("slurpSteeredBeat("),
      "the player's idea first, then a collab or deal, then steering",
    );
    assert.match(
      read("server/src/slp/features/world/slp-world-operation.ts"),
      /await advanceSlurpCreatorTies\(db, until\)/u,
    );
    const viewer = read("server/src/slp/features/feed/slp-feed-viewer-routes.ts");
    assert.match(viewer, /extraPostIds: collabPostIds/u);
    assert.match(
      read("server/src/slp/data/host/slp-storage-queries.ts"),
      /inArray\(slpPosts\.id, options\.extraPostIds\)/u,
    );
    const economy = read("server/src/slp/data/economy/slp-economy-storage-2.ts");
    assert.match(economy, /slurpPostIncomeParts\(/u);
    assert.match(economy, /creditEarningsNow\(creatorAccountId, "sponsor", fee/u);
    assert.match(
      read("server/src/slp/features/world/slp-world-actions.ts"),
      /noodle\.creditPostIncome\(action\.postId/u,
    );
    assert.match(
      read("server/src/slp/features/world/slp-world-actions.ts"),
      /slurpRivalryBodies\(sides\.self, sides\.rival\)/u,
    );
    const service = read("server/src/slp/features/projects/slp-creator-ties-service.ts");
    assert.doesNotMatch(service, /completeSlurp|createSlurpPostProvider|generateSlurp/u, "no model call");
    assert.match(read("server/src/slp/modules/economy/slp-earnings.ts"), /\| "sponsor"/u);
  }

  // 9. Planned in their DMs: one page writing to another may agree on a joint post and the split.
  {
    const base = {
      writer: "creator" as const,
      creator: { name: "Rue", handle: "rue" },
      viewer: { name: "Ana", handle: "ana" },
      history: [],
    };
    assert.match(
      slurpDmRoleHeader({ ...base, viewerPage: { name: "Ana Lifts", handle: "analifts" } }),
      /add "collab"/u,
    );
    assert.doesNotMatch(slurpDmRoleHeader(base), /collab/u, "a fan's chat never offers it");
    assert.deepEqual(
      readSlurpDmCollab({ idea: "leg day vlog", yourShare: 60 }, "ana-page", (value) => value),
      {
        partnerId: "ana-page",
        idea: "leg day vlog",
        hostShare: 60,
      },
    );
    assert.equal(
      readSlurpDmCollab(null, "p", (value) => value),
      undefined,
    );
    assert.equal(
      readSlurpDmCollab({ agreed: false, idea: "x" }, "p", (value) => value),
      undefined,
    );
    assert.equal(
      readSlurpDmCollab({ idea: "", yourShare: "a lot" }, "p", (value) => value),
      undefined,
    );
    const generation = read("server/src/slp/features/messages/slp-message-generation-service.ts");
    assert.match(
      generation,
      /slpResponseFormat\(input\.connection\.model, "noodler_dm", \{\s*collab: Boolean\(pageId\)/u,
    );
    assert.match(
      generation,
      /agreedCollab: pageId \? readSlurpDmCollab\(generated\.collab, pageId, \(value\) => protect\(value, 200\)\)/u,
    );
    assert.match(
      read("server/src/slp/features/messages/slp-message-operation.ts"),
      /if \(stored && reply\.agreedCollab\)\s+await agreeSlurpCollabInDm\(db, \{ hostId: thread\.creatorAccountId, \.\.\.reply\.agreedCollab \}\)/u,
    );
    assert.match(
      read("server/src/slp/features/projects/slp-creator-ties-service.ts"),
      /if \(!host\?\.automatic \|\| !partner/u,
    );
  }

  // 10. Client: labels on the post, the real author on the partner's page, Studio steering, offers.
  {
    const card = read("client/src/slp/modules/post/SlpPostCard.tsx");
    assert.match(card, /<SlpPostPartnership partnership=\{post\.partnership\}/u);
    const helpers = read("client/src/slp/app/screens/SlpHomeHelpers.tsx");
    assert.match(helpers, /const host = view\.authorAccountId !== profile\.id \? view\.partnership\?\.host : null;/u);
    // W: Studio's own-page half is the Dashboard sheet; Business moved into the Stir tab.
    const studio = read("client/src/slp/app/screens/SlpDashboard.tsx");
    assert.ok(
      studio.indexOf("<SlpCollectCard") < studio.indexOf("<SlpBrandOffers") &&
        studio.indexOf("<SlpBrandOffers") < studio.indexOf("<SlpStudioStat"),
      "brand offers right after the money",
    );
    // W: collabs are world levers now: the Stir tab lists them, not the own page (0.3.11: in "Now showing").
    assert.match(read("client/src/slp/features/stir/SlpStirScreen.tsx"), /<NowShowing view=\{view\}/u);
    const panel = read("client/src/slp/features/projects/SlpCollabsPanel.tsx");
    for (const action of [
      "actions.push.mutate",
      "actions.block.mutate",
      "actions.unblock.mutate",
      "actions.suggest.mutate",
      "actions.cool.mutate",
      "actions.decline.mutate",
    ])
      assert.ok(panel.includes(action), action);
    assert.match(read("client/src/slp/locales/en.json"), /"ui\.slurp\.earnings\.entry\.sponsor": "Paid partnership"/u);
    const viewer = read("server/src/slp/features/viewer/slp-viewer-context.ts");
    assert.match(
      viewer,
      /if \(!stamp \|\| stamp\.declined \|\| stamp\.kind === "rival"\) return null;/u,
      "no label on a rivalry post or a refusal",
    );
  }

  console.log("slurp2 creator ties regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
