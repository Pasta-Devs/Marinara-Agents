/**
 * Drama runtime (`docs/DRAMA.md`): late casting, the level's caps, choices (player, fans, default on
 * silence), outcomes, the exit, and a 60-day world where Creators join and leave. Every drama ends,
 * nobody is in more than two, nothing is queued for someone who left, and the same seed gives the
 * same world.
 */
import assert from "node:assert/strict";
import { slpDramaSchema, slpSituationSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-drama.ts";
import {
  slpAdvanceDrama,
  slpAnswerDramaChoice,
  slpDramaCast,
  slpDramaLeadFits,
  slpDramaText,
  slpRequestDrama,
  slpDueDramaJobs,
  SLP_DRAMA_LEVEL_RULES,
  SLP_EMPTY_DRAMA_STATE,
  type SlpDramaCreator,
  type SlpDramaInput,
  type SlpDramaState,
  type SlpDramaWorld,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-runtime.ts";
import { partner, rivals } from "./slurp2-drama-fixtures";
import { slurp2Source } from "./slurp2-source";
import {
  SLURP_BUILTIN_DRAMAS,
  SLURP_BUILTIN_SITUATIONS,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-packs.ts";
import { slurpApplyDramaTie } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-drama-ties.ts";
import {
  slurpSetBond,
  type SlurpBond,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-bonds.ts";
import { SLURP_NO_TIES } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-ties.ts";
import { newSlurpCouple } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/projects/slp-creator-couples.ts";

const HOUR = 3_600_000;
const T0 = Date.parse("2026-10-01T00:00:00.000Z");

const creator = (id: string, tags: string[], extra: Partial<SlpDramaCreator> = {}): SlpDramaCreator => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  automatic: true,
  gender: "female",
  spice: 3,
  tags,
  joinedAt: new Date(T0 - 60 * 24 * HOUR).toISOString(),
  followers: 1000,
  ...extra,
});
const people = [
  creator("mia", ["fitness"]),
  creator("lena", ["fitness"]),
  creator("nora", ["fitness"]),
  creator("zoe", ["art"]),
  creator("ivy", ["art"]),
  creator("jake", ["fitness"], { gender: "male", joinedAt: new Date(T0 - 2 * 24 * HOUR).toISOString() }),
  creator("tom", ["gaming"], { gender: "male" }),
  creator("me", [], { automatic: false, gender: "male" }),
];
const world = (creators = people): SlpDramaWorld => ({
  creators,
  relations: new Map(
    creators.some((entry) => entry.id === "mia") ? [["mia", [{ playerId: "me", relation: "partner" as const }]]] : [],
  ),
  ties: new Set(["couple:me|mia"]),
});

const situation = slpSituationSchema.parse(partner);
const rivalry = slpDramaSchema.parse({ ...rivals, cooldownDays: 3 });
const open = slpDramaSchema.parse({
  id: "test-open",
  name: "Open relationship",
  requires: { situation: "test-partner" },
  cooldownDays: 5,
  roles: [
    { key: "her", needs: { relationToPlayer: ["partner"] } },
    { key: "you", player: true },
    { key: "him", needs: { gender: "male", minSpice: 2 }, prefer: "newcomer" },
  ],
  maxDays: 20,
  stages: [
    {
      key: "noticed",
      days: [1, 2],
      beats: [
        { role: "him", channel: "comment", on: "her", lines: ["{him} was here"] },
        { role: "her", channel: "dm", to: "you", seed: "{him} keeps commenting" },
      ],
    },
    {
      key: "ask",
      days: [1, 2],
      choice: {
        asks: "player",
        question: "{him} wants to shoot with me. ok?",
        options: [
          { label: "ok", next: "shoot" },
          { label: "no", next: "end" },
        ],
        default: 0,
        timeoutDays: 2,
      },
    },
    {
      key: "shoot",
      days: [2, 3],
      minSpice: 3,
      beats: [
        { role: "her", channel: "post", heat: { line: "shot at {him}'s place", with: "him", shotBy: "him" } },
        { role: "crowd", channel: "comment", on: "her", lines: ["does your bf know?"] },
        { role: "him", channel: "money", to: "her", amount: { min: 50, max: 100 } },
      ],
      outcomes: [{ kind: "tie", tie: "friend", between: ["her", "him"], level: 2 }],
    },
  ],
  exit: { role: "her", channel: "dm", to: "you", seed: "home again" },
});

let counter = 0;
const input = (at: number, overrides: Partial<SlpDramaInput> = {}): SlpDramaInput => ({
  at: new Date(at),
  level: "soap",
  situations: [situation],
  dramas: [rivalry, open],
  dials: {},
  world: world(),
  activity: 1,
  newId: () => `id-${++counter}`,
  ...overrides,
});
const run = (
  state: SlpDramaState,
  hours: number,
  from: number,
  overrides: (at: number) => Partial<SlpDramaInput> = () => ({}),
) => {
  let current = state;
  const ties: ReturnType<typeof slpAdvanceDrama>["ties"] = [];
  for (let step = 0; step < hours; step += 1) {
    const result = slpAdvanceDrama(current, input(from + step * HOUR, overrides(from + step * HOUR)));
    current = result.state;
    ties.push(...result.ties);
  }
  return { state: current, ties };
};

async function main() {
  assert.equal(slpDramaText("{him} and {her}, {nobody}", { him: "Jake", her: "Mia" }), "Jake and Mia, {nobody}");

  // Casting: relations bring the player's page along; newcomers first; a drama with no fit waits.
  const cast = slpDramaCast(
    open.roles,
    ["her", "him"],
    {},
    { world: world(), busy: new Set(), seed: "s", at: new Date(T0) },
  );
  assert.deepEqual(cast, { her: "mia", you: "me", him: "jake" });
  // 0.3.17: a role pair that ends as a couple never pairs two the player's romance settings keep apart.
  const kept = people.map((entry) => (entry.id === "jake" ? { ...entry, romance: { off: true, only: [] } } : entry));
  const recast = slpDramaCast(
    open.roles,
    ["her", "him"],
    {},
    { world: world(kept), busy: new Set(), seed: "s", at: new Date(T0), couples: [["her", "him"]] },
  );
  assert.notEqual(recast?.him, "jake", "romance off keeps Jake out of a couple role");
  assert.equal(
    slpDramaCast(
      open.roles,
      ["her"],
      { her: "mia", him: "jake" },
      {
        world: world(kept),
        busy: new Set(),
        seed: "s",
        at: new Date(T0),
        couples: [["her", "him"]],
      },
    ),
    null,
    "a pair cast before (a situation, an earlier stage) is held to the romance settings too",
  );
  assert.equal(
    slpDramaCast(open.roles, ["her", "him"], {}, { world: world(kept), busy: new Set(), seed: "s", at: new Date(T0) })
      ?.him,
    "jake",
    "without a couple outcome the setting does not matter",
  );
  assert.equal(
    slpDramaCast(
      open.roles,
      ["her"],
      {},
      { world: world(people.filter((entry) => entry.id !== "mia")), busy: new Set(), seed: "s", at: new Date(T0) },
    ),
    null,
  );

  // Stir's lead pick (0.3.11): only someone who fits the first role, not someone already busy, and
  // not on a drama that stands on a situation (its people come from the situation).
  const lead = rivalry.roles[0]!.key;
  const fits = (id: string, busy: string[] = []) =>
    slpDramaLeadFits(rivalry, id, { world: world(), busy: new Set(busy), at: new Date(T0) });
  assert.equal(fits("lena"), true);
  assert.equal(fits("me"), false, "the player's page is never cast in a Creator's role");
  assert.equal(fits("lena", ["lena"]), false);
  assert.equal(slpDramaLeadFits(open, "mia", { world: world(), busy: new Set(), at: new Date(T0) }), false);
  counter = 0;
  const led = slpAdvanceDrama(
    slpRequestDrama(SLP_EMPTY_DRAMA_STATE, rivalry.id, "lena"),
    input(T0, { dramas: [rivalry] }),
  );
  assert.equal(led.state.runs[0]?.cast[lead], "lena", "the requested drama starts with the player's pick");
  assert.equal(led.state.requestedLead, null, "the pick is used once");

  // Nothing switched on: nothing runs.
  counter = 0;
  const quiet = run(SLP_EMPTY_DRAMA_STATE, 48, T0, () => ({ situations: [], dramas: [] })).state;
  assert.deepEqual([quiet.runs.length, quiet.situations.length, quiet.jobs.length], [0, 0, 0]);

  // The situation stands at once and draws at most `perDay` beats a day, only those its dials allow.
  counter = 0;
  const standing = run(SLP_EMPTY_DRAMA_STATE, 72, T0, () => ({
    dramas: [],
    dials: { "test-partner": { "audience-knows": "no" } },
  })).state;
  assert.equal(standing.situations.filter((entry) => entry.endedAt === null).length, 1);
  assert.deepEqual(standing.situations[0]!.cast, { her: "mia", you: "me" });
  const deckJobs = standing.jobs;
  assert.ok(
    deckJobs.length >= 1 && deckJobs.length <= 3 * situation.perDay,
    `deck draws stay within perDay (${deckJobs.length})`,
  );
  assert.ok(
    deckJobs.every((entry) => entry.channel === "dm" && entry.toId === "me"),
    "audience-knows=no keeps the crowd quiet",
  );

  // The open drama, answered "no" by the player: it ends after the question, no shoot, no outcome.
  const toAsk = (overrides: (at: number) => Partial<SlpDramaInput> = () => ({ dramas: [open] })) => {
    counter = 0;
    let state = SLP_EMPTY_DRAMA_STATE;
    for (let hour = 0; hour < 24 * 20; hour += 1) {
      state = slpAdvanceDrama(state, input(T0 + hour * HOUR, overrides(T0 + hour * HOUR))).state;
      const asking = state.jobs.find((entry) => entry.channel === "choice");
      if (asking) return { state, hour, asking };
    }
    throw new Error("the open drama never asked");
  };
  const asked = toAsk();
  assert.equal(asked.asking.toId, "me");
  assert.equal(slpDramaText(asked.asking.choice!.question, asked.asking.names), "Jake wants to shoot with me. ok?");
  const runId = asked.asking.runId;
  const said = slpAnswerDramaChoice(asked.state, runId, 1, new Date(T0 + asked.hour * HOUR))!;
  assert.ok(said);
  assert.equal(slpAnswerDramaChoice(said, runId, 0, new Date(T0)), null, "a settled choice stays settled");
  const afterNo = run(said, 24 * 4, T0 + (asked.hour + 1) * HOUR, () => ({ dramas: [open] }));
  const ended = afterNo.state.runs.find((entry) => entry.id === runId)!;
  assert.equal(ended.ending, "done");
  assert.ok(!ended.log.some((entry) => entry.code === "stage" && entry.detail === "shoot"));
  assert.equal(afterNo.ties.length, 0);
  assert.ok(
    afterNo.state.jobs.some((entry) => entry.runId === runId && entry.channel === "dm" && entry.seed === "home again"),
    "the exit",
  );

  // Silence means the pack's default ("ok"): the shoot runs, with its post line, the crowd, coins and the tie.
  const silent = run(asked.state, 24 * 8, T0 + (asked.hour + 1) * HOUR, () => ({ dramas: [open] }));
  const shot = silent.state.runs.find((entry) => entry.id === runId)!;
  assert.ok(shot.log.some((entry) => entry.code === "choice" && entry.detail === "ok"));
  assert.ok(shot.log.some((entry) => entry.code === "stage" && entry.detail === "shoot"));
  const post = silent.state.jobs.find((entry) => entry.runId === runId && entry.channel === "post")!;
  assert.deepEqual([post.actorId, post.heat?.withId, post.heat?.shotById], ["mia", "jake", "jake"]);
  assert.ok(
    silent.state.jobs.some((entry) => entry.runId === runId && entry.channel === "comment" && entry.actorId === null),
  );
  const coins = silent.state.jobs.find((entry) => entry.runId === runId && entry.channel === "money")!;
  assert.ok(coins.amount! >= 50 && coins.amount! <= 100);
  assert.deepEqual(
    silent.ties.map((entry) => [entry.outcome.kind, ...entry.ids]),
    [["tie", "mia", "jake"]],
  );

  // Too hot for her: the shoot stage is skipped, never forced.
  const mild = people.map((entry) => (entry.id === "mia" ? { ...entry, spice: 1 } : entry));
  const cooler = run(asked.state, 24 * 8, T0 + (asked.hour + 1) * HOUR, () => ({ dramas: [open], world: world(mild) }));
  const skipped = cooler.state.runs.find((entry) => entry.id === runId)!;
  assert.ok(skipped.log.some((entry) => entry.code === "skipped" && entry.detail === "shoot"));
  assert.ok(!cooler.state.jobs.some((entry) => entry.runId === runId && entry.channel === "post"));

  // The lead leaves: the drama ends ("left"); nothing more is queued for her.
  const gone = run(asked.state, 24, T0 + (asked.hour + 1) * HOUR, () => ({
    dramas: [open],
    world: world(people.filter((entry) => entry.id !== "mia")),
  }));
  assert.equal(gone.state.runs.find((entry) => entry.id === runId)!.ending, "left");
  assert.equal(gone.state.situations.find((entry) => entry.situationId === "test-partner")!.ending, "left");

  // 60 days, Creators joining and leaving at random, levels switching: every rule holds.
  const simulate = () => {
    counter = 0;
    let state = SLP_EMPTY_DRAMA_STATE;
    const levels = ["calm", "lively", "soap"] as const;
    for (let hour = 0; hour < 24 * 60; hour += 1) {
      const at = T0 + hour * HOUR;
      const creators = people.filter(
        (entry, index) => !((Math.floor(hour / 30) + index * 7) % 11 < 2 && entry.id !== "me"),
      );
      const level = levels[Math.floor(hour / (24 * 20))]!;
      const result = slpAdvanceDrama(state, input(at, { level, world: world(creators) }));
      state = result.state;
      const liveIds = new Set(creators.map((entry) => entry.id));
      const running = state.runs.filter((entry) => entry.endedAt === null);
      assert.ok(running.length <= SLP_DRAMA_LEVEL_RULES.soap.running);
      for (const entry of running) {
        const drama = [rivalry, open].find((item) => item.id === entry.dramaId)!;
        assert.ok(at - Date.parse(entry.startedAt) <= drama.maxDays * 24 * HOUR, "every drama ends by maxDays");
        assert.ok(liveIds.has(entry.cast[drama.roles[0]!.key]!), "a drama whose lead left is over");
      }
      const load = new Map<string, number>();
      for (const entry of running) for (const id of Object.values(entry.cast)) load.set(id, (load.get(id) ?? 0) + 1);
      for (const [id, count] of load) assert.ok(id === "me" || count <= 2, `${id} is in ${count} dramas`);
      for (const due of slpDueDramaJobs(state, new Date(at)))
        if (due.status === "queued" && Date.parse(due.dueAt) === at)
          assert.ok(!due.actorId || liveIds.has(due.actorId));
      for (const entry of state.jobs)
        if (entry.channel === "post") assert.ok(entry.heat?.line, "a post job carries its line");
    }
    return state;
  };
  const world60 = simulate();
  assert.ok(world60.runs.length >= 3, `dramas happen over 60 days (${world60.runs.length})`);
  assert.ok(
    world60.runs.some((entry) => entry.ending !== null),
    "and end",
  );
  assert.deepEqual(simulate(), world60, "same seed, same world");

  // Calm: never more than one at once.
  counter = 0;
  let calm = SLP_EMPTY_DRAMA_STATE;
  for (let hour = 0; hour < 24 * 30; hour += 1) {
    calm = slpAdvanceDrama(calm, input(T0 + hour * HOUR, { level: "calm" })).state;
    assert.ok(calm.runs.filter((entry) => entry.endedAt === null).length <= 1);
  }

  // Outcomes go through the ties' own rules: a drama makes an unlocked bond, never moves one the player
  // set, starts a rivalry, breaks a couple up, and changes how a bond feels.
  {
    const at = new Date(T0);
    const tieCreators = ["mia", "jake"].map((id) => ({
      id,
      name: id,
      text: "",
      tags: [],
      automatic: true,
      followers: 1,
    }));
    const doc = {
      ties: { ...SLURP_NO_TIES, collabs: [], rivalries: [], blocked: [] },
      couples: [],
      bonds: [] as SlurpBond[],
    };
    const opts = { at, newId: () => `t-${++counter}`, creators: tieCreators, polyamory: false };
    const friends = slurpApplyDramaTie(
      doc,
      { kind: "tie", tie: "friend", between: ["her", "him"], level: 2 },
      ["mia", "jake"],
      opts,
    );
    assert.deepEqual(
      [friends.bonds[0]!.origin, friends.bonds[0]!.level, friends.bonds[0]!.locked],
      ["drama", 2, undefined],
    );
    const tense = slurpApplyDramaTie(
      friends,
      { kind: "temperature", between: ["her", "him"], value: "tense" },
      ["mia", "jake"],
      opts,
    );
    assert.equal(tense.bonds[0]!.temperature, "tense");
    const mine = {
      ...doc,
      bonds: slurpSetBond([], { aId: "mia", bId: "jake", kind: "friend", level: 1 }, { at, id: "p" }) as SlurpBond[],
    };
    const kept = slurpApplyDramaTie(
      mine,
      { kind: "tie", tie: "friend", between: ["her", "him"], level: 3 },
      ["mia", "jake"],
      opts,
    );
    assert.equal(kept.bonds[0]!.level, 1, "a bond the player set stays as set");
    const ended = slurpApplyDramaTie(
      mine,
      { kind: "end-tie", tie: "friend", between: ["her", "him"] },
      ["mia", "jake"],
      opts,
    );
    assert.equal(ended.bonds[0]!.endedAt, null, "nor does a drama end it");
    const rival = slurpApplyDramaTie(
      doc,
      { kind: "tie", tie: "rival", between: ["her", "him"] },
      ["mia", "jake"],
      opts,
    );
    assert.equal(rival.ties.rivalries.length, 1);
    const couple = { ...doc, couples: [newSlurpCouple("c", "mia", "jake", "world", at.toISOString(), "together")] };
    const split = slurpApplyDramaTie(
      couple,
      { kind: "end-tie", tie: "couple", between: ["her", "him"] },
      ["mia", "jake"],
      opts,
    );
    assert.equal(split.couples[0]!.stage, "split");
  }

  // Wiring: the post planner takes due post lines right after ties; the dispatcher never sends a post
  // line itself; the scheduler and the catch-up both move drama; a drama notification is worth a line.
  {
    const src = (path: string) =>
      slurp2Source(new URL(`../packages/slurp2/src/engine/packages/server/src/slp/${path}`, import.meta.url));
    const planner = src("features/feed/slp-post-beat-service.ts");
    assert.ok(planner.indexOf("planSlurpDramaBeat(db") > planner.indexOf("if (tie) return tie;"));
    assert.ok(planner.indexOf("planSlurpDramaBeat(db") < planner.indexOf("planSlurpOccasionBeat(db"));
    assert.match(src("features/world/slp-drama-service.ts"), /filter\(\(job\) => job\.channel !== "post"\)/u);
    assert.match(src("features/world/slp-world-scheduler-service.ts"), /advanceSlurpDrama\(app\.db\)/u);
    assert.match(src("workflows/slp-world-tick-workflow.ts"), /advanceSlurpDrama\(app\.db\)/u);
    assert.match(src("modules/notifications/slp-event-weight.ts"), /drama: 6\d,/u);
  }

  // Review fixes: an old message never answers a newer question, only the player's own questions take
  // a tap, an answer outside the options is refused, and a stored bad answer never crashes the tick.
  {
    const said = slpAnswerDramaChoice(asked.state, runId, 0, new Date(T0), "noticed");
    assert.equal(said, null, "an answer for another stage is refused");
    assert.equal(
      slpAnswerDramaChoice(asked.state, runId, 5, new Date(T0), "ask"),
      null,
      "an answer outside the options is refused",
    );
    assert.ok(
      slpAnswerDramaChoice(asked.state, runId, 1, new Date(T0), "ask"),
      "the right stage and a real option count",
    );
    const broken: SlpDramaState = {
      ...asked.state,
      runs: asked.state.runs.map((entry) =>
        entry.id === runId ? { ...entry, stageDays: 0, choice: { ...entry.choice!, answer: 9, by: "player" } } : entry,
      ),
    };
    assert.doesNotThrow(() => slpAdvanceDrama(broken, input(T0 + (asked.hour + 1) * HOUR, { dramas: [open] })));
    const rivalsAsk = asked.state.runs.find((entry) => entry.id === runId)!;
    const fansChoice: SlpDramaState = {
      ...asked.state,
      runs: asked.state.runs.map((entry) =>
        entry === rivalsAsk ? { ...entry, choice: { ...entry.choice!, asks: "fans" } } : entry,
      ),
    };
    assert.equal(slpAnswerDramaChoice(fansChoice, runId, 0, new Date(T0)), null, "a tap never answers the fans' vote");
    // Switched off: the run ends and nothing it had queued goes out.
    const off = slpAdvanceDrama(asked.state, input(T0 + (asked.hour + 1) * HOUR, { dramas: [] })).state;
    assert.equal(off.runs.find((entry) => entry.id === runId)!.ending, "off");
    assert.ok(off.jobs.filter((entry) => entry.runId === runId).every((entry) => entry.status !== "queued"));
    // The question job carries its stage, for the DM's metadata.
    assert.equal(asked.asking.choice!.stage, "ask");
  }
  {
    const src = slurp2Source(
      new URL(
        "../packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-drama-service.ts",
        import.meta.url,
      ),
    );
    assert.ok(
      src.indexOf("const claimed = await mutateSlurpDramaState") < src.indexOf("await sendDramaJob(db, job"),
      "claimed before sent",
    );
    assert.ok(
      src.indexOf("const world = await loadDramaWorld(db, at);") > src.indexOf("ADVANCE_EVERY_MS) {"),
      "the world loads only to move",
    );
  }

  // The starter set: valid, unique, every drama's situation exists, and in a lived-in world every
  // drama gets cast and starts within 90 days at "soap", with only the post lines the packs wrote.
  {
    const ids = [...SLURP_BUILTIN_SITUATIONS, ...SLURP_BUILTIN_DRAMAS].map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok([...SLURP_BUILTIN_SITUATIONS, ...SLURP_BUILTIN_DRAMAS].every((entry) => entry.builtin && !entry.enabled));
    for (const entry of SLURP_BUILTIN_DRAMAS)
      if (entry.requires) assert.ok(SLURP_BUILTIN_SITUATIONS.some((item) => item.id === entry.requires!.situation));
    const lived: SlpDramaWorld = {
      creators: [
        ...people,
        creator("kai", ["fitness"], { gender: "male", followers: 90_000 }),
        creator("sam", ["art"], { gender: "male" }),
      ],
      relations: new Map([["mia", [{ playerId: "me", relation: "partner" as const }]]]),
      ties: new Set(["couple:me|mia", "friend:lena|nora", "roommate:ivy|zoe", "couple:sam|zoe"]),
    };
    counter = 0;
    let state = SLP_EMPTY_DRAMA_STATE;
    for (let hour = 0; hour < 24 * 90; hour += 1)
      state = slpAdvanceDrama(state, {
        ...input(T0 + hour * HOUR),
        situations: SLURP_BUILTIN_SITUATIONS,
        dramas: SLURP_BUILTIN_DRAMAS,
        world: lived,
      }).state;
    const started = new Set(state.runs.map((entry) => entry.dramaId));
    const missing = SLURP_BUILTIN_DRAMAS.map((entry) => entry.id).filter((id) => !started.has(id));
    assert.deepEqual(missing, [], `every starter drama runs within 90 days (missing ${missing.join(", ")})`);
    assert.deepEqual(
      state.situations
        .filter((entry) => !entry.endedAt)
        .map((entry) => entry.situationId)
        .sort(),
      ["partner-is-creator", "roommates"],
    );
    const lines = state.jobs
      .filter((entry) => entry.channel === "post")
      .map((entry) => slpDramaText(entry.heat!.line, entry.names));
    assert.ok(
      lines.length > 0 && lines.every((line) => !/\{[a-z-]+\}/u.test(line) && line.length <= 200),
      "post lines read clean",
    );
  }

  console.log("slurp2 drama runtime regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
