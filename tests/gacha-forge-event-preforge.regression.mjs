// Seasonal story events pre-forge on the main chapter chain (1.26.0, Pasta-Devs/Marinara-Agents#1780). This drives
// the shipped server's real routes, chain, dedupe and cancellation; only the host boundary is faked: deterministic
// model replies, isolated documents and a stub Engine image endpoint.
import assert from "node:assert/strict";

const serverUrl = new URL(
  process.env.GACHA_EVENT_SERVER_UNDER_TEST || "../packages/gacha-forge/server.mjs",
  import.meta.url,
);
const packageId = "gacha-forge";
const runId = "event-preforge";
const sessionId = `${runId}:session`;
const chapter = "event-1";
const unitId = `${runId}:unit:arden`;
const clone = (value) => structuredClone(value);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const DAY = 864e5;

// Seven scenes and three fights, in the order an event plan uses: S C S S C S S S C S.
const eventPlan = {
  title: "The crossing begins",
  premise: "Friends share the lantern festival.",
  nodes: Array.from({ length: 10 }, (_, index) =>
    [1, 4, 8].includes(index)
      ? {
          type: "combat",
          title: `Trial ${index}`,
          setup: "A festival guard tests the crossing.",
          tier: index === 8 ? "boss" : "soldier",
        }
      : { type: "story", title: `Lantern scene ${index}`, goal: "Keep the promise.", guide: "Honor the friendship." },
  ),
};
const mainPlan = (chapterNumber) => ({ ...eventPlan, chapter: chapterNumber, title: `Chapter ${chapterNumber}` });
const scene = (label, { places = [], cg = null, choices = [] } = {}) => ({
  places: places.map((name) => ({ name, tags: name.toLowerCase() })),
  segments: [
    { speaker: "Arden", text: `${label} begins.` },
    ...places.map((name) => ({ speaker: "", text: `${label} reaches ${name}.`, place: name })),
  ],
  choices,
  ...(cg ? { cg } : {}),
});
const guide = (name, tier = "soldier") => ({
  enemy: name,
  tier,
  opening: `${name} steps forward.`,
  objective: `Pass ${name}'s trial.`,
  outcomeOnWin: `${name} lets the procession pass.`,
  place: `Gate of ${name}`,
  placeTags: "gate",
  formation: [
    {
      name,
      tier,
      role: "Warrior",
      affinity: "Fire",
      position: "front",
      stats: { hp: 10, atk: 10, def: 10, spd: 10 },
      skill: { name: "Strike", effect: "damage", power: 100, target: "enemy", description: "A clean hit." },
      look: "a lantern-armored guard",
      lookTags: ["armor"],
    },
  ],
  dialogueCues: [
    { speaker: "enemy-0", content: "Welcome to the trial.", type: "main", trigger: "intro" },
    { speaker: "enemy-0", content: "The procession may pass.", type: "main", trigger: "victory" },
    { speaker: "enemy-0", content: "Rest and try again.", type: "main", trigger: "defeat" },
  ],
});
const bigChoice = {
  id: "choice-1",
  kind: "big",
  at: 0,
  options: [
    {
      id: "option-1",
      text: "Light the north lantern.",
      selection: { kind: "action", text: "You light the north lantern." },
      segments: [],
    },
    {
      id: "option-2",
      text: "Light the south lantern.",
      selection: { kind: "action", text: "You light the south lantern." },
      segments: [],
    },
  ],
};

// The Engine's image endpoints. A paint can be held.
const engine = { paints: [], held: null };
const holdNextPaint = () => {
  let release;
  const promise = new Promise((resolve) => (release = resolve));
  engine.held = { promise, entered: false };
  return { release, entered: () => engine.held?.entered === true || engine.paints.length > 0 };
};
globalThis.fetch = async (input, init = {}) => {
  const path = new URL(input).pathname;
  if (path === "/api/connections")
    return Response.json([
      { id: "fixture-model", provider: "fixture", model: "fixture-only", maxContext: 128000 },
      { id: "fixture-images", provider: "image_generation", model: "fixture-only" },
    ]);
  if (path === "/api/app-settings/ui") return Response.json({});
  if (path === "/api/characters/avatar-generation") {
    const body = JSON.parse(init.body);
    engine.paints.push(body.name);
    const held = engine.held;
    if (held) {
      engine.held = null;
      held.entered = true;
      await held.promise;
    }
    return Response.json({
      image: `data:image/png;base64,${Buffer.from(body.name).toString("base64")}`,
      prompt: "prompt",
    });
  }
  if (path === "/api/global-gallery/upload") {
    const id = `gallery-${engine.paints.length}`;
    return Response.json({ id, url: `/api/global-gallery/file/${id}` });
  }
  throw new Error(`Unexpected Engine request: ${path}`);
};

