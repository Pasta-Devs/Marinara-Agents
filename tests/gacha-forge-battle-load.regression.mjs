// #1757: slices the shipped battle entry, load, leave and farm methods out of client.js and drives them against a fake
// server whose replies the test releases in any order. The render stub mirrors the bundle: it skips when the combat
// render key is unchanged, and a drawn combat screen in phase "loading" calls _loadBattle(), as the combat wiring does.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
const cut = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `slice ${from}`);
  assert.equal(source.indexOf(from, start + 1), -1, `slice anchor unique: ${from}`);
  return source.slice(start, end);
};
// The combat wiring really does this after drawing the combat screen; pin it so the stub cannot drift.
assert.ok(source.includes("onRetry:()=>this._loadBattle(),foeSheet:em,onBack:()=>this._exitCombat(!1)"));
assert.ok(source.includes('}}),this._combatPhase==="loading"&&this._loadBattle();else if(e==="forge")'));

const methods = [
  cut("_openCombat(e){", "_enterBattle(){"),
  cut("_enterBattle(){", "_combatFinished(e){"),
  cut("_exitCombat(e){", "_completeCombatNode(){"),
  cut("_farmRun(e,a=null){", "_claimFarm(){"),
  cut("_seasonalRun(e,a=null){", "_seasonalLabel(){"),
  cut("_towerFight(){", "_claimTower(){"),
  cut("_resultAgain(){", "_loadContinuity(){"),
  cut("_initState(){", "get capabilityProps(){"),
  // The shipped Start battle; host() stubs it, and a test deletes the stub to press the real one.
  cut("_vigorView(){", "_feedRoom(e){"),
].join("");
const combatKeyExpr = cut("`combat:${this._combatPhase}", ':e==="unit"?');
const { waitForgeFormationSave } = new Function(
  `${cut("const forgeFormationSaving = (host) =>", "// Reopening Formation")};return { waitForgeFormationSave };`,
)();
const ef = new Function(`${cut("function ef(", "function Ja(")};return ef`)();
const forgeChapterCurrent = new Function(
  `${cut("function forgeChapterCurrent(host) {", "function forgeChapterResetTarget(")};return forgeChapterCurrent`,
)();
const provided = {
  waitForgeFormationSave,
  ef,
  forgeChapterCurrent,
  forgeWarmCombatVoices: (host) => (host.warmed = (host.warmed || 0) + 1),
  Wt: () => false,
};
// Free names the sliced _initState touches (Br, Ka, small wiring helpers) resolve to harmless stubs.
const scope = new Proxy(provided, {
  has: (target, key) => typeof key === "string" && (key in target || !(key in globalThis)),
  get: (target, key) => (key === Symbol.unscopables ? undefined : key in target ? target[key] : () => undefined),
});
const Host = new Function("scope", `with (scope) { return class { ${methods} }; }`)(scope);
const combatKey = new Function(`return ${combatKeyExpr}`);

const flush = async () => {
  for (let index = 0; index < 8; index += 1) await new Promise((resolve) => setImmediate(resolve));
};
const ok = (fight, activePreset = 0) => ({ ok: true, fight, allies: [], enemies: [], activePreset, battleKey: fight });

function host() {
  const h = new Host();
  Object.assign(h, {
    _run: { runId: "r1" },
    _difficulty: "normal",
    _chapterProgress: { normal: 0 },
    _planChapter: 2,
    _hudView: "chapter",
    _combatPhase: "loading",
    _battleLoading: false,
    _farmBusy: false,
    _towerBusy: false,
    _towerHalves: [0, 1],
    _renderKey: null,
    calls: [],
    started: [],
    drawn: [],
    _readCombatPrefs() {
      return {};
    },
    _postJson(path, body) {
      let resolve;
      const reply = new Promise((done) => (resolve = done));
      this.calls.push({ path, body, resolve });
      return reply;
    },
    _startBattle() {
      this.started.push(this._combatNode?.title);
    },
    _stopCombat() {},
    _loadFarm() {},
    _loadTower() {},
    _towerFollow() {},
    _towerFloorN() {
      return 7;
    },
    _againVigor() {
      return null;
    },
    _seasonalLabel() {
      return "Seasonal Event";
    },
    _renderBrowser() {
      const view = this._hudView;
      const key = view === "combat" ? combatKey.call(this) : view;
      if (key === this._renderKey) return;
      this._renderKey = key;
      this.drawn.push(
        view === "combat"
          ? `combat:${this._autoStarting ? "loading" : this._combatPhase}:${this._combatNode?.title}:${this._combat?.fight ?? "-"}`
          : view,
      );
      if (view === "combat" && this._combatPhase === "loading") this._loadBattle();
    },
  });
  h.land = async (index, payload) => {
    h.calls[index]?.resolve(payload);
    await flush();
  };
  h.screen = () => ({
    view: h._hudView,
    phase: h._combatPhase,
    fight: h._combatNode?.title ?? null,
    payload: h._combat?.fight ?? null,
    error: h._combatError ?? "",
  });
  return h;
}
// The Formation screen's "Into battle" button.
const storyFight = (h, combatIndex, title) => (h._openCombat({ combatIndex, title }), h._enterBattle());
const farmFight = (h, stage) => (h._farmRun({ stage, difficulty: 1, family: "" }), h._enterBattle());

