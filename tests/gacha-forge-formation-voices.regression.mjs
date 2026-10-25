// Actual package files plus deterministic host APIs; no providers or personal worlds are used.
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createForgeCombatVoices,
  normalizeForgeCombatVoiceLines,
  forgeCombatVoiceMessages,
} from "../packages/gacha-forge/src/combat-voices-server.mjs";
import {
  createForgeCombatVoiceController,
  createForgeCombatPresentation,
} from "../packages/gacha-forge/src/combat-voices-client.mjs";
import { forgeCombatVoiceEnglish } from "../packages/gacha-forge/src/combat-voices-en.mjs";
import { createForgeUltimatePresentation } from "../packages/gacha-forge/src/combat-ultimate-client.mjs";
import { forgeExplicitVoice, forgeVoiceCacheKey } from "../packages/gacha-forge/src/audio-client.mjs";
import { forgeSoundtrackContextKey, normalizeForgeAudio } from "../packages/gacha-forge/src/audio-settings.mjs";

const original = Object.fromEntries(
  [
    "document",
    "matchMedia",
    "forgeExplicitVoice",
    "forgeVoiceCacheKey",
    "forgeSoundtrackContextKey",
    "forgeCombatVoiceEnglish",
    "createForgeUltimatePresentation",
  ].map((key) => [key, globalThis[key]]),
);
Object.assign(globalThis, {
  forgeExplicitVoice,
  forgeVoiceCacheKey,
  forgeSoundtrackContextKey,
  forgeCombatVoiceEnglish,
  createForgeUltimatePresentation,
});
const roots = [];
const managers = [];
const controllers = [];
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
const lines = {
  death: "Not my last stand.",
  kill: "One less obstacle.",
  ultimateA: "Witness the dawn!",
  ultimateB: "Let it burn bright!",
};
const actor = {
  id: "world:unit:a",
  characterId: "card-a",
  name: "Arden",
  portrait: "/fixture/a.webp",
  affinity: "fire",
};
const context = {
  runId: "world",
  unitId: actor.id,
  characterId: actor.characterId,
  voiceIdentity: "voice-profile-a",
  timeZone: "Europe/Warsaw",
};
const wav = Buffer.alloc(524);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(wav.length - 44, 40);
const base64 = wav.toString("base64");
let cases = 0;
async function test(name, callback) {
  await callback();
  process.stdout.write(`ok ${++cases} - ${name}\n`);
}

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.hidden = false;
    this.style = { setProperty: (key, value) => (this.style[key] = value) };
  }
  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
  addEventListener(key, callback) {
    this.listeners[key] = callback;
  }
  get isConnected() {
    return !!this.parent || this.connected === true;
  }
  focus() {
    assert.fail("Decorative combat presentation must not move keyboard focus");
  }
}
globalThis.document = { createElement: (tag) => new Element(tag) };
globalThis.matchMedia = () => ({ matches: false });

async function server(options = {}) {
  const root = options.root || (await mkdtemp(join(tmpdir(), "forge-formation-voices-")));
  if (!roots.includes(root)) roots.push(root);
  const run = options.run || { combat: { mode: "formation" }, audio: { combatVoices: true } };
  let generations = 0;
  const manager = createForgeCombatVoices({
    dataDir: root,
    runtime: { logger: { warn() {} } },
    readUnit: options.readUnit || (async (_runId, unitId) => (unitId === actor.id ? { run, unit: actor } : null)),
    generateLines: async (input) => {
      generations++;
      return options.generateLines ? options.generateLines(input) : lines;
    },
  });
  managers.push(manager);
  return {
    root,
    run,
    manager,
    get generations() {
      return generations;
    },
  };
}

