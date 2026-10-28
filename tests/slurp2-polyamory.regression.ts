/**
 * 0.3.5: polyamory (Settings › Stir, off by default). A couple that is dating or together can grow to
 * four; everyone in it is a partner in prompts and posts; a shared page splits among all of them.
 */
import assert from "node:assert/strict";
import {
  newSlurpCouple,
  slurpSetUpCouple,
  slurpCoupleOther,
  type SlurpCouple,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";
import { readSlurpCouples } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-read.ts";
import {
  slurpAddToCouple,
  slurpCoupleMembers,
  slurpCouplePageSplit,
  slurpCouplePartners,
  slurpNameList,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-group.ts";
import { slurpUndoTie } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-stir-tie-preview.ts";
import { slurpRelationshipLine } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-couple-lines.ts";
import { slurpCoupleBeat } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-couple-beats.ts";

const at = new Date("2026-09-29T12:00:00.000Z");
const stamp = at.toISOString();
const together = (id: string, a: string, b: string): SlurpCouple =>
  newSlurpCouple(id, a, b, "player", stamp, "together");
const on = { at, polyamory: true };

// 1. Off by default: nobody joins.
assert.equal(
  slurpAddToCouple([together("c", "mira", "kai")], "c", { id: "lena" }, { at, polyamory: false }),
  "polyOff",
);

// 2. Joining: dating or together only, never twice, never someone taken, never past four.
{
  const sparks = newSlurpCouple("s", "mira", "kai", "player", stamp);
  assert.equal(slurpAddToCouple([sparks], "s", { id: "lena" }, on), "notTogether");
  const base = [together("c", "mira", "kai"), together("d", "ana", "bo")];
  assert.equal(slurpAddToCouple(base, "c", { id: "kai", poly: true }, on), "same");
  // Everyone in a group is polyamorous: a monogamous joiner, or a monogamous member, blocks it.
  assert.equal(slurpAddToCouple(base, "c", { id: "lena" }, on), "mono");
  assert.equal(
    slurpAddToCouple(base, "c", { id: "lena", poly: true }, { ...on, creators: [{ id: "mira", poly: false }] }),
    "mono",
  );
  // A polyamorous joiner may be in another couple too.
  assert.ok(Array.isArray(slurpAddToCouple(base, "c", { id: "ana", poly: true }, on)));
  const three = slurpAddToCouple(base, "c", { id: "lena", poly: true }, on);
  assert.ok(Array.isArray(three));
  const couple = three.find((entry) => entry.id === "c")!;
  assert.deepEqual(slurpCoupleMembers(couple), ["mira", "kai", "lena"]);
  assert.equal(couple.moments.at(-1)?.kind, "joined");
  assert.equal(couple.moments.at(-1)?.withId, "lena");
  const four = slurpAddToCouple(three, "c", { id: "mo", poly: true }, on);
  assert.ok(Array.isArray(four));
  assert.equal(slurpAddToCouple(four, "c", { id: "zoe", poly: true }, on), "full");
  // Undo takes the one who joined out again (review 0.3.5).
  const previous = base.find((entry) => entry.id === "c")!;
  const undone = slurpUndoTie(
    { ties: { collabs: [], rivalries: [], deals: [] } as never, couples: three },
    { kind: "restoreCouple", couple: previous },
  );
  assert.deepEqual(undone?.couples.find((entry) => entry.id === "c")?.moreIds, undefined);
  // Stored and read back, the group stays; a joined partner is "in" the couple.
  const read = readSlurpCouples(JSON.parse(JSON.stringify(four))).find((entry) => entry.id === "c")!;
  assert.deepEqual(read.moreIds, ["lena", "mo"]);
  assert.equal(slurpCoupleOther(read, "lena"), "mira");
  assert.deepEqual(slurpCouplePartners(read, "kai"), ["mira", "lena", "mo"]);
  assert.deepEqual(slurpCouplePartners(read, "zoe"), []);

  // 3. Words: every partner is named.
  assert.equal(slurpNameList(["Mira", "Lena", "Mo"]), "Mira, Lena and Mo");
  const names = new Map([
    ["mira", "Mira"],
    ["kai", "Kai"],
    ["lena", "Lena"],
    ["mo", "Mo"],
  ]);
  assert.match(slurpRelationshipLine([read], "kai", names, { at }), /polyamorous relationship with Mira, Lena and Mo/u);
  const beat = slurpCoupleBeat({ creatorId: "kai", sequence: 1, couples: [read], names, at });
  // The newest untold moment first: Mo joined last.
  assert.ok(beat, "the joined moment is big news");
  assert.match(beat!.line, /Mo joined you and Mira and Lena/u);
  assert.deepEqual(beat!.cast.slice(0, 3), ["Mira", "Lena", "Mo"]);
  const joinerBeat = slurpCoupleBeat({ creatorId: "mo", sequence: 1, couples: [read], names, at });
  assert.match(joinerBeat!.line, /You joined Mira, Kai and Lena/u);
}

// 4. One person, several couples: only a polyamorous Creator, only with polyamory on, never twice.
{
  const creator = (id: string, poly = false) => ({
    id,
    name: id,
    text: "",
    tags: [],
    automatic: true,
    followers: 0,
    poly,
  });
  const base = [together("c", "mira", "kai")];
  assert.equal(slurpSetUpCouple(base, creator("kai", true), creator("lena"), { at, id: "n" }), "busy", "off: busy");
  assert.equal(slurpSetUpCouple(base, creator("kai"), creator("lena"), { at, id: "n", polyamory: true }), "mono");
  const both = slurpSetUpCouple(base, creator("kai", true), creator("lena"), { at, id: "n", polyamory: true });
  assert.ok(Array.isArray(both), "a poly Creator starts a second couple");
  assert.equal(
    slurpSetUpCouple(both, creator("kai", true), creator("lena", true), { at, id: "m", polyamory: true }),
    "busy",
    "never the same two twice",
  );
  const names = new Map([
    ["mira", "Mira"],
    ["kai", "Kai"],
    ["lena", "Lena"],
  ]);
  assert.match(
    slurpRelationshipLine(both, "kai", names, { at }),
    /You are with Mira.*You are polyamorous, and you are also flirting with Lena\./su,
  );
}

// 5. A shared page's earnings go to every member; no coin lost or made.
for (const amount of [0, 1, 7, 100, 999])
  for (const members of [2, 3, 4]) {
    const shares = slurpCouplePageSplit(amount, members);
    assert.equal(shares.length, members);
    assert.equal(
      shares.reduce((sum, share) => sum + share, 0),
      amount,
    );
    assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
  }

console.log("slurp2 polyamory: ok");
