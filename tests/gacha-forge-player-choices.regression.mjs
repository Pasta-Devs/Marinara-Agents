// Exercise the shipped server, including its actual generation parser and route wiring. The host
// boundary alone is faked: deterministic model responses, isolated documents with revision checks,
// and read-only Engine metadata. No provider or user save is contacted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { forgeCanonicalSegments, forgePendingChoice } from "../sources/forge-kit/player-choices-server.mjs";

const serverUrl = new URL("../packages/gacha-forge/server.mjs", import.meta.url);
const packageId = "gacha-forge";
const runId = "choices-regression";
const chapterId = (chapter) => `${runId}:chapter:${chapter}`;
const beatId = (chapter, storyIndex) => `${runId}:beat:${chapter}:${storyIndex}`;
const sessionId = `${runId}:session`;
const clone = (value) => structuredClone(value);
const narrator = (text) => ({ speaker: "", text });
const line = (text) => ({ places: [], segments: [narrator(text)] });
const storyNode = (index) => ({
  index: index + 1,
  type: "story",
  title: `Scene ${index + 1}`,
  goal: "Continue",
  guide: "Meet the next scene.",
});
const plan = (chapter = 1, count = 2) => ({
  chapter,
  title: `Chapter ${chapter}`,
  premise: "Two roads meet again.",
  nodes: Array.from({ length: count }, (_, index) => storyNode(index)),
});
const smallChoice = (id = "choice-1", at = 0) => ({
  id,
  kind: "small",
  at,
  options: [
    {
      id: "option-1",
      text: "Walk with Arden.",
      selection: { kind: "action", text: "You walk with Arden." },
      segments: [{ speaker: "Arden", text: "CANON_ARDEN_ONLY" }],
    },
    {
      id: "option-2",
      text: "Walk with Brin.",
      selection: { kind: "action", text: "You walk with Brin." },
      segments: [{ speaker: "Brin", text: "ALTERNATE_BRIN_ONLY" }],
    },
  ],
});
const bigChoice = (id = "choice-1", at = 0) => ({
  id,
  kind: "big",
  at,
  options: [
    {
      id: "option-1",
      text: "Save the northern village.",
      selection: { kind: "action", text: "You choose to save the northern village." },
      segments: [],
    },
    {
      id: "option-2",
      text: "Save the southern village.",
      selection: { kind: "action", text: "You choose to save the southern village." },
      segments: [],
    },
  ],
});
const smallBeat = () => ({
  places: [],
  segments: [narrator("At the fork."), narrator("COMMON_REJOIN")],
  choices: [smallChoice()],
});
const choiceRequest = (optionId = "option-1", extra = {}) => ({
  runId,
  chapter: 1,
  storyIndex: 0,
  choiceId: "choice-1",
  optionId,
  ...extra,
});

let harnessSequence = 0;
async function harness({ story, progress = {}, reading, chapters = [plan()], storedDocuments } = {}) {
  const docs = new Map();
  const modelCalls = [];
  const responses = [];
  const updates = [];
  let conflictCount = 0;
  let collision = null;
  let generationPause = null;
  const seed = (id, kind, data) => {
    const current = docs.get(id);
    docs.set(id, {
      id,
      kind,
      packageId,
      name: id,
      description: "fixture",
      revision: (current?.revision ?? 0) + 1,
      data: clone(data),
    });
  };
  const run = {
    runId,
    name: "Choice regression",
    scenario: "A fictional crossroads.",
    connectionId: "fixture-model",
    protagonist: { name: "Mari" },
    images: { connectionId: "" },
    ...(story ? { story } : {}),
  };
  seed("index", "index", { runs: [run], activeRunId: runId });
  seed(sessionId, "session", { progress, ...(reading ? { reading } : {}) });
  seed(`${runId}:combat-art`, "combat-art", { effigies: { byKey: {}, hasArt: false } });
  for (const chapter of chapters) seed(chapterId(chapter.chapter), "chapter-plan", chapter);
  if (storedDocuments) {
    docs.clear();
    for (const document of storedDocuments) docs.set(document.id, clone(document));
  }
  const documents = {
    async getById(id, documentId) {
      assert.equal(id, packageId);
      return clone(docs.get(documentId) ?? null);
    },
    async list(id, kind) {
      assert.equal(id, packageId);
      return clone([...docs.values()].filter((doc) => !kind || doc.kind === kind));
    },
    async create(document) {
      assert.equal(document.packageId, packageId);
      if (docs.has(document.id)) throw new Error(`Document already exists: ${document.id}`);
      const stored = { ...clone(document), revision: 1 };
      docs.set(document.id, stored);
      return clone(stored);
    },
    async update(document) {
      assert.equal(document.packageId, packageId);
      if (collision?.id === document.id && collision.arrivals < 2) {
        collision.arrivals += 1;
        if (collision.arrivals === 2) collision.release();
        await collision.promise;
      }
      const current = docs.get(document.id);
      if (!current || current.revision !== document.expectedRevision) {
        conflictCount += 1;
        return null;
      }
      const stored = { ...current, ...clone(document), revision: current.revision + 1 };
      delete stored.expectedRevision;
      docs.set(document.id, stored);
      updates.push(clone(stored));
      return clone(stored);
    },
    async remove(id, documentId, revision) {
      assert.equal(id, packageId);
      if (docs.get(documentId)?.revision !== revision) return false;
      return docs.delete(documentId);
    },
  };
  const routes = new Map();
  const runtime = {
    persistence: { documents },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    json: { parseJsonish: JSON.parse },
    languageModels: {
      async resolveForRequest({ connectionId }) {
        assert.equal(connectionId, "fixture-model");
        return {
          connectionId,
          model: "fixture-only",
          async chatComplete(messages) {
            modelCalls.push(clone(messages));
            if (generationPause) {
              const pause = generationPause;
              generationPause = null;
              pause.entered();
              await pause.promise;
            }
            assert.ok(responses.length, "Every generation needs an explicit fixture response");
            const response = responses.length > 1 ? responses.shift() : responses[0];
            return { content: JSON.stringify(response), finishReason: "stop" };
          },
        };
      },
    },
  };
  // A distinct module instance keeps the shipped module's per-activation queues and ledgers
  // isolated exactly as separate Engine processes would be, without rewriting any implementation.
  const { activate } = await import(`${serverUrl.href}?choice-regression=${harnessSequence++}`);
  await activate({
    package: { id: packageId, version: "fixture" },
    api: {
      runtime,
      async registerPrivilegedRoutes(register) {
        await register({
          get(path, handler) {
            routes.set(`GET ${path}`, handler);
          },
          post(path, handler) {
            routes.set(`POST ${path}`, handler);
          },
        });
      },
    },
  });
  return {
    seed,
    docs,
    modelCalls,
    updates,
    responses,
    get conflicts() {
      return conflictCount;
    },
    snapshot() {
      return clone([...docs.values()]);
    },
    pauseNextGeneration() {
      let entered;
      let release;
      const ready = new Promise((resolve) => {
        entered = resolve;
      });
      const promise = new Promise((resolve) => {
        release = resolve;
      });
      generationPause = { entered, promise };
      return { ready, release };
    },
    collideUpdates(id) {
      let release;
      const promise = new Promise((resolve) => {
        release = resolve;
      });
      collision = { id, promise, release, arrivals: 0 };
    },
    async post(path, body = {}) {
      const route = routes.get(`POST ${path}`);
      assert.ok(route, `The shipped server must register POST ${path}`);
      return route({ body: clone(body) });
    },
    data(id) {
      return clone(docs.get(id)?.data);
    },
    setProgress(chapter, normal) {
      const session = clone(docs.get(sessionId).data);
      session.progress[String(chapter)] = { normal };
      seed(sessionId, "session", session);
    },
  };
}

