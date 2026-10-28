// Forge kit options. (a) Imported as plain ESM with every option passed, a kit module reads no Gacha Forge global.
// (b) Pasted the way Gacha Forge's bundle pastes it, beside GF's globals in a vm context, its defaults give GF's
// results. (c) Another game's names, looks, avatar-path reader, log prefix, scope name and label are honoured.
// The audio and log-prefix defaults name only their own module's declarations, so plain ESM is GF's pasted result.
import assert from "node:assert/strict";
import { AsyncResource, createHook } from "node:async_hooks";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { createForgeMusicPromptService, forgeMusicBriefMessages } from "../sources/forge-kit/audio-prompts.mjs";
import {
  availableForgeSoundtracks,
  forgeSoundtrackContextKey,
  normalizeForgeMusicMood,
  recordForgeSoundtrack,
} from "../sources/forge-kit/audio-settings.mjs";
import { forgeHydrateStoryCharacters, logForgeStoryPrompt } from "../sources/forge-kit/character-card-context.mjs";
import { forgeLocalAvatarPath, forgeWrapImageReferenceClient } from "../sources/forge-kit/image-avatar-references.mjs";
import { forgeChoiceLabel } from "../sources/forge-kit/player-choice-text.mjs";
import { forgeNormalizeChoiceBeat } from "../sources/forge-kit/player-choices-server.mjs";
import {
  forgeStoryExpressionArt,
  forgeStoryExpressionNames,
  normalizeForgeStoryExpression,
} from "../sources/forge-kit/story-expressions.mjs";
import {
  createForgeStoryExpressions,
  forgeExpressionLooks,
  forgeStoryExpressionCast,
  forgeStoryExpressionPrompt,
} from "../sources/forge-kit/story-expressions-server.mjs";
import { forgeSpeakerVoice, forgeStableVoice, forgeStoryPersona } from "../sources/forge-kit/voice-picking.mjs";

// The siblings Gacha Forge's bundle supplies to these modules. (a) runs with none of them on globalThis.
const gachaGlobals = [
  "forgeStoryExpressionNames",
  "forgeLocalAvatarPath",
  "forgeChoiceLabel",
  "forgeConnectionVoices",
  "forgeMusicScenes",
  "forgeSoundtrackCues",
  "forgeSoundtrackContextKey",
];
for (const name of gachaGlobals) assert.equal(name in globalThis, false, `${name} is not a global in this test`);