const kindOf = (messages) => {
  const system = String(messages?.[0]?.content || "");
  if (system.includes("SEASONAL EVENT:")) return "plan";
  if (system.includes("Summarize only the supplied canonical story history")) return "summary";
  if (system.includes("You design ONE combat encounter")) return "fight";
  if (system.includes("Design the COMBAT KIT for the PLAYER's protagonist")) return "kit";
  if (system.includes("You are the chapter planner")) return "main-plan";
  return "scene";
};

let sequence = 0;
async function harness({
  story = { preforge: "story" },
  images = { enabled: false },
  scenes = {},
  mainChapters = [],
  sceneFor = () => null,
} = {}) {
  engine.paints.length = 0;
  engine.held = null;
  const docs = new Map();
  const calls = [];
  const warnings = [];
  let pause = null;
  const seed = (id, kind, data) =>
    docs.set(id, {
      id,
      kind,
      packageId,
      name: id,
      description: "fixture",
      revision: (docs.get(id)?.revision ?? 0) + 1,
      data: clone(data),
    });
  const hero = {
    kind: "character",
    name: "Arden",
    rarity: 5,
    role: "Mage",
    affinity: "Water",
    position: "front",
    identitySex: "male",
    stats: { hp: 100, atk: 100, def: 100, spd: 100 },
    skill: { name: "Lighthouse strike", effect: "damage", power: 100, target: "enemy", description: "A clean strike." },
  };
  seed("index", "index", {
    runs: [
      {
        runId,
        name: "Event pre-forge",
        scenario: "A lighthouse coast.",
        connectionId: "fixture-model",
        protagonist: { name: "Mari" },
        images,
        story: { seasonalEvents: true, ...story },
      },
    ],
    activeRunId: runId,
  });
  seed(sessionId, "session", {
    progress: { 1: { normal: 10 } },
    wallet: { vigor: 100, funds: 10000, aether: 1000 },
    account: { level: 100, xp: 0 },
    roster: { [unitId]: { level: 100, bondFights: 0 } },
    presets: [{ name: "Fixture team", board: { front: [unitId, null, null], back: [null, null, null] } }],
    activePreset: 0,
  });
  seed(`${runId}:combat-art`, "combat-art", { effigies: { byKey: {}, hasArt: false } });
  seed(unitId, "unit", hero);
  seed(`${runId}:chapter:1`, "chapter-plan", mainPlan(1));
  for (const plan of mainChapters) seed(`${runId}:chapter:${plan.chapter}`, "chapter-plan", plan);
  seed(`${runId}:story-event:1`, "story-event", {
    seq: 1,
    chapter,
    startedAt: Date.now() - DAY,
    endsAt: Date.now() + 20 * DAY,
    state: "ready",
    title: "The Lantern Crossing",
    theme: "A winter festival of promises.",
    premise: "Keep the coast's old promise.",
    cast: [unitId],
    newCharacter: { name: "Neris", description: "NEW_EVENT_GUEST", personality: "", backstory: "", appearance: "" },
    rewards: [
      { nodeIndex: 2, kind: "funds", qty: 5000 },
      { nodeIndex: 5, kind: "aether", qty: 160 },
      { nodeIndex: 8, kind: "xp", tier: "core", qty: 3 },
      { nodeIndex: 9, kind: "aether", qty: 320 },
    ],
  });
  const documents = {
    getById: async (_id, id) => clone(docs.get(id) ?? null),
    list: async (_id, kind) => clone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
    async create(document) {
      if (docs.has(document.id)) throw new Error(`Document already exists: ${document.id}`);
      const stored = { ...clone(document), revision: 1 };
      docs.set(document.id, stored);
      return clone(stored);
    },
    async update(document) {
      const current = docs.get(document.id);
      if (!current || current.revision !== document.expectedRevision) return null;
      const stored = { ...current, ...clone(document), revision: current.revision + 1 };
      delete stored.expectedRevision;
      docs.set(document.id, stored);
      return clone(stored);
    },
    remove: async (_id, id) => docs.delete(id),
  };
  const routes = new Map();
  let scenesWritten = 0,
    fights = 0;
  const { activate } = await import(`${serverUrl.href}?event-preforge=${sequence++}`);
  await activate({
    package: { id: packageId, version: "fixture" },
    api: {
      runtime: {
        persistence: {
          documents,
          async transaction(operation) {
            const before = clone([...docs]);
            try {
              return await operation({ documents });
            } catch (error) {
              docs.clear();
              for (const [id, row] of before) docs.set(id, row);
              throw error;
            }
          },
        },
        logger: { info() {}, warn: (...args) => warnings.push(args.map(String).join(" | ")), error() {}, debug() {} },
        json: { parseJsonish: JSON.parse },
        languageModels: {
          async resolveForRequest({ connectionId }) {
            return {
              connectionId,
              model: "fixture-only",
              async chatComplete(messages) {
                const kind = kindOf(messages);
                calls.push({ kind, messages });
                if (pause && pause.kind === kind && pause.at === calls.filter((call) => call.kind === kind).length) {
                  pause.entered = true;
                  await pause.promise;
                }
                const value =
                  kind === "plan"
                    ? eventPlan
                    : kind === "main-plan"
                      ? mainPlan(2)
                      : kind === "summary"
                        ? { summary: "The lighthouse friendship holds." }
                        : kind === "fight"
                          ? guide(
                              `Guard ${(fights += 1)}`,
                              /ENCOUNTER TIER: (soldier|elite|boss)/u.exec(String(messages[0].content))?.[1],
                            )
                          : (sceneFor(messages) ?? scenes[scenesWritten] ?? scene(`Scene ${scenesWritten}`));
                if (kind === "scene") scenesWritten += 1;
                return { content: JSON.stringify(value), finishReason: "stop" };
              },
            };
          },
        },
      },
      async registerPrivilegedRoutes(register) {
        await register({
          get: (path, handler) => routes.set(`GET ${path}`, handler),
          post: (path, handler) => routes.set(`POST ${path}`, handler),
        });
      },
    },
  });
  const post = (path, body = {}) => {
    const route = routes.get(`POST ${path}`);
    assert.ok(route, `the shipped server registers POST ${path}`);
    return route({ body: clone({ runId, ...body }) });
  };
  return {
    docs,
    calls,
    warnings,
    routes,
    post,
    data: (id) => clone(docs.get(id)?.data),
    put: seed,
    session: () => docs.get(sessionId).data,
    kinds: (...only) => calls.map((call) => call.kind).filter((kind) => !only.length || only.includes(kind)),
    setRun(change) {
      const index = clone(docs.get("index").data);
      change(index.runs[0]);
      seed("index", "index", index);
    },
    setEvent(change) {
      const row = clone(docs.get(`${runId}:story-event:1`).data);
      change(row);
      seed(`${runId}:story-event:1`, "story-event", row);
    },
    // Holds the at-th model call of one kind until released.
    pauseCall(kind, at) {
      let release;
      const promise = new Promise((resolve) => (release = resolve));
      pause = { kind, at, promise, entered: false };
      return { release, entered: () => pause.entered };
    },
    status: async () => (await post("/preforge", { chapter })).preforge,
    open: async () => {
      const listed = await post("/story-events");
      assert.equal(listed.ok, true, JSON.stringify(listed));
      const plan = await post("/story-event/plan", { chapter });
      assert.equal(plan.ok, true, JSON.stringify(plan));
      return { listed, plan };
    },
  };
}

