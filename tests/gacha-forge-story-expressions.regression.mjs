import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import vm from "node:vm";
import {
  forgeStoryExpressionArt,
  forgeStoryExpressionNames,
  normalizeForgeStoryExpression,
} from "../sources/forge-kit/story-expressions.mjs";
import { forgeStoryExpressionFields } from "../packages/gacha-forge/src/story-expressions-en.mjs";
import { forgeAudioFields } from "../packages/gacha-forge/src/audio-en.mjs";
import { normalizeForgeAudio } from "../sources/forge-kit/audio-settings.mjs";
import { forgeChoiceLabel } from "../sources/forge-kit/player-choice-text.mjs";
import { forgeCanonicalSegments, forgeNormalizeChoiceBeat } from "../sources/forge-kit/player-choices-server.mjs";

const previousFetch = globalThis.fetch;
const previousAudio = globalThis.normalizeForgeAudio;
globalThis.forgeChoiceLabel = forgeChoiceLabel;
after(() => {
  delete globalThis.forgeChoiceLabel;
  globalThis.fetch = previousFetch;
  if (previousAudio === undefined) delete globalThis.normalizeForgeAudio;
  else globalThis.normalizeForgeAudio = previousAudio;
});

const until = async (check, message) => {
  for (let index = 0; index < 400; index += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

test("the four expressions are a closed set and only tagged lines with a ready image change the plate art", () => {
  assert.deepEqual(forgeStoryExpressionNames, ["anger", "fear", "sadness", "joy"]);
  for (const name of forgeStoryExpressionNames) assert.equal(normalizeForgeStoryExpression(name), name);
  for (const value of ["neutral", "Anger", "constructor", "", null, undefined, 3]) {
    assert.equal(normalizeForgeStoryExpression(value), "");
  }
  const arden = { name: "Arden", art: "arden.png", expressions: { anger: "arden-anger.png" } };
  assert.deepEqual(forgeStoryExpressionArt(arden, { expression: "anger" }), {
    ...arden,
    art: "arden-anger.png",
    neutral: "arden.png",
  });
  assert.equal(forgeStoryExpressionArt(arden, { expression: "joy" }), arden, "a missing image stays neutral");
  assert.equal(forgeStoryExpressionArt(arden, {}), arden, "an untagged line stays neutral");
  assert.equal(forgeStoryExpressionArt(arden, { expression: "constructor" }), arden);
  assert.equal(forgeStoryExpressionArt(null, { expression: "anger" }), null);
});

test("the toggle sits with the image toggles in World → Sources → Images, defaults off and needs an image connection", async () => {
  globalThis.normalizeForgeAudio = normalizeForgeAudio;
  const bundle = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  assert.ok(bundle.includes("it=forgeStoryExpressionFields([...forgeAnimationFields(),...forgeAudioFields(),"));
  const battle = bundle.match(
    /\{id:"images\.battleBackgrounds",step:"([a-z]+)",settings:"([a-z]+)",group:"([a-z]+)",type:"toggle"/u,
  );
  assert.ok(battle, "the shipped Battle backgrounds toggle");
  const fields = forgeStoryExpressionFields([
    ...forgeAudioFields(),
    { id: "images.enemyArt", step: battle[1], settings: battle[2], group: battle[3], type: "toggle" },
    { id: "images.battleBackgrounds", step: battle[1], settings: battle[2], group: battle[3], type: "toggle" },
    { id: "images.cgEvery", step: battle[1], settings: battle[2], group: battle[3], type: "range" },
  ]);
  const at = fields.findIndex((field) => field.id === "images.expressions");
  assert.equal(fields[at - 1].id, "images.battleBackgrounds");
  const field = fields[at];
  assert.equal(field.group, "images");
  assert.deepEqual([field.step, field.settings, field.group], battle.slice(1), "the same place as the image toggles");
  assert.equal(field.type, "toggle");
  assert.equal(field.default, false);
  assert.equal(field.label, "Expression portraits");
  assert.equal(field.showIf({}), false);
  assert.equal(field.showIf({ "images.connectionId": "img" }), true);
  assert.equal(
    fields.filter((item) => item.group === "audio").at(-1)?.id,
    forgeAudioFields()
      .filter((item) => item.group === "audio")
      .at(-1).id,
    "nothing joins the Audio group",
  );
});

test("the shipped plate follows each line, swaps faces on the same speaker and falls back to neutral", async () => {
  const bundle = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  const helpers = bundle.slice(bundle.indexOf("function Kl("), bundle.indexOf("function dg("));
  const source = bundle.slice(bundle.indexOf("function mg("), bundle.indexOf("function gg("));
  const calls = [];
  const timers = [];
  const plates = Object.fromEntries(
    ["left", "right"].map((side) => [
      side,
      {
        side,
        open: "false",
        setAttribute(name, value) {
          if (name === "data-open") this.open = value;
        },
      },
    ]),
  );
  let rootClick;
  const context = vm.createContext({
    window: { matchMedia: () => ({ matches: true }) },
    Jl: () => null,
    Zl: () => "",
    Go: String,
    Ql: (segment) => segment.speaker || "Narration",
    ok: 1,
    forgeStoryExpressionArt,
    setForgeStoryPortrait: (plate, character) => calls.push(["set", plate.side, character?.art]),
    showForgeStoryExpression: (plate, character) => calls.push(["show", plate.side, character?.art]),
    createForgeVoiceLine: () => ({ start() {}, reveal() {}, ready: () => true, dispose() {} }),
    forgeVoiceCharacter: () => null,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: (handler) => timers.push(handler),
    clearTimeout() {},
  });
  const mg = vm.runInContext(`${helpers};${source};mg`, context);
  const node = () => ({ hidden: false, setAttribute() {}, removeAttribute() {}, addEventListener() {} });
  const host = {
    querySelector(selector) {
      if (selector === ".root") return { addEventListener: (_name, handler) => (rootClick = handler) };
      if (selector === '[data-plate="left"]') return plates.left;
      if (selector === '[data-plate="right"]') return plates.right;
      return node();
    },
  };
  const cast = [
    { name: "Arden Vale", art: "arden.png", expressions: { anger: "arden-anger.png", joy: "arden-joy.png" } },
    { name: "Mari", art: "mari.png", prota: true, expressions: { sadness: "mari-sad.png" } },
    { name: "Lev", art: "lev.png" },
  ];
  mg(host, {
    cast,
    segments: [
      { speaker: "Arden Vale", text: "Neutral." },
      { speaker: "Arden Vale", text: "Angry.", expression: "anger" },
      { speaker: "Arden", text: "No fear image.", expression: "fear" },
      { speaker: "Arden Vale", text: "Joy.", expression: "joy" },
      { speaker: "Arden Vale", text: "Joy again.", expression: "joy" },
      { speaker: "Lev", text: "No set at all.", expression: "anger" },
      { speaker: "Mari", text: "Sad.", expression: "sadness" },
      { speaker: "", text: "Narration." },
      { speaker: "Arden Vale", text: "Old saved line." },
    ],
  });
  const next = () => {
    calls.length = 0;
    rootClick({ target: { closest: () => null } });
    while (timers.length) timers.shift()();
    return [...calls];
  };
  assert.deepEqual(calls, [["show", "right", "arden.png"]], "the first line keeps the rendered neutral face");
  assert.deepEqual(next(), [["show", "right", "arden-anger.png"]], "same speaker, new expression: no clear-then-set");
  assert.deepEqual(next(), [["show", "right", "arden.png"]], "a missing expression image falls back to neutral");
  assert.deepEqual(next(), [["show", "right", "arden-joy.png"]]);
  assert.deepEqual(next(), [["show", "right", "arden-joy.png"]], "an unchanged face is left to the plate to keep");
  assert.deepEqual(next(), [["set", "right", "lev.png"]], "a speaker change still replaces the plate");
  assert.deepEqual(next(), [["set", "left", "mari-sad.png"]], "the persona shows its expression after the side swap");
  assert.deepEqual(next(), [], "narration closes the plates");
  assert.equal(plates.left.open, "false");
  assert.deepEqual(next(), [["set", "right", "arden.png"]], "an untagged saved line shows neutral");
});

test("the shipped template opens the first line with its expression", async () => {
  const bundle = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  const anchor = "w=k.length?forgeStoryExpressionArt(Xl(k,h.speaker),h):null";
  assert.equal(bundle.split(anchor).length, 2);
});

test("the shipped segment normalizer keeps a valid expression on mainline and choice-branch lines", async () => {
  const bundle = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
  const AS = new Function(
    "l",
    "ir",
    "normalizeForgeMusicMood",
    "normalizeForgeStoryExpression",
    `const Ry=4,Oy=2;return (${bundle.slice(bundle.indexOf("function AS("), bundle.indexOf("function SS("))})`,
  )(
    (value) => (typeof value === "string" ? value.trim() : ""),
    (value) => String(value ?? "").toLowerCase(),
    () => "happy",
    normalizeForgeStoryExpression,
  );
  const line = (speaker, expression, thought) => ({
    speaker,
    text: `${speaker || "Narrator"} line.`,
    expression,
    thought,
  });
  const beat = forgeNormalizeChoiceBeat(
    {
      segments: [line("Arden", "anger"), line("", "joy"), line("Mari", "sadness", true), line("Arden", "neutral")],
      places: [],
      choices: [
        {
          kind: "small",
          at: 0,
          options: [
            { text: "Calm her", selection: { kind: "dialogue", text: "Easy." }, segments: [line("Arden", "joy")] },
            {
              text: "Step back",
              selection: { kind: "action", text: "You step back." },
              segments: [line("Arden", "fear"), line("", "fear")],
            },
          ],
        },
      ],
    },
    {},
    AS,
    { enabled: true, terminal: false },
  );
  assert.deepEqual(
    beat.segments.map((segment) => segment.expression),
    ["anger", undefined, "sadness", undefined],
  );
  assert.deepEqual(
    beat.choices[0].options.map((option) => option.segments.map((segment) => segment.expression)),
    [["joy"], ["fear", undefined]],
  );
  assert.equal(
    forgeCanonicalSegments({ ...beat, choiceCanon: { "choice-1": "option-2" }, choiceProtagonist: "Mari" })[3]
      .expression,
    "fear",
    "a chosen branch line keeps its face",
  );
});

// ---- Shipped server: settings, segments, cast, queue, invalidation and world delete ----
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const docs = new Map();
const routes = new Map();
const prompts = [];
const paints = [];
const deleted = [];
let uploads = 0;
let failPaint = () => false;
let duringPaint = () => {};
let beatReply = null;
const runId = "expr-world";
const seed = (id, kind, data) =>
  docs.set(id, {
    id,
    kind,
    packageId: "gacha-forge",
    name: id,
    description: "fixture",
    revision: 1,
    data: structuredClone(data),
  });
const unitData = (id) => docs.get(`${runId}:unit:${id}`).data;
const editUnit = (id, change) => {
  const doc = docs.get(`${runId}:unit:${id}`);
  doc.data = { ...doc.data, ...change };
  doc.revision += 1;
};
const run = (images) => ({
  runId,
  name: "Expressions",
  scenario: "A fictional harbour.",
  connectionId: "fixture-model",
  protagonist: { name: "Mari", personaId: "persona-1", avatarPath: "/api/avatars/file/mari-old.png" },
  story: { choices: false },
  images,
});
const json = (value, status = 200) => ({
  ok: status < 400,
  status,
  headers: { get: () => "application/json" },
  json: async () => structuredClone(value),
});

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  const path = decodeURIComponent(url.pathname);
  if (path === "/api/connections")
    return json([
      { id: "fixture-model", provider: "fixture", model: "fixture", maxContext: 128000 },
      { id: "img", provider: "image_generation", model: "painter" },
    ]);
  if (path === "/api/app-settings/ui") return json({});
  if (path === "/api/characters/personas/persona-1") return json({ avatarPath: "/api/avatars/file/mari.png" });
  if (path.startsWith("/api/global-gallery/file/") || path.startsWith("/api/avatars/file/"))
    return {
      ok: true,
      status: 200,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => pixel.buffer.slice(pixel.byteOffset, pixel.byteOffset + pixel.byteLength),
    };
  if (path === "/api/characters/avatar-generation") {
    const body = JSON.parse(init.body);
    paints.push(body);
    await duringPaint(body);
    if (failPaint(body)) return json({ error: "provider said no" }, 502);
    return json({ image: `data:image/png;base64,${pixel.toString("base64")}`, prompt: body.promptOverrides[0].prompt });
  }
  if (path === "/api/global-gallery/upload") {
    uploads += 1;
    return json({ id: `g${uploads}`, url: `/api/global-gallery/file/g${uploads}.png` });
  }
  if (init.method === "DELETE" && path.startsWith("/api/global-gallery/")) {
    const id = path.slice("/api/global-gallery/".length);
    const still = [...docs.values()].some((doc) => JSON.stringify(doc.data).includes(`global-gallery:${id}"`));
    assert.equal(still, false, `gallery image ${id} is deleted only after no document references it`);
    deleted.push(id);
    return { ok: true, status: 200 };
  }
  throw new Error(`unexpected fetch ${init.method || "GET"} ${path}`);
};

seed("index", "index", { runs: [run({ connectionId: "img", expressions: true })], activeRunId: runId });
seed(`${runId}:session`, "session", { progress: {} });
seed(`${runId}:chapter:1`, "chapter-plan", {
  chapter: 1,
  nodes: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => ({
    index: index + 1,
    type: "story",
    title: "Harbour",
    guide: "Talk.",
    goal: "Go on.",
  })),
});
const seedBeat = (index, segments) =>
  seed(`${runId}:beat:1:${index}`, "beat", { chapter: 1, storyIndex: index, musicMood: "happy", segments, places: [] });
seed(`${runId}:unit:arden`, "unit", {
  kind: "character",
  name: "Arden",
  identitySex: "female",
  identityLine: "a tall woman with silver hair",
  portrait: "/api/global-gallery/file/arden-p1.png",
  portraitRef: "global-gallery:arden-p1",
  outfits: [{ id: "outfit:sea:arden", url: "/api/global-gallery/file/arden-o1.png", outfitLine: "a sailor's coat" }],
  wornOutfit: "outfit:sea:arden",
});
seed(`${runId}:unit:brann`, "unit", {
  kind: "character",
  name: "Brann",
  identitySex: "male",
  portrait: "/api/global-gallery/file/brann.png",
});
seed(`${runId}:unit:cara`, "unit", {
  kind: "character",
  name: "Cara",
  identitySex: "female",
  portrait: "/api/global-gallery/file/cara.png",
});
seed(`${runId}:unit:protagonist`, "unit", {
  kind: "character",
  name: "Mari",
  isProtagonist: true,
  portrait: "/api/avatars/file/mari.png",
});
seedBeat(0, [
  { speaker: "Arden", text: "We sail at dawn.", expression: "joy" },
  { speaker: "Mari", text: "I am not ready." },
  { speaker: "", text: "Brann watches from the pier." },
]);

const { activate } = await import(`../packages/gacha-forge/server.mjs?expressions=${Date.now()}`);
const clone = (value) => structuredClone(value);
await activate({
  package: { id: "gacha-forge", version: "fixture" },
  api: {
    runtime: {
      persistence: {
        documents: {
          getById: async (_package, id) => clone(docs.get(id) || null),
          list: async (_package, kind) => clone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
          create: async (doc) => {
            const stored = { ...clone(doc), revision: 1 };
            docs.set(doc.id, stored);
            return clone(stored);
          },
          update: async (doc) => {
            const old = docs.get(doc.id);
            if (old?.revision !== doc.expectedRevision) return null;
            const stored = { ...old, ...clone(doc), revision: old.revision + 1 };
            delete stored.expectedRevision;
            docs.set(doc.id, stored);
            return clone(stored);
          },
          remove: async (_package, id) => docs.delete(id),
        },
      },
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      json: { parseJsonish: JSON.parse },
      languageModels: {
        async resolveForRequest() {
          return {
            model: "fixture",
            async chatComplete(messages) {
              prompts.push(messages);
              return { content: JSON.stringify(beatReply), finishReason: "stop" };
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
const post = (path, body) => routes.get(`POST ${path}`)({ body });
const open = async (storyIndex) => {
  const result = await post("/beat", { runId, chapter: 1, storyIndex });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};
const record = (unit, base) => unitData(unit).expressions?.[base];
const ready = (unit, base) => record(unit, base)?.state === "ready";
const castOf = (result, name) => result.cast.find((character) => character.name === name);

test("the settings normalizer keeps the toggle and stamps a re-enable for one explicit retry", async () => {
  const saved = await post("/run/sources", { runId, sources: { images: { expressions: false } } });
  assert.equal(saved.ok, true);
  assert.equal(saved.run.images.expressions, false);
  assert.equal(saved.run.images.connectionId, "img", "a partial save keeps the other image settings");
  const on = await post("/run/sources", { runId, sources: { images: { expressions: true } } });
  assert.equal(on.run.images.expressions, true);
  assert.ok(Date.parse(on.run.images.expressionsSince), "turning it on records when");
  const again = await post("/run/sources", { runId, sources: { images: { expressions: "true" } } });
  assert.equal(again.run.images.expressionsSince, on.run.images.expressionsSince, "saving it on again is no re-enable");
  const replaced = await post("/run/images", { runId, images: { connectionId: "img", expressions: true } });
  assert.equal(replaced.images.expressions, true, "the replacing save keeps the key too");
  await post("/run/sources", {
    runId,
    sources: { images: { expressions: true, expressionsSince: on.run.images.expressionsSince } },
  });
});

test("opening a scene paints one set per speaking base only, as edits of that base, and the cast exposes it", async () => {
  const first = await open(0);
  assert.equal(castOf(first, "Arden").expressions, undefined, "nothing shows before a set is ready");
  const arden = "/api/global-gallery/file/arden-o1.png";
  const mari = "/api/avatars/file/mari.png";
  await until(() => ready("arden", arden) && ready("protagonist", mari), "speaker sets finish");
  await settle();
  assert.equal(paints.length, 8, "four faces for the worn outfit and four for the persona");
  assert.equal(record("brann", "/api/global-gallery/file/brann.png"), undefined, "a silent unit costs nothing");
  for (const body of paints) {
    assert.equal(body.referenceImages.length, 1, "the base is the only reference");
    assert.equal(body.referenceImages[0], `data:image/png;base64,${pixel.toString("base64")}`);
    assert.match(body.promptOverrides[0].prompt, /change ONLY the facial expression/u);
    assert.equal(body.debugMode, false);
  }
  const ardenPaints = paints.filter((body) => body.name === "Arden");
  assert.match(ardenPaints[0].promptOverrides[0].prompt, /silver hair/u);
  assert.match(ardenPaints[0].promptOverrides[0].prompt, /sailor's coat/u);
  assert.deepEqual([ardenPaints[0].width, ardenPaints[0].height], [832, 1216], "portrait size");
  const mariPaints = paints.filter((body) => body.name === "Mari");
  assert.deepEqual([mariPaints[0].width, mariPaints[0].height], [832, 832], "the persona avatar is painted square");
  assert.deepEqual(Object.keys(record("arden", arden).images), forgeStoryExpressionNames);
  const second = await open(0);
  assert.deepEqual(Object.keys(castOf(second, "Arden").expressions), forgeStoryExpressionNames);
  assert.equal(castOf(second, "Arden").art, arden, "the neutral face is still the base");
  assert.deepEqual(Object.keys(castOf(second, "Mari").expressions), forgeStoryExpressionNames);
  assert.equal(castOf(second, "Brann").expressions, undefined);
  await settle();
  assert.equal(paints.length, 8, "a ready set is never repainted");
});

test("switching outfits paints each base once and switching back never pays again", async () => {
  editUnit("arden", { wornOutfit: "" });
  const portrait = "/api/global-gallery/file/arden-p1.png";
  const result = await open(0);
  assert.equal(castOf(result, "Arden").expressions, undefined, "the portrait has no set yet");
  await until(() => ready("arden", portrait), "portrait set finishes");
  assert.equal(paints.length, 12);
  assert.ok(ready("arden", "/api/global-gallery/file/arden-o1.png"), "the outfit's set is kept while it exists");
  editUnit("arden", { wornOutfit: "outfit:sea:arden" });
  const back = await open(0);
  assert.equal(
    castOf(back, "Arden").expressions.joy,
    record("arden", "/api/global-gallery/file/arden-o1.png").images.joy.url,
  );
  await settle();
  assert.equal(paints.length, 12);
});

test("turning the setting off or losing images stops painting and shows the base image", async () => {
  await post("/run/sources", { runId, sources: { images: { expressions: false } } });
  seedBeat(1, [{ speaker: "Cara", text: "Hello." }]);
  const off = await open(1);
  assert.ok(
    off.cast.every((character) => !character.expressions),
    "plates show the base images",
  );
  await settle();
  assert.equal(paints.length, 12);
  assert.ok(ready("arden", "/api/global-gallery/file/arden-o1.png"), "turning it off keeps existing sets");
  await post("/run/sources", { runId, sources: { images: { expressions: true, connectionId: "" } } });
  const noImages = await open(1);
  assert.ok(noImages.cast.every((character) => !character.expressions));
  await settle();
  assert.equal(paints.length, 12);
  await post("/run/sources", { runId, sources: { images: { connectionId: "img" } } });
});

test("a failed set is never repaid automatically; re-enabling allows one retry of the missing faces", async () => {
  const cara = "/api/global-gallery/file/cara.png";
  failPaint = (body) => body.name === "Cara" && body.promptOverrides[0].prompt.includes("frightened");
  await open(1);
  await until(() => record("cara", cara)?.state === "failed", "Cara's set fails");
  assert.deepEqual(Object.keys(record("cara", cara).images), ["anger"], "the face painted before the failure is kept");
  const paid = paints.length;
  await open(1);
  await open(1);
  await settle();
  assert.equal(paints.length, paid, "reopening never repays a failed set");
  failPaint = () => false;
  await post("/run/sources", { runId, sources: { images: { expressions: false } } });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await post("/run/sources", { runId, sources: { images: { expressions: true } } });
  await open(1);
  await until(() => ready("cara", cara), "the explicit retry finishes");
  assert.equal(paints.length, paid + 3, "only the three missing faces are painted");
  editUnit("brann", {
    expressions: {
      "/api/global-gallery/file/brann.png": { state: "pending", at: new Date().toISOString(), images: {} },
    },
  });
  seedBeat(2, [{ speaker: "Brann", text: "Where was I?" }]);
  await open(2);
  await until(
    () => record("brann", "/api/global-gallery/file/brann.png").state === "failed",
    "interrupted set is failed",
  );
  assert.equal(record("brann", "/api/global-gallery/file/brann.png").error, "interrupted");
  await settle();
  assert.equal(paints.length, paid + 3, "an interrupted set is not repainted after a restart");
});

test("a redrawn portrait prunes its old set, deleting gallery images only after the document drops them", async () => {
  const old = record("cara", "/api/global-gallery/file/cara.png");
  const ids = Object.values(old.images).map((image) => image.ref.slice("global-gallery:".length));
  editUnit("cara", { portrait: "/api/global-gallery/file/cara-2.png" });
  await open(1);
  await until(() => ready("cara", "/api/global-gallery/file/cara-2.png"), "the new portrait's set finishes");
  assert.equal(record("cara", "/api/global-gallery/file/cara.png"), undefined);
  assert.deepEqual(deleted.slice(-ids.length).sort(), ids.sort());
});

test("a base redrawn while its faces paint discards the result and deletes its image", async () => {
  editUnit("brann", { expressions: {} });
  let redrawn = false;
  duringPaint = (body) => {
    if (body.name !== "Brann" || redrawn) return;
    redrawn = true;
    editUnit("brann", { portrait: "/api/global-gallery/file/brann-2.png" });
  };
  const before = deleted.length;
  const uploadsBefore = uploads;
  await open(2);
  await until(() => deleted.length > before, "the stale face is deleted");
  assert.equal(deleted.at(-1), `g${uploadsBefore + 1}`);
  assert.equal(record("brann", "/api/global-gallery/file/brann.png")?.images?.anger, undefined, "nothing was filed");
  duringPaint = () => {};
});

test("a newly written scene keeps valid expression tags on dialogue and thoughts only and queues its speakers", async () => {
  beatReply = {
    musicMood: "tense",
    places: [],
    segments: [
      { speaker: "Brann", text: "Get down!", expression: "fear" },
      { speaker: "Brann", text: "Furious.", expression: "furious" },
      { speaker: "", text: "The pier shakes.", expression: "joy" },
      { speaker: "Mari", text: "Not again.", thought: true, expression: "sadness" },
    ],
  };
  const written = await open(3);
  const saved = docs.get(`${runId}:beat:1:3`).data.segments;
  assert.deepEqual(
    saved.map((segment) => segment.expression),
    ["fear", undefined, undefined, "sadness"],
  );
  assert.deepEqual(
    written.segments.map((segment) => segment.expression),
    ["fear", undefined, undefined, "sadness"],
  );
  assert.match(
    prompts
      .at(-1)
      .map((message) => message.content)
      .join("\n"),
    /- expression: optional/u,
  );
  await until(() => ready("brann", "/api/global-gallery/file/brann-2.png"), "the writer's speakers are queued");
});

test("deleting the world deletes every expression image", async () => {
  const refs = [...docs.values()]
    .filter((doc) => doc.id.startsWith(`${runId}:unit:`))
    .flatMap((doc) => Object.values(doc.data.expressions || {}))
    .flatMap((set) => Object.values(set.images || {}))
    .map((image) => image.ref.slice("global-gallery:".length));
  assert.ok(refs.length >= 16);
  const result = await post("/run/delete", { runId });
  assert.notEqual(result?.ok, false, JSON.stringify(result));
  for (const id of refs) assert.ok(deleted.includes(id), `world delete removes ${id}`);
});