function client(backend, options = {}) {
  const stage = new Element("main");
  stage.connected = true;
  const root = { querySelector: (selector) => (selector === ".gf-stage" ? stage : null) };
  const host = {
    _run: { runId: "world", combat: { mode: "formation" } },
    _root: root,
    _state: () => "combat",
    _postJson: (path, body) => backend.manager[path.split("/").at(-1)]({ ...body, timeZone: "Europe/Warsaw" }),
  };
  const audio = { settings: normalizeForgeAudio({ combatVoices: true, ...options.audio }), disposed: false };
  const played = [];
  let synthesis = 0;
  let prompts = 0;
  const config = {
    connectionId: "tts-selected",
    connectionProfiles: { "tts-selected": { voiceAssignments: [{ characterId: "card-a", voice: "explicit-a" }] } },
  };
  const services = {
    tts: {
      ttsService: {
        generateAudio: async (...args) => {
          synthesis++;
          return options.generateAudio ? options.generateAudio(...args) : new Blob([wav], { type: "audio/wav" });
        },
      },
    },
    audio: {
      createPlayer: () => ({
        setVolumes() {},
        setMuted() {},
        unlock() {},
        dispose() {},
        playSfx: (...args) => played.push(args),
      }),
    },
    dialogs: {
      showConfirmDialog: async (request) => {
        prompts++;
        assert.match(request.message, /provider credits again/u);
        return options.confirm?.(request) ?? false;
      },
    },
  };
  const controller = createForgeCombatVoiceController({
    host,
    audio,
    services,
    getConfig: options.getConfig || (async () => config),
  });
  controllers.push(controller);
  return {
    host,
    audio,
    stage,
    controller,
    played,
    services,
    config,
    get synthesis() {
      return synthesis;
    },
    get prompts() {
      return prompts;
    },
  };
}