async function waitFor(check, label) {
  for (let turn = 0; turn < 6000; turn += 1) {
    if (await check()) return;
    await tick();
  }
  assert.fail(`timed out waiting for ${label}`);
}
// The harness has no timers, so a quiet stretch means every queued chain step ran.
async function settle(host) {
  let last = "";
  for (let quiet = 0, turn = 0; quiet < 200 && turn < 10000; turn += 1) {
    const now = JSON.stringify([engine.paints.length, host.calls.length, host.docs.size]);
    quiet = now === last ? quiet + 1 : 0;
    last = now;
    await tick();
  }
}
const beatIds = (host) => [...host.docs.keys()].filter((id) => id.startsWith(`${runId}:beat:${chapter}:`)).sort();
const fightIds = (host) => [...host.docs.keys()].filter((id) => id.startsWith(`${runId}:combat:${chapter}:`)).sort();
const chainWarnings = (host) => host.warnings.filter((warning) => warning.includes("pre-forge"));
const writeOrder = ["scene", "fight", "scene", "scene", "fight", "scene", "scene", "scene", "fight", "scene"];

let cases = 0;
async function test(name, run) {
  await run();
  cases += 1;
  process.stdout.write(`ok ${cases} - ${name}\n`);
}

await test("an event offered under the 1.24.10 rule opens and pre-forges every scene ahead, each fight after the scene before it, at no Vigor cost", async () => {
  const host = await harness();
  const { listed } = await host.open();
  assert.equal(listed.events[0].canStart, true, "chapter 1 is cleared, nothing is half played");
  const vigor = host.session().wallet.vigor;
  const started = await host.post("/preforge/start", { chapter });
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.equal(started.allowed, true);
  assert.equal(started.preforge.chapter, chapter, "the status names the event key, so the client's map shows the bar");
  assert.equal(started.preforge.locked, true);
  await settle(host);
  assert.deepEqual(host.kinds("scene", "fight"), writeOrder);
  assert.equal(beatIds(host).length, 7);
  assert.equal(fightIds(host).length, 3);
  const status = await host.status();
  assert.deepEqual(
    {
      chapter: status.chapter,
      total: status.total,
      done: status.done,
      next: status.next,
      locked: status.locked,
      running: status.running,
      autos: status.autos,
    },
    { chapter, total: 7, done: 7, next: -1, locked: false, running: false, autos: 1 },
  );
  assert.equal(host.session().wallet.vigor, vigor, "pre-forge charges no Vigor");
  assert.equal(host.session().progress[chapter], undefined, "writing ahead plays nothing");
  // The fights were designed by the event's designer: its cast canon and its scale, saved as event fights.
  for (const call of host.calls.filter((entry) => entry.kind === "fight"))
    assert.match(JSON.stringify(call.messages), /SEASONAL EVENT CHARACTER CANON/u);
  assert.equal(host.docs.get(`${runId}:combat:${chapter}:0`).description, "The Lantern Crossing");
  // A pre-forged scene starts for free, and opening it or its fight costs no model call.
  const before = host.kinds("scene", "fight").length;
  const start = await host.post("/story-event/start", { chapter, storyIndex: 0 });
  assert.deepEqual({ ok: start.ok, spent: start.spent, resumed: start.resumed }, { ok: true, spent: 0, resumed: true });
  assert.equal((await host.post("/story-event/beat", { chapter, storyIndex: 0 })).cached, true);
  assert.equal((await host.post("/story-event/complete", { chapter, nodeIndex: 0 })).ok, true);
  const battle = await host.post("/story-event/battle", { chapter, combatIndex: 0 });
  assert.equal(battle.ok, true, JSON.stringify(battle));
  assert.equal(battle.enemies[0].name, "Guard 1");
  assert.equal(host.kinds("scene", "fight").length, before, "opening pre-forged work writes and designs nothing again");
  assert.equal(host.session().wallet.vigor, vigor);
  assert.deepEqual(chainWarnings(host), []);
});