const fetchBefore = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(input);
  assert.equal(url.pathname, "/api/connections", `Unexpected Engine request: ${url.pathname}`);
  return {
    ok: true,
    json: async () => [{ id: "fixture-model", provider: "fixture", model: "fixture-only", maxContext: 128000 }],
  };
};

let cases = 0;
async function test(name, run) {
  await run();
  cases += 1;
  process.stdout.write(`ok ${cases} - ${name}\n`);
}
const expectError = (result, error) => {
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.error, error, JSON.stringify(result));
};
const promptText = (messages) => messages.map((message) => message.content).join("\n");

// Execute the maintained source section of the actual shipped client, not a replacement player.
const clientPayload = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
const clientSource = clientPayload
  .split("/* forge-choices-client-source:start */\n")[1]
  ?.split("/* forge-choices-client-source:end */")[0];
assert.ok(clientSource, "The built client must contain the maintained choice player");
const preparePlayback = new Function(`${clientSource}; return prepareForgeChoices;`)();
function playback(response, replay = false) {
  const host = {
    _run: { runId, protagonist: { name: "Mari" } },
    _activeStoryNode: { chapter: 1, storyIndex: 0, replay },
  };
  preparePlayback(host, response);
  return host._choicePlayback.timeline;
}

try {
  await test("unselected small branches leave a common continuation without inventing canon", () => {
    const beat = smallBeat();
    assert.equal(forgePendingChoice(beat)?.kind, "small", "Playback and selection still see the pending choice");
    assert.equal(forgePendingChoice(beat, "big"), undefined);
    assert.deepEqual(forgeCanonicalSegments(beat), beat.segments);
    beat.choiceCanon = { "choice-1": "option-2" };
    const canon = forgeCanonicalSegments(beat)
      .map((segment) => segment.text)
      .join("\n");
    assert.match(canon, /ALTERNATE_BRIN_ONLY/u);
    assert.doesNotMatch(canon, /CANON_ARDEN_ONLY/u);
    assert.equal(forgeCanonicalSegments({ ...line("A lasting decision."), choices: [bigChoice()] }), null);
  });

  await test("generated intent labels stay separate from selected narration and spoken dialogue", async () => {
    const host = await harness();
    const graph = smallBeat();
    graph.choices[0].options[0] = {
      text: "Pull your hoodie up.",
      selection: { kind: "action", text: "You pull your hoodie up against the cold." },
      segments: [narrator("Arden waits while you adjust it.")],
    };
    graph.choices[0].options[1] = {
      text: "Apologize for the delay.",
      selection: { kind: "dialogue", text: "I am sorry I kept you waiting." },
      segments: [{ speaker: "Arden", text: "You are here now." }],
    };
    host.responses.push(graph);
    const generated = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(generated.ok, true, JSON.stringify(generated));
    assert.deepEqual(generated.choices[0].options[0].selection, graph.choices[0].options[0].selection);
    assert.deepEqual(generated.choices[0].options[1].selection, graph.choices[0].options[1].selection);
    assert.match(promptText(host.modelCalls[0]), /paraphrase|intent/u);
    assert.match(promptText(host.modelCalls[0]), /narration/u);
    assert.equal((await host.post("/choice", choiceRequest())).ok, true);
    const canon = { ...generated, choiceCanon: host.data(beatId(1, 0)).choiceCanon };
    assert.equal(playback(canon)[1].speaker, "");
    assert.equal(playback(canon)[1].text, graph.choices[0].options[0].selection.text);
    assert.equal(playback(canon)[2].text, "Arden waits while you adjust it.");
    assert.equal(playback(canon)[3].text, "COMMON_REJOIN");
    host.setProgress(1, 1);
    const replay = await host.post("/choice", choiceRequest("option-2", { replay: true }));
    assert.equal(replay.ok, true);
    assert.equal(replay.canonical, false);
    // The replay response chooses a temporary branch; its canon map stays unchanged.
    assert.equal(playback({ ...generated, choiceCanon: { "choice-1": replay.optionId } })[1].speaker, "Mari");
    assert.equal(
      playback({ ...generated, choiceCanon: { "choice-1": replay.optionId } })[1].text,
      graph.choices[0].options[1].selection.text,
    );
    assert.deepEqual(host.data(beatId(1, 0)).choiceCanon, { "choice-1": "option-1" });
    host.responses[0] = line("The next scene.");
    const next = await host.post("/beat", { runId, chapter: 1, storyIndex: 1 });
    assert.equal(next.ok, true, JSON.stringify(next));
    const context = host.modelCalls
      .at(-1)
      .filter((message) => message.role !== "system")
      .map((message) => message.content)
      .join("\n");
    assert.match(context, /You pull your hoodie up against the cold/u);
    assert.doesNotMatch(context, /I am sorry I kept you waiting/u);
  });

  await test("raw intent labels retain their 280-character allowance before terminal punctuation", async () => {
    for (const length of [280, 281]) {
      const host = await harness();
      const graph = smallBeat();
      graph.choices[0].options[0].text = "x".repeat(length);
      host.responses.push(graph);
      const generated = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
      if (length === 280) {
        assert.equal(generated.ok, true, JSON.stringify(generated));
        assert.equal(generated.choices[0].options[0].text, `${"x".repeat(length)}.`);
        assert.equal(host.data(beatId(1, 0)).choices[0].options[0].text, `${"x".repeat(length)}.`);
      } else {
        expectError(generated, "invalid-shape");
        assert.equal(host.data(beatId(1, 0)), undefined);
      }
    }
  });

  await test("terminal selected actions and spoken words keep their type and immutable canon", async () => {
    for (const kind of ["action", "dialogue"]) {
      const host = await harness({ chapters: [plan(1, 1), plan(2)] });
      const choice = bigChoice();
      choice.options[0] = {
        text: kind === "dialogue" ? "Promise to help Arden." : "Offer Arden your hand.",
        selection: { kind, text: kind === "dialogue" ? "I promise I will help you." : "You offer Arden your hand." },
        segments: [],
      };
      host.responses.push({ ...line("Arden waits for your decision."), choices: [choice] });
      const generated = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
      assert.equal(generated.ok, true, JSON.stringify(generated));
      assert.equal((await host.post("/choice", choiceRequest())).ok, true);
      const response = { ...generated, choiceCanon: host.data(beatId(1, 0)).choiceCanon };
      const selectedBeat = playback(response)[1];
      assert.equal(selectedBeat.speaker, kind === "dialogue" ? "Mari" : "");
      assert.equal(selectedBeat.text, choice.options[0].selection.text);
      assert.equal(playback(response).length, 2, "A big choice has no pre-generated consequence");
      expectError(await host.post("/choice", choiceRequest("option-2", { replay: true })), "choice-locked");
      host.setProgress(1, 1);
      host.responses[0] = line("The next chapter.");
      assert.equal((await host.post("/beat", { runId, chapter: 2, storyIndex: 0 })).ok, true);
      const context = host.modelCalls
        .at(-1)
        .filter((message) => message.role !== "system")
        .map((message) => message.content)
        .join("\n");
      assert.ok(
        context.includes(choice.options[0].selection.text),
        "Future chapters must retain the exact performed decision",
      );
      assert.ok(!context.includes(choice.options[1].selection.text), "Unselected decisions must not enter continuity");
    }
  });

  await test("different labels cannot disguise identical performed small or big options", async () => {
    for (const kind of ["small", "big"]) {
      const host = await harness({ chapters: [plan(1, 1)] });
      const choice = kind === "small" ? smallChoice() : bigChoice();
      choice.options[1].selection = clone(choice.options[0].selection);
      host.responses.push({ ...line("Choose a path."), choices: [choice] });
      expectError(await host.post("/beat", { runId, chapter: 1, storyIndex: 0 }), "invalid-shape");
      assert.equal(host.data(beatId(1, 0)), undefined);
    }
  });

  await test("untyped saved choices remain playable without inventing a dialogue speaker", async () => {
    const host = await harness();
    const saved = smallBeat();
    delete saved.choices[0].options[0].selection;
    saved.choices[0].options[0].text = "Pull a hoodie up.";
    host.seed(beatId(1, 0), "beat", { chapter: 1, storyIndex: 0, ...saved, choiceCanon: { "choice-1": "option-1" } });
    const response = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(response.ok, true);
    assert.equal(playback(response)[1].speaker, "");
    assert.equal(playback(response)[1].text, "Pull a hoodie up.");
    assert.equal(host.modelCalls.length, 0);
  });

  await test("legacy linear saves still resume and choices default on for new narration", async () => {
    const host = await harness({ reading: { chapter: 1, storyIndex: 0, at: 4 } });
    host.seed(beatId(1, 0), "beat", { chapter: 1, storyIndex: 0, ...line("Legacy narration") });
    const cached = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(cached.ok, true);
    assert.equal(cached.resumeAt, 4);
    assert.equal(cached.segments[0].text, "Legacy narration");
    assert.equal(host.modelCalls.length, 0);
    host.responses.push(smallBeat());
    const generated = await host.post("/beat", { runId, chapter: 1, storyIndex: 1 });
    assert.equal(generated.ok, true, JSON.stringify(generated));
    assert.equal(generated.choices.length, 1, "Absent setting must enable choices");
    assert.doesNotMatch(promptText(host.modelCalls[0]), /NEVER offer choices/u);
  });

  await test("story settings preserve pre-forge and unrelated source fields while toggling choices", async () => {
    const host = await harness({ story: { preforge: "art", choices: true } });
    const disabled = await host.post("/run/sources", {
      runId,
      sources: { story: { preforge: "story", choices: false } },
    });
    assert.equal(disabled.ok, true);
    assert.equal(disabled.run.story.preforge, "story");
    assert.equal(disabled.run.story.choices, false);
    assert.equal(disabled.run.connectionId, "fixture-model");
    const enabled = await host.post("/run/sources", { runId, sources: { story: { preforge: "off", choices: true } } });
    assert.equal(enabled.ok, true);
    assert.equal(enabled.run.story.choices, true);
    host.responses.push(line("Linear when disabled"));
    await host.post("/run/sources", { runId, sources: { story: { preforge: "off", choices: false } } });
    const beat = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(beat.ok, true);
    assert.equal(beat.choices?.length ?? 0, 0);
    assert.match(promptText(host.modelCalls[0]), /NEVER offer choices/u);
  });

  await test("a choice-only settings update preserves the current pre-forge mode", async () => {
    const host = await harness({ story: { preforge: "art", choices: true } });
    const disabled = await host.post("/run/sources", { runId, sources: { story: { choices: false } } });
    assert.equal(disabled.ok, true);
    assert.equal(disabled.run.story.preforge, "art");
    assert.equal(disabled.run.story.choices, false);
    assert.equal(disabled.run.connectionId, "fixture-model");
  });

  await test("a pre-forge-only settings update preserves disabled choices", async () => {
    const host = await harness({ story: { preforge: "art", choices: false } });
    const changed = await host.post("/run/sources", { runId, sources: { story: { preforge: "story" } } });
    assert.equal(changed.ok, true);
    assert.equal(changed.run.story.preforge, "story");
    assert.equal(changed.run.story.choices, false);
  });

  await test("small alternatives generate together; only the first selected path becomes canon", async () => {
    const host = await harness();
    host.responses.push(smallBeat());
    const beat = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(beat.ok, true, JSON.stringify(beat));
    assert.equal(host.modelCalls.length, 1, "Both paths must be generated in one request");
    assert.deepEqual(
      beat.choices[0].options.map((option) => option.segments[0].text),
      ["CANON_ARDEN_ONLY", "ALTERNATE_BRIN_ONLY"],
    );
    assert.deepEqual(beat.choiceCanon, {});
    const initial = host.data(beatId(1, 0));
    for (const body of [
      choiceRequest("missing"),
      choiceRequest("option-1", { choiceId: "missing" }),
      choiceRequest("option-1", { storyIndex: -1 }),
      choiceRequest("option-1", { chapter: 0 }),
    ]) {
      const bad = await host.post("/choice", body);
      assert.equal(bad.ok, false, JSON.stringify(bad));
      assert.deepEqual(host.data(beatId(1, 0)), initial, "Bad IDs cannot mutate the saved beat");
    }
    const selected = await host.post("/choice", choiceRequest());
    assert.equal(selected.ok, true, JSON.stringify(selected));
    assert.equal(host.data(beatId(1, 0)).choiceCanon["choice-1"], "option-1");
    const revision = host.docs.get(beatId(1, 0)).revision;
    assert.equal((await host.post("/choice", choiceRequest())).ok, true);
    assert.equal(host.docs.get(beatId(1, 0)).revision, revision, "Retrying an accepted choice is idempotent");
    const beforeClear = await host.post("/choice", choiceRequest("option-2", { replay: true }));
    assert.equal(beforeClear.ok, true);
    assert.equal(beforeClear.optionId, "option-1", "The request cannot pretend an unfinished node is a replay");
    host.setProgress(1, 1);
    const replay = await host.post("/choice", choiceRequest("option-2", { replay: true }));
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.optionId, "option-2");
    assert.equal(host.data(beatId(1, 0)).choiceCanon["choice-1"], "option-1");
    host.responses[0] = line("Next scene");
    const next = await host.post("/beat", { runId, chapter: 1, storyIndex: 1 });
    assert.equal(next.ok, true, JSON.stringify(next));
    const context = promptText(host.modelCalls.at(-1));
    assert.match(context, /CANON_ARDEN_ONLY/u);
    assert.match(context, /Walk with Arden\./u);
    assert.match(context, /COMMON_REJOIN/u);
    assert.doesNotMatch(context, /ALTERNATE_BRIN_ONLY|Walk with Brin\./u);
    assert.equal(host.modelCalls.length, 2, "Replaying a pre-generated branch makes no model call");
  });

  await test("a previously completed chapter never acquires new canon on replay", async () => {
    const host = await harness({ progress: { 1: { normal: 10 } } });
    host.seed(beatId(1, 0), "beat", { chapter: 1, storyIndex: 0, ...smallBeat(), choiceCanon: {} });
    const before = host.docs.get(beatId(1, 0)).revision;
    const replay = await host.post("/choice", choiceRequest("option-2", { replay: true }));
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.optionId, "option-2");
    assert.deepEqual(host.data(beatId(1, 0)).choiceCanon, {});
    assert.equal(host.docs.get(beatId(1, 0)).revision, before);
    assert.equal(host.modelCalls.length, 0);
  });

  await test("an unresolved big choice gates progression even after choices are switched off", async () => {
    const host = await harness({ story: { preforge: "story", choices: true }, chapters: [plan(1, 1), plan(2)] });
    host.responses.push({ ...line("Which village do you save?"), choices: [bigChoice()] });
    const finalBeat = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(finalBeat.ok, true, JSON.stringify(finalBeat));
    assert.equal(finalBeat.choices[0].kind, "big");
    assert.equal(host.modelCalls.length, 1);
    const status = await host.post("/preforge", { runId, chapter: 1 });
    assert.equal(status.ok, true);
    assert.equal(status.preforge.waitingChoice, true);
    assert.equal(status.preforge.locked, false, "The ready choice must remain readable");
    assert.equal(status.preforge.canAuto, false);
    await host.post("/run/sources", { runId, sources: { story: { preforge: "story", choices: false } } });
    for (const [route, body] of [
      ["/beat", { runId, chapter: 2, storyIndex: 0 }],
      ["/chapter-plan", { runId, chapter: 2 }],
      ["/compress", { runId, chapter: 1 }],
      ["/complete", { runId, chapter: 1, difficulty: "normal", nodeIndex: 0 }],
    ])
      expectError(await host.post(route, body), "choice-required");
    const retry = await host.post("/preforge/retry", { runId, chapter: 1 });
    assert.equal(retry.allowed, false);
    assert.equal(host.modelCalls.length, 1, "No generation may run beyond the unanswered decision");
    assert.equal(host.data(sessionId).progress["1"], undefined);
    const selected = await host.post("/choice", choiceRequest());
    assert.equal(selected.ok, true, JSON.stringify(selected));
    expectError(await host.post("/choice", choiceRequest("option-2", { replay: true })), "choice-locked");
    assert.equal(host.data(beatId(1, 0)).choiceCanon["choice-1"], "option-1");
    assert.equal((await host.post("/preforge", { runId, chapter: 1 })).preforge.waitingChoice, false);
    assert.equal((await host.post("/complete", { runId, chapter: 1, difficulty: "normal", nodeIndex: 0 })).ok, true);
    host.responses[0] = line("The northern village survived.");
    const next = await host.post("/beat", { runId, chapter: 2, storyIndex: 0 });
    assert.equal(next.ok, true, JSON.stringify(next));
    assert.match(promptText(host.modelCalls.at(-1)), /Save the northern village\./u);
    assert.doesNotMatch(promptText(host.modelCalls.at(-1)), /Save the southern village\./u);
  });

  await test("conflicting concurrent big choices settle once through document revisions", async () => {
    const host = await harness({ chapters: [plan(1, 1)] });
    host.seed(beatId(1, 0), "beat", {
      chapter: 1,
      storyIndex: 0,
      ...line("A final decision"),
      choices: [bigChoice()],
      choiceCanon: {},
    });
    host.collideUpdates(beatId(1, 0));
    const results = await Promise.all([
      host.post("/choice", choiceRequest()),
      host.post("/choice", choiceRequest("option-2")),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1, JSON.stringify(results));
    const refused = results.find((result) => !result.ok);
    expectError(refused, "choice-locked");
    assert.ok(host.conflicts > 0, "The harness must exercise a real stale-revision conflict");
    const canonical = host.data(beatId(1, 0)).choiceCanon["choice-1"];
    assert.equal(canonical, results.find((result) => result.ok).optionId);
    const revision = host.docs.get(beatId(1, 0)).revision;
    assert.equal((await host.post("/choice", choiceRequest(canonical))).ok, true);
    assert.equal(host.docs.get(beatId(1, 0)).revision, revision);
  });

  await test("a concurrent future beat waits for generation and then continues past a small choice", async () => {
    const host = await harness();
    host.responses.push(smallBeat(), line("The common story continues."));
    const pause = host.pauseNextGeneration();
    const first = host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    await pause.ready;
    const future = host.post("/beat", { runId, chapter: 1, storyIndex: 1 });
    pause.release();
    assert.equal((await first).ok, true);
    assert.equal((await future).ok, true);
    assert.equal(host.modelCalls.length, 2);
    assert.equal(host.data(beatId(1, 1)).segments[0].text, "The common story continues.");
    assert.deepEqual(host.data(beatId(1, 0)).choiceCanon, {});
  });

  await test("cached reads and small selections finish while a future model request is pending", async () => {
    const host = await harness();
    const unitId = `${runId}:unit:arden`;
    const chapter = "bond-arden";
    host.seed(unitId, "unit", {
      kind: "character",
      name: "Arden",
      identitySex: "male",
      rarity: 5,
      role: "Warrior",
      affinity: "Fire",
    });
    host.seed(chapterId(chapter), "chapter-plan", { ...plan(chapter, 3), bondUnitId: unitId, bondPart: 1, after: 0 });
    const session = host.data(sessionId);
    session.roster = { [unitId]: { bondFights: 100, bondCurve: 2 } };
    session.bondChapters = { [unitId]: { beats: 3, after: 0, opened: 1 } };
    host.seed(sessionId, "session", session);
    host.responses.push(smallBeat());
    const first = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(first.ok, true, JSON.stringify(first));
    for (const cached of [
      await host.post("/chapter-plan", { runId, chapter: 1 }),
      await host.post("/bond-chapter/plan", { runId, unitId, part: 1 }),
    ])
      assert.equal(cached.ok, true, JSON.stringify(cached));
    host.responses[0] = line("The next scene eventually finishes generating.");
    const pause = host.pauseNextGeneration();
    let futureFinished = false;
    const future = host.post("/beat", { runId, chapter: 1, storyIndex: 1 }).then((result) => {
      futureFinished = true;
      return result;
    });
    await pause.ready;
    let cachedReplies;
    const cachedReads = Promise.all([
      host.post("/beat", { runId, chapter: 1, storyIndex: 0 }),
      host.post("/chapter-plan", { runId, chapter: 1 }),
      host.post("/bond-chapter/plan", { runId, unitId, part: 1 }),
    ]).then((replies) => {
      cachedReplies = replies;
    });
    let selectedReply;
    const selecting = host.post("/choice", choiceRequest()).then((reply) => {
      selectedReply = reply;
    });
    try {
      // All persistence/metadata fixture operations resolve as promises. One event-loop turn
      // drains those reads while the provider stays explicitly blocked on pause.release().
      await new Promise(setImmediate);
      assert.ok(cachedReplies, "Reading cached story or plans must not wait for the pending model response");
      for (const reply of cachedReplies) assert.equal(reply.ok, true, JSON.stringify(reply));
      assert.equal(cachedReplies[0].segments[0].text, "At the fork.");
      assert.equal(cachedReplies[1].plan.chapter, 1);
      assert.equal(cachedReplies[2].plan.bondUnitId, unitId);
      assert.equal(selectedReply?.ok, true, "Saving a prewritten branch must not wait for future generation");
      assert.equal(host.data(beatId(1, 0)).choiceCanon["choice-1"], "option-1");
      assert.equal(
        playback({ ...first, choiceCanon: host.data(beatId(1, 0)).choiceCanon })[2].text,
        "CANON_ARDEN_ONLY",
        "The selected branch is already available for playback",
      );
      assert.equal(futureFinished, false, "The future model response is still deliberately held open");
      assert.equal(host.modelCalls.length, 2, "Cache reads must not request more generation");
    } finally {
      pause.release();
      assert.equal((await future).ok, true);
      await cachedReads;
      await selecting;
    }
  });

  await test("accepted fate survives package reactivation without another write or model call", async () => {
    const firstHost = await harness({ chapters: [plan(1, 1), plan(2)] });
    firstHost.responses.push({ ...line("The last decision"), choices: [bigChoice()] });
    assert.equal((await firstHost.post("/beat", { runId, chapter: 1, storyIndex: 0 })).ok, true);
    assert.equal((await firstHost.post("/choice", choiceRequest())).ok, true);
    assert.equal(
      (await firstHost.post("/complete", { runId, chapter: 1, difficulty: "normal", nodeIndex: 0 })).ok,
      true,
    );
    const saved = firstHost.snapshot();
    const reloaded = await harness({ storedDocuments: saved });
    const revision = reloaded.docs.get(beatId(1, 0)).revision;
    const cached = await reloaded.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(cached.ok, true);
    assert.deepEqual(cached.choiceCanon, { "choice-1": "option-1" });
    expectError(await reloaded.post("/choice", choiceRequest("option-2")), "choice-locked");
    assert.equal((await reloaded.post("/choice", choiceRequest())).ok, true);
    assert.equal(reloaded.docs.get(beatId(1, 0)).revision, revision);
    assert.equal(reloaded.modelCalls.length, 0);
    reloaded.responses.push(line("Tomorrow remembers."));
    assert.equal((await reloaded.post("/beat", { runId, chapter: 2, storyIndex: 0 })).ok, true);
    assert.match(promptText(reloaded.modelCalls[0]), /Save the northern village\./u);
    assert.doesNotMatch(promptText(reloaded.modelCalls[0]), /Save the southern village\./u);
  });

  await test("compressed continuity keeps immutable fate and excludes later chapter decisions", async () => {
    const host = await harness({ chapters: [plan(1, 1)] });
    host.responses.push({ ...line("The decision lasts."), choices: [bigChoice()] });
    assert.equal((await host.post("/beat", { runId, chapter: 1, storyIndex: 0 })).ok, true);
    assert.equal((await host.post("/choice", choiceRequest())).ok, true);
    assert.equal((await host.post("/complete", { runId, chapter: 1, difficulty: "normal", nodeIndex: 0 })).ok, true);
    host.responses[0] = { digest: "A journey ended. This summary intentionally omits the player's decision." };
    const compressed = await host.post("/compress", { runId, chapter: 1 });
    assert.equal(compressed.ok, true, JSON.stringify(compressed));
    assert.doesNotMatch(host.data(`${runId}:summary:1`).digest, /northern|southern/u);

    const future = bigChoice();
    future.options[0].text = "FUTURE_CANON_UNSEEN";
    host.seed(chapterId(3), "chapter-plan", plan(3, 1));
    host.seed(beatId(3, 0), "beat", {
      chapter: 3,
      storyIndex: 0,
      ...line("A later decision"),
      choices: [future],
      choiceCanon: { "choice-1": "option-1" },
    });
    const nextPlan = plan(2, 10);
    nextPlan.nodes = nextPlan.nodes.map((node, index) =>
      [1, 3, 5].includes(index)
        ? {
            index: index + 1,
            type: "combat",
            tier: index === 5 ? "boss" : index === 3 ? "elite" : "soldier",
            title: `Battle ${index}`,
            setup: "A test battle",
          }
        : node,
    );
    host.responses[0] = nextPlan;
    const planned = await host.post("/chapter-plan", { runId, chapter: 2 });
    assert.equal(planned.ok, true, JSON.stringify(planned));
    const context = promptText(host.modelCalls.at(-1));
    assert.match(context, /Save the northern village\./u);
    assert.doesNotMatch(context, /Save the southern village\.|FUTURE_CANON_UNSEEN/u);
  });

  await test("folded summaries retain fate in chapter order rather than document insertion order", async () => {
    const host = await harness({
      chapters: [plan(1, 1), plan(2, 1)],
      progress: { 1: { normal: 10 }, 2: { normal: 10 } },
    });
    for (const [chapter, text] of [
      [2, "SECOND_CHAPTER_FATE"],
      [1, "FIRST_CHAPTER_FATE"],
      [10, "FUTURE_TENTH_FATE"],
    ]) {
      const choice = bigChoice();
      choice.options[0].text = text;
      host.seed(beatId(chapter, 0), "beat", {
        chapter,
        storyIndex: 0,
        ...line("A recorded decision"),
        choices: [choice],
        choiceCanon: { "choice-1": "option-1" },
      });
      host.seed(`${runId}:summary:${chapter}`, "summary", {
        chapter,
        digest: "A completed chapter, with fate omitted from this summary.",
      });
    }
    host.responses.push({ digest: "Two completed chapters, with both decisions omitted by the summarizer." });
    const folded = await host.post("/compress/merge", { runId, rows: ["1", "2"] });
    assert.equal(folded.ok, true, JSON.stringify(folded));
    assert.equal(host.data(`${runId}:summary:1`).to, 2);
    assert.equal(host.data(`${runId}:summary:2`), undefined);
    const nextPlan = plan(3, 10);
    nextPlan.nodes = nextPlan.nodes.map((node, index) =>
      [1, 3, 5].includes(index)
        ? {
            index: index + 1,
            type: "combat",
            tier: index === 5 ? "boss" : index === 3 ? "elite" : "soldier",
            title: `Battle ${index}`,
            setup: "A test battle",
          }
        : node,
    );
    host.responses[0] = nextPlan;
    const planned = await host.post("/chapter-plan", { runId, chapter: 3 });
    assert.equal(planned.ok, true, JSON.stringify(planned));
    const context = promptText(host.modelCalls.at(-1));
    const first = context.indexOf("FIRST_CHAPTER_FATE");
    const second = context.indexOf("SECOND_CHAPTER_FATE");
    assert.ok(first >= 0, "The first chapter's fate must survive its summary");
    assert.ok(second > first, "Earlier chapter decisions must precede later decisions");
    assert.doesNotMatch(context, /FUTURE_TENTH_FATE|Save the southern village/u);
  });

  await test("several small choices commit in order and compress only the chosen branches", async () => {
    const host = await harness({ chapters: [plan(1, 1)] });
    const second = smallChoice("choice-2", 1);
    second.options[0].text = "I will ask about the tower.";
    second.options[0].segments[0].text = "UNSELECTED_TOWER_ONLY";
    second.options[1].text = "I will ask about the garden.";
    second.options[1].segments[0].text = "CANON_GARDEN_ONLY";
    host.responses.push({ ...smallBeat(), choices: [smallChoice(), second] });
    assert.equal((await host.post("/beat", { runId, chapter: 1, storyIndex: 0 })).ok, true);
    expectError(await host.post("/choice", choiceRequest("option-2", { choiceId: "choice-2" })), "choice-required");
    assert.deepEqual(host.data(beatId(1, 0)).choiceCanon, {});
    expectError(await host.post("/compress", { runId, chapter: 1 }), "choice-required");
    assert.equal((await host.post("/choice", choiceRequest())).ok, true);
    expectError(
      await host.post("/complete", { runId, chapter: 1, difficulty: "normal", nodeIndex: 0 }),
      "choice-required",
    );
    assert.equal((await host.post("/choice", choiceRequest("option-2", { choiceId: "choice-2" }))).ok, true);
    host.responses[0] = { digest: "Only the chosen journey happened." };
    const compressed = await host.post("/compress", { runId, chapter: 1 });
    assert.equal(compressed.ok, true, JSON.stringify(compressed));
    const context = promptText(host.modelCalls.at(-1));
    assert.match(context, /CANON_ARDEN_ONLY/u);
    assert.match(context, /CANON_GARDEN_ONLY/u);
    assert.doesNotMatch(context, /ALTERNATE_BRIN_ONLY|UNSELECTED_TOWER_ONLY/u);
    assert.equal(host.data(`${runId}:summary:1`).digest, "Only the chosen journey happened.");
  });

  await test("four options and eight branch segments remain valid at the supported limits", async () => {
    const host = await harness();
    const graph = smallBeat();
    graph.choices[0].options = Array.from({ length: 4 }, (_, index) => ({
      text: `Follow route ${index + 1}.`,
      selection: { kind: "action", text: `You follow route ${index + 1}.` },
      segments: Array.from({ length: 8 }, (_, beat) => narrator(`Route ${index + 1}, line ${beat + 1}`)),
    }));
    host.responses.push(graph);
    const response = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(response.ok, true, JSON.stringify(response));
    assert.equal(response.choices[0].options.length, 4);
    assert.equal(response.choices[0].options[3].segments.length, 8);
    assert.equal((await host.post("/choice", choiceRequest("option-4"))).ok, true);
    assert.equal(host.data(beatId(1, 0)).choiceCanon["choice-1"], "option-4");
  });

  await test("future plans and out-of-order beats cannot preempt an unplayed chapter ending", async () => {
    const host = await harness();
    expectError(await host.post("/chapter-plan", { runId, chapter: 2 }), "chapter-locked");
    expectError(await host.post("/beat", { runId, chapter: 1, storyIndex: 1 }), "beat-locked");
    assert.equal(host.modelCalls.length, 0);
    const graph = { chapter: 1, storyIndex: 1, ...smallBeat(), choiceCanon: {} };
    host.seed(beatId(1, 1), "beat", graph);
    expectError(await host.post("/choice", choiceRequest("option-1", { storyIndex: 1 })), "choice-unavailable");
    assert.deepEqual(host.data(beatId(1, 1)), graph);
  });

  await test("pre-forge writes every common beat without waiting for small decisions", async () => {
    const host = await harness({ story: { preforge: "story", choices: true }, chapters: [plan(1, 4)] });
    host.responses.push(smallBeat(), smallBeat(), smallBeat(), line("All paths have rejoined."));
    const started = await host.post("/preforge/start", { runId, chapter: 1 });
    assert.equal(started.allowed, true);
    // Every host operation in this harness is a deterministic promise. Yielding one event-loop
    // turn drains the real background chain without sleeping or calling /beat to mask a stalled chain.
    await new Promise(setImmediate);
    const ready = await host.post("/preforge", { runId, chapter: 1 });
    assert.equal(ready.preforge.done, 4);
    assert.equal(ready.preforge.waitingChoice, false);
    assert.equal(host.modelCalls.length, 4);
    for (let storyIndex = 0; storyIndex < 3; storyIndex += 1) {
      const waiting = await host.post("/preforge", { runId, chapter: 1 });
      assert.equal(waiting.preforge.waitingChoice, false);
      assert.equal(waiting.preforge.locked, false);
      assert.equal(waiting.preforge.canAuto, false);
      assert.ok(host.data(beatId(1, storyIndex)), "Every alternative was written before any selection");
      expectError(
        await host.post("/complete", { runId, chapter: 1, difficulty: "normal", nodeIndex: storyIndex }),
        "choice-required",
      );
      const chosen = await host.post("/choice", choiceRequest("option-1", { storyIndex }));
      assert.equal(chosen.ok, true, JSON.stringify(chosen));
      const complete = await host.post("/complete", { runId, chapter: 1, difficulty: "normal", nodeIndex: storyIndex });
      assert.equal(complete.ok, true, JSON.stringify(complete));
      await new Promise(setImmediate);
    }
    const finished = await host.post("/preforge", { runId, chapter: 1 });
    assert.equal(finished.preforge.done, 4);
    assert.equal(finished.preforge.waitingChoice, false);
    assert.equal(finished.preforge.autos, 1);
    assert.equal(host.modelCalls.length, 4);
  });

  for (const bond of [false, true]) {
    for (const preforge of ["off", "story"]) {
      await test(`${bond ? "Character Story" : "chapter"} continues past unselected small branches with pre-forge ${preforge}`, async () => {
        const host = await harness({
          story: { preforge, choices: true },
          chapters: [plan(1, 3)],
          ...(bond ? { progress: { 1: { normal: 10 } } } : {}),
        });
        let body = { runId, chapter: 1, storyIndex: 0 };
        if (bond) {
          const unitId = `${runId}:unit:arden`;
          const chapter = "bond-arden";
          host.seed(unitId, "unit", {
            kind: "character",
            name: "Arden",
            identitySex: "male",
            rarity: 5,
            role: "Warrior",
            affinity: "Fire",
          });
          host.seed(chapterId(chapter), "chapter-plan", {
            ...plan(chapter, 3),
            bondUnitId: unitId,
            bondPart: 1,
            after: 1,
          });
          const session = host.data(sessionId);
          session.roster = { [unitId]: { bondFights: 100, bondCurve: 2 } };
          session.bondChapters = { [unitId]: { beats: 0, after: 1, opened: 1 } };
          host.seed(sessionId, "session", session);
          body = { runId, chapter, unitId, part: 1, storyIndex: 0 };
        }
        host.responses.push(smallBeat(), line("COMMON_NEXT_CHUNK"), line("COMMON_CHAPTER_END"));
        const beatRoute = bond ? "/bond-chapter/beat" : "/beat";
        if (preforge === "story") {
          assert.equal((await host.post("/preforge/start", { runId, chapter: body.chapter })).allowed, true);
          await new Promise(setImmediate);
        } else {
          assert.equal((await host.post(beatRoute, body)).ok, true);
        }
        const status = await host.post("/preforge", { runId, chapter: body.chapter });
        assert.equal(status.preforge.waitingChoice, false);
        assert.equal(status.preforge.done, preforge === "story" ? 3 : 1);
        const next = await host.post(beatRoute, { ...body, storyIndex: 1 });
        assert.equal(next.ok, true, JSON.stringify(next));
        assert.equal(next.segments[0].text, "COMMON_NEXT_CHUNK");
        assert.deepEqual(host.data(beatId(body.chapter, 0)).choiceCanon, {});
        const context = promptText(host.modelCalls[1]);
        assert.match(context, /COMMON_REJOIN/u);
        assert.doesNotMatch(context, /CANON_ARDEN_ONLY|ALTERNATE_BRIN_ONLY|Walk with Arden|Walk with Brin/u);
        assert.match(context, /Later beats may be written before the player chooses/u);
        const complete = bond
          ? await host.post("/bond-chapter/complete", body)
          : await host.post("/complete", { runId, chapter: 1, difficulty: "normal", nodeIndex: 0 });
        expectError(complete, "choice-required");
        expectError(await host.post("/compress", body), "choice-required");
        const calls = host.modelCalls.length;
        assert.equal((await host.post("/choice", { ...body, choiceId: "choice-1", optionId: "option-1" })).ok, true);
        await new Promise(setImmediate);
        assert.equal(host.modelCalls.length, calls, "Selecting a stored branch does not request narration");
        if (bond) {
          const session = host.data(sessionId);
          session.bondChapters[body.unitId].beats = 1;
          host.seed(sessionId, "session", session);
        } else host.setProgress(1, 1);
        const replay = await host.post("/choice", {
          ...body,
          choiceId: "choice-1",
          optionId: "option-2",
          replay: true,
        });
        assert.equal(replay.ok, true);
        assert.equal(replay.canonical, false);
        assert.equal(host.data(beatId(body.chapter, 0)).choiceCanon["choice-1"], "option-1");
        assert.equal(host.modelCalls.length, calls, "Replaying a stored branch makes no model call");
      });
    }
  }

  await test("model-provided IDs cannot choose the persistence keys", async () => {
    const host = await harness();
    const graph = smallBeat();
    graph.choices[0].id = "__proto__";
    graph.choices[0].options[0].id = "constructor";
    graph.choices[0].options[1].id = "constructor";
    host.responses.push(graph);
    const beat = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
    assert.equal(beat.ok, true, JSON.stringify(beat));
    assert.equal(beat.choices[0].id, "choice-1");
    assert.deepEqual(
      beat.choices[0].options.map((option) => option.id),
      ["option-1", "option-2"],
    );
    assert.equal((await host.post("/choice", choiceRequest())).ok, true);
    assert.deepEqual(host.data(beatId(1, 0)).choiceCanon, { "choice-1": "option-1" });
  });

  await test("Character Stories share small replay canon and a locked final big decision", async () => {
    const host = await harness({ chapters: [plan(1), plan(2)], progress: { 1: { normal: 10 } } });
    const unitId = `${runId}:unit:arden`;
    const chapter = "bond-arden";
    const bondBody = { runId, unitId, part: 1 };
    host.seed(unitId, "unit", {
      kind: "character",
      name: "Arden",
      identitySex: "male",
      rarity: 5,
      role: "Warrior",
      affinity: "Fire",
    });
    host.seed(chapterId(chapter), "chapter-plan", { ...plan(chapter, 3), bondUnitId: unitId, bondPart: 1, after: 1 });
    const session = host.data(sessionId);
    session.roster = { [unitId]: { bondFights: 100, bondCurve: 2 } };
    session.bondChapters = { [unitId]: { beats: 0, after: 1, opened: 1 } };
    host.seed(sessionId, "session", session);
    host.responses.push(smallBeat());
    const opening = await host.post("/bond-chapter/beat", { ...bondBody, storyIndex: 0 });
    assert.equal(opening.ok, true, JSON.stringify(opening));
    assert.equal(opening.choices[0].kind, "small");
    expectError(await host.post("/bond-chapter/complete", { ...bondBody, storyIndex: 0 }), "choice-required");
    const smallBody = choiceRequest("option-1", { ...bondBody, storyIndex: 0 });
    assert.equal((await host.post("/choice", smallBody)).ok, true);
    const clearOpening = await host.post("/bond-chapter/complete", { ...bondBody, storyIndex: 0 });
    assert.equal(clearOpening.ok, true, JSON.stringify(clearOpening));
    const replay = await host.post("/choice", { ...smallBody, optionId: "option-2", replay: true });
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.optionId, "option-2");
    assert.equal(host.data(beatId(chapter, 0)).choiceCanon["choice-1"], "option-1");
    host.responses[0] = line("The paths meet again.");
    const middle = await host.post("/bond-chapter/beat", { ...bondBody, storyIndex: 1 });
    assert.equal(middle.ok, true, JSON.stringify(middle));
    assert.match(promptText(host.modelCalls.at(-1)), /CANON_ARDEN_ONLY/u);
    assert.doesNotMatch(promptText(host.modelCalls.at(-1)), /ALTERNATE_BRIN_ONLY/u);
    assert.equal((await host.post("/bond-chapter/complete", { ...bondBody, storyIndex: 1 })).ok, true);
    host.responses[0] = { ...line("Your promise will last."), choices: [bigChoice()] };
    const ending = await host.post("/bond-chapter/beat", { ...bondBody, storyIndex: 2 });
    assert.equal(ending.ok, true, JSON.stringify(ending));
    assert.equal(ending.choices[0].kind, "big");
    const callsBeforeChoice = host.modelCalls.length;
    expectError(await host.post("/bond-chapter/complete", { ...bondBody, storyIndex: 2 }), "choice-required");
    expectError(await host.post("/beat", { runId, chapter: 2, storyIndex: 0 }), "choice-required");
    expectError(await host.post("/compress", { ...bondBody }), "choice-required");
    assert.equal(host.modelCalls.length, callsBeforeChoice);
    const bigBody = choiceRequest("option-1", { ...bondBody, storyIndex: 2 });
    assert.equal((await host.post("/choice", bigBody)).ok, true);
    expectError(await host.post("/choice", { ...bigBody, optionId: "option-2", replay: true }), "choice-locked");
    const finalClear = await host.post("/bond-chapter/complete", { ...bondBody, storyIndex: 2 });
    assert.equal(finalClear.ok, true, JSON.stringify(finalClear));
    assert.equal(finalClear.beats, 3);
    host.responses[0] = { digest: "Arden's Character Story ended in a quiet promise, with the decision omitted." };
    const compressedBond = await host.post("/compress", bondBody);
    assert.equal(compressedBond.ok, true, JSON.stringify(compressedBond));
    assert.doesNotMatch(host.data(`${runId}:summary:${chapter}`).digest, /northern|southern/u);
    host.responses[0] = line("A new chapter remembers the promise.");
    const nextChapter = await host.post("/beat", { runId, chapter: 2, storyIndex: 0 });
    assert.equal(nextChapter.ok, true, JSON.stringify(nextChapter));
    assert.match(promptText(host.modelCalls.at(-1)), /Save the northern village\./u);
    assert.doesNotMatch(promptText(host.modelCalls.at(-1)), /Save the southern village\.|ALTERNATE_BRIN_ONLY/u);
  });

  await test("invalid mainline segments cannot shift a generated choice to another line", async () => {
    const host = await harness();
    const graph = smallBeat();
    graph.segments.unshift(narrator(""));
    host.responses.push(graph);
    expectError(await host.post("/beat", { runId, chapter: 1, storyIndex: 0 }), "invalid-shape");
    assert.equal(host.data(beatId(1, 0)), undefined);
  });

  const invalidChoices = [
    [
      "missing selected beat",
      (choice) => {
        delete choice.options[0].selection;
      },
    ],
    [
      "unknown selection kind",
      (choice) => {
        choice.options[0].selection.kind = "thought";
      },
    ],
    [
      "empty selected beat",
      (choice) => {
        choice.options[0].selection.text = "  ";
      },
    ],
    [
      "oversized selected beat",
      (choice) => {
        choice.options[0].selection.text = "x".repeat(281);
      },
    ],
    [
      "verbatim dialogue label",
      (choice) => {
        choice.options[0].selection = { kind: "dialogue", text: choice.options[0].text };
      },
    ],
    [
      "fewer than two options",
      (choice) => {
        choice.options.length = 1;
      },
    ],
    [
      "more than four options",
      (choice) => {
        choice.options = Array.from({ length: 5 }, (_, index) => ({
          ...clone(choice.options[0]),
          id: `option-${index + 1}`,
        }));
      },
    ],
    [
      "empty small branch",
      (choice) => {
        choice.options[0].segments = [];
      },
    ],
    [
      "oversized small branch",
      (choice) => {
        choice.options[0].segments = Array.from({ length: 9 }, () => narrator("Too long"));
      },
    ],
    [
      "duplicate option labels",
      (choice) => {
        choice.options[1].text = choice.options[0].text;
      },
    ],
    [
      "choice outside the mainline",
      (choice) => {
        choice.at = 5;
      },
    ],
    [
      "negative choice position",
      (choice) => {
        choice.at = -1;
      },
    ],
  ];
  for (const [name, corrupt] of invalidChoices) {
    await test(`model output rejects ${name} before persistence`, async () => {
      const host = await harness();
      const invalid = smallBeat();
      corrupt(invalid.choices[0]);
      host.responses.push(invalid);
      const response = await host.post("/beat", { runId, chapter: 1, storyIndex: 0 });
      expectError(response, "invalid-shape");
      assert.equal(host.data(beatId(1, 0)), undefined);
      assert.ok(host.modelCalls.length >= 1);
    });
  }
  await test("big choices are rejected before the final story node or before the final line", async () => {
    for (const [chapters, segments, choices] of [
      [[plan()], [narrator("Not the chapter end")], [bigChoice()]],
      [[plan(1, 1)], [narrator("Question"), narrator("Forbidden future")], [bigChoice()]],
      [[plan(1, 1)], [narrator("Question")], [bigChoice(), bigChoice("choice-2")]],
    ]) {
      const host = await harness({ chapters });
      host.responses.push({ places: [], segments, choices });
      expectError(await host.post("/beat", { runId, chapter: 1, storyIndex: 0 }), "invalid-shape");
      assert.equal(host.data(beatId(1, 0)), undefined);
    }
  });
  await test("legacy storyNodes plans cannot end on a big choice before their trailing combat", async () => {
    const legacyPlan = {
      chapter: 1,
      title: "Legacy chapter",
      premise: "A battle still lies ahead.",
      storyNodes: [{ title: "Before the battle", goal: "Meet Arden", guide: "The battle follows." }],
    };
    const host = await harness({ chapters: [legacyPlan] });
    host.responses.push({ ...line("A lasting decision would stop before the battle."), choices: [bigChoice()] });
    expectError(await host.post("/beat", { runId, chapter: 1, storyIndex: 0 }), "invalid-shape");
    assert.equal(host.data(beatId(1, 0)), undefined);
    assert.match(promptText(host.modelCalls[0]), /This is NOT the last story beat/u);
  });
  process.stdout.write(`${cases} Gacha Forge player-choice regression cases passed.\n`);
} finally {
  globalThis.fetch = fetchBefore;
}