test("enter A, leave while A loads, enter B: A's late reply is ignored and B is loaded and shown", async () => {
  const h = host();
  storyFight(h, 0, "A");
  h._exitCombat(false); // Back on "Preparing the battle..."
  storyFight(h, 1, "B");
  const sent = h.calls.map((call) => `${call.path}#${call.body.combatIndex}`);
  await h.land(0, ok("A"));
  const afterA = { ...h.screen(), drawn: h.drawn.at(-1) };
  await h.land(1, ok("B"));
  assert.deepEqual(
    { sent, afterA, final: { ...h.screen(), drawn: h.drawn.at(-1) }, started: h.started },
    {
      sent: ["/battle#0", "/battle#1"],
      afterA: { view: "combat", phase: "loading", fight: "B", payload: null, error: "", drawn: "combat:loading:B:-" },
      final: { view: "combat", phase: "prebattle", fight: "B", payload: "B", error: "", drawn: "combat:prebattle:B:B" },
      started: [],
    },
  );
});

test("farm fight left while loading, tower fight entered: the farm reply never shows on the tower fight", async () => {
  const h = host();
  farmFight(h, "xp");
  h._exitCombat(false);
  h._towerFight();
  const sent = h.calls.map((call) => call.path);
  await h.land(0, ok("farm A"));
  const afterA = { ...h.screen(), farmBusy: h._farmBusy };
  await h.land(1, ok("tower B"));
  assert.deepEqual(
    { sent, afterA, final: { ...h.screen(), farmBusy: h._farmBusy } },
    {
      sent: ["/farm/battle", "/tower/battle"],
      afterA: { view: "combat", phase: "loading", fight: "Floor 7", payload: null, error: "", farmBusy: false },
      final: { view: "combat", phase: "prebattle", fight: "Floor 7", payload: "tower B", error: "", farmBusy: false },
    },
  );
});

test("a preset change while a load is in flight sends its own request and the older reply cannot undo it", async () => {
  const h = host();
  storyFight(h, 0, "A");
  h._pickCombatPreset(2);
  const sent = h.calls.map((call) => call.body.presetIndex);
  await h.land(0, ok("A team 0", 0));
  const afterOld = { phase: h._combatPhase, preset: h._combatPreset, payload: h._combat?.fight ?? null };
  await h.land(1, ok("A team 2", 2));
  assert.deepEqual(
    { sent, afterOld, final: { phase: h._combatPhase, preset: h._combatPreset, payload: h._combat?.fight ?? null } },
    {
      sent: [null, 2],
      afterOld: { phase: "loading", preset: 2, payload: null },
      final: { phase: "prebattle", preset: 2, payload: "A team 2" },
    },
  );
  // The reachable case, a pick from the briefing once the team is shown, works before and after the fix.
  const g = host();
  storyFight(g, 0, "A");
  await g.land(0, ok("A team 0", 0));
  g._pickCombatPreset(1);
  await g.land(1, ok("A team 1", 1));
  assert.deepEqual([g.calls.length, g._combatPreset, g._combat.fight], [2, 1, "A team 1"]);
});