await test("a fight designed ahead uses the same prompt as the one its battle designs when pre-forge is off", async () => {
  const ahead = await harness();
  await ahead.open();
  await ahead.post("/preforge/start", { chapter });
  await settle(ahead);
  const onOpen = await harness({ story: { preforge: "off" } });
  await onOpen.open();
  assert.equal((await onOpen.post("/preforge/start", { chapter })).allowed, false, "pre-forge off starts nothing");
  assert.equal(
    (await onOpen.post("/story-event/start", { chapter, storyIndex: 0 })).spent,
    5,
    "an unwritten scene costs its Vigor",
  );
  assert.equal((await onOpen.post("/story-event/beat", { chapter, storyIndex: 0 })).ok, true);
  assert.equal((await onOpen.post("/story-event/complete", { chapter, nodeIndex: 0 })).ok, true);
  await settle(onOpen);
  assert.deepEqual(onOpen.kinds("scene", "fight"), ["scene"], "with pre-forge off, nothing is designed ahead");
  assert.equal((await onOpen.post("/story-event/battle", { chapter, combatIndex: 0 })).ok, true);
  const prompt = (host) => JSON.stringify(host.calls.find((call) => call.kind === "fight").messages);
  assert.equal(prompt(ahead), prompt(onOpen));
  assert.deepEqual(ahead.data(`${runId}:combat:${chapter}:0`), onOpen.data(`${runId}:combat:${chapter}:0`));
});

