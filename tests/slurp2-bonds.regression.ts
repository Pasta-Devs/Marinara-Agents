/**
 * Drama phase 2 (`docs/DRAMA.md`): bonds — friends, roommates, coworkers and exes between Creators.
 * Cards seed them once, breakups leave exes, rivalries make them tense, friends grow and drift within
 * caps, the player's bonds are locked, and a 90-day world with Creators joining and leaving keeps
 * every rule. Old data reads back safely, and every ties write keeps the bonds.
 */
import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import {
  readSlurpBonds,
  slurpAdvanceBonds,
  slurpBondActive,
  slurpBondFromRelation,
  slurpBondsFor,
  slurpEndBond,
  slurpSetBond,
  SLURP_BOND_MAX_LEVEL,
  SLURP_MAX_BEST_FRIENDS,
  SLURP_MAX_FRIENDS,
  type SlurpBond,
  type SlurpBondsInput,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-bonds.ts";
import {
  slurpPairKey,
  type SlurpTieCreator,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import {
  newSlurpCouple,
  slurpBreakUp,
  type SlurpCouple,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import {
  slpBusiestCreator,
  slpEgoTies,
  slpPeopleEdges,
  slpPeopleGraph,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/projects/slp-people-map.ts";
import {
  slurpBondBeat,
  SLURP_BOND_BEAT_PERCENT,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-bond-beats.ts";
import { slpPagePeople } from "../packages/slurp2/src/engine/packages/client/src/slp/modules/creator/slp-creator-page-data.ts";
import {
  SLP_FORCE_COOLING,
  slpForceBox,
  slpForceSeed,
  slpForceStep,
  type SlpForceNode,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/creator/slp-force-layout.ts";

const DAY = 86_400_000;
const T0 = new Date("2026-10-01T00:00:00.000Z");
const at = (days: number) => new Date(T0.getTime() + days * DAY);

const creator = (
  id: string,
  tags: string[],
  cardPeople: { name: string; relation: string }[] = [],
  automatic = true,
): SlurpTieCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  text: "",
  tags,
  automatic,
  followers: 1000,
  cardPeople,
});

let counter = 0;
const newId = () => `id-${++counter}`;
const input = (overrides: Partial<SlurpBondsInput>): SlurpBondsInput => ({
  creators: [],
  couples: [],
  at: T0,
  activity: 1,
  rivals: new Set(),
  collabbedWith: new Map(),
  newId,
  ...overrides,
});
const pairOf = (bonds: readonly SlurpBond[], a: string, b: string) =>
  bonds.filter((bond) => slurpPairKey(bond.aId, bond.bId) === slurpPairKey(a, b));

async function main() {
  // Card relations → bond kinds. A partner is a couple, not a bond; "girlfriend" is not "friend".
  assert.deepEqual(slurpBondFromRelation("best friend")?.kind, "friend");
  assert.equal(slurpBondFromRelation("best friend")?.level, SLURP_BOND_MAX_LEVEL);
  assert.equal(slurpBondFromRelation("childhood friend")?.level, 1);
  assert.equal(slurpBondFromRelation("roommate")?.kind, "roommate");
  assert.equal(slurpBondFromRelation("coworker at the bar")?.kind, "coworker");
  assert.equal(slurpBondFromRelation("ex-girlfriend")?.kind, "ex");
  assert.equal(slurpBondFromRelation("girlfriend"), null);
  // R3: family is a bond of its own, never romance; a "mom friend" or a "family friend" is a friend.
  assert.equal(slurpBondFromRelation("sister")?.kind, "family");
  assert.equal(slurpBondFromRelation("her daughter")?.kind, "family");
  assert.equal(slurpBondFromRelation("stepmom")?.kind, "family");
  assert.equal(slurpBondFromRelation("ex-wife's son")?.kind, "family");
  assert.equal(slurpBondFromRelation("mom friend")?.kind, "friend");
  assert.equal(slurpBondFromRelation("family friend")?.kind, "friend");
  assert.equal(slurpBondFromRelation("personal trainer"), null, 'not "son"');
  {
    const couple = newSlurpCouple("c", "mum", "kid", "world", T0.toISOString());
    assert.equal(
      slurpSetBond([], { aId: "mum", bId: "kid", kind: "family", couples: [couple] }, { at: T0, id: "f" }),
      "couple",
      "a couple cannot be made family; end the couple first",
    );
    const set = slurpSetBond([], { aId: "mum", bId: "kid", kind: "family" }, { at: T0, id: "f" });
    assert.ok(Array.isArray(set) && set[0]!.kind === "family" && set[0]!.locked);
    const people = slpPagePeople("mum", {
      creators: [
        { id: "mum", name: "Mum", avatarUrl: null },
        { id: "kid", name: "Kid", avatarUrl: null },
      ],
      couples: [],
      collabs: [],
      rivalries: [],
      bonds: [{ aId: "mum", bId: "kid", kind: "family", level: 1, endedAt: null }],
    });
    assert.deepEqual(
      people.map((person) => person.relation),
      ["family"],
    );
  }

  // Cards seed once; persona text never seeds; a name must mean exactly one Creator.
  {
    const lena = creator(
      "lena",
      ["cosplay"],
      [
        { name: "Nora", relation: "best friend" },
        { name: "Mia", relation: "roommate" },
        { name: "Somebody", relation: "friend" },
      ],
    );
    const nora = creator("nora", ["gaming"]);
    const mia = creator("mia", ["fitness"]);
    const me = creator("me", [], [{ name: "Lena", relation: "coworker" }], false);
    let bonds = slurpAdvanceBonds([], input({ creators: [lena, nora, mia, me], activity: 0 }));
    assert.equal(bonds.length, 2);
    assert.equal(pairOf(bonds, "lena", "nora")[0]?.level, SLURP_BOND_MAX_LEVEL);
    assert.equal(pairOf(bonds, "lena", "nora")[0]?.notes[0]?.code, "card");
    assert.equal(pairOf(bonds, "lena", "mia")[0]?.kind, "roommate");
    assert.equal(pairOf(bonds, "lena", "me").length, 0, "a persona's card never makes a bond by itself");
    const ended = slurpEndBond(bonds, pairOf(bonds, "lena", "mia")[0]!.id, at(1));
    assert.ok(Array.isArray(ended));
    bonds = slurpAdvanceBonds(ended, input({ creators: [lena, nora, mia, me], at: at(2), activity: 0 }));
    assert.equal(pairOf(bonds, "lena", "mia").filter(slurpBondActive).length, 0, "an ended card bond stays ended");
  }

  // Exes: a breakup leaves one bond (cold); getting back together ends it; ending it never brings it back.
  {
    const a = creator("ana", []);
    const b = creator("ben", []);
    const couple = newSlurpCouple("c1", "ana", "ben", "world", T0.toISOString(), "together");
    const split = slurpBreakUp(couple, at(1));
    let bonds = slurpAdvanceBonds([], input({ creators: [a, b], couples: [split], at: at(1), activity: 0 }));
    const ex = pairOf(bonds, "ana", "ben")[0]!;
    assert.equal(ex.kind, "ex");
    assert.equal(ex.temperature, "cold");
    bonds = slurpAdvanceBonds(bonds, input({ creators: [a, b], couples: [split], at: at(2), activity: 0 }));
    assert.equal(pairOf(bonds, "ana", "ben").length, 1, "one ex bond per breakup");
    const back: SlurpCouple = { ...split, stage: "together", ending: null, stageAt: at(3).toISOString() };
    bonds = slurpAdvanceBonds(bonds, input({ creators: [a, b], couples: [back], at: at(3), activity: 0 }));
    assert.equal(pairOf(bonds, "ana", "ben")[0]?.ending, "together");
    const byPlayer = slurpEndBond(
      slurpAdvanceBonds([], input({ creators: [a, b], couples: [split], at: at(1), activity: 0 })),
      "id-" + counter,
      at(2),
    );
    assert.ok(Array.isArray(byPlayer));
    bonds = slurpAdvanceBonds(byPlayer, input({ creators: [a, b], couples: [split], at: at(3), activity: 0 }));
    assert.equal(pairOf(bonds, "ana", "ben").filter(slurpBondActive).length, 0, "the player ended it; it stays ended");
  }

  // Leaving ends every bond, locked ones too.
  {
    const set = slurpSetBond([], { aId: "ana", bId: "ben", kind: "friend", level: 2 }, { at: T0, id: "p1" });
    assert.ok(Array.isArray(set) && set[0]!.locked);
    const bonds = slurpAdvanceBonds(set as SlurpBond[], input({ creators: [creator("ana", [])], at: at(1) }));
    assert.equal(bonds[0]?.ending, "left");
  }

  // A rivalry makes a bond tense; it warms up again some days after the rivalry is over.
  {
    const a = creator("ana", ["art"]);
    const b = creator("ben", ["art"]);
    const start = slurpAdvanceBonds([], input({ creators: [a, b], activity: 0 }));
    const base: SlurpBond[] = [
      {
        ...readSlurpBonds([
          { id: "f1", aId: "ana", bId: "ben", since: T0.toISOString(), kind: "friend", level: 1 },
        ])[0]!,
      },
    ];
    assert.equal(start.length, 0);
    const rivals = new Set([slurpPairKey("ana", "ben")]);
    let bonds = slurpAdvanceBonds(base, input({ creators: [a, b], rivals, at: at(1), activity: 0 }));
    assert.equal(bonds[0]!.temperature, "tense");
    bonds = slurpAdvanceBonds(bonds, input({ creators: [a, b], at: at(3), activity: 0 }));
    assert.equal(bonds[0]!.temperature, "tense", "still sore two days later");
    bonds = slurpAdvanceBonds(bonds, input({ creators: [a, b], at: at(7), activity: 0 }));
    assert.equal(bonds[0]!.temperature, "warm");
  }

  // Meeting: a fresh collab wins over a shared niche; nothing new with activity 0; never with a persona.
  {
    const a = creator("ana", ["art"]);
    const b = creator("ben", ["art"]);
    const c = creator("cid", []);
    const me = creator("me", ["art"], [], false);
    const collabbedWith = new Map([
      ["ana", "cid"],
      ["cid", "ana"],
    ]);
    const quiet = slurpAdvanceBonds([], input({ creators: [a, b, c, me], collabbedWith, activity: 0 }));
    assert.equal(quiet.length, 0);
    let met: SlurpBond | undefined;
    for (let day = 0; day < 20 && !met; day += 0.25) {
      met = slurpAdvanceBonds([], input({ creators: [a, b, c, me], collabbedWith, at: at(day) }))[0];
    }
    assert.ok(met, "somebody meets within twenty days");
    assert.equal(slurpPairKey(met.aId, met.bId), slurpPairKey("ana", "cid"));
    assert.equal(met.notes[0]!.code, "collab");
    assert.equal(met.level, 0);
  }

  // The player: set creates a locked bond; the world never moves it; caps hold; ex refused while together.
  {
    let bonds: SlurpBond[] = [];
    for (let index = 0; index < SLURP_MAX_BEST_FRIENDS; index += 1) {
      const next = slurpSetBond(
        bonds,
        { aId: "hub", bId: `b${index}`, kind: "friend", level: 3 },
        { at: T0, id: `x${index}` },
      );
      assert.ok(Array.isArray(next));
      bonds = next;
    }
    assert.equal(
      slurpSetBond(bonds, { aId: "hub", bId: "extra", kind: "friend", level: 3 }, { at: T0, id: "x9" }),
      "full",
    );
    for (let index = SLURP_MAX_BEST_FRIENDS; index < SLURP_MAX_FRIENDS; index += 1) {
      const next = slurpSetBond(
        bonds,
        { aId: "hub", bId: `b${index}`, kind: "friend", level: 1 },
        { at: T0, id: `y${index}` },
      );
      assert.ok(Array.isArray(next));
      bonds = next;
    }
    assert.equal(
      slurpSetBond(bonds, { aId: "hub", bId: "one-more", kind: "friend", level: 1 }, { at: T0, id: "z" }),
      "full",
    );
    // CodeRabbit: going straight to close or best friend counts against the friend cap too.
    assert.equal(
      slurpSetBond(bonds, { aId: "hub", bId: "one-more", kind: "friend", level: 2 }, { at: T0, id: "z2" }),
      "full",
    );
    assert.ok(
      Array.isArray(slurpSetBond(bonds, { aId: "hub", bId: "one-more", kind: "roommate" }, { at: T0, id: "r" })),
    );
    assert.equal(slurpSetBond([], { aId: "a", bId: "a", kind: "friend" }, { at: T0, id: "s" }), "same");
    const together = newSlurpCouple("c", "a", "b", "world", T0.toISOString(), "together");
    assert.equal(
      slurpSetBond([], { aId: "a", bId: "b", kind: "ex", couples: [together] }, { at: T0, id: "e" }),
      "couple",
    );
    const locked = slurpSetBond(
      [],
      { aId: "ana", bId: "ben", kind: "friend", level: 2 },
      { at: T0, id: "l" },
    ) as SlurpBond[];
    const world = [creator("ana", []), creator("ben", [])];
    let moved = locked;
    for (let day = 1; day < 60; day += 0.25) moved = slurpAdvanceBonds(moved, input({ creators: world, at: at(day) }));
    assert.equal(moved.find((bond) => bond.id === "l")?.level, 2, "a locked bond never drifts");
    assert.equal(slurpEndBond(moved, "missing", at(61)), "unknown");
  }

  // An ended ex bond is never trimmed: it is how a breakup knows it already made its ex, so a bond the
  // player ended cannot come back after many other bonds end.
  {
    const ex = readSlurpBonds([
      {
        id: "ex",
        aId: "ana",
        bId: "ben",
        kind: "ex",
        since: at(1).toISOString(),
        endedAt: at(2).toISOString(),
        ending: "player",
      },
    ]);
    const noise = readSlurpBonds(
      Array.from({ length: 60 }, (_, index) => ({
        id: `n${index}`,
        aId: `x${index}`,
        bId: `y${index}`,
        since: T0.toISOString(),
        endedAt: at(3).toISOString(),
      })),
    );
    const couple = slurpBreakUp(newSlurpCouple("cb", "ana", "ben", "world", T0.toISOString(), "together"), at(1));
    const after = slurpAdvanceBonds(
      [...ex, ...noise],
      input({ creators: [creator("ana", []), creator("ben", [])], couples: [couple], at: at(4), activity: 0 }),
    );
    assert.ok(
      after.some((bond) => bond.id === "ex"),
      "the ended ex is kept",
    );
    assert.equal(
      after.filter((bond) => bond.kind === "ex" && slurpBondActive(bond)).length,
      0,
      "and it does not come back",
    );
  }

  // CodeRabbit: an ended card bond is never trimmed either, so a card cannot bring back a bond the player ended.
  {
    const card = readSlurpBonds([
      {
        id: "card",
        aId: "lena",
        bId: "mia",
        kind: "roommate",
        origin: "card",
        since: T0.toISOString(),
        endedAt: at(1).toISOString(),
        ending: "player",
      },
    ]);
    const noise = readSlurpBonds(
      Array.from({ length: 60 }, (_, index) => ({
        id: `m${index}`,
        aId: `p${index}`,
        bId: `q${index}`,
        since: T0.toISOString(),
        endedAt: at(2).toISOString(),
      })),
    );
    const lena = creator("lena", [], [{ name: "Mia", relation: "roommate" }]);
    const after = slurpAdvanceBonds(
      [...card, ...noise],
      input({ creators: [lena, creator("mia", [])], at: at(3), activity: 0 }),
    );
    assert.ok(after.some((bond) => bond.id === "card"));
    assert.equal(after.filter((bond) => bond.kind === "roommate" && slurpBondActive(bond)).length, 0);
  }

  // Old and broken data reads back safely.
  {
    const read = readSlurpBonds([
      null,
      { id: "a", aId: "x", bId: "x", since: T0.toISOString() },
      { id: "b", aId: "x", bId: "y", since: "not a date" },
      {
        id: "c",
        aId: "x",
        bId: "y",
        since: T0.toISOString(),
        kind: "nemesis",
        level: 99,
        temperature: "boiling",
        notes: [
          { at: T0.toISOString(), code: "closer" },
          { at: "bad", code: "closer" },
          { at: T0.toISOString(), code: "??" },
        ],
      },
    ]);
    assert.equal(read.length, 1);
    assert.equal(read[0]!.kind, "friend");
    assert.equal(read[0]!.level, SLURP_BOND_MAX_LEVEL);
    assert.equal(read[0]!.temperature, "warm");
    assert.equal(read[0]!.notes.length, 1);
    assert.deepEqual(readSlurpBonds(undefined), []);
  }

  // 90 days, 14 Creators joining and leaving at random: every rule holds, and the same seed gives the same world.
  {
    const run = () => {
      counter = 0;
      const pool = Array.from({ length: 14 }, (_, index) =>
        creator(
          `c${index}`,
          [["art", "fitness", "gaming"][index % 3]!],
          index === 0 ? [{ name: "C1", relation: "roommate" }] : [],
        ),
      );
      let bonds: SlurpBond[] = [];
      let couples: SlurpCouple[] = [newSlurpCouple("k", "c2", "c5", "world", T0.toISOString(), "together")];
      for (let step = 0; step < 90 * 4; step += 1) {
        const now = new Date(T0.getTime() + step * 6 * 60 * 60 * 1000);
        const live = pool.filter((_, index) => !((step + index * 37) % 97 < 9 && index > 1));
        if (step === 40) couples = [slurpBreakUp(couples[0]!, now)];
        const rivals = step > 100 && step < 140 ? new Set([slurpPairKey("c3", "c6")]) : new Set<string>();
        const collabbedWith = new Map(
          step % 20 < 3
            ? [
                ["c4", "c7"],
                ["c7", "c4"],
              ]
            : [],
        ) as Map<string, string>;
        bonds = slurpAdvanceBonds(bonds, input({ creators: live, couples, at: now, rivals, collabbedWith }));
        const ids = new Set(live.map((entry) => entry.id));
        const active = bonds.filter(slurpBondActive);
        for (const bond of active) assert.ok(ids.has(bond.aId) && ids.has(bond.bId), "no bond with somebody who left");
        const keys = active.map((bond) => `${bond.kind}:${slurpPairKey(bond.aId, bond.bId)}`);
        assert.equal(new Set(keys).size, keys.length, "one active bond per pair and kind");
        for (const entry of live) {
          const friends = slurpBondsFor(bonds, entry.id).filter((bond) => bond.kind === "friend" && bond.level >= 1);
          assert.ok(friends.length <= SLURP_MAX_FRIENDS);
          assert.ok(friends.filter((bond) => bond.level === SLURP_BOND_MAX_LEVEL).length <= SLURP_MAX_BEST_FRIENDS);
        }
        for (const bond of bonds)
          assert.ok(bond.notes.length >= 1 && bond.notes.length <= 8, "every bond explains itself");
      }
      return bonds;
    };
    const first = run();
    assert.ok(
      first.some((bond) => bond.kind === "friend"),
      "friendships form over 90 days",
    );
    assert.ok(
      first.some((bond) => bond.kind === "ex"),
      "the breakup left an ex",
    );
    assert.ok(
      first.some((bond) => bond.kind === "roommate"),
      "the card's roommate is there",
    );
    assert.deepEqual(run(), first, "same seed, same world");
  }

  // The People map: every tie as an edge, the strongest first; an old breakup without a bond still shows.
  {
    const bond = readSlurpBonds([
      { id: "b1", aId: "lena", bId: "nora", since: T0.toISOString(), kind: "friend", level: 3 },
      {
        id: "b2",
        aId: "lena",
        bId: "gone",
        since: T0.toISOString(),
        kind: "friend",
        level: 1,
        endedAt: T0.toISOString(),
      },
    ]);
    const together = newSlurpCouple("c1", "lena", "max", "world", T0.toISOString(), "together");
    const oldSplit = slurpBreakUp(newSlurpCouple("c2", "lena", "tom", "world", T0.toISOString(), "together"), at(1));
    const view = {
      creators: [],
      collabs: [
        {
          id: "k1",
          hostId: "lena",
          partnerId: "nora",
          idea: "a shoot",
          hostShare: 50,
          status: "agreed" as const,
          origin: "world" as const,
          askedAt: T0.toISOString(),
          answeredAt: null,
          postId: null,
          decline: null,
        },
      ],
      rivalries: [
        {
          id: "r1",
          fromId: "lena",
          toId: "zoe",
          cause: "copied",
          stage: "feud" as const,
          stageAt: T0.toISOString(),
          ending: null,
        },
      ],
      deals: [],
      blocked: [],
      couples: [together, oldSplit],
      bonds: bond,
    };
    const edges = slpPeopleEdges(view as never, at(2));
    const kinds = edges.map((edge) => edge.kind).sort();
    assert.deepEqual(kinds, ["collab", "couple", "ex", "friend", "rival"]);
    const ego = slpEgoTies(edges, "lena");
    assert.deepEqual(
      ego.map((tie) => tie.otherId),
      ["max", "tom", "zoe", "nora"],
    );
    assert.deepEqual(
      ego.find((tie) => tie.otherId === "nora")!.edges.map((edge) => edge.kind),
      ["friend", "collab"],
    );
    assert.equal(slpBusiestCreator(edges, ["nora", "lena", "zoe"]), "lena");
    // Open Lena: her people show; open Nora too and nothing is drawn twice.
    const one = slpPeopleGraph(edges, ["lena"]);
    assert.deepEqual([...one.ids].sort(), ["lena", "max", "nora", "tom", "zoe"]);
    assert.equal(one.ties.filter((edge) => [edge.aId, edge.bId].sort().join() === "lena,nora").length, 1);
    assert.equal(one.ties.find((edge) => [edge.aId, edge.bId].sort().join() === "lena,nora")!.kind, "friend");
    assert.deepEqual(slpPeopleGraph(edges, ["nobody"]).ids, ["nobody"]);
  }

  // The layout: settles without NaN, ties pull together, strangers push apart, a held person stays put,
  // and people already placed keep their spot when someone new arrives.
  {
    const links = [
      { a: "a", b: "b", length: 100 },
      { a: "a", b: "c", length: 100 },
    ];
    let nodes: SlpForceNode[] = slpForceSeed(new Map(), ["a", "b", "c", "d"], () => []);
    nodes = nodes.map((node) => (node.id === "d" ? { ...node, x: 5, y: 5, pinned: true } : node));
    let alpha = 1;
    for (let step = 0; step < 400; step += 1) {
      nodes = slpForceStep(nodes, links, alpha);
      alpha *= 1 - SLP_FORCE_COOLING;
    }
    const at = new Map(nodes.map((node) => [node.id, node]));
    for (const node of nodes) assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
    const gap = (x: string, y: string) => Math.hypot(at.get(x)!.x - at.get(y)!.x, at.get(x)!.y - at.get(y)!.y);
    assert.ok(gap("a", "b") < 160, `tied people stay close (${gap("a", "b")})`);
    assert.ok(gap("b", "c") > 40, "people push apart");
    assert.deepEqual([at.get("d")!.x, at.get("d")!.y], [5, 5], "a held person stays put");
    const again = slpForceSeed(at, ["a", "b", "c", "d", "e"], (id) => (id === "e" ? ["a"] : []));
    assert.deepEqual(
      again.slice(0, 4).map((node) => [node.x, node.y]),
      nodes.map((node) => [node.x, node.y]),
    );
    assert.ok(
      Math.hypot(again[4]!.x - at.get("a")!.x, again[4]!.y - at.get("a")!.y) < 30,
      "a newcomer starts next to who opened them",
    );
    const box = slpForceBox(nodes);
    for (const node of nodes)
      assert.ok(node.x > box.x && node.x < box.x + box.size && node.y > box.y && node.y < box.y + box.size);
    assert.equal(slpForceBox([]).size, 220);
  }

  // Cameos: about one slot in five, only people who are close (never an acquaintance, an ex or a cold
  // bond), with their account in the cast so their look reaches the picture; after the player's steering.
  {
    const bonds = readSlurpBonds([
      { id: "f", aId: "me", bId: "best", since: T0.toISOString(), kind: "friend", level: 3 },
      { id: "r", aId: "me", bId: "flat", since: T0.toISOString(), kind: "roommate" },
      { id: "a", aId: "me", bId: "acq", since: T0.toISOString(), kind: "friend", level: 0 },
      { id: "x", aId: "me", bId: "ex", since: T0.toISOString(), kind: "ex" },
      { id: "c", aId: "me", bId: "cold", since: T0.toISOString(), kind: "friend", level: 1, temperature: "cold" },
    ]);
    const names = new Map([
      ["best", "Nora"],
      ["flat", "Mia"],
      ["acq", "Acq"],
      ["ex", "Tom"],
      ["cold", "Cold"],
    ]);
    const beats = Array.from({ length: 400 }, (_, sequence) =>
      slurpBondBeat({ creatorId: "me", bonds, names, sequence }),
    );
    const hits = beats.filter(Boolean);
    const share = (hits.length / beats.length) * 100;
    assert.ok(Math.abs(share - SLURP_BOND_BEAT_PERCENT) < 8, `about one slot in five (${share}%)`);
    assert.deepEqual([...new Set(hits.map((beat) => beat!.castIds![0]))].sort(), ["best", "flat"]);
    assert.ok(hits.every((beat) => beat!.cast.length === 1 && beat!.line.includes(beat!.cast[0]!)));
    assert.equal(slurpBondBeat({ creatorId: "nobody", bonds, names, sequence: 1 }), null);
    const planner = slurp2Source(
      new URL(
        "../packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-beat-service.ts",
        import.meta.url,
      ),
    );
    assert.ok(
      planner.indexOf("planSlurpBondBeat(db") > planner.indexOf("if (steered) return steered;"),
      "cameos never take a steered slot",
    );
    // The page's People block: best friend and roommate before collabs, friends after, no exes.
    const people = slpPagePeople("me", {
      creators: ["best", "flat", "acq", "ex", "cold", "kai"].map((id) => ({ id, name: id, avatarUrl: null })),
      couples: [],
      collabs: [{ hostId: "me", partnerId: "kai", status: "posted" }],
      rivalries: [],
      bonds: bonds.map((bond) => ({ ...bond })),
    });
    assert.deepEqual(
      people.map((person) => `${person.id}:${person.relation}`),
      ["best:bestie", "flat:roommate", "kai:collab", "cold:friend"],
    );
  }

  // Every ties write keeps the bonds: the document reads and writes them.
  {
    const storage = slurp2Source(
      new URL(
        "../packages/slurp2/src/engine/packages/server/src/slp/data/projects/slp-creator-ties-storage.ts",
        import.meta.url,
      ),
    );
    assert.match(storage, /bonds: readSlurpBonds\(value\?\.bonds\)/u);
    assert.match(storage, /bonds: next\.document\.bonds/u);
    const service = slurp2Source(
      new URL(
        "../packages/slurp2/src/engine/packages/server/src/slp/features/projects/slp-creator-ties-service.ts",
        import.meta.url,
      ),
    );
    assert.match(service, /bonds: slurpAdvanceBonds\(document\.bonds/u);
    for (const match of service.matchAll(
      /mutateSlurpCreatorTies\(db, \(document\) => \(\{\s*document: \{([^]*?)\n {6,8}\}/gu,
    ))
      assert.match(match[1]!, /\.\.\.document/u, "a ties write that builds the document keeps the other lists");
  }

  console.log("slurp2 bonds regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