test("farm repeat after an abandoned load: only the repeat's own reply auto-starts, with its own fight", async () => {
  const h = host();
  storyFight(h, 0, "A");
  h._exitCombat(false);
  h._result = { again: { stage: "xp", difficulty: 1, family: "" }, back: "farm", againPreset: 1, canReplay: true };
  h._resultAgain(); // "Again" on a farm result: autoStart with the same team
  const sent = h.calls.map((call) => `${call.path}:${call.body.presetIndex}`);
  await h.land(0, ok("A"));
  const afterA = { started: [...h.started], autoStarting: !!h._autoStarting, fight: h._combatNode?.title };
  await h.land(1, ok("farm B", 1));
  assert.deepEqual(
    { sent, afterA, final: { started: h.started, autoStarting: !!h._autoStarting, fight: h._combatNode?.title } },
    {
      sent: ["/battle:null", "/farm/battle:1"],
      afterA: { started: [], autoStarting: false, fight: "Materials" },
      final: { started: ["Materials"], autoStarting: true, fight: "Materials" },
    },
  );
});

test("an abandoned farm-repeat load never auto-starts on the fight the player is now in", async () => {
  // The autoStart loading screen hides Back, so this exit is programmatic: it pins that a stale autoStart
  // reply cannot set _autoStarting or call _startBattle.
  const h = host();
  h._result = { again: { stage: "xp", difficulty: 1, family: "" }, back: "farm", againPreset: 1, canReplay: true };
  h._resultAgain();
  h._leaveCombat("farm");
  storyFight(h, 1, "B");
  await h.land(0, ok("farm A", 1));
  const afterA = { started: [...h.started], autoStarting: !!h._autoStarting, ...h.screen() };
  await h.land(1, ok("B"));
  assert.deepEqual(
    { afterA, final: { started: h.started, autoStarting: !!h._autoStarting, ...h.screen() } },
    {
      afterA: {
        started: [],
        autoStarting: false,
        view: "combat",
        phase: "loading",
        fight: "B",
        payload: null,
        error: "",
      },
      final: {
        started: [],
        autoStarting: false,
        view: "combat",
        phase: "prebattle",
        fight: "B",
        payload: "B",
        error: "",
      },
    },
  );
});

test("an error reply for the abandoned fight is ignored; the current fight's own error still shows and retries", async () => {
  const h = host();
  storyFight(h, 0, "A");
  h._exitCombat(false);
  storyFight(h, 1, "B");
  await h.land(0, { ok: false, error: "empty-party" });
  const afterA = h.screen();
  await h.land(1, { ok: false, error: "failed" });
  const afterB = { ...h.screen(), loading: h._battleLoading };
  h._loadBattle(); // the Retry button
  assert.deepEqual(
    { afterA, afterB, retried: h.calls.at(-1)?.body.combatIndex ?? null, calls: h.calls.length },
    {
      afterA: { view: "combat", phase: "loading", fight: "B", payload: null, error: "" },
      afterB: { view: "combat", phase: "error", fight: "B", payload: null, error: "failed", loading: false },
      retried: 1,
      calls: 3,
    },
  );
});

test("the farm lock holds while a farm load runs and is freed by Back, even when that load never answers", async () => {
  const h = host();
  farmFight(h, "xp"); // never answered
  h._farmRun({ stage: "funds", difficulty: 1, family: "" });
  const blocked = h.calls.length === 1 && h._hudView === "combat";
  h._exitCombat(false);
  h._farmRun({ stage: "funds", difficulty: 1, family: "" });
  const reopened = h._hudView;
  h._exitCombat(false);
  h._hudView = "events";
  h._seasonalRun(3);
  const seasonal = h._hudView;
  // A farm load abandoned for a story fight that is itself abandoned: its late reply touches nothing.
  const g = host();
  farmFight(g, "xp");
  g._exitCombat(false);
  storyFight(g, 0, "C");
  await g.land(0, ok("farm B"));
  const whileC = g._farmBusy;
  g._exitCombat(false);
  await g.land(1, ok("C"));
  assert.deepEqual(
    { blocked, reopened, seasonal, whileC, end: g._farmBusy, gView: g._hudView, gDrawn: g.drawn.at(-1) },
    {
      blocked: true,
      reopened: "formation",
      seasonal: "formation",
      whileC: false,
      end: false,
      gView: "chapter",
      gDrawn: "chapter",
    },
  );
});