await test("the map's status reports a scene being written, and opening it joins that scene instead of writing it twice", async () => {
  const host = await harness();
  await host.open();
  const writing = host.pauseCall("scene", 1);
  await host.post("/preforge/start", { chapter });
  await waitFor(writing.entered, "the first scene");
  const status = await host.status();
  assert.deepEqual(
    { running: status.running, locked: status.locked, done: status.done, next: status.next, mode: status.mode },
    { running: true, locked: true, done: 0, next: 0, mode: "story" },
  );
  const opened = host.post("/story-event/beat", { chapter, storyIndex: 0 });
  for (let turn = 0; turn < 50; turn += 1) await tick();
  writing.release();
  const beat = await opened;
  assert.equal(beat.ok, true, JSON.stringify(beat));
  assert.deepEqual(beat.segments, host.data(`${runId}:beat:${chapter}:0`).segments);
  await settle(host);
  assert.deepEqual(host.kinds("scene", "fight"), writeOrder, "scene one was written once");
});

await test("opening a fight while the chain designs it joins that design", async () => {
  const host = await harness();
  await host.open();
  const designing = host.pauseCall("fight", 1);
  await host.post("/preforge/start", { chapter });
  await waitFor(designing.entered, "the first fight design");
  assert.equal((await host.post("/story-event/start", { chapter, storyIndex: 0 })).spent, 0);
  assert.equal((await host.post("/story-event/complete", { chapter, nodeIndex: 0 })).ok, true);
  const battle = host.post("/story-event/battle", { chapter, combatIndex: 0 });
  for (let turn = 0; turn < 50; turn += 1) await tick();
  designing.release();
  const opened = await battle;
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(opened.enemies[0].name, "Guard 1");
  await settle(host);
  assert.deepEqual(host.kinds("scene", "fight"), writeOrder, "the first fight was designed once");
});

await test("pre-forge Cancel stops the event's chain after the scene in flight, and Retry finishes it", async () => {
  const host = await harness();
  await host.open();
  const writing = host.pauseCall("scene", 2);
  await host.post("/preforge/start", { chapter });
  await waitFor(writing.entered, "the second scene");
  const cancelled = await host.post("/preforge/cancel", { chapter });
  assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
  assert.equal(cancelled.preforge.cancelled, true);
  writing.release();
  await settle(host);
  assert.deepEqual(host.kinds("scene", "fight"), ["scene", "fight", "scene"], "nothing after the scene in flight");
  const stopped = await host.status();
  assert.deepEqual(
    {
      running: stopped.running,
      locked: stopped.locked,
      cancelled: stopped.cancelled,
      done: stopped.done,
      next: stopped.next,
    },
    { running: false, locked: false, cancelled: true, done: 2, next: 2 },
  );
  const retried = await host.post("/preforge/retry", { chapter });
  assert.equal(retried.allowed, true, JSON.stringify(retried));
  await settle(host);
  assert.deepEqual(host.kinds("scene", "fight"), writeOrder);
  assert.equal((await host.status()).done, 7);
  assert.deepEqual(chainWarnings(host), []);
});

await test("the story Cancel aborts the event's chain and marks the event cancelled, so it does not restart on its own", async () => {
  const host = await harness();
  await host.open();
  const writing = host.pauseCall("scene", 2);
  await host.post("/preforge/start", { chapter });
  await waitFor(writing.entered, "the second scene");
  assert.equal((await host.post("/story/cancel", { chapter })).ok, true);
  writing.release();
  await settle(host);
  assert.equal(host.session().preforge[chapter].cancelled, true);
  assert.equal(beatIds(host).length, 1, "the aborted scene is not saved");
  const status = await host.status();
  assert.equal(status.running, false);
  assert.equal((await host.post("/preforge/start", { chapter })).allowed, false);
});

await test("Story and images paints each pre-forged event scene's places and then its key image", async () => {
  const host = await harness({
    story: { preforge: "art" },
    images: { connectionId: "fixture-images", backgrounds: true, enemyArt: false, battleBackgrounds: false },
    scenes: {
      0: scene("Scene 0", {
        places: ["Lantern Bridge"],
        cg: {
          from: 0,
          to: 1,
          title: "The First Lantern",
          prompt: "A lantern rises.",
          characters: [],
          reason: "fixture",
        },
      }),
      1: scene("Scene 1", { places: ["Harbor Steps"] }),
    },
  });
  await host.open();
  await host.post("/preforge/start", { chapter });
  await settle(host);
  assert.deepEqual(host.kinds("scene", "fight"), writeOrder);
  assert.deepEqual(
    engine.paints.filter((name) => ["Lantern Bridge", "The First Lantern", "Harbor Steps"].includes(name)),
    ["Lantern Bridge", "The First Lantern", "Harbor Steps"],
    "reading order: the scene's places, then its key image",
  );
  assert.ok(host.data(`${runId}:cg:${chapter}:0`).url, "the event's key image is filed");
  const opened = await host.post("/story-event/beat", { chapter, storyIndex: 0 });
  assert.ok(
    opened.places.every((place) => place.url),
    "the scene opens painted",
  );
});

