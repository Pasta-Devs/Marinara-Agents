/**
 * #1293: what a breakup leaves behind — keep (today's behaviour), move on (history stays, no more
 * dwelling or pending drama), forget (stops reaching future posts and chats; existing messages are
 * never deleted, but a direct chat gets an explicit override instead of staying silent). The same
 * choice reaches an existing ex later through `steer-couple` moveOn/forget.
 */
import assert from "node:assert/strict";
import {
  newSlurpCouple,
  slurpAdvanceCouples,
  slurpBreakUp,
  slurpCoupleOf,
  slurpGetBackTogether,
  slurpSteerCouple,
  type SlurpCouple,
  type SlurpCouplesInput,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import { readSlurpCouples } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-read.ts";
import {
  slurpChatBridgeCoupleLine,
  slurpRelationshipLine,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";
import { slurpCoupleBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-couple-beats.ts";
import {
  slurpAdvanceBonds,
  slurpSyncExBonds,
  type SlurpBond,
  type SlurpBondsInput,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-bonds.ts";
import {
  slurpPairKey,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import {
  slurpPreviewTieLever,
  slurpUndoTie,
  type SlurpStirTieWorld,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-stir-tie-preview.ts";
import { SLURP_NO_TIES } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

const creator = (id: string, over: Partial<SlurpTieCreator> = {}): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1) + " Vale",
  text: "Likes bouldering.",
  tags: ["fitness"],
  automatic: true,
  followers: 1000,
  gender: null,
  cardPartners: [],
  cardPeople: [],
  ...over,
});
const mira = creator("mira", { gender: "female" });
const kai = creator("kai", { gender: "male" });
const noCreators: readonly SlurpTieCreator[] = [mira, kai];

const together = (id = "c1"): SlurpCouple =>
  newSlurpCouple(id, "mira", "kai", "player", new Date(T0).toISOString(), "together");
const brokeUp = (at = T0 + 10 * DAY, id = "c1"): SlurpCouple => slurpBreakUp(together(id), new Date(at));

// ─── 1. readSlurpCouples: aftermath only normalizes on an existing ex ────────────────────────────
{
  const splitRaw = { ...brokeUp(), aftermath: "forget" };
  const [split] = readSlurpCouples([splitRaw]);
  assert.equal(split!.aftermath, "forget", "a valid aftermath on a split couple reads back");

  const liveRaw = { ...together(), aftermath: "moveOn" };
  const [live] = readSlurpCouples([liveRaw]);
  assert.equal(live!.aftermath, undefined, "an aftermath on a couple that is not split is dropped");

  const junkRaw = { ...brokeUp(), aftermath: "nonsense" };
  const [junk] = readSlurpCouples([junkRaw]);
  assert.equal(junk!.aftermath, undefined, "an unknown aftermath value is dropped, not guessed");

  const keepRaw = { ...brokeUp(), aftermath: "keep" };
  const [kept] = readSlurpCouples([keepRaw]);
  assert.equal(kept!.aftermath, undefined, '"keep" is never stored: absent means keep');
}

// ─── 2. slurpSteerCouple: the trust boundary, the default, and stageAt stability ─────────────────
{
  const input = { at: new Date(T0 + 10 * DAY), creators: noCreators };

  // Default unchanged: breakUp without an aftermath behaves exactly as before.
  const plain = slurpSteerCouple([together()], "c1", "breakUp", input);
  assert.ok(Array.isArray(plain));
  assert.equal((plain as SlurpCouple[])[0]!.aftermath, undefined, "no aftermath sent, none stored");

  // Explicit "keep" on a breakup is a no-op (never stored).
  const kept = slurpSteerCouple([together()], "c1", "breakUp", { ...input, aftermath: "keep" });
  assert.equal((kept as SlurpCouple[])[0]!.aftermath, undefined, '"keep" on breakUp still stores nothing');

  // An aftermath on anything but breakUp is refused outright, even "keep" (the trust boundary).
  assert.equal(slurpSteerCouple([together()], "c1", "date", { ...input, aftermath: "moveOn" }), "notOpen");
  assert.equal(slurpSteerCouple([together()], "c1", "date", { ...input, aftermath: "keep" }), "notOpen");

  // moveOn / forget only ever apply to an existing ex (stage "split"); on a live couple, refused.
  assert.equal(slurpSteerCouple([together()], "c1", "moveOn", input), "notOpen");

  // breakUp + aftermath sets it in the same step.
  const brokenMovedOn = slurpSteerCouple([together()], "c1", "breakUp", { ...input, aftermath: "moveOn" });
  const movedOnCouple = (brokenMovedOn as SlurpCouple[])[0]!;
  assert.equal(movedOnCouple.aftermath, "moveOn");

  // Switching an existing ex's choice never touches stageAt ("you broke up N days ago" stays true).
  const stageAt = movedOnCouple.stageAt;
  const switched = slurpSteerCouple([movedOnCouple], "c1", "forget", { ...input, at: new Date(T0 + 40 * DAY) });
  const forgotten = (switched as SlurpCouple[])[0]!;
  assert.equal(forgotten.aftermath, "forget");
  assert.equal(forgotten.stageAt, stageAt, "moveOn -> forget does not move stageAt");

  // A manual reunite clears whatever choice was on record.
  const a = creator("mira", { gender: "female" });
  const b = creator("kai", { gender: "male" });
  const reunited = slurpGetBackTogether(forgotten, new Date(T0 + 41 * DAY));
  assert.equal(reunited.aftermath, undefined, "getting back together clears a chosen aftermath");
  void a;
  void b;
}

// ─── 3. slurpAdvanceCouples: no automatic reunion, no movingOn moment, with a chosen aftermath ───
{
  const base: SlurpCouplesInput = {
    creators: noCreators,
    activity: 1,
    storylines: [],
    rivals: new Set(),
    collabbedWith: new Map(),
    newId: () => "new",
  };
  // Kept under the world's own REST_DAYS (60): past that, two free Creators may spontaneously start
  // a brand new flirt by pure chance regardless of any choice (an existing, unrelated world rule).
  // This window isolates the aftermath guard on the couple's *own* split-stage clock from that rule.
  const DAYS = 55;
  let couples: SlurpCouple[] = [{ ...brokeUp(T0), aftermath: "forget" }];
  for (let day = 1; day <= DAYS; day++)
    couples = slurpAdvanceCouples(couples, { ...base, at: new Date(T0 + day * DAY) });
  const own = couples.find((couple) => couple.id === "c1")!;
  assert.equal(own.stage, "split", "no automatic reunion while an aftermath is set");
  assert.equal(own.reunions, 0);
  assert.ok(
    !own.moments.some((moment) => moment.kind === "movingOn"),
    "a forgotten (or moved-on) ex never gets the automatic moving-on post",
  );

  let movedOn: SlurpCouple[] = [{ ...brokeUp(T0), aftermath: "moveOn" }];
  for (let day = 1; day <= DAYS; day++)
    movedOn = slurpAdvanceCouples(movedOn, { ...base, at: new Date(T0 + day * DAY) });
  const ownMovedOn = movedOn.find((couple) => couple.id === "c1")!;
  assert.equal(ownMovedOn.stage, "split");
  assert.equal(ownMovedOn.reunions, 0, "moveOn also blocks the clock's own reunion");
  assert.ok(!ownMovedOn.moments.some((moment) => moment.kind === "movingOn"));

  // Without a choice, the ordinary clock may still reunite or post moving on over the same window
  // (this is the control: it proves the guard above is about the aftermath, not a broken clock).
  let plain: SlurpCouple[] = [brokeUp(T0)];
  for (let day = 1; day <= DAYS; day++) plain = slurpAdvanceCouples(plain, { ...base, at: new Date(T0 + day * DAY) });
  const ownPlain = plain.find((couple) => couple.id === "c1")!;
  assert.ok(
    ownPlain.stage !== "split" || ownPlain.moments.some((moment) => moment.kind === "movingOn"),
    "control: an ordinary ex does get a moving-on post or a reunion somewhere across 55 days",
  );
}

// ─── 4. slurpCoupleBeat: forgetting drops the couple from the beat entirely ──────────────────────
{
  const names = new Map([
    ["mira", "Mira Vale"],
    ["kai", "Kai Vale"],
  ]);
  const forgotten: SlurpCouple = {
    ...brokeUp(T0, "c1"),
    aftermath: "forget",
    moments: [{ id: "breakup:1:0", kind: "breakup", at: new Date(T0).toISOString(), detail: "" }],
  };
  for (let sequence = 0; sequence < 10; sequence++)
    assert.equal(
      slurpCoupleBeat({ creatorId: "mira", sequence, couples: [forgotten], names, at: new Date(T0 + 1 * DAY) }),
      null,
      "a forgotten couple never supplies a beat, even with an untold breakup moment",
    );

  // moveOn: a breakup moment that is already queued from before the choice never gets told either.
  const movedOn: SlurpCouple = { ...forgotten, aftermath: "moveOn" };
  for (let sequence = 0; sequence < 10; sequence++) {
    const beat = slurpCoupleBeat({
      creatorId: "mira",
      sequence,
      couples: [movedOn],
      names,
      at: new Date(T0 + 1 * DAY),
    });
    assert.ok(!beat || beat.tie.moment !== "breakup", "moveOn filters a pending breakup moment out of the beat");
  }
}

// ─── 5. Relationship lines: ambient, direct, player, group, chat bridge ──────────────────────────
{
  const names = new Map([
    ["kai", "Kai Vale"],
    ["mira", "Mira Vale"],
  ]);
  const at = new Date(T0 + 10 * DAY);

  // Ambient (ex not addressed directly): forget never surfaces at all; moveOn is quieter than keep.
  const kept = [brokeUp(T0)];
  const keptLine = slurpRelationshipLine(kept, "mira", names, { at });
  assert.match(keptLine, /is your ex/u);
  assert.match(keptLine, /fans may ask/u);

  const forgot = [{ ...brokeUp(T0), aftermath: "forget" as const }];
  assert.equal(
    slurpRelationshipLine(forgot, "mira", names, { at }),
    "",
    "ambient: a forgotten ex never surfaces unasked",
  );

  const movedOnAmbient = [{ ...brokeUp(T0), aftermath: "moveOn" as const }];
  const movedOnLine = slurpRelationshipLine(movedOnAmbient, "mira", names, { at });
  assert.match(movedOnLine, /moved on/u);
  assert.ok(!/fans may ask/u.test(movedOnLine), "moveOn drops the ongoing-drama wording");

  // Direct chat with the ex (withId): forget still speaks, with an explicit override, not silence.
  const forgetDirect = slurpRelationshipLine(forgot, "mira", names, { at, withId: "kai" });
  assert.match(forgetDirect, /no memory of a romantic relationship/u);
  assert.match(forgetDirect, /historical records only/u);
  assert.ok(!/moved on/u.test(forgetDirect), "forget reads differently from moveOn: no memory, not just calm about it");

  const moveOnDirect = slurpRelationshipLine(movedOnAmbient, "mira", names, { at, withId: "kai" });
  assert.match(moveOnDirect, /is your ex/u);
  assert.match(moveOnDirect, /moved on/u);

  // Fizzled (sparks that never got anywhere) + forget: forget still wins over the fizzle line.
  const fizzledForget: SlurpCouple = {
    ...newSlurpCouple("c2", "mira", "kai", "player", new Date(T0).toISOString(), "sparks"),
    stage: "split",
    ending: "fizzled",
    stageAt: new Date(T0 + 1 * DAY).toISOString(),
    aftermath: "forget",
  };
  const fizzledLine = slurpRelationshipLine([fizzledForget], "mira", names, { at, withId: "kai" });
  assert.match(
    fizzledLine,
    /no memory of a romantic relationship/u,
    "forget overrides even a fizzled flirt's own line",
  );

  // The player's own ex (playerIds): same three outcomes, in the player-facing voice.
  const playerIds = new Set(["kai"]);
  const words = new Map([["kai", "boyfriend"]]);
  const playerKeep = slurpRelationshipLine(kept, "mira", names, { at, withId: "kai", playerIds, words });
  assert.match(playerKeep, /is your ex/u);
  const playerForget = slurpRelationshipLine(forgot, "mira", names, { at, withId: "kai", playerIds, words });
  assert.match(playerForget, /no memory of a romantic relationship/u);
  const playerMoveOn = slurpRelationshipLine(movedOnAmbient, "mira", names, { at, withId: "kai", playerIds, words });
  assert.match(playerMoveOn, /moved on/u);

  // A poly group split: the plural wording, with the same three outcomes.
  const ren = creator("ren");
  void ren;
  const groupNames = new Map([
    ["kai", "Kai Vale"],
    ["ren", "Ren Vale"],
  ]);
  const group: SlurpCouple = {
    ...newSlurpCouple("c3", "mira", "kai", "player", new Date(T0).toISOString(), "together"),
    moreIds: ["ren"],
    stage: "split",
    ending: "breakup",
    stageAt: new Date(T0 + 5 * DAY).toISOString(),
    aftermath: "forget",
  };
  const groupLine = slurpRelationshipLine([group], "mira", groupNames, { at, withId: "kai" });
  assert.match(groupLine, /no memory of a romantic relationship/u);

  // The chat bridge (an ordinary Engine chat with the character): forget overrides regardless of
  // how the old transcript reads; moveOn still names the breakup, just without dwelling on it.
  const bridgeKeep = slurpChatBridgeCoupleLine(brokeUp(T0), { her: "Kai", herGender: "male", you: "Sam", at });
  assert.match(bridgeKeep, /broke up on Slurp/u);
  const bridgeForget = slurpChatBridgeCoupleLine(
    { ...brokeUp(T0), aftermath: "forget" },
    { her: "Kai", herGender: "male", you: "Sam", at },
  );
  assert.match(bridgeForget, /no memory of a romantic relationship/u);
  // Forget overrides even long after the ordinary 30-day window would have gone quiet on its own.
  const bridgeForgetOld = slurpChatBridgeCoupleLine(
    { ...brokeUp(T0), aftermath: "forget" },
    { her: "Kai", herGender: "male", you: "Sam", at: new Date(T0 + 400 * DAY) },
  );
  assert.match(bridgeForgetOld, /no memory of a romantic relationship/u);
  const bridgeMoveOn = slurpChatBridgeCoupleLine(
    { ...brokeUp(T0), aftermath: "moveOn" },
    { her: "Kai", herGender: "male", you: "Sam", at },
  );
  assert.match(bridgeMoveOn, /broke up on Slurp/u);
  assert.match(bridgeMoveOn, /moved on/u);
}

// ─── 6. Preview detail + Undo (pure, no DB) ───────────────────────────────────────────────────────
{
  const at = new Date(T0 + 10 * DAY);
  const world: SlurpStirTieWorld = {
    creators: noCreators,
    avatars: new Map(),
    ties: SLURP_NO_TIES,
    couples: [together()],
  };
  const preview = slurpPreviewTieLever(
    world,
    "steer-couple",
    { coupleId: "c1", steer: "breakUp", aftermath: "forget" },
    at,
  );
  assert.deepEqual(preview.detail, { steer: "breakUp", aftermath: "forget" });

  const splitWorld: SlurpStirTieWorld = { ...world, couples: [{ ...brokeUp(T0, "c1"), aftermath: "moveOn" }] };
  const switchPreview = slurpPreviewTieLever(splitWorld, "steer-couple", { coupleId: "c1", steer: "forget" }, at);
  assert.deepEqual(
    switchPreview.detail,
    { steer: "forget" },
    "a direct moveOn/forget steer carries no detail.aftermath of its own",
  );

  // Undo restores the couple's previous aftermath (not "revived" and not left forgotten).
  const before: SlurpCouple = { ...brokeUp(T0, "c1"), aftermath: "moveOn" };
  const after: SlurpCouple = { ...before, aftermath: "forget" };
  const restored = slurpUndoTie(
    { ties: SLURP_NO_TIES, couples: [after] },
    { kind: "restoreCouple", couple: before },
    at,
  );
  assert.equal(restored!.couples[0]!.aftermath, "moveOn", "undo puts the prior choice back, not the one just undone");
}

// ─── 7. Bonds: the ex bond follows the couple's choice, immediately and consistently ─────────────
{
  const bondsBase: SlurpBondsInput = {
    creators: noCreators,
    couples: [],
    activity: 1,
    rivals: new Set(),
    collabbedWith: new Map(),
    newId: () => "newbond",
  };

  // First tick, breakUp + forget, no ex bond yet: the card naming "my ex" never gets to seed one.
  const miraWithCard = creator("mira", { gender: "female", cardPeople: [{ name: "Kai Vale", relation: "my ex" }] });
  const kaiWithCard = creator("kai", { gender: "male", cardPeople: [{ name: "Mira Vale", relation: "my ex" }] });
  const freshForget: SlurpCouple = { ...brokeUp(T0, "c1"), aftermath: "forget" };
  const firstTick = slurpAdvanceBonds([], {
    ...bondsBase,
    creators: [miraWithCard, kaiWithCard],
    couples: [freshForget],
    at: new Date(T0 + 1 * DAY),
  });
  assert.ok(
    !firstTick.some((bond) => bond.kind === "ex" && bond.endedAt === null),
    'a card\'s own "ex" line never seeds a fresh bond for a pair forgetting on the very same tick',
  );

  // An existing active ex bond ends the moment the couple is marked forget, via the same tick.
  const existingEx: SlurpBond = {
    id: "ex1",
    kind: "ex",
    aId: "kai",
    bId: "mira",
    level: 1,
    temperature: "cold",
    origin: "couple",
    since: new Date(T0).toISOString(),
    changedAt: new Date(T0).toISOString(),
    endedAt: null,
    ending: null,
    notes: [{ at: new Date(T0).toISOString(), code: "breakup" }],
  };
  const afterForget = slurpAdvanceBonds([existingEx], {
    ...bondsBase,
    couples: [freshForget],
    at: new Date(T0 + 1 * DAY),
  });
  const forgottenBond = afterForget.find((bond) => bond.id === "ex1")!;
  assert.notEqual(forgottenBond.endedAt, null, "forgetting ends the existing ex bond");
  assert.equal(forgottenBond.notes.at(-1)!.code, "forget");

  // Switching back off forget (moveOn) reopens the very bond forgetting ended, rather than leaving
  // it gone or creating a second one.
  const movedOnCouple: SlurpCouple = { ...freshForget, aftermath: "moveOn" };
  const afterMoveOn = slurpAdvanceBonds(afterForget, {
    ...bondsBase,
    couples: [movedOnCouple],
    at: new Date(T0 + 2 * DAY),
  });
  const exBonds = afterMoveOn.filter(
    (bond) => bond.kind === "ex" && slurpPairKey(bond.aId, bond.bId) === slurpPairKey("mira", "kai"),
  );
  assert.equal(exBonds.length, 1, "reopening never duplicates the bond");
  assert.equal(exBonds[0]!.id, "ex1");
  assert.equal(exBonds[0]!.endedAt, null, "moveOn reopens the bond forgetting had ended");

  // Group (poly) split: forgetting covers every member pair, not only the couple's own aId/bId, so a
  // card naming a non-primary member as an "ex" is suppressed too, on the first tick.
  const ren = creator("ren", { cardPeople: [{ name: "Mira Vale", relation: "my ex" }] });
  const miraForRen = creator("mira", { gender: "female", cardPeople: [{ name: "Ren Vale", relation: "my ex" }] });
  const groupSplit: SlurpCouple = {
    ...newSlurpCouple("g1", "mira", "kai", "player", new Date(T0).toISOString(), "together"),
    moreIds: ["ren"],
    stage: "split",
    ending: "breakup",
    stageAt: new Date(T0 + 5 * DAY).toISOString(),
    aftermath: "forget",
  };
  const groupTick = slurpAdvanceBonds([], {
    ...bondsBase,
    creators: [miraForRen, kai, ren],
    couples: [groupSplit],
    at: new Date(T0 + 6 * DAY),
  });
  assert.ok(
    !groupTick.some(
      (bond) =>
        bond.kind === "ex" && slurpPairKey(bond.aId, bond.bId) === slurpPairKey("mira", "ren") && bond.endedAt === null,
    ),
    "a forgotten poly split suppresses card-ex seeding for every member pair, not only aId/bId",
  );

  // slurpSyncExBonds directly: idempotent, and only ever touches "ex" bonds for a split pair.
  const synced = slurpSyncExBonds([existingEx], [freshForget], new Date(T0 + 1 * DAY));
  assert.notEqual(synced[0]!.endedAt, null);
  const syncedAgain = slurpSyncExBonds(synced, [freshForget], new Date(T0 + 1 * DAY));
  assert.deepEqual(syncedAgain, synced, "syncing an already-synced state changes nothing");
}

// ─── 8. A full cycle: forget → reunite → a new breakup kept plain, exactly one active ex bond ────
{
  const bondsBase: SlurpBondsInput = {
    creators: noCreators,
    couples: [],
    activity: 1,
    rivals: new Set(),
    collabbedWith: new Map(),
    newId: () => "newbond",
  };
  const existingEx: SlurpBond = {
    id: "ex1",
    kind: "ex",
    aId: "kai",
    bId: "mira",
    level: 1,
    temperature: "cold",
    origin: "couple",
    since: new Date(T0).toISOString(),
    changedAt: new Date(T0).toISOString(),
    endedAt: null,
    ending: null,
    notes: [{ at: new Date(T0).toISOString(), code: "breakup" }],
  };
  const forgotten: SlurpCouple = { ...brokeUp(T0, "c1"), aftermath: "forget" };
  // Tick 1: forgetting ends the bond.
  const afterForget = slurpAdvanceBonds([existingEx], {
    ...bondsBase,
    couples: [forgotten],
    at: new Date(T0 + 1 * DAY),
  });

  // Reunite (manual, via Stir): the same couple id, dating again, aftermath cleared.
  const reunited = slurpGetBackTogether(forgotten, new Date(T0 + 5 * DAY));
  const afterReunite = slurpAdvanceBonds(afterForget, {
    ...bondsBase,
    couples: [reunited],
    at: new Date(T0 + 6 * DAY),
  });
  assert.ok(
    afterReunite.find((bond) => bond.id === "ex1")!.endedAt !== null,
    "reuniting closes the old ex bond for good, not reopened by a later forget check",
  );

  // A brand new breakup, kept plain (no aftermath): a fresh ex bond, not a revival of the old one.
  const rebrokenKeep = slurpSteerCouple([reunited], "c1", "breakUp", {
    at: new Date(T0 + 10 * DAY),
    creators: noCreators,
  });
  const keptCouple = (rebrokenKeep as SlurpCouple[])[0]!;
  assert.equal(keptCouple.aftermath, undefined, "the new breakup carries no aftermath of its own");
  const afterRebreak = slurpAdvanceBonds(afterReunite, {
    ...bondsBase,
    couples: [keptCouple],
    at: new Date(T0 + 11 * DAY),
  });
  const activeExes = afterRebreak.filter(
    (bond) =>
      bond.kind === "ex" && slurpPairKey(bond.aId, bond.bId) === slurpPairKey("mira", "kai") && bond.endedAt === null,
  );
  assert.equal(activeExes.length, 1, "exactly one active ex bond after forget -> reunite -> a new, plain breakup");
  assert.equal(
    activeExes[0]!.since,
    keptCouple.stageAt,
    "the active bond belongs to the new breakup, not a resurrected old record",
  );

  // Order independence: syncing sees the same couple state whichever order the bonds array holds
  // the old (ended) and new (active) records in.
  const mixed = afterRebreak;
  const reversed = [...afterRebreak].reverse();
  const at2 = new Date(T0 + 20 * DAY);
  assert.deepEqual(
    slurpSyncExBonds(mixed, [keptCouple], at2),
    slurpSyncExBonds(reversed, [keptCouple], at2).slice().reverse(),
    "syncing does not depend on the bonds array's order",
  );

  // And the DM line for this (now plain, kept) ex reads the ordinary way again, not forget/moveOn.
  const names = new Map([["kai", "Kai Vale"]]);
  const line = slurpRelationshipLine([keptCouple], "mira", names, { at: new Date(T0 + 11 * DAY), withId: "kai" });
  assert.match(line, /is your ex/u);
  assert.ok(!/no memory of a romantic relationship/u.test(line) && !/moved on/u.test(line));
}

// ─── 9. A poly group's forgotten split, chatting directly with the non-primary member ───────────
{
  const names = new Map([
    ["kai", "Kai Vale"],
    ["ren", "Ren Vale"],
  ]);
  const group: SlurpCouple = {
    ...newSlurpCouple("g2", "mira", "kai", "player", new Date(T0).toISOString(), "together"),
    moreIds: ["ren"],
    stage: "split",
    ending: "breakup",
    stageAt: new Date(T0 + 5 * DAY).toISOString(),
    aftermath: "forget",
  };
  const at = new Date(T0 + 10 * DAY);
  // Direct chat with the non-primary member (moreIds), not the couple's own aId/bId: forgetting
  // still reaches them, not only whoever happens to be `aId`/`bId` on the record.
  const line = slurpRelationshipLine([group], "mira", names, { at, withId: "ren" });
  assert.match(line, /no memory of a romantic relationship/u);
}

// ─── 10. Two couple records for the same pair: the newest one wins, never an older "keep" leak ───
{
  const names = new Map([["kai", "Kai Vale"]]);
  const at = new Date(T0 + 25 * DAY);
  const oldKeep: SlurpCouple = {
    ...newSlurpCouple("old1", "mira", "kai", "player", new Date(T0).toISOString(), "together"),
    stage: "split",
    ending: "breakup",
    stageAt: new Date(T0 + 5 * DAY).toISOString(),
  };
  const newForget: SlurpCouple = {
    ...newSlurpCouple("new1", "mira", "kai", "player", new Date(T0 + 15 * DAY).toISOString(), "together"),
    stage: "split",
    ending: "breakup",
    stageAt: new Date(T0 + 20 * DAY).toISOString(),
    aftermath: "forget",
  };
  for (const pair of [
    [oldKeep, newForget],
    [newForget, oldKeep],
  ]) {
    const clock: SlurpCouplesInput = {
      creators: noCreators,
      activity: 1,
      storylines: [],
      rivals: new Set(),
      collabbedWith: new Map(),
      newId: () => "stale-reunion",
    };
    for (let day = 21; day <= 55; day++) {
      const advanced = slurpAdvanceCouples(pair, { ...clock, at: new Date(T0 + day * DAY) });
      assert.deepEqual(
        advanced.find((couple) => couple.id === oldKeep.id),
        oldKeep,
        "a superseded breakup stays historical: no automatic reunion or moving-on moment",
      );
    }
    const pending = {
      ...oldKeep,
      moments: [{ id: "old-breakup", kind: "breakup" as const, at: at.toISOString(), detail: "" }],
    };
    assert.equal(
      slurpCoupleBeat({
        creatorId: "mira",
        sequence: 0,
        couples: pair.map((couple) => (couple === oldKeep ? pending : couple)),
        names,
        at,
      }),
      null,
      "the older untold breakup cannot supply a post after the newest record was forgotten",
    );
    assert.equal(
      slurpRelationshipLine(pair, "mira", names, { at }),
      "",
      'the newest record for this pair is forgotten, so it never falls back to an older "keep" one, in either array order',
    );
    for (const newest of [newForget, { ...newForget, stage: "together" as const, aftermath: undefined }]) {
      const next = slurpAdvanceBonds([], {
        creators: noCreators,
        couples: pair.map((entry) => (entry === newForget ? newest : entry)),
        at,
        activity: 1,
        rivals: new Set(),
        collabbedWith: new Map(),
        newId: () => "stale-ex",
      });
      assert.equal(
        next.filter((bond) => bond.kind === "ex" && bond.endedAt === null).length,
        0,
        "a paused-clock older keep breakup never seeds an ex bond after the newest record forgot or reunited",
      );
    }
  }
}

// ─── 11. An old forgotten record and a newer active one, for the same pair, in both orders: the
// active record wins for the DM line, and a fresh breakup afterwards is not haunted by the old one.
{
  const oldForgot: SlurpCouple = {
    ...newSlurpCouple("old2", "mira", "kai", "player", new Date(T0).toISOString(), "together"),
    stage: "split",
    ending: "breakup",
    stageAt: new Date(T0 + 5 * DAY).toISOString(),
    aftermath: "forget",
  };
  const newActive: SlurpCouple = {
    ...newSlurpCouple("new2", "mira", "kai", "player", new Date(T0 + 20 * DAY).toISOString(), "together"),
  };
  const names = new Map([["kai", "Kai Vale"]]);
  const dmAt = new Date(T0 + 21 * DAY);
  for (const pair of [
    [oldForgot, newActive],
    [newActive, oldForgot],
  ]) {
    assert.equal(
      slurpCoupleOf(pair, "mira", "kai"),
      newActive,
      "the active record is the current one, regardless of order",
    );
    const line = slurpRelationshipLine(pair, "mira", names, { at: dmAt, withId: "kai" });
    assert.match(line, /is your partner/u, "the DM line reads the active couple, not the older forgotten one");
    assert.ok(!/no memory of a romantic relationship/u.test(line));
  }

  // The old bond, ended by forgetting long ago, must not be revived nor stop a brand new ex bond
  // for the couple that is active (and then breaks up plainly) today — in either array order.
  const oldBond: SlurpBond = {
    id: "oldex",
    kind: "ex",
    aId: "kai",
    bId: "mira",
    level: 1,
    temperature: "cold",
    origin: "couple",
    since: new Date(T0 + 5 * DAY).toISOString(),
    changedAt: new Date(T0 + 5 * DAY).toISOString(),
    endedAt: new Date(T0 + 5 * DAY).toISOString(),
    ending: "player",
    notes: [{ at: new Date(T0 + 5 * DAY).toISOString(), code: "forget" }],
  };
  const bondsBase: SlurpBondsInput = {
    creators: noCreators,
    couples: [],
    activity: 1,
    rivals: new Set(),
    collabbedWith: new Map(),
    newId: () => "newerex",
  };
  const freshBreakup = (couple: SlurpCouple) =>
    slurpSteerCouple([couple], couple.id, "breakUp", { at: new Date(T0 + 30 * DAY), creators: noCreators });

  for (const order of [
    [oldForgot, newActive],
    [newActive, oldForgot],
  ]) {
    const broken = freshBreakup(newActive);
    assert.ok(Array.isArray(broken));
    const brokenCouple = (broken as SlurpCouple[])[0]!;
    assert.equal(brokenCouple.aftermath, undefined, "a plain, kept breakup carries no aftermath");
    const couplesNow = order.map((entry) => (entry.id === newActive.id ? brokenCouple : entry));
    const after = slurpAdvanceBonds([oldBond], {
      ...bondsBase,
      couples: couplesNow,
      at: new Date(T0 + 31 * DAY),
    });
    const active = after.filter((bond) => bond.kind === "ex" && bond.endedAt === null);
    assert.equal(active.length, 1, "exactly one active ex bond after a fresh breakup, in either array order");
    assert.notEqual(active[0]!.id, "oldex", "the old, forgotten-and-ended bond is not the one revived");
    const oldStillGone = after.find((bond) => bond.id === "oldex")!;
    assert.notEqual(oldStillGone.endedAt, null, "the old bond stays exactly as ended as it was");
  }
}

console.log("slurp2 breakup aftermath (backend) regression: ok");