test("Back while a fight loads: its late reply never fills the fight, starts it or warms its voices", async () => {
  const h = host();
  storyFight(h, 0, "A");
  h._exitCombat(false);
  await h.land(0, ok("A"));
  const g = host();
  g._result = { again: { stage: "xp", difficulty: 1, family: "" }, back: "farm", againPreset: 1, canReplay: true };
  g._resultAgain(); // auto-starting load
  g._leaveCombat("farm");
  await g.land(0, ok("farm A", 1));
  const state = (x) => ({
    view: x._hudView,
    phase: x._combatPhase,
    combat: x._combat,
    autoStarting: !!x._autoStarting,
    started: x.started.length,
    warmed: x.warmed || 0,
  });
  assert.deepEqual(
    [state(h), state(g)],
    [
      { view: "chapter", phase: "loading", combat: null, autoStarting: false, started: 0, warmed: 0 },
      { view: "farm", phase: "loading", combat: null, autoStarting: false, started: 0, warmed: 0 },
    ],
  );
});

test("a fight entered while a team save is pending loads after the save, and an abandoned reply cannot pre-empt it", async () => {
  const h = host();
  storyFight(h, 0, "A");
  h._exitCombat(false);
  let saved;
  h._formationSaves = new Map([["r1", { running: new Promise((done) => (saved = done)) }]]);
  storyFight(h, 1, "B");
  const beforeSave = h.calls.length;
  await h.land(0, ok("A"));
  const afterA = h.screen();
  h._formationSaves = new Map();
  saved(true);
  await new Promise((resolve) => setImmediate(resolve));
  await h.land(1, ok("B"));
  assert.deepEqual(
    { beforeSave, afterA, final: h.screen(), calls: h.calls.map((call) => call.body.combatIndex) },
    {
      beforeSave: 1,
      afterA: { view: "combat", phase: "loading", fight: "B", payload: null, error: "" },
      final: { view: "combat", phase: "prebattle", fight: "B", payload: "B", error: "" },
      calls: [0, 1],
    },
  );
});

test("a /battle request that never answers no longer blocks every later fight", async () => {
  const h = host();
  storyFight(h, 0, "A"); // never answered
  h._exitCombat(false);
  storyFight(h, 0, "A");
  await h.land(1, ok("A again"));
  assert.deepEqual([h.calls.length, h.screen().payload], [2, "A again"]);
});

test("re-drawing the combat screen while its load runs does not send a duplicate request", async () => {
  const h = host();
  storyFight(h, 0, "A");
  h._hudView = "settings";
  h._renderBrowser();
  h._hudView = "combat"; // back from Settings
  h._renderBrowser();
  await h.land(0, ok("A"));
  assert.deepEqual([h.calls.length, h.screen().phase, h.screen().payload], [1, "prebattle", "A"]);
});

test("switching worlds while a fight loads: the old world's reply never lands in the new one", async () => {
  const h = host();
  storyFight(h, 0, "A");
  h._initState(); // _adoptRun resets the per-world state
  h._run = { runId: "r2" };
  await h.land(0, ok("A"));
  assert.deepEqual([h._combat, h._combatNode, h._combatPhase], [null, null, "loading"]);
});

test("entering the same fight twice, with its screen already drawn, still loads it", async () => {
  const h = host();
  h._openCombat({ combatIndex: 0, title: "A" });
  h._enterBattle();
  h._enterBattle();
  for (let index = 0; index < h.calls.length; index += 1) await h.land(index, ok("A"));
  assert.deepEqual([h.calls.length, h._combatPhase, h._combat?.fight], [2, "prebattle", "A"]);
});