for (const [label, close] of [
  ["the event ends", (host) => host.setEvent((event) => (event.endsAt = Date.now() - 1))],
  ["Seasonal events is turned off", (host) => host.setRun((run) => (run.story.seasonalEvents = false))],
]) {
  await test(`once ${label}, the event pre-forges and paints nothing more`, async () => {
    const host = await harness({
      story: { preforge: "art" },
      images: { connectionId: "fixture-images", backgrounds: true, enemyArt: false, battleBackgrounds: false },
      scenes: { 0: scene("Scene 0", { places: ["Lantern Bridge", "Harbor Steps"] }) },
    });
    await host.open();
    const painting = holdNextPaint();
    const writing = host.pauseCall("scene", 2);
    await host.post("/preforge/start", { chapter });
    await waitFor(writing.entered, "the second scene");
    await waitFor(painting.entered, "the first paint");
    close(host);
    painting.release();
    writing.release();
    await settle(host);
    assert.deepEqual(host.kinds("scene", "fight"), ["scene", "fight", "scene"], "no scene or fight after it closed");
    assert.deepEqual(engine.paints, ["Lantern Bridge"], "no paint after it closed");
    const status = await host.status();
    assert.deepEqual(
      { mode: status.mode, locked: status.locked, running: status.running },
      { mode: "off", locked: false, running: false },
    );
    const again = await host.post("/preforge/start", { chapter });
    assert.equal(again.allowed, false);
  });
}

for (const [label, close] of [
  ["still open", async () => {}],
  ["ended", (host) => host.setEvent((event) => (event.endsAt = Date.now() - 1))],
  ["switched off", (host) => host.setRun((run) => (run.story.seasonalEvents = false))],
]) {
  await test(`a fight the chain is designing when the event is ${label} paints its enemy and place only while it is open`, async () => {
    const host = await harness({
      images: { connectionId: "fixture-images", backgrounds: true, enemyArt: true, battleBackgrounds: true },
    });
    await host.open();
    const designing = host.pauseCall("fight", 1);
    await host.post("/preforge/start", { chapter });
    await waitFor(designing.entered, "the fight design");
    await settle(host);
    const before = engine.paints.length;
    await close(host);
    designing.release();
    await settle(host);
    // Open, the chain goes on to the next fights; closed, it paints nothing for a battle that can no longer open.
    assert.deepEqual(
      label === "still open" ? engine.paints.slice(before, before + 2) : engine.paints.slice(before),
      label === "still open" ? ["Guard 1", "Gate of Guard 1"] : [],
    );
  });
}

await test("an event's last scene may end on a big choice: pre-forge stops there with every scene written, and the event route takes the choice", async () => {
  const host = await harness({
    story: { preforge: "story", choices: true },
    scenes: { 6: scene("Scene 6", { choices: [bigChoice] }) },
  });
  await host.open();
  await host.post("/preforge/start", { chapter });
  await settle(host);
  assert.deepEqual(host.kinds("scene", "fight"), writeOrder);
  const waiting = await host.status();
  assert.deepEqual(
    { waitingChoice: waiting.waitingChoice, done: waiting.done, locked: waiting.locked, running: waiting.running },
    { waitingChoice: true, done: 7, locked: false, running: false },
  );
  // A choice past the node the player has reached is refused, so writing ahead never decides for the player.
  const early = await host.post("/story-event/choice", {
    chapter,
    storyIndex: 6,
    choiceId: "choice-1",
    optionId: "option-1",
  });
  assert.equal(early.error, "event-node-locked");
  host.session().progress[chapter] = { normal: 9 };
  const chosen = await host.post("/story-event/choice", {
    chapter,
    storyIndex: 6,
    choiceId: "choice-1",
    optionId: "option-1",
  });
  assert.equal(chosen.ok, true, JSON.stringify(chosen));
  assert.equal((await host.status()).waitingChoice, false);
});

