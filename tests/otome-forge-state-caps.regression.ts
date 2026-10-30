// Otome Forge's economy and angst state (M2a): the pinned numbers; trust and tension in their ranges, capped per beat
// and per chapter, also across a save; a grievance never closes in the beat that opened it, and closes only where its
// node allows; a rupture never takes anything unlocked back, and moves to another rupture still owed instead of
// closing; a pick applies once (first play only) and names whom it touched; reading pays each
// beat and each chapter once; hostile first-play picks cost affection above the reached level's floor; and the daily
// caps follow the player's own midnight in each zone.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type {
  Chapter,
  Effect,
  RunState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import * as economy from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
  normalizeState,
  toRunView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  applyChoiceEffects,
  type ChoiceContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/relationship.ts";
import {
  grant,
  readBeatToEnd,
  type ReadChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/rewards.ts";

const KAI = "li-kai-ab12";
const MIR = "li-mireille-cd34";
const AT = "2026-10-28T10:00:00.000Z";
const DAY = "2026-10-28";

const fresh = (): RunState => normalizeState({ lis: { [KAI]: {}, [MIR]: {} } });
/** The state as the next request reads it back from storage. */
const saved = (state: RunState): RunState => normalizeState(JSON.parse(JSON.stringify(state)));

function pick(state: RunState, effects: Effect[], where: Partial<ChoiceContext> & Pick<ChoiceContext, "i">) {
  return applyChoiceEffects(state, effects, { key: "main-1", choice: "choice-1", at: AT, ...where });
}

test("the economy's numbers are pinned", () => {
  assert.deepEqual(
    {
      start: economy.STARTING_STARLIGHT,
      wish: economy.WISH_COST,
      tenWishes: economy.TEN_WISH_COST,
      starlight: economy.STARLIGHT_EARNINGS,
      activityCap: economy.ACTIVITY_STARLIGHT_DAILY_CAP,
      perLevel: economy.POINTS_PER_LEVEL,
      levels: [economy.MIN_LEVEL, economy.MAX_LEVEL],
      affection: economy.AFFECTION_EARNINGS,
      outsideCap: economy.OUTSIDE_AFFECTION_DAILY_CAP,
      trust: [economy.TRUST_MIN, economy.TRUST_MAX],
      tension: [economy.TENSION_MIN, economy.TENSION_MAX],
      shifts: [economy.BEAT_SHIFT_MAX, economy.CHAPTER_SHIFT_MAX],
      sources: economy.REWARD_SOURCES,
      story: economy.REWARD_SOURCES.filter(economy.isStoryReward),
    },
    {
      start: 2000,
      wish: 100,
      tenWishes: 1000,
      starlight: {
        beat: 30,
        chapter: 160,
        routeChapter: 300,
        date: 120,
        readHim: 40,
        readMe: 40,
        clawRound: 20,
        clawPlush: 30,
      },
      activityCap: 400,
      perLevel: 300,
      levels: [1, 10],
      affection: {
        lead: 150,
        foil: 60,
        date: 100,
        readHim: 40,
        readMe: 20,
        readMeRight: 10,
        readMeClose: 5,
        clawRound: 30,
        closeAndRemember: 20,
        showHim: 20,
      },
      outsideCap: 300,
      trust: [-3, 3],
      tension: [0, 3],
      shifts: [1, 2],
      sources: [
        "beat",
        "chapter",
        "route-chapter",
        "date",
        "read-him",
        "read-me",
        "claw",
        "close-and-remember",
        "show-him",
      ],
      story: ["beat", "chapter", "route-chapter"],
    },
  );
  assert.deepEqual(
    [0, 299, 300, 599, 600, 2699, 2700, 99_999, -50, Number.NaN].map(economy.levelOf),
    [1, 1, 2, 2, 3, 9, 10, 10, 1, 1],
  );
});

test("the public run projects current-level affection without exposing private relationship state", () => {
  const world = normalizeWorld({});
  const player = normalizePlayer({});
  const unit = normalizeUnit({ id: KAI, name: "Kai", source: "archetype" });
  assert.ok(unit);
  for (const [points, level, current] of [
    [0, 1, 0],
    [299, 1, 299],
    [300, 2, 0],
    [599, 2, 299],
    [2699, 9, 299],
    [2700, 10, 300],
    [99_999, 10, 300],
  ]) {
    const state = normalizeState({ lis: { [KAI]: { points, trust: -2, tension: 3 } } });
    const before = structuredClone(state);
    const view = JSON.parse(JSON.stringify(toRunView("r-affection-abcdef", world, player, [unit], state)));
    assert.equal(view.lis[0].level, level);
    assert.deepEqual(view.lis[0].affectionProgress, { current, required: 300 });
    for (const hidden of ["points", "trust", "tension", "grievances", "disclosures", "bible"]) {
      assert.equal(hidden in view.lis[0], false, `${hidden} remains private`);
    }
    assert.deepEqual(state, before, "a view does not change earned affection or relationship state");
  }
});

test("trust and tension stay in their ranges however many chapters push them", () => {
  let state = fresh();
  for (let chapter = 1; chapter <= 6; chapter += 1) {
    for (let i = 0; i < 3; i += 1) {
      state = pick(
        state,
        [
          { li: KAI, trust: 1, tension: 1 },
          { li: MIR, trust: -1, tension: -1 },
        ],
        {
          key: `main-${chapter}`,
          i,
        },
      ).state;
    }
  }
  assert.deepEqual([state.lis[KAI]!.trust, state.lis[KAI]!.tension], [3, 3]);
  assert.deepEqual([state.lis[MIR]!.trust, state.lis[MIR]!.tension], [-3, 0]);
});

test("a beat moves each axis at most one step, across its picks and across a save", () => {
  // Two effects in one option count once.
  let state = pick(
    fresh(),
    [
      { li: KAI, trust: 1 },
      { li: KAI, trust: 1 },
    ],
    { i: 0 },
  ).state;
  assert.equal(state.lis[KAI]!.trust, 1);
  // A second choice in the same beat, read back from storage first: the beat's step is spent.
  const second = pick(saved(state), [{ li: KAI, trust: 1 }], { i: 0, choice: "choice-2" });
  assert.equal(second.state.lis[KAI]!.trust, 1);
  assert.equal(second.remembered, false, "nothing moved, so nothing is remembered");
  // Moving back within the beat is allowed, and so is the next beat's step.
  state = pick(second.state, [{ li: KAI, trust: -1 }], { i: 0, choice: "choice-3" }).state;
  assert.equal(state.lis[KAI]!.trust, 0);
  state = pick(state, [{ li: KAI, trust: 1 }], { i: 1 }).state;
  assert.equal(state.lis[KAI]!.trust, 1);
});

test("a chapter moves each axis at most two steps; the next chapter starts again", () => {
  let state = fresh();
  for (let i = 0; i < 4; i += 1) state = saved(pick(state, [{ li: KAI, trust: -1, tension: 1 }], { i }).state);
  assert.deepEqual([state.lis[KAI]!.trust, state.lis[KAI]!.tension], [-2, 2]);
  state = pick(state, [{ li: KAI, trust: -1, tension: 1 }], { key: "main-2", i: 0 }).state;
  assert.deepEqual([state.lis[KAI]!.trust, state.lis[KAI]!.tension], [-3, 3]);
  // A step lost at the end of the range does not use up the chapter: the way back is open.
  state = pick(state, [{ li: KAI, trust: -1 }], { key: "main-2", i: 1 }).state;
  state = pick(state, [{ li: KAI, trust: 1 }], { key: "main-2", i: 2 }).state;
  assert.equal(state.lis[KAI]!.trust, -2);
});

test("each chapter keeps its own cap while route and repair chapters are read alongside a main one", () => {
  let state = fresh();
  const step = (key: string, i: number, trust: -1 | 1) => {
    state = saved(pick(state, [{ li: KAI, trust }], { key, i }).state);
  };
  step("main-2", 0, -1);
  step("main-2", 1, -1);
  step(`repair-${KAI}-1`, 0, 1);
  step("main-2", 2, -1);
  step("main-2", 3, -1);
  assert.equal(state.lis[KAI]!.trust, -1, "main-2 moved trust by −2 in all, the repair by +1");
  // A finished chapter's counters are let go; the unfinished ones stay.
  state = { ...state, chapters: { ...state.chapters, "main-2": { ...state.chapters["main-2"]!, completed: AT } } };
  step(`route-${KAI}-2`, 0, 1);
  assert.deepEqual(Object.keys(state.lis[KAI]!.chapterDelta).sort(), [`repair-${KAI}-1`, `route-${KAI}-2`]);
  // A state saved with the older single slot keeps its chapter's counters.
  const legacy = normalizeState({
    lis: {
      [KAI]: {
        trust: -2,
        chapterDelta: { key: "main-1", trust: -2, tension: 0, beat: { i: 1, trust: -1, tension: 0 } },
      },
    },
  });
  assert.deepEqual(legacy.lis[KAI]!.chapterDelta, {
    "main-1": { trust: -2, tension: 0, beat: { i: 1, trust: -1, tension: 0 } },
  });
  assert.equal(pick(legacy, [{ li: KAI, trust: -1 }], { i: 2 }).state.lis[KAI]!.trust, -2, "the cap still holds");
});

test("a pick applies once: a replay changes nothing", () => {
  const first = pick(fresh(), [{ li: KAI, trust: 1, disclose: "She told him her brother drowned." }], { i: 2 });
  assert.equal(first.remembered, true);
  assert.deepEqual(first.rememberedBy, [KAI]);
  assert.equal(first.replay, false);
  assert.deepEqual(first.state.chapters["main-1"]!.applied, ["2/choice-1"]);
  assert.deepEqual(first.state.lis[KAI]!.disclosures, [
    { text: "She told him her brother drowned.", at: AT, ref: "main-1/2" },
  ]);
  const replay = pick(saved(first.state), [{ li: KAI, trust: 1, disclose: "Something else." }], { i: 2 });
  assert.equal(replay.replay, true);
  assert.equal(replay.remembered, false);
  assert.deepEqual(replay.rememberedBy, []);
  assert.deepEqual(replay.state, saved(first.state));
  // Effects for a love interest the run does not have are skipped, and no effects remember nothing.
  const stranger = pick(fresh(), [{ li: "li-nobody-zz99", trust: 1 }], { i: 0 });
  assert.equal(stranger.remembered, false);
  assert.deepEqual(stranger.state.lis, fresh().lis);
});

test("a grievance never closes in its own beat, and closes only where its node lists it", () => {
  const opened = pick(
    fresh(),
    [{ li: KAI, grievance: { by: "li", text: "She read his letters.", severity: "major" } }],
    {
      i: 2,
    },
  );
  const id = "g-main-1-2-0";
  assert.deepEqual(opened.state.lis[KAI]!.grievances, [
    { id, li: KAI, by: "li", text: "She read his letters.", severity: "major", opened: "main-1/2", status: "open" },
  ]);
  const forgive: Effect = { li: KAI, resolve: { id, status: "forgiven" } };
  // The same beat, even where the node lists it.
  let state = pick(opened.state, [forgive], { i: 2, choice: "choice-2", resolves: [id] }).state;
  assert.equal(state.lis[KAI]!.grievances[0]!.status, "open");
  // A later beat whose node does not list it.
  state = pick(state, [forgive], { i: 3 }).state;
  assert.equal(state.lis[KAI]!.grievances[0]!.status, "open");
  // A later beat whose node lists it.
  const closed = pick(saved(state), [forgive], { i: 4, resolves: [id] });
  assert.equal(closed.state.lis[KAI]!.grievances[0]!.status, "forgiven");
  assert.equal(closed.remembered, true);
  // Closed stays closed.
  state = pick(closed.state, [{ li: KAI, resolve: { id, status: "festering" } }], { i: 5, resolves: [id] }).state;
  assert.equal(state.lis[KAI]!.grievances[0]!.status, "forgiven");
  // Both directions, numbered within the beat.
  const both = pick(
    fresh(),
    [
      { li: KAI, grievance: { by: "li", text: "One.", severity: "minor" } },
      { li: MIR, grievance: { by: "protagonist", text: "Two.", severity: "minor" } },
    ],
    { i: 0 },
  );
  assert.deepEqual(
    [both.state.lis[KAI]!.grievances[0]!.id, both.state.lis[MIR]!.grievances[0]!.id],
    ["g-main-1-0-0", "g-main-1-0-1"],
  );
});

test("a rupture opens with its grievance, holds while it festers, and never takes anything unlocked back", () => {
  const before = fresh();
  before.lis[KAI] = { ...before.lis[KAI]!, points: 1200, stage: 3 };
  const broken = pick(
    before,
    [{ li: KAI, trust: -1, grievance: { by: "li", text: "She sold him out.", severity: "rupture" } }],
    { i: 1 },
  ).state;
  const id = "g-main-1-1-0";
  assert.deepEqual(broken.lis[KAI]!.rupture, { grievanceId: id, since: AT });
  assert.deepEqual([broken.lis[KAI]!.points, broken.lis[KAI]!.stage], [1200, 3]);
  // A second rupture-grade grievance does not replace the open rupture.
  let state = pick(broken, [{ li: KAI, grievance: { by: "li", text: "Again.", severity: "rupture" } }], {
    i: 1,
    choice: "choice-2",
  }).state;
  assert.equal(state.lis[KAI]!.rupture?.grievanceId, id);
  state = pick(state, [{ li: KAI, resolve: { id, status: "festering" } }], { i: 2, resolves: [id] }).state;
  assert.equal(state.lis[KAI]!.rupture?.grievanceId, id);
  // Repairing the first leaves the second owed: the rupture moves to it, and his gates stay shut.
  const second = "g-main-1-1-1";
  const repaired = pick(state, [{ li: KAI, resolve: { id, status: "addressed" } }], { i: 3, resolves: [id] });
  state = repaired.state;
  assert.deepEqual(state.lis[KAI]!.rupture, { grievanceId: second, since: AT });
  assert.deepEqual(repaired.rememberedBy, [KAI]);
  state = pick(saved(state), [{ li: KAI, resolve: { id: second, status: "forgiven" } }], {
    i: 4,
    resolves: [second],
  }).state;
  assert.equal(state.lis[KAI]!.rupture, null, "no rupture is left once every rupture is repaired");
  assert.deepEqual([state.lis[KAI]!.points, state.lis[KAI]!.stage], [1200, 3]);
});

const chapter = (changes: Partial<ReadChapter> = {}): ReadChapter => ({
  key: "main-1",
  kind: "main",
  number: 1,
  lead: KAI,
  foil: MIR,
  nodes: [0, 1, 2].map((i) => ({ i, kind: "beat", guide: "", cast: [KAI] })) as Chapter["nodes"],
  ledger: {
    relationship: [{ li: KAI, line: "He let her hold the lantern." }],
    conflict: [{ id: "c1-1", li: KAI, type: "pride", action: "plant" }],
    offscreen: [{ li: MIR, line: "Mireille audits the vault." }],
  },
  ...changes,
});

test("reading pays each beat once and the chapter once, saves its ledger and records the Lead", () => {
  const read = (state: RunState, i: number, of = chapter()) =>
    readBeatToEnd(saved(state), of, i, { at: AT, dayKey: DAY });
  let outcome = read(fresh(), 0);
  assert.deepEqual(outcome.grants, [{ source: "beat", starlight: 30 }]);
  assert.equal(outcome.state.wallet.starlight, 2030);
  // Read again, or out of order: nothing.
  for (const i of [0, 2, 7]) {
    const again = read(outcome.state, i);
    assert.deepEqual([again.grants, again.state], [[], saved(outcome.state)]);
  }
  outcome = read(outcome.state, 1);
  assert.equal(outcome.chapterDone, false);
  outcome = read(outcome.state, 2);
  assert.equal(outcome.chapterDone, true);
  assert.deepEqual(outcome.grants, [
    { source: "beat", starlight: 30 },
    { source: "chapter", starlight: 160 },
    { source: "lead", li: KAI, affection: 150 },
    { source: "foil", li: MIR, affection: 60 },
  ]);
  const done = outcome.state;
  assert.equal(done.wallet.starlight, 2000 + 3 * 30 + 160);
  assert.deepEqual([done.lis[KAI]!.points, done.lis[MIR]!.points], [150, 60]);
  assert.deepEqual(done.chapters["main-1"], { beatsRead: 3, completed: AT, applied: [] });
  assert.equal(done.lis[KAI]!.lastLead, 1);
  assert.deepEqual(done.lis[KAI]!.angst, ["pride"]);
  assert.deepEqual(done.ledgers, {
    relationship: [{ key: "main-1", li: KAI, line: "He let her hold the lantern." }],
    conflicts: [{ id: "c1-1", li: KAI, type: "pride", status: "open", chapter: 1, key: "main-1" }],
    offscreen: [{ key: "main-1", li: MIR, line: "Mireille audits the vault." }],
  });
  assert.equal(read(done, 2).chapterDone, true);
  assert.deepEqual(read(done, 2).grants, []);

  // A later chapter resolving it; a route chapter pays 300 and leaves lastLead alone.
  const route = chapter({
    key: "route-li-kai-ab12-2",
    kind: "route",
    number: undefined,
    nodes: chapter().nodes.slice(0, 1),
    ledger: { relationship: [], conflict: [{ id: "c1-1", li: KAI, type: "pride", action: "resolve" }], offscreen: [] },
  });
  const after = read(done, 0, route);
  assert.deepEqual(
    after.grants.map((entry) => entry.starlight ?? entry.affection),
    [30, 300, 150, 60],
  );
  assert.equal(after.state.ledgers.conflicts[0]!.status, "resolved");
  assert.equal(after.state.lis[KAI]!.lastLead, 1);
});

test("reward grants remain earning-only", () => {
  const state = fresh();
  state.lis[KAI] = { ...state.lis[KAI]!, points: 600 };
  for (const source of ["chapter", "date"] as const) {
    const result = grant(state, { source, li: KAI, affection: -250, starlight: -40 }, DAY);
    assert.deepEqual(result.granted, { starlight: 0, affection: 0 });
    assert.equal(result.state, state);
  }
  assert.equal(economy.levelOf(state.lis[KAI]!.points), 3);
});

test("hostile choices lose 15 affection without ever losing a reached level, including after earning a new one", () => {
  for (const points of [0, 5, 299, 300, 305, 599, 600, 605, 2699, 2700, 2705, 99_999]) {
    const before = fresh();
    before.lis[KAI] = { ...before.lis[KAI]!, points };
    const after = pick(before, [{ li: KAI, trust: -1 }], { i: 0 }).state;
    const expected = new Map([
      [0, 0],
      [5, 0],
      [299, 284],
      [300, 300],
      [305, 300],
      [599, 584],
      [600, 600],
      [605, 600],
      [2699, 2684],
      [2700, 2700],
      [2705, 2700],
      [99_999, 99_984],
    ]).get(points);
    assert.equal(after.lis[KAI]!.points, expected, `loss from ${points}`);
    assert.equal(economy.levelOf(after.lis[KAI]!.points), economy.levelOf(points));
    assert.equal(saved(after).lis[KAI]!.points, expected, "the next request retains the protected level");
  }
  const before = fresh();
  before.lis[KAI] = { ...before.lis[KAI]!, points: 299 };
  let state = grant(before, { source: "chapter", li: KAI, affection: 30 }, DAY).state;
  assert.equal(economy.levelOf(state.lis[KAI]!.points), 2);
  state = pick(state, [{ li: KAI, trust: -1 }], { i: 0 }).state;
  assert.equal(state.lis[KAI]!.points, 314);
  state = pick(saved(state), [{ li: KAI, trust: -1 }], { i: 1 }).state;
  assert.equal(state.lis[KAI]!.points, 300, "the newly earned level becomes the next loss floor");
});

test("harm costs affection once per LI and canonical pick; an existing grievance, tension and replay do not", () => {
  const before = fresh();
  before.lis[KAI] = { ...before.lis[KAI]!, points: 945, trust: -3 };
  before.lis[MIR] = { ...before.lis[MIR]!, points: 945 };
  const grievance = { by: "li" as const, text: "She read his letters.", severity: "major" as const };
  const first = pick(
    before,
    [
      { li: KAI, trust: -1, grievance },
      { li: KAI, trust: -1, grievance },
      { li: MIR, tension: 1, grievance: { ...grievance, by: "protagonist" } },
      { li: "li-missing-zz99", trust: -1 },
    ],
    { i: 0 },
  );
  assert.equal(
    first.state.lis[KAI]!.points,
    930,
    "negative trust counts even at its hidden cap, without double charging",
  );
  assert.equal(
    first.state.lis[MIR]!.points,
    945,
    "tension and the protagonist's own grievance do not cost his affection",
  );
  const replay = pick(saved(first.state), [{ li: KAI, trust: -1 }], { i: 0 });
  assert.equal(replay.replay, true);
  assert.deepEqual(replay.state, saved(first.state));
  const repeated = pick(replay.state, [{ li: KAI, grievance: { ...grievance, text: "  She read   his letters. " } }], {
    i: 1,
  });
  assert.equal(repeated.state.lis[KAI]!.points, 930, "repeating an unresolved grievance is not new harm");
  const newHurt = pick(repeated.state, [{ li: MIR, grievance }], { i: 2 });
  assert.equal(newHurt.state.lis[MIR]!.points, 930, "a genuinely new grievance alone also costs 15");
  const legacy = pick(saved(newHurt.state), [{ li: KAI, tension: 1, disclose: "She told him the truth." }], { i: 3 });
  assert.equal(legacy.state.lis[KAI]!.points, 930, "older effects without harm remain unchanged");
});

test("affection loss preserves daily earning caps and unlocked progress, and completion rewards still pay normally", () => {
  const before = fresh();
  before.lis[KAI] = {
    ...before.lis[KAI]!,
    points: 945,
    stage: 3,
    revealed: ["secret-1"],
    firsts: { date: AT },
    lastLead: 1,
  };
  before.daily = { dayKey: DAY, starlight: 400, affection: { [KAI]: 300 } };
  const after = pick(before, [{ li: KAI, trust: -1 }], { i: 0 }).state;
  assert.equal(after.lis[KAI]!.points, 930);
  assert.equal(after.daily, before.daily, "losing affection never refunds the day's earned amount");
  assert.equal(after.wallet, before.wallet);
  for (const key of ["stage", "revealed", "firsts", "lastLead"] as const) {
    assert.deepEqual(after.lis[KAI]![key], before.lis[KAI]![key], key);
  }
  assert.deepEqual(grant(after, { source: "date", li: KAI, affection: 100, starlight: 120 }, DAY).granted, {
    starlight: 0,
    affection: 0,
  });
  const done = readBeatToEnd(after, chapter({ nodes: chapter().nodes.slice(0, 1) }), 0, { at: AT, dayKey: DAY });
  assert.equal(done.state.lis[KAI]!.points, 1080);
  assert.equal(done.state.lis[MIR]!.points, 60);
  assert.equal(done.state.wallet.starlight, before.wallet.starlight + 190);
  assert.equal(done.state.daily, before.daily);
  assert.equal(done.state.chapters["main-1"]!.completed, AT);
  assert.deepEqual(readBeatToEnd(saved(done.state), chapter(), 0, { at: AT, dayKey: DAY }).grants, []);
});

test("daily caps follow the player's own midnight in each time zone", (t) => {
  // 03:30 UTC on 28 October 2026 is 23:30 on the 27th in New York (EDT) and 12:30 on the 28th in Tokyo.
  const late = Date.parse("2026-10-28T03:30:00.000Z");
  let now = late;
  t.mock.method(Date, "now", () => now);
  const handlers: Record<string, (request: unknown) => unknown> = {};
  const router = forgeTimeZoneRoutes({
    get: (path: string, handler: (request: unknown) => unknown) => void (handlers[`GET ${path}`] = handler),
    post: (path: string, handler: (request: unknown) => unknown) => void (handlers[`POST ${path}`] = handler),
  });
  router.post("/run", (request: { body: { run: () => unknown } }) => request.body.run());
  const inZone = <T>(timeZone: string, run: () => T) => handlers["POST /run"]!({ body: { timeZone, run } }) as T;

  for (const zone of ["America/New_York", "Asia/Tokyo"]) {
    now = late;
    let state = fresh();
    const earn = (request: Parameters<typeof grant>[1]) =>
      inZone(zone, () => {
        const result = grant(state, request);
        state = result.state;
        return result.granted;
      });
    const dates = [1, 2, 3, 4].map(() => earn({ source: "date", starlight: 120, li: KAI, affection: 100 }));
    assert.deepEqual(dates, [
      { starlight: 120, affection: 100 },
      { starlight: 120, affection: 100 },
      { starlight: 120, affection: 100 },
      { starlight: 40, affection: 0 },
    ]);
    assert.deepEqual(earn({ source: "read-him", starlight: 40, li: MIR, affection: 40 }), {
      starlight: 0,
      affection: 40,
    });
    // Story earnings are never capped.
    assert.deepEqual(earn({ source: "chapter", starlight: 160, li: KAI, affection: 150 }), {
      starlight: 160,
      affection: 150,
    });
    assert.equal(state.wallet.starlight, 2000 + 400 + 160);
    assert.equal(state.lis[KAI]!.points, 450);
    assert.equal(state.daily.dayKey, zone === "America/New_York" ? "2026-10-27" : "2026-10-28");

    now = late + 60 * 60 * 1000; // 00:30 in New York, a new day; 13:30 in Tokyo, the same day
    const next = earn({ source: "date", starlight: 120, li: KAI, affection: 100 });
    assert.deepEqual(
      next,
      zone === "America/New_York" ? { starlight: 120, affection: 100 } : { starlight: 0, affection: 0 },
      zone,
    );
  }
});