// Otome Forge's shape: five faces with their own looks, and a path reader that accepts only its own art.
const faces = ["tender", "flustered", "cold", "hurt", "angry"];
const looks = {
  tender: ["a tender expression: softened eyes, a faint warm smile", "tender, soft eyes, faint smile"],
  flustered: ["a flustered expression: blushing cheeks, eyes glancing away", "flustered, blush, looking away"],
  cold: ["a cold expression: a level, unimpressed stare, a still mouth", "cold stare, expressionless"],
  hurt: ["a hurt expression: drawn brows, glassy eyes, a tight mouth", "hurt, glassy eyes, drawn brows"],
  angry: forgeExpressionLooks.anger,
};
const otomePath = (value) => (typeof value === "string" && value.startsWith("/otome/") ? value : "");
const plain = (value) => JSON.parse(JSON.stringify(value));
const until = async (check, message) => {
  for (let index = 0; index < 400; index += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
};

// Gacha Forge's bundle shape (scripts/gacha-forge-bundle-patches.mjs): a block's kit sources joined with `export `
// dropped. A vm script cannot import, so the one node: import is handed in as the name it binds.
async function gachaBlock(names, globals, exported) {
  const sources = await Promise.all(
    names.map((name) => readFile(new URL(`../sources/forge-kit/${name}.mjs`, import.meta.url), "utf8")),
  );
  const text = sources
    .join("\n")
    .replace(/^export /gmu, "")
    .replace(/^import \{ AsyncResource as ForgeStoryExpressionScope \} from "node:async_hooks";$/mu, "");
  assert.doesNotMatch(text, /^import /mu, "every import is handed in");
  const context = vm.createContext({ ForgeStoryExpressionScope: AsyncResource, ...globals });
  return vm.runInContext(`${text}\n;({ ${exported.join(", ")} })`, context);
}

// One unit that speaks in a scene, painted by an expressions instance; records every paid face and log line.
async function paint(create, { portrait, ...options }) {
  const unitId = "w:unit:arden";
  const docs = new Map([[unitId, { id: unitId, revision: 1, data: { kind: "character", name: "Arden", portrait } }]]);
  const run = { runId: "w", images: { expressions: true, portraitWidth: 832, portraitHeight: 1216 } };
  const seen = { paid: [], looks: [], references: [], logs: [], scopes: [] };
  const hook = createHook({
    init(_id, type) {
      if (type.endsWith("-expressions")) seen.scopes.push(type);
    },
  }).enable();
  let uploads = 0;
  let settled = false;
  const client = {
    cardAvatarImage: async (reference) => {
      seen.references.push(reference);
      return { base64: "AA==", mime: "image/png" };
    },
    personaAvatar: async () => "",
    async generateExpression({ expression, looks: sent }) {
      seen.paid.push(expression);
      seen.looks.push(sent);
      return { overrideTook: false, sentPrompt: "sent", prompt: "prompt" };
    },
    async uploadToGallery() {
      uploads += 1;
      return { id: `g${uploads}`, url: `/api/global-gallery/file/g${uploads}.png` };
    },
    deleteGalleryImage: async () => true,
  };
  const log = (message) => seen.logs.push(message);
  try {
    const instance = create({
      documents: {
        getById: async (_package, id) => structuredClone(docs.get(id) || null),
        list: async () => structuredClone([...docs.values()]),
      },
      packageId: "test",
      logger: { warn: log, info: log, debug: log },
      readRun: async () => run,
      images: (value) => value.images,
      connection: async () => ({ id: "img", provider: "p", model: "m" }),
      client: () => client,
      slot: (_target, job) => job(),
      dedupe: (_key, job) => job(),
      background: (job) => job().finally(() => (settled = true)),
      update: async (id, change) => {
        const doc = docs.get(id);
        const data = structuredClone(doc.data);
        change(data);
        docs.set(id, { ...doc, data, revision: doc.revision + 1 });
        return structuredClone(data);
      },
      base: (unit) => unit.portrait,
      galleryRef: (id) => `global-gallery:${id}`,
      ...options,
    });
    instance.queue("w", run, [{ name: "Arden" }], { segments: [{ speaker: "Arden", text: "Hello." }] });
    await until(() => settled, "the set finishes painting");
  } finally {
    hook.disable();
  }
  return { ...seen, record: docs.get(unitId).data.expressions?.[portrait] };
}

const readySet = (names) => ({
  state: "ready",
  images: Object.fromEntries(names.map((name) => [name, { url: `/api/global-gallery/file/${name}.png`, ref: name }])),
});

test("(a, c) expression names, looks and cast work as plain ESM with Otome's five faces", () => {
  assert.equal(normalizeForgeStoryExpression("flustered", faces), "flustered");
  assert.equal(normalizeForgeStoryExpression("joy", faces), "", "a Gacha Forge face is not one of Otome's");
  const arden = { name: "Arden", art: "arden.png", expressions: { hurt: "arden-hurt.png", joy: "arden-joy.png" } };
  assert.deepEqual(forgeStoryExpressionArt(arden, { expression: "hurt" }, faces), {
    ...arden,
    art: "arden-hurt.png",
    neutral: "arden.png",
  });
  assert.equal(forgeStoryExpressionArt(arden, { expression: "joy" }, faces), arden);

  const base = "/otome/arden.png";
  const unit = { expressions: { [base]: readySet([...faces, "joy"]) } };
  const cast = forgeStoryExpressionCast({ expressions: true }, unit, base, faces);
  assert.deepEqual(Object.keys(cast.expressions), faces, "only Otome's faces reach the cast");

  const prompt = forgeStoryExpressionPrompt({ name: "Arden" }, base, "cold", {}, { looks });
  assert.match(prompt.prompt, /a level, unimpressed stare/u);
  const tagged = forgeStoryExpressionPrompt({ name: "Arden" }, base, "cold", {}, { tagged: true, looks });
  assert.match(tagged.prompt, /cold stare, expressionless/u);
});

test("(a, c) a choice beat takes Otome's label as plain ESM", () => {
  const raw = {
    segments: [{ speaker: "Arden", text: "Well?" }],
    choices: [
      {
        kind: "small",
        at: 0,
        options: [
          { text: "Tease him", selection: { kind: "action", text: "You grin." }, segments: [{ text: "He sighs." }] },
          { text: "Thank him", selection: { kind: "dialogue", text: "Thanks." }, segments: [{ text: "He nods." }] },
        ],
      },
    ],
  };
  const normalizeBeat = (value) => ({ segments: value.segments.map((segment) => ({ ...segment })), places: [] });
  const label = (text) => `${text}…`;
  const beat = forgeNormalizeChoiceBeat(raw, {}, normalizeBeat, { enabled: true, terminal: false, label });
  assert.deepEqual(
    beat.choices[0].options.map((option) => option.text),
    ["Tease him…", "Thank him…"],
  );
});

test("(a) voice picking takes its voice list as plain ESM", async () => {
  const empty = { enabled: true, npcDefaultMaleVoices: [], npcDefaultFemaleVoices: [] };
  const listVoices = async () => ["v1", "v2", "v3"];
  assert.equal(
    await forgeSpeakerVoice(empty, { name: "Bryn" }, true, listVoices),
    forgeStableVoice(["v1", "v2", "v3"], "Bryn"),
  );
  assert.deepEqual(forgeStoryPersona({ name: "Mari", personaId: "p1" }, "you"), {
    name: "Mari",
    characterId: "p1",
    prota: true,
  });
});

test("(a, c) Otome's expression set paints its five faces with its looks, reader, log prefix and scope", async () => {
  const painted = await paint(createForgeStoryExpressions, {
    portrait: "/otome/arden.png",
    names: faces,
    looks,
    localAvatarPath: otomePath,
    logPrefix: "[otome-forge]",
    scopeName: "otome-forge-expressions",
  });
  assert.deepEqual(painted.paid, faces);
  assert.ok(
    painted.looks.every((sent) => sent === looks),
    "the client gets Otome's looks for its prompt",
  );
  assert.deepEqual(painted.references, ["/otome/arden.png"], "Otome's reader picks the base");
  assert.equal(painted.record.state, "ready");
  assert.deepEqual(Object.keys(painted.record.images), faces);
  assert.ok(painted.logs.length > 0);
  assert.ok(
    painted.logs.every((line) => line.startsWith("[otome-forge] ")),
    painted.logs.join("\n"),
  );
  assert.deepEqual(painted.scopes, ["otome-forge-expressions"]);
});

test("(b) Gacha Forge's pasted expressions keep GF's names, looks, reader, log prefix and scope", async () => {
  const gf = await gachaBlock(["story-expressions", "story-expressions-server"], { forgeLocalAvatarPath }, [
    "normalizeForgeStoryExpression",
    "forgeStoryExpressionArt",
    "forgeStoryExpressionCast",
    "forgeStoryExpressionPrompt",
    "createForgeStoryExpressions",
  ]);
  assert.equal(gf.normalizeForgeStoryExpression("anger"), "anger");
  assert.equal(gf.normalizeForgeStoryExpression("tender"), "");
  const arden = { name: "Arden", art: "arden.png", expressions: { anger: "arden-anger.png" } };
  assert.deepEqual(
    plain(gf.forgeStoryExpressionArt(arden, { expression: "anger" })),
    forgeStoryExpressionArt(arden, { expression: "anger" }, forgeStoryExpressionNames),
  );

  const base = "/api/global-gallery/file/arden.png";
  const unit = { expressions: { [base]: readySet([...forgeStoryExpressionNames, "tender"]) } };
  const cast = plain(gf.forgeStoryExpressionCast({ expressions: true }, unit, base));
  assert.deepEqual(cast, forgeStoryExpressionCast({ expressions: true }, unit, base, forgeStoryExpressionNames));
  assert.deepEqual(Object.keys(cast.expressions), ["anger", "fear", "sadness", "joy"]);

  for (const tagged of [false, true]) {
    const prompt = plain(gf.forgeStoryExpressionPrompt({ name: "Arden" }, base, "anger", {}, { tagged }));
    assert.deepEqual(
      prompt,
      forgeStoryExpressionPrompt({ name: "Arden" }, base, "anger", {}, { tagged, looks: forgeExpressionLooks }),
    );
    assert.match(prompt.prompt, tagged ? /angry, furrowed brows, glaring/u : /narrowed glaring eyes, a tense jaw/u);
  }

  const painted = await paint(gf.createForgeStoryExpressions, { portrait: base });
  assert.deepEqual(painted.paid, ["anger", "fear", "sadness", "joy"]);
  assert.ok(painted.looks.every((sent) => JSON.stringify(sent) === JSON.stringify(forgeExpressionLooks)));
  assert.deepEqual(painted.references, [base], "GF's own avatar-path reader accepts its gallery base");
  assert.ok(painted.logs.length > 0);
  assert.ok(
    painted.logs.every((line) => line.startsWith("[gacha-forge] ")),
    painted.logs.join("\n"),
  );
  assert.deepEqual(painted.scopes, ["gacha-forge-expressions"]);
});

test("(b) Gacha Forge's pasted choices keep GF's label punctuation", async () => {
  const gf = await gachaBlock(["player-choice-text", "player-choices-server"], {}, ["forgeNormalizeChoiceBeat"]);
  const raw = {
    segments: [{ speaker: "Arden", text: "Well?" }],
    choices: [
      {
        kind: "small",
        at: 0,
        options: [
          { text: "Apologize", selection: { kind: "action", text: "You bow." }, segments: [{ text: "She nods." }] },
          { text: "Leave!", selection: { kind: "action", text: "You go." }, segments: [{ text: "She frowns." }] },
        ],
      },
    ],
  };
  const normalizeBeat = (value) => ({ segments: value.segments.map((segment) => ({ ...segment })), places: [] });
  const options = { enabled: true, terminal: false };
  const pasted = plain(gf.forgeNormalizeChoiceBeat(raw, {}, normalizeBeat, options));
  assert.deepEqual(pasted, forgeNormalizeChoiceBeat(raw, {}, normalizeBeat, { ...options, label: forgeChoiceLabel }));
  assert.deepEqual(
    pasted.choices[0].options.map((option) => option.text),
    ["Apologize.", "Leave!"],
  );
});

test("(b) Gacha Forge's pasted voice picking lists voices with GF's connection list", async () => {
  const listed = [];
  const forgeConnectionVoices = async (config) => {
    listed.push(config);
    return ["v1", "v2", "v3"];
  };
  const gf = await gachaBlock(["voice-picking"], { forgeConnectionVoices }, ["forgeSpeakerVoice"]);
  const empty = { enabled: true, npcDefaultMaleVoices: [], npcDefaultFemaleVoices: [] };
  assert.equal(
    await gf.forgeSpeakerVoice(empty, { name: "Bryn" }, true),
    await forgeSpeakerVoice(empty, { name: "Bryn" }, true, forgeConnectionVoices),
  );
  assert.equal(await gf.forgeSpeakerVoice(empty, { name: "Bryn" }, true), forgeStableVoice(["v1", "v2", "v3"], "Bryn"));
  assert.ok(listed.length >= 2 && listed.every((config) => config === empty));
});

const otomeScenes = { home: "a quiet evening at home", confession: "a held-breath confession under city lights" };
const otomeCues = ["home", "date", "tender", "tense", "angst", "confession"];
const world = { scenario: "A frost kingdom under a red moon." };

test("(b) music brief defaults are byte-identical to GF 1.26.1, so saved brief fingerprints stay valid", () => {
  const messages = forgeMusicBriefMessages(world, "home", null);
  assert.equal(
    createHash("sha256").update(JSON.stringify(messages)).digest("hex"),
    "b696dd6087beb8582cef3e863920e2ab58672d5e2f0ada834e853be4a7a6e720",
  );
  assert.match(messages[0].content, /an original instrumental game soundtrack brief in English/u);
  assert.deepEqual(forgeMusicBriefMessages(world, "home", null, {}), messages);
});

test("(a, c) music brief honours another game's scenes and medium", () => {
  const messages = forgeMusicBriefMessages(world, "confession", null, {
    scenes: otomeScenes,
    medium: "romance visual novel",
  });
  assert.match(messages[0].content, /an original instrumental romance visual novel brief in English/u);
  assert.doesNotMatch(messages[0].content, /game soundtrack/u);
  assert.deepEqual(JSON.parse(messages[1].content), {
    world: world.scenario,
    soundtrackContext: otomeScenes.confession,
  });
});

test("(a, b, c) the music prompt service validates cues against, and passes through, its scenes and medium", async () => {
  const service = (options = {}) => {
    const calls = [];
    const session = {};
    return {
      calls,
      session,
      ask: createForgeMusicPromptService({
        readWorld: async () => structuredClone(world),
        readSession: async () => structuredClone(session),
        updateSession: async (_id, update) => (update(session), structuredClone(session)),
        generate: async ({ messages }) => (calls.push(messages), { ok: true, value: { prompt: "Solo piano." } }),
        ...options,
      }),
    };
  };
  const gf = service();
  assert.deepEqual(await gf.ask({ runId: "r", cue: "confession" }), { ok: false, error: "bad-request" });
  assert.deepEqual(await gf.ask({ runId: "r", cue: "combat" }), { ok: true, prompt: "Solo piano.", cached: false });
  assert.deepEqual(gf.calls[0], forgeMusicBriefMessages(world, "combat", null));

  const otome = service({ scenes: otomeScenes, medium: "romance visual novel" });
  assert.deepEqual(await otome.ask({ runId: "r", cue: "combat" }), { ok: false, error: "bad-request" });
  assert.deepEqual(await otome.ask({ runId: "r", cue: "confession" }), {
    ok: true,
    prompt: "Solo piano.",
    cached: false,
  });
  const expected = forgeMusicBriefMessages(world, "confession", null, {
    scenes: otomeScenes,
    medium: "romance visual novel",
  });
  assert.deepEqual(otome.calls[0], expected);
  assert.equal(
    otome.session.audioPrompts.confession.fingerprint,
    createHash("sha256").update(JSON.stringify(expected)).digest("hex"),
  );
  // The saved fingerprint was computed with the same options, so the next request is served from the cache.
  assert.deepEqual(await otome.ask({ runId: "r", cue: "confession" }), {
    ok: true,
    prompt: "Solo piano.",
    cached: true,
  });
  assert.equal(otome.calls.length, 1);
});

test("(a, b, c) music mood keeps GF's list and fallback, and another list falls back to its first mood", () => {
  assert.equal(normalizeForgeMusicMood("tense"), "tense");
  assert.equal(normalizeForgeMusicMood("angst"), "happy");
  assert.equal(normalizeForgeMusicMood(undefined), "happy");
  assert.equal(normalizeForgeMusicMood("angst", ["tender", "angst"]), "angst");
  assert.equal(normalizeForgeMusicMood("happy", ["tender", "angst"]), "tender");
});

const track = (scope, cue, runId = "run-1", connectionId = "music") => {
  const key = forgeSoundtrackContextKey(runId, connectionId, cue);
  return {
    cue,
    connectionId,
    tag: `music:contexts:${scope}:${key}:theme`,
    path: `music/contexts/${scope}/${key}/theme.mp3`,
  };
};

test("(b) soundtrack records keep GF's scope and cues by default", () => {
  const session = {};
  assert.equal(recordForgeSoundtrack(session, "run-1", track("gacha-forge", "combat")), true);
  assert.equal(recordForgeSoundtrack(session, "run-1", track("otome-forge", "combat")), false);
  assert.equal(recordForgeSoundtrack(session, "run-1", track("gacha-forge", "confession")), false);
  assert.deepEqual(
    availableForgeSoundtracks(session).map((item) => item.cue),
    ["combat"],
  );
});

test("(a, c) soundtrack records honour another package's scope and cues", () => {
  const options = { scope: "otome-forge", cues: otomeCues };
  const session = {};
  assert.equal(recordForgeSoundtrack(session, "run-1", track("otome-forge", "confession"), options), true);
  assert.equal(recordForgeSoundtrack(session, "run-1", track("gacha-forge", "confession"), options), false);
  assert.equal(recordForgeSoundtrack(session, "run-1", track("otome-forge", "combat"), options), false);
  // A tag from another scope never pairs with this scope's path.
  const mixed = { ...track("otome-forge", "date"), tag: track("gacha-forge", "date").tag };
  assert.equal(recordForgeSoundtrack(session, "run-1", mixed, options), false);
  assert.deepEqual(
    session.audioTracks.map((item) => item.cue),
    ["confession"],
  );
  assert.deepEqual(availableForgeSoundtracks(session), []);
  assert.deepEqual(
    availableForgeSoundtracks(session, { cues: otomeCues }).map((item) => [item.cue, item.title]),
    [["confession", ""]],
  );
});

const capture = () => {
  const calls = [];
  const logger = new Proxy(
    {},
    {
      get:
        (_target, level) =>
        (...args) =>
          calls.push([level, ...args]),
    },
  );
  return { calls, logger };
};

test("(a, b, c) card hydration logs with GF's prefix by default and with another prefix when given", async () => {
  const units = [{ kind: "character", cardId: "card-1", name: "Rin" }];
  const missing = async () => {
    throw new Error("gone");
  };
  const gf = capture();
  await forgeHydrateStoryCharacters(units, missing, gf.logger);
  assert.deepEqual(gf.calls, [
    ["warn", "[gacha-forge] linked character card %s could not be read; using the saved character summary", "card-1"],
  ]);
  const otome = capture();
  await forgeHydrateStoryCharacters(units, missing, otome.logger, { logPrefix: "[otome-forge]" });
  assert.deepEqual(otome.calls, [
    ["warn", "[otome-forge] linked character card %s could not be read; using the saved character summary", "card-1"],
  ]);
});

test("(a, b, c) prompt logs keep GF's debug label by default and use another prefix when given", () => {
  const calls = [];
  const runtime = {
    isDebugAgentsEnabled: () => false,
    logger: { isLevelEnabled: () => true, debugOverride: (...args) => calls.push(args) },
  };
  const messages = [{ role: "user", content: "hi" }];
  logForgeStoryPrompt(runtime, "story", messages);
  logForgeStoryPrompt(runtime, "story", messages, { debugMode: true, logPrefix: "otome-forge" });
  const debugAgents = /^(1|true)$/iu.test(process.env.DEBUG_AGENTS || "");
  assert.deepEqual(calls, [
    [debugAgents, "[debug/gacha-forge/%s] Messages sent to the provider: %s", "story", JSON.stringify(messages)],
    [true, "[debug/otome-forge/%s] Messages sent to the provider: %s", "story", JSON.stringify(messages)],
  ]);
});

test("(a, b, c) image reference logs keep GF's prefix by default and use another prefix when given", async () => {
  const client = () => ({
    characterCard: async () => null,
    personaAvatar: async () => null,
    cardAvatarImage: async () => null,
    generatePortrait: async (options) => options,
    generateOutfit: async (options) => options,
    generateBannerArt: async (options) => options,
  });
  const format =
    "%s: identity references resolved for %d/%d subjects, %d worn outfit(s); sending %d distinct of at most %d (a provider may keep fewer)";
  const gf = capture();
  await forgeWrapImageReferenceClient(client(), gf.logger).generatePortrait({ unit: { kind: "character" } });
  assert.deepEqual(gf.calls, [["warn", `[gacha-forge] ${format}`, "generatePortrait", 0, 1, 0, 0, 4]]);
  const otome = capture();
  await forgeWrapImageReferenceClient(client(), otome.logger, { logPrefix: "[otome-forge]" }).generatePortrait({
    unit: { kind: "character" },
  });
  assert.deepEqual(otome.calls, [["warn", `[otome-forge] ${format}`, "generatePortrait", 0, 1, 0, 0, 4]]);
});
