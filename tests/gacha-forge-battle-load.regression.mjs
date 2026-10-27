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
].join("");
const combatKeyExpr = cut("`combat:${this._combatPhase}", ':e==="unit"?');
const { waitForgeFormationSave } = new Function(
  `${cut("const forgeFormationSaving = (host) =>", "// Reopening Formation")};return { waitForgeFormationSave };`,
)();
const ef = new Function(`${cut("function ef(", "function Ja(")};return ef`)();
const provided = { waitForgeFormationSave, ef, forgeWarmCombatVoices() {}, Wt: () => false };
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

test("farm fight left while loading, tower fight entered: the farm reply neither shows nor frees the lock early", async () => {
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
      afterA: { view: "combat", phase: "loading", fight: "Floor 7", payload: null, error: "", farmBusy: true },
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

test("the farm lock: blocked while its load runs, never stuck once every abandoned load has replied", async () => {
  const h = host();
  farmFight(h, "xp");
  h._exitCombat(false);
  h._farmRun({ stage: "funds", difficulty: 1, family: "" });
  const blocked = h._hudView === "farm";
  await h.land(0, ok("farm A"));
  h._farmRun({ stage: "funds", difficulty: 1, family: "" });
  const reopened = h._hudView;
  // A farm load abandoned for a story fight that is itself abandoned: the last reply frees the lock.
  const g = host();
  farmFight(g, "xp");
  g._exitCombat(false);
  storyFight(g, 0, "C");
  await g.land(0, ok("farm B"));
  const whileC = g._farmBusy;
  g._exitCombat(false);
  await g.land(1, ok("C"));
  assert.deepEqual(
    { blocked, reopened, whileC, end: g._farmBusy, gView: g._hudView, gDrawn: g.drawn.at(-1) },
    { blocked: true, reopened: "formation", whileC: true, end: false, gView: "chapter", gDrawn: "chapter" },
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
