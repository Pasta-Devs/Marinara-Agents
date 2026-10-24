// Deterministic UI/clock boundaries and the real shipped simulator; no provider or user data is used.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  createForgeCombatDialogue,
  forgeEncounterTier,
  forgeEnemyTier,
  forgeEnemyTierBadge,
  forgeEnemyTierLabel,
} from "../packages/gacha-forge/src/enemy-encounters-client.mjs";
import { ForgeAudioController } from "../packages/gacha-forge/src/audio-client.mjs";
import { forgeEnemyTier as serverEnemyTier } from "../packages/gacha-forge/src/enemy-encounters-server.mjs";

const original = {
  document: globalThis.document,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  getComputedStyle: globalThis.getComputedStyle,
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const clone = (value) => JSON.parse(JSON.stringify(value));
const enemy = { id: "enemy-0", name: "Captain Arden", tier: "boss", characterId: "cast-arden" };
const cue = (trigger, extra = {}) => ({ speaker: enemy.id, content: trigger, type: "main", trigger, ...extra });
let count = 0;
async function test(name, callback) {
  await callback();
  console.info(`ok ${++count} - ${name}`);
}

class Element extends EventTarget {
  constructor(tag = "div") {
    super();
    this.tag = tag;
    this.dataset = {};
    this.children = [];
    this.attributes = {};
    this.hidden = false;
    this.style = {};
    this.classList = {
      add() {},
      remove() {},
      contains() {
        return false;
      },
      toggle() {},
    };
  }
  set innerHTML(value) {
    this.markup = value;
    this.parts = { b: new Element("b"), p: new Element("p"), button: new Element("button") };
    for (const part of Object.values(this.parts)) part.parent = this;
  }
  querySelector(selector) {
    return this.parts?.[selector] || null;
  }
  querySelectorAll() {
    return [];
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  append(child) {
    child.parent = this;
    this.children.push(child);
  }
  remove() {
    this.removed = true;
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
  }
  get isConnected() {
    return !this.removed && (!this.parent || this.parent.isConnected);
  }
  getClientRects() {
    return this.hidden || !this.isConnected ? [] : [{}];
  }
  contains(element) {
    return (
      !!element &&
      (element === this ||
        Object.values(this.parts || {}).some((part) => part.contains(element)) ||
        this.children.some((child) => child.contains(element)))
    );
  }
  getRootNode() {
    return this.parent?.getRootNode() || this.ownerRoot || this;
  }
  focus() {
    this.focusCalls = (this.focusCalls || 0) + 1;
    this.getRootNode().activeElement = this;
  }
  click() {
    this.dispatchEvent(new Event("click"));
  }
}

function clock() {
  let time = 0;
  let next = 0;
  const pending = new Map();
  globalThis.setTimeout = (callback, delay = 0) => {
    pending.set(++next, { callback, at: time + delay });
    return next;
  };
  globalThis.clearTimeout = (id) => pending.delete(id);
  return {
    pending,
    async advance(ms) {
      const end = time + ms;
      for (let i = 0; i < 100; i += 1) {
        const first = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (!first || first[1].at > end) {
          time = end;
          return;
        }
        time = first[1].at;
        pending.delete(first[0]);
        first[1].callback();
        await tick();
      }
      assert.fail("Unexpected repeating combat-dialogue timer");
    },
  };
}

function harness(cues, options = {}) {
  const screen = new Element();
  const autoButton = new Element("button");
  const root = {
    activeElement: null,
    querySelector: (selector) => ({ ".screen": screen, "[data-auto]": autoButton })[selector] || null,
    querySelectorAll: () => [],
  };
  screen.ownerRoot = root;
  autoButton.ownerRoot = root;
  const run = options.run || { auto: false };
  const spoken = [];
  let resumed = 0;
  let paused = false;
  const host = { _run: { audio: { autoplayPauseSeconds: 2 } } };
  const audio = {
    speak: (...args) => {
      spoken.push(args);
      return options.voice?.(...args);
    },
  };
  const controller = createForgeCombatDialogue(root, {
    payload: { enemies: options.enemies || [enemy], dialogueCues: cues },
    run,
    host,
    audio,
    resume: () => {
      resumed += 1;
    },
    isPaused: () => paused,
  });
  return {
    controller,
    root,
    run,
    screen,
    autoButton,
    spoken,
    host,
    get resumed() {
      return resumed;
    },
    get panel() {
      return screen.children[0];
    },
    text() {
      return this.panel?.querySelector("p").textContent;
    },
    next() {
      this.panel.querySelector("button").click();
    },
    pause(value) {
      paused = value;
      controller.syncAuto();
    },
  };
}

try {
  globalThis.document = { createElement: (tag) => new Element(tag) };
  globalThis.getComputedStyle = () => ({ visibility: "visible" });
  await test("Soldier legacy fallback, explicit Elite/Boss and Tower mechanics agree across tier helpers", () => {
    assert.equal(forgeEnemyTier({}), "soldier");
    assert.equal(forgeEnemyTier({ tier: "invalid" }), "soldier");
    assert.equal(forgeEnemyTier({ tier: "elite" }), "elite");
    assert.equal(forgeEnemyTier({ tier: "boss" }), "boss");
    assert.equal(forgeEnemyTier({ tier: "soldier", mech: ["phases"] }), "soldier");
    assert.equal(forgeEnemyTier({ tier: "elite", mech: ["phases"] }), "elite");
    assert.equal(forgeEnemyTier({ mech: ["unknown"] }), "soldier");
    assert.equal(forgeEnemyTier({ mech: ["phases"] }), "boss");
    for (const tier of [undefined, "invalid", "soldier", "elite", "boss"]) {
      for (const mech of [undefined, [], ["unknown"], ["phases"], ["charge", "unknown"]]) {
        assert.equal(forgeEnemyTier({ tier, mech }), serverEnemyTier({ tier, mech }));
      }
    }
    assert.equal(forgeEnemyTierLabel({ tier: "elite" }), "Elite");
    assert.equal(forgeEncounterTier({ enemies: [{}, { tier: "elite" }] }), "elite");
    assert.equal(forgeEncounterTier({ enemies: [{ tier: "elite" }, { mech: ["charge"] }] }), "boss");
    assert.match(forgeEnemyTierBadge(enemy), /data-forge-tier="boss">Boss</u);
  });
  await test("Blocking focus enters once per queue, restores a visible prior control and falls back after removal", () => {
    clock();
    const h = harness([cue("intro"), cue("intro", { content: "second" })]);
    const prior = new Element("button");
    prior.ownerRoot = h.root;
    prior.focus();
    h.controller.event({ op: "start" });
    const next = h.panel.querySelector("button");
    assert.equal(h.root.activeElement, next);
    assert.equal(next.focusCalls, 1);
    h.next();
    assert.equal(h.root.activeElement, next);
    assert.equal(next.focusCalls, 1, "The next line must not interrupt focus or live announcements");
    h.next();
    assert.equal(h.root.activeElement, prior);
    h.controller.dispose();
    const fallback = harness([cue("intro")]);
    fallback.root.activeElement = prior;
    fallback.controller.event({ op: "start" });
    prior.removed = true;
    fallback.next();
    assert.equal(fallback.root.activeElement, fallback.autoButton);
    fallback.controller.dispose();
    const external = harness([cue("intro")]);
    external.controller.event({ op: "start" });
    external.root.activeElement = null;
    document.activeElement = {};
    external.next();
    assert.equal(
      external.root.activeElement,
      null,
      "Auto must not pull focus from an Engine control outside the package",
    );
    external.controller.dispose();
    const ancestor = harness([cue("intro")]);
    ancestor.controller.event({ op: "start" });
    ancestor.root.activeElement = null;
    document.activeElement = { contains: () => true };
    ancestor.next();
    assert.equal(
      ancestor.root.activeElement,
      ancestor.autoButton,
      "A package ancestor is WebKit's native fallback when inspection closes",
    );
    document.activeElement = undefined;
    ancestor.controller.dispose();
  });
  await test("Enemy inspection defers first focus and Auto restores it after the final timer", async () => {
    const time = clock();
    const h = harness([cue("intro")], { run: { auto: true } });
    const inspector = new Element("button");
    inspector.ownerRoot = h.root;
    inspector.focus();
    h.pause(true);
    h.controller.event({ op: "start" });
    assert.equal(h.root.activeElement, inspector);
    await tick();
    await time.advance(3000);
    assert.equal(h.root.activeElement, inspector);
    h.pause(false);
    assert.equal(h.root.activeElement, h.panel.querySelector("button"));
    // Closing inspection can remove its focused Close button before the Auto timer settles.
    inspector.removed = true;
    h.root.activeElement = null;
    await time.advance(2000);
    assert.equal(h.root.activeElement, h.autoButton);
    h.controller.dispose();
  });
  await test("Only real enemy IDs speak; generated content stays text and Manual never auto-advances", async () => {
    const time = clock();
    const h = harness([
      cue("intro", { content: '<img src=x onerror="attack()">' }),
      cue("intro", { speaker: "ally-0" }),
      cue("intro", { type: "action" }),
    ]);
    h.controller.event({ op: "start" });
    await tick();
    assert.equal(h.text(), '<img src=x onerror="attack()">');
    assert.equal(h.panel.querySelector("b").textContent, enemy.name);
    assert.equal(h.panel.markup.includes("<img"), false);
    assert.equal(h.spoken.length, 1);
    assert.deepEqual(h.spoken[0].slice(0, 2), [{ speaker: enemy.name, text: h.text(), thought: false }, enemy]);
    await time.advance(20_000);
    assert.equal(h.controller.busy, true);
    h.next();
    assert.equal(h.resumed, 1);
    assert.equal(h.run.auto, false);
    h.controller.dispose();
  });
  await test("Real action/hit/charge and crossed HP thresholds queue once without party or replay duplicates", () => {
    clock();
    const triggers = ["attack", "hit", "charge", "phase_75", "phase_50", "phase_25", "low_hp"];
    const h = harness(triggers.map((trigger) => cue(trigger)));
    h.controller.event({ op: "act", id: "ally-0" });
    assert.equal(h.controller.busy, false);
    for (const event of [
      { op: "act", id: enemy.id },
      { op: "ult", id: enemy.id },
      { op: "charge", id: enemy.id },
      { op: "hit", id: enemy.id, hpPct: 20 },
      { op: "hp", id: enemy.id, pct: 20 },
    ])
      h.controller.event(event);
    const heard = [];
    while (h.controller.busy) {
      heard.push(h.text());
      h.next();
    }
    assert.deepEqual(heard, ["attack", "charge", "hit", "phase_75", "phase_50", "phase_25", "low_hp"]);
    h.controller.event({ op: "hit", id: enemy.id, hpPct: 10 });
    assert.equal(h.controller.busy, false);
    h.controller.dispose();
  });
  await test("Intro precedes first-round cues and round/everyNRounds select one first eligible round", () => {
    clock();
    const h = harness([cue("intro"), cue("round", { round: 2, everyNRounds: 2 })]);
    h.controller.frame({ round: 1, events: [{ op: "start" }] });
    h.controller.event({ op: "start" });
    assert.equal(h.run._forgeDialogue.queue.length, 1);
    assert.equal(h.text(), "intro");
    h.next();
    h.controller.frame({ round: 2 });
    assert.equal(h.text(), "round");
    h.next();
    h.controller.frame({ round: 4 });
    assert.equal(h.controller.busy, false);
    h.controller.dispose();
    const deadBoss = harness([cue("round", { round: 2 })], {
      enemies: [enemy, { id: "enemy-1", name: "Living escort", tier: "soldier" }],
    });
    deadBoss.controller.event({ op: "hp", id: enemy.id, pct: 0 });
    deadBoss.controller.event({ op: "hp", id: "enemy-1", pct: 100 });
    deadBoss.controller.frame({ round: 2 });
    assert.equal(deadBoss.controller.busy, false, "A defeated boss cannot speak on a later escort-only round");
    deadBoss.controller.dispose();
  });
  await test("Auto waits for voice settlement and the reading pause, then resumes its original intent", async () => {
    const time = clock();
    let settle;
    const h = harness([cue("intro")], {
      run: { auto: true },
      voice: () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    });
    h.controller.event({ op: "start" });
    await tick();
    await time.advance(10_000);
    assert.equal(h.controller.busy, true);
    settle();
    await tick();
    await time.advance(1999);
    assert.equal(h.controller.busy, true);
    await time.advance(1);
    assert.equal(h.controller.busy, false);
    assert.equal(h.resumed, 1);
    assert.equal(h.run.auto, true);
    h.controller.dispose();
  });
  await test("Turning Auto off and foe-sheet pause prevent a queued timer from advancing dialogue", async () => {
    const time = clock();
    const h = harness([cue("intro")], { run: { auto: true } });
    h.controller.event({ op: "start" });
    await tick();
    h.run.auto = false;
    h.autoButton.click();
    await time.advance(10_000);
    assert.equal(h.controller.busy, true);
    h.run.auto = true;
    h.autoButton.click();
    h.pause(true);
    await time.advance(10_000);
    assert.equal(h.controller.busy, true);
    h.pause(false);
    await time.advance(2000);
    assert.equal(h.controller.busy, false);
    assert.equal(h.run.auto, true);
    h.controller.dispose();
  });
  await test("Voice rejection and muted/thought lines retain a working manual Continue", async () => {
    clock();
    const h = harness([cue("intro", { type: "thought" })], {
      voice: () => Promise.reject(new Error("fixture voice unavailable")),
    });
    h.controller.event({ op: "start" });
    await tick();
    assert.equal(h.spoken[0][0].thought, true);
    h.next();
    assert.equal(h.controller.busy, false);
    await ForgeAudioController.prototype.speak.call(
      {
        settings: { tts: true, muted: true, dialogueVolume: 1 },
        tts: { speakSequence: () => assert.fail("Muted speech must not play") },
      },
      { speaker: enemy.name, text: "muted" },
      enemy,
    );
    h.controller.dispose();
  });
  await test("Fullscreen remount retains unread and queued lines without replaying voice or stale callbacks", async () => {
    const time = clock();
    const h = harness([cue("intro"), cue("victory", { content: "I concede." })]);
    h.controller.event({ op: "start" });
    await tick();
    const signal = h.spoken[0][2];
    h.controller.finish("win", () => assert.fail("Disposed callback must not finish combat"));
    h.controller.dispose();
    assert.equal(signal.aborted, true);
    assert.equal(time.pending.size, 0);
    const again = harness([cue("intro"), cue("victory", { content: "I concede." })], { run: h.run });
    await tick();
    assert.equal(again.text(), "intro");
    assert.equal(again.spoken.length, 0);
    let finished = 0;
    again.controller.finish("win", () => {
      finished += 1;
    });
    again.next();
    assert.equal(again.text(), "I concede.");
    assert.equal(finished, 0);
    again.next();
    assert.equal(finished, 1);
    again.controller.finish("win", () => {
      finished += 1;
    });
    assert.equal(finished, 1);
    again.controller.dispose();
  });
  await test("Player victory queues boss concession; player defeat queues boss taunt before completion", () => {
    clock();
    for (const [result, expected] of [
      ["win", "I concede."],
      ["lose", "You have lost."],
    ]) {
      const h = harness([cue("victory", { content: "I concede." }), cue("defeat", { content: "You have lost." })]);
      let finished = 0;
      h.controller.finish(result, () => {
        finished += 1;
      });
      assert.equal(h.text(), expected);
      assert.equal(finished, 0);
      h.next();
      assert.equal(finished, 1);
      h.controller.dispose();
    }
  });
  await test("Encounters without cues add no pause or UI, and disposal fences delayed voice completion", async () => {
    const time = clock();
    const h = harness([]);
    h.controller.frame({ round: 1 });
    h.controller.event({ op: "start" });
    assert.equal(h.controller.busy, false);
    assert.equal(h.panel, undefined);
    let finished = 0;
    h.controller.finish("win", () => {
      finished += 1;
    });
    assert.equal(finished, 1);
    h.controller.dispose();
    let settle;
    const pending = harness([cue("intro")], {
      run: { auto: true },
      voice: () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    });
    pending.controller.event({ op: "start" });
    await tick();
    pending.controller.dispose();
    settle();
    await tick();
    assert.equal(time.pending.size, 0);
    assert.equal(pending.resumed, 0);
  });
  await test("The real combat runner pauses an unread Auto defeat line while inspecting a living enemy", async () => {
    const time = clock();
    const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
    const start = source.indexOf("function Vu(");
    const end = source.indexOf("var Zu=Z,", start);
    assert.ok(start >= 0 && end > start, "Extract the actual shipped combat runner");
    const screen = new Element();
    const inspect = new Element("button");
    inspect.setAttribute("data-foe-inspect", enemy.id);
    const enemyCard = new Element();
    enemyCard.dataset.id = enemy.id;
    const root = new Element();
    const close = new Element("button");
    let sheet = null;
    root.querySelector = (selector) =>
      selector === ".screen" ? screen : selector.startsWith("[data-foe-sheet]") ? sheet : null;
    root.querySelectorAll = (selector) =>
      selector === "[data-foe-inspect]" ? [inspect] : selector === ".side.enemies .cbt:not(.dead)" ? [enemyCard] : [];
    root.insertAdjacentHTML = () => {
      sheet = new Element();
      sheet.setAttribute("data-foe-id", enemy.id);
      sheet.querySelectorAll = (selector) => (selector === "[data-foe-close]" ? [close] : []);
    };
    const runner = vm.runInNewContext(`(${source.slice(start, end)})`, {
      createForgeCombatDialogue,
      setTimeout,
      clearTimeout,
      matchMedia: () => ({ matches: true }),
      rl: () => ({}),
      Uw: () => ({}),
    });
    const run = { steps: [], stepI: 0, auto: true, done: { result: "lose", log: [] }, pending: null };
    let finished = 0;
    const cleanup = runner(root, {
      phase: "battle",
      payload: { allies: [], enemies: [enemy], dialogueCues: [cue("defeat")] },
      run,
      host: { _run: { audio: { autoplayPauseSeconds: 2 } } },
      foeSheet: () => "<section>Enemy details</section>",
      onFinished: () => {
        finished += 1;
      },
    });
    try {
      await tick();
      assert.equal(run._forgeDialogue.queue.length, 1);
      inspect.click();
      assert.ok(sheet, "The real runner must open the enemy detail sheet");
      await time.advance(3000);
      assert.equal(finished, 0, "An unread defeat line must not finish combat behind an open enemy detail sheet");
      assert.equal(run._forgeDialogue.queue.length, 1);
      close.click();
      await time.advance(1999);
      assert.equal(finished, 0);
      await time.advance(1);
      assert.equal(finished, 1, "Closing inspection resumes the same Auto intent after reading the line");
      assert.equal(run.auto, true);
    } finally {
      cleanup();
    }
    assert.equal(time.pending.size, 0);
  });
  await test("An actual enemy-first instant loss honors saved Auto for active playback and preserves manual result replay", async () => {
    const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
    for (const [result, savedAuto] of [
      [null, true],
      ["lose", true],
      [null, false],
    ]) {
      const time = clock();
      const screen = new Element();
      const auto = new Element("button");
      const root = new Element();
      root.querySelector = (selector) => (selector === ".screen" ? screen : selector === "[data-auto]" ? auto : null);
      const context = vm.createContext({
        HTMLElement: class {},
        console,
        document: globalThis.document,
        getComputedStyle: globalThis.getComputedStyle,
        setTimeout,
        clearTimeout,
        AbortController,
        URL,
        crypto: globalThis.crypto,
        matchMedia: () => ({ matches: true }),
      });
      const { Gu, Vu } = vm.runInContext(source + "\n;({Gu,Vu})", context);
      const hero = {
        id: "hero",
        name: "Hero",
        role: "Warrior",
        affinity: "fire",
        power: 1,
        stats: { hp: 1, atk: 1, def: 1, spd: 1 },
      };
      const boss = {
        ...enemy,
        role: "Warrior",
        affinity: "fire",
        power: 1000,
        stats: { hp: 10000, atk: 10000, def: 1, spd: 200 },
      };
      const payload = { allies: [hero], enemies: [boss], dialogueCues: [cue("intro"), cue("defeat")] };
      const run = Gu({ ...payload, seed: 1 });
      assert.equal(run.done?.result, "lose", "The real simulator must finish before the first player turn");
      assert.equal(run.pending, null);
      assert.equal(run.done.log.length, 0);
      let finished = 0;
      const cleanup = Vu(root, {
        phase: "battle",
        payload,
        run,
        result,
        prefs: { auto: savedAuto },
        host: { _run: { audio: { autoplayPauseSeconds: 2 } } },
        onFinished: () => {
          finished += 1;
        },
      });
      try {
        await tick();
        const activeAuto = !result && savedAuto;
        assert.equal(run.auto, activeAuto, "Simulation completion must not suppress saved Auto on active playback");
        await time.advance(50_000);
        assert.equal(finished, activeAuto ? 1 : 0);
        assert.equal(run.done.log.length, 0, "Presentation must not add or regenerate player commands");
        if (!activeAuto) assert.equal(run._forgeDialogue.queue.length, 1);
      } finally {
        cleanup();
      }
      assert.equal(time.pending.size, 0);
    }
  });
} finally {
  Object.assign(globalThis, original);
}

await test("The rebuilt simulator keeps commands/results identical and stamps real render rounds", async () => {
  const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  const context = vm.createContext({
    HTMLElement: class {},
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    URL,
    crypto: globalThis.crypto,
  });
  const { Gu, Lo, jr, ju, Gw, em } = vm.runInContext(source + "\n;({Gu,Lo,jr,ju,Gw,em})", context);
  const actor = (id) => ({
    id,
    name: id,
    affinity: "fire",
    role: "Warrior",
    power: 1,
    stats: { hp: 50, atk: 50, def: 50, spd: 50 },
  });
  for (const seed of [1, 42, 123456]) {
    const base = { allies: [actor("ally-0")], enemies: [{ ...actor(enemy.id), name: enemy.name }], seed };
    const regular = Gu(base);
    const withDialogue = Gu({ ...base, enemies: [{ ...base.enemies[0], ...enemy }], dialogueCues: [cue("intro")] });
    while (!regular.done) Lo(regular, jr);
    while (!withDialogue.done) Lo(withDialogue, jr);
    assert.deepEqual(
      clone(withDialogue.done),
      clone(regular.done),
      "Dialogue metadata must not alter deterministic simulation or command verification",
    );
    assert.ok(
      withDialogue.steps.every((frame) => Number.isInteger(frame.round) && frame.round >= 1),
      "Generated render frames need actual round metadata",
    );
    assert.ok(
      withDialogue.steps.some((frame) => frame.round > 1),
      "Fixture must exercise a later round",
    );
  }
  assert.match(Gw(enemy, true), /data-forge-tier="boss"/u);
  assert.doesNotMatch(Gw(enemy, false), /data-forge-tier/u);
  assert.match(ju({ phase: "battle", payload: { allies: [], enemies: [enemy] } }), /data-boss="enemy-0"/u);
  assert.match(
    ju({ phase: "prebattle", payload: { allies: [], enemies: [{ ...enemy, tier: "elite" }] } }),
    /data-forge-tier="elite"/u,
  );
  assert.match(em({ foes: [enemy] }), /class="kick">Boss</u);
});
console.info(`Gacha combat dialogue: ${count} controls passed.`);