try {
  await test("fixed lines are bounded, use authored canon and require four slots with distinct ultimates", () => {
    assert.deepEqual(normalizeForgeCombatVoiceLines(lines), lines);
    assert.equal(normalizeForgeCombatVoiceLines({ ...lines, ultimateB: lines.ultimateA }), null);
    assert.equal(normalizeForgeCombatVoiceLines({ ...lines, kill: "x".repeat(181) }), null);
    assert.equal(normalizeForgeCombatVoiceLines({ ...lines, scenario: "forbidden" }), null);
    assert.equal(normalizeForgeAudio().combatVoices, false);
    const prompt = forgeCombatVoiceMessages({
      ...actor,
      description: "OLD_SUMMARY",
      scenario: "ROLEPLAY_SCENARIO",
      forgeCardCanon: { description: "AUTHORED_DESCRIPTION", backstory: "AUTHORED_BACKSTORY" },
    });
    assert.match(prompt[1].content, /AUTHORED_DESCRIPTION/u);
    assert.match(prompt[1].content, /AUTHORED_BACKSTORY/u);
    assert.doesNotMatch(prompt[1].content, /OLD_SUMMARY|ROLEPLAY_SCENARIO/u);
  });
  await test("simultaneous requests share one saved line set and clip reservation", async () => {
    const gate = deferred();
    const s = await server({ generateLines: () => gate.promise });
    const first = s.manager.prepare(context);
    const second = s.manager.prepare(context);
    await tick();
    gate.resolve(lines);
    const results = await Promise.all([first, second]);
    assert.equal(s.generations, 1);
    assert(results.every((result) => result.ok && result.clips.length === 4));
    const reservations = await Promise.all([
      s.manager.reserve({ ...context, slot: "death" }),
      s.manager.reserve({ ...context, slot: "death" }),
    ]);
    assert.equal(reservations.filter((result) => result.ok).length, 1);
    assert.equal(reservations.filter((result) => result.retry).length, 1);
    const reserved = reservations.find((result) => result.ok);
    const saved = await s.manager.commit({ ...context, slot: "death", token: reserved.token, base64 });
    assert.equal(saved.ok, true);
    assert.match(saved.url, /\/combat-voices\/file\/[a-f0-9]{64}\/[a-f0-9]{64}\.wav$/u);
    assert.equal(
      (await s.manager.fail({ ...context, slot: "death", token: reserved.token })).error,
      "stale-combat-voice",
    );
    const reopened = await server({ root: s.root });
    const prepared = await reopened.manager.prepare(context);
    assert.equal(reopened.generations, 0);
    assert.equal(prepared.clips.find((clip) => clip.slot === "death").url, saved.url);
  });
  await test("interrupted or corrupt reservations require explicit retry and reject stale commits", async () => {
    const s = await server();
    await s.manager.prepare(context);
    const old = await s.manager.reserve({ ...context, slot: "kill" });
    const reopened = await server({ root: s.root });
    assert.equal((await reopened.manager.reserve({ ...context, slot: "kill" })).retry, true);
    const retry = await reopened.manager.reserve({ ...context, slot: "kill", retry: true });
    assert.notEqual(old.token, retry.token);
    assert.equal(
      (await reopened.manager.commit({ ...context, slot: "kill", token: old.token, base64 })).error,
      "stale-combat-voice",
    );
    assert.equal(
      (await reopened.manager.commit({ ...context, slot: "kill", token: retry.token, base64: "PHNjcmlwdD4=" })).error,
      "bad-audio",
    );
    assert.equal((await reopened.manager.commit({ ...context, slot: "kill", token: retry.token, base64 })).ok, true);
    const voices = join(s.root, "capability-package-data", "gacha-forge", "combat-voices");
    const folder = join(voices, (await readdir(voices))[0]);
    for (const name of await readdir(folder)) {
      if (!name.endsWith(".json")) continue;
      const record = JSON.parse(await readFile(join(folder, name), "utf8"));
      if (record.lines) await writeFile(join(folder, name), "null");
    }
    assert.equal((await reopened.manager.prepare(context)).retry, true);
    assert.equal(reopened.generations, 0, "a malformed saved record is not permission for paid regeneration");
  });
  await test("disabled worlds, wrong character identities and symlink storage perform no model work", async () => {
    const off = await server({ run: { audio: { combatVoices: false }, combat: { mode: "formation" } } });
    assert.equal((await off.manager.prepare(context)).ok, false);
    assert.equal(off.generations, 0);
    const s = await server();
    assert.equal((await s.manager.prepare({ ...context, characterId: "other" })).ok, false);
    assert.equal((await s.manager.prepare({ ...context, unexpected: "ignored?" })).ok, false);
    assert.equal(s.generations, 0);
    const outside = await mkdtemp(join(tmpdir(), "forge-formation-voices-outside-"));
    roots.push(outside);
    await symlink(outside, join(s.root, "capability-package-data"));
    assert.equal((await s.manager.prepare(context)).ok, false);
    assert.equal(s.generations, 0);
    assert.deepEqual(await readdir(outside), []);
  });
  await test("world deletion fences a provider that ignores abort and cannot resurrect files", async () => {
    const gate = deferred();
    const started = deferred();
    const s = await server({
      generateLines: () => {
        started.resolve();
        return gate.promise;
      },
    });
    const request = s.manager.prepare(context);
    await started.promise;
    await s.manager.removeWorld("world");
    gate.resolve(lines);
    assert.equal((await request).ok, false);
    const parent = join(s.root, "capability-package-data", "gacha-forge", "combat-voices");
    assert.deepEqual(await readdir(parent), []);
  });
  await test("four clips are saved once, reused by later controllers and played through the explicit voice", async () => {
    const s = await server();
    const c = client(s);
    await Promise.all([c.controller.warm([actor]), c.controller.warm([actor])]);
    assert.equal(s.generations, 1);
    assert.equal(c.synthesis, 4);
    await c.controller.warm([actor]);
    assert.equal(c.synthesis, 4);
    await c.controller.play(actor, "ultimateA");
    assert.equal(c.played.length, 1);
    const c2 = client(s);
    await c2.controller.warm([actor]);
    assert.equal(c2.synthesis, 0, "saved package clips survive a fresh browser controller");
    await c2.controller.play(actor, "death");
    assert.equal(c2.played.length, 1);
  });
  await test("opt-out, mute, zero dialogue volume and unassigned characters never generate clips", async () => {
    for (const audio of [{ combatVoices: false }, { muted: true }, { dialogueVolume: 0 }]) {
      const s = await server();
      const c = client(s, { audio });
      await c.controller.warm([actor]);
      await c.controller.play(actor, "kill");
      assert.equal(c.synthesis, 0);
      assert.equal(s.generations, 0);
      assert.equal(c.played.length, 0);
    }
    const s = await server();
    const c = client(s);
    await c.controller.warm([{ ...actor, characterId: "unassigned" }]);
    assert.equal(c.synthesis, 0);
    assert.equal(s.generations, 0);
  });
  await test("muting lets a paid clip settle silently without turning the interruption into a retry failure", async () => {
    const s = await server();
    const gate = deferred();
    const started = deferred();
    const c = client(s, {
      generateAudio: (_text, { signal }) => {
        started.resolve();
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
            once: true,
          });
          gate.promise.then(() => resolve(new Blob([wav])));
        });
      },
    });
    const preparing = c.controller.warm([actor]);
    await started.promise;
    c.audio.settings.muted = true;
    c.controller.configure();
    await c.controller.play(actor, "death");
    gate.resolve();
    await preparing;
    assert.equal(c.synthesis, 1, "Mute must stop before the next clip, without discarding already paid bytes");
    assert.equal(c.played.length, 0);
    c.audio.settings.muted = false;
    c.controller.configure();
    assert.equal(
      c.stage.children.some((element) => !element.hidden),
      false,
      "Mute is not a provider failure",
    );
    await c.controller.warm([actor]);
    assert.equal(c.synthesis, 4, "Only the remaining three never-requested clips are generated after unmute");
    assert.equal(c.prompts, 0);
    const reopened = client(s);
    await reopened.controller.warm([actor]);
    assert.equal(reopened.synthesis, 0, "All returned clips were durably committed, including the muted one");
  });
  await test("muting, disabling or zeroing volume holds an unspent reservation and resumes the same token", async () => {
    for (const [setting, paused, resumed] of [
      ["muted", true, false],
      ["combatVoices", false, true],
      ["dialogueVolume", 0, 1],
    ]) {
      const s = await server();
      const reserved = deferred();
      const release = deferred();
      const c = client(s);
      const post = c.host._postJson;
      const reservations = [];
      let failures = 0;
      c.host._postJson = async (path, body) => {
        const result = await post(path, body);
        if (path.endsWith("/fail")) failures++;
        if (path.endsWith("/reserve")) {
          reservations.push({ slot: body.slot, token: result.token });
          if (reservations.length === 1) {
            reserved.resolve();
            await release.promise;
          }
        }
        return result;
      };
      const preparing = c.controller.warm([actor]);
      await reserved.promise;
      c.audio.settings[setting] = paused;
      if (setting === "combatVoices") s.run.audio.combatVoices = false;
      c.controller.configure();
      release.resolve();
      await tick();
      assert.equal(c.synthesis, 0, "A reserved token alone never authorizes synthesis while paused");
      assert.equal(failures, 0, "An unspent token stays on the same job instead of being marked failed");
      c.audio.settings[setting] = resumed;
      s.run.audio.combatVoices = true;
      c.controller.configure();
      await preparing;
      assert.equal(c.synthesis, 4);
      assert.equal(reservations.length, 4, "Each fixed slot is reserved once, including the held first slot");
      assert.equal(failures, 0);
      assert.equal(c.prompts, 0);
      assert.equal(
        c.stage.children.some((element) => !element.hidden),
        false,
      );
      await c.controller.warm([actor]);
      assert.equal(c.synthesis, 4);
      assert.equal(s.generations, 1);
    }
  });
  await test("disposal and a stale run release held waiters without synthesis or automatic recovery charges", async () => {
    for (const reason of ["dispose", "stale-run"]) {
      const s = await server();
      const reserved = deferred();
      const release = deferred();
      const c = client(s);
      const post = c.host._postJson;
      c.host._postJson = async (path, body) => {
        const result = await post(path, body);
        if (path.endsWith("/reserve")) {
          reserved.resolve();
          await release.promise;
        }
        return result;
      };
      const preparing = c.controller.warm([actor]);
      await reserved.promise;
      c.audio.settings.muted = true;
      c.controller.configure();
      release.resolve();
      await tick();
      if (reason === "dispose") c.controller.dispose();
      else {
        c.host._run = { runId: "other", combat: { mode: "formation" } };
        c.controller.configure();
      }
      await preparing;
      assert.equal(c.synthesis, 0);
      assert.equal(
        c.stage.children.some((element) => !element.hidden),
        false,
      );
      const reopened = client(s);
      await reopened.controller.warm([actor]);
      assert.equal(reopened.synthesis, 0, "A lost controller retains conservative explicit reservation recovery");
    }
  });
  await test("a genuine provider error during mute still requires explicit paid retry after unmute", async () => {
    const s = await server();
    const started = deferred();
    const gate = deferred();
    let calls = 0;
    let confirm = false;
    const c = client(s, {
      generateAudio: async () => {
        if (++calls === 1) {
          started.resolve();
          await gate.promise;
          throw new Error("fixture provider failure during mute");
        }
        return new Blob([wav]);
      },
      confirm: () => confirm,
    });
    const preparing = c.controller.warm([actor]);
    await started.promise;
    c.audio.settings.muted = true;
    c.controller.configure();
    gate.resolve();
    await preparing;
    c.audio.settings.muted = false;
    c.controller.configure();
    await c.controller.warm([actor]);
    assert.equal(c.synthesis, 1, "Unmute never automatically retries a genuinely failed provider attempt");
    assert.equal(c.stage.children[0].hidden, false);
    const retry = c.stage.children[0].children[1];
    await retry.listeners.click({ stopPropagation() {} });
    assert.equal(c.synthesis, 1);
    assert.equal(c.prompts, 1);
    confirm = true;
    await retry.listeners.click({ stopPropagation() {} });
    assert.equal(c.synthesis, 5);
    assert.equal(c.stage.children[0].hidden, true);
  });
  await test("failed paid work stays silent until a warning is accepted; saved clips survive retry", async () => {
    const s = await server();
    let calls = 0;
    let confirm = false;
    const c = client(s, {
      generateAudio: async () => {
        if (++calls === 2) throw new Error("fixture provider failure");
        return new Blob([wav]);
      },
      confirm: () => confirm,
    });
    await c.controller.warm([actor]);
    assert.equal(c.synthesis, 2);
    await c.controller.warm([actor]);
    assert.equal(c.synthesis, 2);
    const retry = c.stage.children[0].children[1];
    await retry.listeners.click({ stopPropagation() {} });
    assert.equal(c.synthesis, 2);
    assert.equal(c.prompts, 1);
    confirm = true;
    await retry.listeners.click({ stopPropagation() {} });
    assert.equal(c.synthesis, 5, "first ready clip is reused, only three missing/failed slots are synthesized");
    assert.equal(s.generations, 1);
    assert.equal(c.stage.children[0].hidden, true);
  });
  await test("an already generated late clip is saved to its old run without stale playback", async () => {
    const s = await server();
    const gate = deferred();
    const started = deferred();
    const c = client(s, {
      generateAudio: () => {
        started.resolve();
        return gate.promise;
      },
    });
    const preparing = c.controller.warm([actor]);
    await started.promise;
    c.host._run = { runId: "other", combat: { mode: "formation" } };
    c.controller.dispose();
    gate.resolve(new Blob([wav]));
    await preparing;
    assert.equal(c.synthesis, 1);
    assert.equal(c.played.length, 0);
    const c2 = client(s);
    await c2.controller.warm([actor]);
    assert.equal(c2.synthesis, 3, "the late saved slot is reused and not charged again");
  });
  await test("battle events attribute kills correctly and yield to saved enemy dialogue without replaying events", () => {
    const screen = new Element("main");
    let dialogue = null;
    const root = {
      querySelector: (selector) =>
        selector === ".screen" ? screen : selector === "[data-forge-combat-dialogue]:not([hidden])" ? dialogue : null,
    };
    const calls = [];
    const audio = { _forgeCombatVoices: { configure() {}, warm() {}, play: (...args) => calls.push(args) } };
    const run = {};
    const fx = createForgeCombatPresentation(root, {
      payload: { combatMode: "formation", allies: [actor], enemies: [{ id: "enemy-0" }] },
      host: { _run: { combat: { mode: "formation" } } },
      run,
      audio,
    });
    const ultimate = { op: "ult", id: actor.id };
    fx.event(ultimate);
    fx.event(ultimate);
    fx.event({ op: "ult", id: actor.id, weapon: true });
    fx.event({ op: "death", id: "enemy-0", killerId: actor.id });
    fx.event({ op: "death", id: actor.id, killerId: "enemy-0" });
    assert.deepEqual(
      calls.map((call) => call[1]),
      ["ultimateA", "kill", "death"],
    );
    dialogue = {};
    fx.event({ op: "ult", id: actor.id });
    assert.equal(calls.length, 3, "a blocking enemy line retains the voice channel");
    fx.dispose();
    fx.event({ op: "death", id: actor.id });
    assert.equal(calls.length, 3);
  });
  await test("ultimate presentation uses the current portrait/element, ignores weapons and clears on disposal", async () => {
    const screen = new Element("main");
    const root = { querySelector: (selector) => (selector === ".screen" ? screen : null) };
    const second = { ...actor, id: "second", portrait: "/fixture/b.webp", affinity: "water" };
    const fx = createForgeUltimatePresentation(root, { actors: [actor, second], duration: 10 });
    fx.event({ op: "ult", id: actor.id, name: "Dawn", weapon: true });
    assert.equal(screen.children.length, 0);
    fx.event({ op: "ult", id: actor.id, name: "Dawn" });
    assert.equal(screen.children[0].children[0].src, actor.portrait);
    assert.equal(screen.children[0].dataset.element, "fire");
    assert.equal(screen.children[0].attributes["aria-hidden"], "true");
    fx.event({ op: "ult", id: second.id, name: "Tide" });
    assert.equal(screen.children.length, 1);
    assert.equal(screen.children[0].children[0].src, second.portrait);
    assert.equal(screen.children[0].dataset.element, "water");
    fx.event({ op: "ult", id: "missing" });
    assert.equal(screen.children.length, 0);
    fx.event({ op: "ult", id: actor.id });
    fx.dispose();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(screen.children.length, 0);
    fx.event({ op: "ult", id: actor.id });
    assert.equal(screen.children.length, 0);
  });
  await test("each element uses its distinct bounded motif and the existing supplied affinity glyph", () => {
    const expected = { fire: "ember", water: "ripple", wind: "streak", earth: "shard", light: "ray", dark: "orbit" };
    const actors = Object.keys(expected).map((element) => ({ ...actor, id: element, affinity: element }));
    const glyphs = Object.fromEntries(
      Object.keys(expected).map((element) => [element, `<svg data-fixture="${element}"></svg>`]),
    );
    const screen = new Element("main");
    const fx = createForgeUltimatePresentation({ querySelector: () => screen }, { actors, glyphs });
    for (const [element, motif] of Object.entries(expected)) {
      fx.event({ op: "ult", id: element });
      assert.equal(screen.children.length, 1);
      const panel = screen.children[0];
      const effect = panel.children[2];
      assert.equal(effect.dataset.motif, motif);
      assert.equal(effect.className, `gf-ultimate-motif gf-ultimate-motif-${motif}`);
      assert.equal(effect.children.length, 6);
      assert(effect.children.every((particle) => particle.innerHTML === glyphs[element]));
      assert.equal(panel.style["--gf-ultimate-element"], `var(--${element})`);
    }
    fx.dispose();
    assert.equal(screen.children.length, 0);
  });
} finally {
  for (const controller of controllers) controller.dispose();
  for (const manager of managers) manager.dispose();
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  Object.assign(globalThis, original);
}