await test("writing the event ahead keeps the 1.24.10 rule, the main-story hold and memory as they were", async () => {
  const host = await harness({ mainChapters: [mainPlan(2)] });
  // A chapter forged but not started does not close the window.
  const { listed } = await host.open();
  assert.equal(listed.events[0].canStart, true);
  await host.post("/preforge/start", { chapter });
  await settle(host);
  const after = await host.post("/story-events");
  assert.equal(after.events[0].played, 0, "pre-forged scenes are not played scenes");
  assert.equal(after.events[0].canStart, true);
  assert.equal(
    (await host.post("/chapter-plan", { chapter: 2 })).error,
    "story-event-open",
    "the open event still holds chapter 2",
  );
  assert.equal(host.kinds("summary").length, 0, "pre-forge schedules no memory work");
  assert.equal(
    host.data(`${runId}:summary:memory`)?.records?.some((record) => record.kind === "story-event") ?? false,
    false,
  );
  // Main chapter keys behave as before: a half-played chapter blocks a new event, and its own status reads as before.
  host.session().progress[2] = { normal: 3 };
  const blocked = await host.post("/story-events");
  assert.deepEqual(blocked.events[0].blockedBy, { kind: "chapter", chapter: 2 });
  assert.equal(
    (await host.post("/preforge", { chapter: "event-0" })).error,
    "bad-request",
    "only a real event key is accepted",
  );
  assert.equal((await host.post("/preforge", { chapter: "event-x" })).error, "bad-request");
});

// An open event holds every main chapter after the one it follows (1.26.1, Pasta-Devs/Marinara-Agents#1786).
const eventCanon = "SEASONAL EVENT CHARACTER CANON";
const mainScene = (call) => call.kind === "scene" && !JSON.stringify(call.messages).includes(eventCanon);
const mainBeats = (host) => [...host.docs.keys()].filter((id) => id.startsWith(`${runId}:beat:2:`)).length;
const mainStatus = async (host) => (await host.post("/preforge", { chapter: 2 })).preforge;
const endsOnBigChoice = (messages) => {
  const text = JSON.stringify(messages);
  return text.includes("LAST story beat") && !text.includes(eventCanon)
    ? scene("Chapter 2 ends", { choices: [bigChoice] })
    : null;
};
const closes = [
  ["is finished", (host) => (host.session().progress[chapter] = { normal: 10 })],
  ["ends", (host) => host.setEvent((event) => (event.endsAt = Date.now() - 1))],
  ["is turned off", (host) => host.setRun((run) => (run.story.seasonalEvents = false))],
];

for (const [label, close] of closes) {
  await test(`a main chapter pre-forging when the event opens stops while the event holds it, and finishes once the event ${label}`, async () => {
    const host = await harness({ mainChapters: [mainPlan(2)] });
    const writing = host.pauseCall("scene", 3);
    assert.equal((await host.post("/preforge/start", { chapter: 2 })).allowed, true);
    await waitFor(writing.entered, "chapter 2's third scene");
    const opening = host.post("/story-event/plan", { chapter });
    writing.release();
    assert.equal((await opening).ok, true);
    await settle(host);
    const planned = host.calls.findIndex((call) => call.kind === "plan");
    assert.equal(
      host.calls.slice(planned).filter(mainScene).length,
      0,
      "no chapter 2 scene starts once the event opens",
    );
    assert.equal(mainBeats(host), 3, "the scene in flight is kept");
    const held = await mainStatus(host);
    assert.deepEqual(
      { mode: held.mode, locked: held.locked, canAuto: held.canAuto, done: held.done },
      { mode: "off", locked: false, canAuto: false, done: 3 },
    );
    assert.equal((await host.post("/preforge/start", { chapter: 2 })).allowed, false);
    assert.equal((await host.post("/preforge/retry", { chapter: 2 })).allowed, false);
    assert.equal((await host.post("/preforge/start", { chapter })).allowed, true, "the event pre-forges meanwhile");
    await settle(host);
    assert.equal(beatIds(host).length, 7);
    assert.equal(fightIds(host).length, 3);
    close(host);
    const free = await mainStatus(host);
    assert.deepEqual({ mode: free.mode, canAuto: free.canAuto }, { mode: "story", canAuto: true });
    assert.equal((await host.post("/preforge/start", { chapter: 2 })).allowed, true);
    await settle(host);
    assert.equal(mainBeats(host), 7, "chapter 2 is written in full");
    assert.deepEqual(chainWarnings(host), []);
  });

  await test(`a big choice written in a chapter the open event holds does not stop the event, and holds the main story again once the event ${label}`, async () => {
    const host = await harness({
      story: { preforge: "story", choices: true },
      mainChapters: [mainPlan(2)],
      sceneFor: endsOnBigChoice,
    });
    // Chapter 2's chain designs its last fight; the event's plan queues behind it. The chain then finds chapter 2 not
    // yet held and queues its last scene behind the plan, so that scene and its big choice are written once it is.
    const designing = host.pauseCall("fight", 3);
    await host.post("/preforge/start", { chapter: 2 });
    await waitFor(designing.entered, "chapter 2's last fight");
    const planning = host.pauseCall("plan", 1);
    const opening = host.post("/story-event/plan", { chapter });
    for (let turn = 0; turn < 50; turn += 1) await tick();
    designing.release();
    await waitFor(planning.entered, "the event's plan");
    for (let turn = 0; turn < 300; turn += 1) await tick();
    planning.release();
    assert.equal((await opening).ok, true);
    await settle(host);
    assert.equal(host.data(`${runId}:beat:2:6`).choices[0].id, "choice-1", "the held chapter's big choice is pending");
    assert.equal((await host.post("/story-event/start", { chapter, storyIndex: 0 })).ok, true);
    const opened = await host.post("/story-event/beat", { chapter, storyIndex: 0 });
    assert.equal(opened.ok, true, JSON.stringify(opened));
    assert.equal((await host.post("/preforge/start", { chapter })).allowed, true);
    await settle(host);
    const status = await host.status();
    assert.deepEqual({ done: status.done, waitingChoice: status.waitingChoice }, { done: 7, waitingChoice: false });
    assert.equal((await mainStatus(host)).mode, "off");
    close(host);
    assert.equal((await mainStatus(host)).waitingChoice, true);
    const next = await host.post("/chapter-plan", { chapter: 3 });
    assert.deepEqual({ error: next.error, chapter: next.chapter }, { error: "choice-required", chapter: 2 });
  });
}

