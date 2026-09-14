import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// Run the actual package lifecycle without canvas/DOM rendering or paid models.
const root = new URL("../packages/pixelforge/src/", import.meta.url);
globalThis.HTMLElement = class {};
globalThis.customElements = { get: () => undefined, define() {} };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = { querySelectorAll: () => [] };
const frames = new Map();
let nextFrame = 0;
globalThis.requestAnimationFrame = (fn) => {
  frames.set(++nextFrame, fn);
  return nextFrame;
};
globalThis.cancelAnimationFrame = (id) => frames.delete(id);
const source = readdirSync(root)
  .filter((name) => name.endsWith(".js") && name !== "40-render.js")
  .sort()
  .map((name) => readFileSync(new URL(name, root), "utf8"))
  .join("\n");
const PF = new Function(`${source}\nreturn PF;`)();
PF.assets.load = async () => {};
PF.spatial.refresh = async () => {};
PF.Hud = class {
  destroy() {}
  update() {}
  refreshChips() {}
  toast() {}
};
const core = PF.core;
const declarations = [];
const stored = new Map();
let posts = 0;
let failGeneration = false;
let releaseStorage;
const storageWait = new Promise((resolve) => {
  releaseStorage = resolve;
});
PF.api.getExperienceState = async () => ({ available: false, status: 404 });
PF.api.patchMetadata = async (chatId, patch) => {
  if (patch.pixelforgeBrief && chatId === "fresh") await storageWait;
  stored.set(chatId, { ...stored.get(chatId), ...patch });
};
PF.api.postExperienceGeneration = async () => {
  posts++;
  return failGeneration
    ? { status: 503, body: { error: "Synthetic unavailable model" } }
    : {
        status: 200,
        body: {
          ok: true,
          data: {
            scale: "village",
            name: "Slateport",
            prosperity: "modest",
            backgroundPopulation: 8,
            situation: "The lighthouse went dark while the harbor bells rang.",
            cast: [
              { name: "Ada Flint", role: "keeper", kind: "host", tint: "amber", home: "Slateport", household: 1 },
              { name: "Oren Vale", role: "carpenter", kind: "maker", tint: "teal", home: "Slateport", household: 2 },
            ],
          },
        },
      };
};
const mount = () => ({ style: {}, inert: false });
const props = (chatId, chatMeta) => ({
  chatId,
  chatMeta,
  startup: true,
  setStartupReady: (context) => declarations.push(context),
  setExperienceChrome() {},
});
const config = { gameSetupConfig: { experienceConfig: { generate: true, seed: 4242, theme: "cozy-village" } } };
const settle = () => new Promise((resolve) => setImmediate(resolve));
const frame = () => {
  const [id, run] = frames.entries().next().value;
  frames.delete(id);
  run(performance.now() + 40);
};

try {
  const first = mount();
  core.attachMain(first, props("fresh", config));
  await settle();
  assert.equal(posts, 1);
  assert.equal(declarations.at(-1), null, "an unpersisted world cannot enable Start");
  assert.equal(PF.save.gateHolds(core), true);
  assert.equal(first.inert, false, "the existing loading/retry controls remain reachable");
  assert.equal(stored.has("fresh"), false);
  core.detach(first);
  const second = mount();
  core.attachMain(second, props("fresh", config));
  await settle();
  assert.equal(posts, 1, "startup remount does not launch duplicate preparation");
  releaseStorage();
  await settle();
  await PF.save._flushChain;
  const pendingIntro = { world: false, zone: "earlier-turn" };
  core.sim._pendingIntro = pendingIntro;
  const intro = structuredClone(core.sim.intro);
  frame();
  assert.ok(stored.get("fresh").pixelforgeBrief, "the actual generated brief was persisted first");
  const context = declarations.at(-1);
  assert.equal(typeof context, "string");
  assert.ok(context.length <= 8000);
  assert.match(context, /Slateport/);
  assert.match(context, /lighthouse went dark/);
  const residents = core.sim.world.zones[core.sim.world.startZone].npcs;
  assert.ok(residents.length > 0);
  for (const npc of residents) assert.ok(context.includes(`${npc.name} (${npc.role})`));
  assert.deepEqual(core.sim.intro, intro, "readiness never burns intro flags");
  assert.equal(core.sim._pendingIntro, pendingIntro, "readiness never replaces a pending turn receipt");
  assert.equal(second.inert, true, "ready play controls stay frozen behind Engine Continue");
  const sim = core.sim;
  let steps = 0;
  const step = sim.step;
  sim.step = () => {
    steps++;
    return { zoneChanged: false };
  };
  core._keyDown({ key: "w", target: null, preventDefault() {} });
  assert.equal(core.input.up, false);
  core.openTalk(residents[0]);
  assert.equal(sim.talkAnchorId, null);
  frame();
  assert.equal(steps, 0, "the clock and movement do not step behind Continue");
  core.detach(second);
  const normal = mount();
  core.attachMain(normal, { ...props("fresh", config), startup: false });
  frame();
  assert.equal(core.sim, sim, "the normal surface remount reuses the prepared world");
  assert.equal(posts, 1);
  assert.equal(normal.inert, false);
  assert.ok(steps > 0, "Continue restores normal stepping");
  sim.step = step;

  // Saved worlds do not need another paid preparation call.
  core.onMainProps(props("saved", { ...config, ...stored.get("fresh") }));
  await settle();
  await PF.save._flushChain;
  frame();
  assert.equal(posts, 1);
  assert.equal(typeof declarations.at(-1), "string");

  failGeneration = true;
  core.onMainProps(props("retry", config));
  await settle();
  frame();
  assert.equal(PF.save.gate.state, "failed");
  assert.equal(declarations.at(-1), null, "failed preparation cannot enable Start");
  assert.equal(normal.inert, false, "Retry remains interactive after failure");
  failGeneration = false;
  assert.equal(await PF.save.retryGeneration(core), true);
  await settle();
  await PF.save._flushChain;
  frame();
  assert.equal(typeof declarations.at(-1), "string", "the existing retry completes startup");
  assert.ok(stored.get("retry").pixelforgeBrief);

  const count = declarations.length;
  core.onMainProps({ chatId: "legacy", chatMeta: {} });
  await settle();
  frame();
  assert.equal(declarations.length, count, "hosts without startup callbacks keep their existing behavior");
  assert.equal(normal.inert, false);
} finally {
  releaseStorage();
  PF.save.reset();
  frames.clear();
}
console.log("Pixelforge startup: persistence, readiness, remount, input freeze, retry, and legacy controls passed.");