test("a fight that cannot be set up says why: a changed story has its own words, any other failure shows its code", () => {
  assert.ok(source.includes('if (error === "story-changed") return forgeFormationLabel("storyChanged");'));
  assert.match(source, /"combat\.formation\.storyChanged":\s+"The story changed while this page was open\./u);
  assert.ok(
    source.includes(`forgeFormationErrorLabel(o)||"Couldn't set up the battle."+(o?" ("+u(String(o))+")":""))`),
  );
});

test("a refused start says why on the fight screen and Retry loads it again; only no-vigor keeps the briefing", async () => {
  // 1.26.3: a start the server refused (a cleared story event fight answered event-already-played) went to
  // _combatVigorError, which the briefing never draws, so Start battle stayed and did nothing.
  const h = host();
  delete h._startBattle;
  storyFight(h, 0, "A");
  await h.land(0, ok("A"));
  const start = async (reply) => {
    h._startBattle();
    await h.land(h.calls.length - 1, reply);
    return { ...h.screen(), drawn: h.drawn.at(-1), starting: h._combatStarting, vigor: h._combatVigorError?.error };
  };
  const retry = async () => {
    h._loadBattle(); // the error screen's Retry
    await h.land(h.calls.length - 1, ok("A"));
    return h.screen().phase;
  };
  const screen = (phase, error, vigor) => ({
    view: "combat",
    phase,
    fight: "A",
    payload: "A",
    error,
    drawn: `combat:${phase}:A:A`,
    starting: false,
    vigor,
  });
  const refused = await start({ ok: false, error: "event-already-played" });
  const afterRefusal = await retry();
  const dropped = await start(null);
  const afterDrop = await retry();
  const short = await start({ ok: false, error: "no-vigor", cost: 5, vigorNextMs: 60000 });
  assert.deepEqual(
    { sent: h.calls.map((call) => call.path), refused, afterRefusal, dropped, afterDrop, short },
    {
      sent: ["/battle", "/battle/start", "/battle", "/battle/start", "/battle", "/battle/start"],
      refused: screen("error", "event-already-played", undefined),
      afterRefusal: "prebattle",
      dropped: screen("error", "failed", undefined),
      afterDrop: "prebattle",
      short: screen("prebattle", "", "no-vigor"),
    },
  );
});

test("a no-vigor answer stays with the fight it refused: the next fight's briefing reads its own cost", async () => {
  // Before 1.26.3 only a successful start cleared _combatVigorError, so a 10-Vigor Materials start refused for Vigor
  // left "7 of 10" and a disabled Start battle on a 5-Vigor story fight's briefing, though 7 Vigor covers it.
  const h = host();
  delete h._startBattle;
  h._wallet = { vigor: 7 };
  farmFight(h, "xp");
  await h.land(0, { ...ok("farm A"), cost: 10 });
  h._startBattle();
  await h.land(1, { ok: false, error: "no-vigor", cost: 10, vigorNextMs: 60000 });
  const refused = h._vigorView();
  h._exitCombat(false);
  storyFight(h, 0, "B");
  await h.land(2, { ...ok("B"), cost: 5 });
  assert.deepEqual(
    { sent: h.calls.map((call) => call.path), refused, next: { ...h.screen(), vigor: h._vigorView() } },
    {
      sent: ["/farm/battle", "/farm/start", "/battle"],
      refused: { have: 7, cost: 10, nextMs: 60000 },
      next: {
        view: "combat",
        phase: "prebattle",
        fight: "B",
        payload: "B",
        error: "",
        vigor: { have: 7, cost: 5, nextMs: null },
      },
    },
  );
});

test("a start in flight when the world changes: the new world's Start battle sends, and the old reply touches nothing", async () => {
  // _initState never reset _combatStarting, so a chapter start answered after a world switch (null: _postJson drops
  // a reply for a world no longer shown) left every Start battle in the new world doing nothing until a reload. A
  // Materials or Tower start counted as current in any world, so its late reply turned the new fight to an error.
  const results = [];
  for (const [kind, enter] of [
    ["chapter", (h) => storyFight(h, 0, "A")],
    ["farm", (h) => farmFight(h, "xp")],
  ]) {
    const h = host();
    delete h._startBattle;
    enter(h);
    await h.land(0, ok("A"));
    h._startBattle();
    h._initState(); // _adoptRun
    h._run = { runId: "r2" };
    storyFight(h, 1, "C");
    await h.land(2, ok("C"));
    await h.land(1, null);
    const afterOld = h.screen();
    h._startBattle();
    results.push({
      kind,
      sent: h.calls.map((call) => call.path),
      afterOld,
      starting: h._combatStarting,
    });
  }
  const screen = { view: "combat", phase: "prebattle", fight: "C", payload: "C", error: "" };
  assert.deepEqual(results, [
    {
      kind: "chapter",
      sent: ["/battle", "/battle/start", "/battle", "/battle/start"],
      afterOld: screen,
      starting: true,
    },
    {
      kind: "farm",
      sent: ["/farm/battle", "/farm/start", "/battle", "/battle/start"],
      afterOld: screen,
      starting: true,
    },
  ]);
});