await test("a chapter forged ahead that ends on a big choice does not stop the event from opening, and its choice holds the main story again once the event is finished", async () => {
  const host = await harness({
    story: { preforge: "story", choices: true },
    mainChapters: [mainPlan(2)],
    sceneFor: endsOnBigChoice,
  });
  assert.equal((await host.post("/preforge/start", { chapter: 2 })).allowed, true);
  await settle(host);
  assert.equal(mainBeats(host), 7);
  assert.equal(host.data(`${runId}:beat:2:6`).choices[0].id, "choice-1", "chapter 2 ends on a pending big choice");
  assert.equal((await host.post("/story-events")).events[0].canStart, true);
  const opened = await host.post("/story-event/plan", { chapter });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal((await host.post("/preforge/start", { chapter })).allowed, true);
  await settle(host);
  const status = await host.status();
  assert.deepEqual({ done: status.done, waitingChoice: status.waitingChoice }, { done: 7, waitingChoice: false });
  assert.equal((await mainStatus(host)).mode, "off");
  host.session().progress[chapter] = { normal: 10 };
  assert.equal((await mainStatus(host)).waitingChoice, true);
  const next = await host.post("/chapter-plan", { chapter: 3 });
  assert.deepEqual({ error: next.error, chapter: next.chapter }, { error: "choice-required", chapter: 2 });
  assert.equal((await host.post("/story/start", { chapter: 2, storyIndex: 0, nodeIndex: 0 })).ok, true);
});

await test("a Character Story's pending choice still stops the event from opening: the event holds only main chapters", async () => {
  // Forged while chapter 2 was forged, the Character Story follows it (after: 2) and was pre-forged to its choice.
  const host = await harness({ story: { preforge: "story", choices: true }, mainChapters: [mainPlan(2)] });
  const story = "bond-arden";
  host.put(`${runId}:chapter:${story}`, "chapter-plan", {
    title: "Arden's Story",
    premise: "A walk on the pier.",
    nodes: [0, 1, 2].map((index) => ({ type: "story", title: `Bond scene ${index}`, goal: "Talk.", guide: "Bond." })),
    bondUnitId: unitId,
    bondPart: 1,
    after: 2,
  });
  for (let index = 0; index < 3; index += 1)
    host.put(`${runId}:beat:${story}:${index}`, "beat", {
      chapter: story,
      storyIndex: index,
      segments: scene(`Bond scene ${index}`).segments,
      choices: index === 2 ? [bigChoice] : [],
      choiceCanon: {},
    });
  host.session().bondChapters = { [unitId]: { beats: 0, after: 2, opened: Date.now() - 1000 } };
  assert.equal((await host.post("/story-events")).events[0].canStart, true);
  const opened = await host.post("/story-event/plan", { chapter });
  assert.deepEqual(
    { ok: opened.ok, error: opened.error, chapter: opened.chapter },
    { ok: false, error: "choice-required", chapter: story },
  );
});

console.log(`${cases} Gacha Forge event pre-forge regression cases passed.`);
process.exit(0);
