import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  forgeFormatCharacterCardReference,
  forgeFormatStoryCharacters,
  forgeHydrateStoryCharacters,
  forgeIncludeStoryFocusCharacters,
  logForgeStoryPrompt,
} from "../packages/gacha-forge/src/character-card-context.mjs";

const character = (overrides = {}) => ({
  kind: "character",
  name: "Łucja 雪",
  rarity: 5,
  role: "Support",
  affinity: "Water",
  identitySex: "female",
  description: "GENERATED_DESCRIPTION_CONFLICT",
  personality: "GENERATED_PERSONALITY_CONFLICT",
  outfitLine: "wearing a travelling coat",
  ...overrides,
});
const fields = ["description", "personality", "backstory", "appearance"];
const authored = (label = "original") =>
  Object.fromEntries(
    fields.map((field) => [field, `${label} ${field}: Zażółć gęślą jaźń 雪。`.repeat(900) + `${field}_TAIL_${label}`]),
  );
const legacy = (units, outfit = false) =>
  (units ?? [])
    .filter((unit) => unit?.kind === "character")
    .map((unit) =>
      [
        `${unit.name} ${unit.rarity}★ ${unit.role} ${unit.affinity} ${unit.identitySex}`,
        unit.description?.slice(0, 220),
        unit.personality?.slice(0, 140),
        outfit ? unit.outfitLine : "",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");

test("full current four-field canon replaces generated characterization while preserving identity, kit and outfit", async () => {
  const card = Object.freeze({ name: "Linked card", ...authored() });
  const original = Object.freeze(character({ cardId: "card-42" }));
  const units = Object.freeze([original]);
  const requests = [];
  const hydrated = await forgeHydrateStoryCharacters(units, async (id) => {
    requests.push(id);
    return card;
  });
  const prompt = forgeFormatStoryCharacters(legacy, hydrated, true);
  assert.deepEqual(requests, ["card-42"]);
  assert.notEqual(hydrated[0], original);
  assert.equal(original.forgeCardCanon, undefined);
  assert.deepEqual(hydrated[0].forgeCardCanon, Object.fromEntries(fields.map((field) => [field, card[field]])));
  for (const field of fields) {
    assert.ok(prompt.includes(card[field]), `entire ${field} remains in the prompt`);
    assert.ok(prompt.includes(`${field}_TAIL_original`));
  }
  assert.match(prompt, /Łucja 雪 5★ Support Water female/);
  assert.match(prompt, /travelling coat/);
  assert.doesNotMatch(prompt, /GENERATED_DESCRIPTION_CONFLICT|GENERATED_PERSONALITY_CONFLICT/);
  assert.match(prompt, /CANONICAL CHARACTER CARD/);
});

test("fresh card edits are read on every request, with duplicate IDs coalesced only within the request", async () => {
  let card = authored("before");
  const requests = [];
  const read = async (id) => {
    requests.push(id);
    return card;
  };
  const first = character({ cardId: "same-card" });
  const second = character({ name: "Second game identity", cardId: "same-card" });
  const initial = await forgeHydrateStoryCharacters([first, second], read);
  assert.deepEqual(requests, ["same-card"]);
  assert.match(forgeFormatStoryCharacters(legacy, initial), /description_TAIL_before/);
  card = authored("edited");
  const updated = await forgeHydrateStoryCharacters(initial, read);
  assert.deepEqual(requests, ["same-card", "same-card"]);
  const prompt = forgeFormatStoryCharacters(legacy, updated);
  assert.match(prompt, /description_TAIL_edited/);
  assert.doesNotMatch(prompt, /TAIL_before/);
});

test("forbidden card fields are never read or serialized, including on the initial forge reference", async () => {
  const card = { name: "Allowed identity", ...authored("allowed") };
  for (const key of [
    "scenario",
    "greetings",
    "first_mes",
    "alternate_greetings",
    "examples",
    "mes_example",
    "system_prompt",
    "creatorNotes",
    "creator_notes",
    "tags",
  ]) {
    Object.defineProperty(card, key, {
      get() {
        throw new Error(`forbidden field read: ${key}`);
      },
    });
  }
  const hydrated = await forgeHydrateStoryCharacters([character({ cardId: "allowed-only" })], async () => card);
  const story = forgeFormatStoryCharacters(legacy, hydrated);
  const initial = forgeFormatCharacterCardReference(card);
  for (const field of fields) {
    assert.ok(story.includes(card[field]));
    assert.ok(initial.includes(card[field]));
  }
  assert.match(initial, /Allowed identity/);
  assert.deepEqual(Object.keys(JSON.parse(initial.slice(initial.indexOf("\n") + 1))), fields);
});

test("a linked card with intentionally empty fields suppresses invented characterization", async () => {
  const hydrated = await forgeHydrateStoryCharacters([character({ cardId: "empty-card" })], async () => ({}));
  const prompt = forgeFormatStoryCharacters(legacy, hydrated);
  assert.doesNotMatch(prompt, /GENERATED_DESCRIPTION_CONFLICT|GENERATED_PERSONALITY_CONFLICT/);
  assert.deepEqual(hydrated[0].forgeCardCanon, Object.fromEntries(fields.map((field) => [field, ""])));
});

test("unlinked characters never borrow same-name cards and keep byte-identical legacy context", async () => {
  const source = [character({ name: "Shared name" }), { kind: "weapon", cardId: "weapon-is-not-a-character" }];
  const hydrated = await forgeHydrateStoryCharacters(source, async () => {
    throw new Error("unlinked units must never read a card by name");
  });
  assert.equal(forgeFormatStoryCharacters(legacy, hydrated, true), legacy(source, true));
  assert.notEqual(hydrated[0], source[0]);
});

for (const failure of ["missing", "throws"]) {
  test(`${failure} linked cards warn once per ID, remove stale canon, and preserve the legacy fallback`, async () => {
    const warnings = [];
    const original = character({ cardId: "deleted-card", forgeCardCanon: authored("stale") });
    const hydrated = await forgeHydrateStoryCharacters(
      [original, original],
      async () => {
        if (failure === "throws") throw new Error("private transport diagnostic");
        return null;
      },
      { warn: (...args) => warnings.push(args) },
    );
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][1], "deleted-card");
    assert.equal(hydrated[0].forgeCardCanon, undefined);
    assert.ok(original.forgeCardCanon);
    assert.equal(forgeFormatStoryCharacters(legacy, hydrated, true), legacy([original, original], true));
    assert.doesNotMatch(warnings.flat().join(" "), /TAIL_stale|private transport diagnostic/);
  });
}

test("a pronoun-only Character Story guide retains its exact focus from the same run without changing matched extras", async () => {
  const focus = character({ cardId: "focus-card" });
  const extra = character({ name: "Mira", cardId: "extra-card" });
  const documents = [
    { id: "run-a:unit:focus", data: focus },
    { id: "run-a:unit:extra", data: extra },
    { id: "run-a:unit:weapon", data: { kind: "weapon" } },
  ];
  const guide = "He tells the protagonist what he remembered.";
  assert.ok(!guide.includes(focus.name));
  const selected = forgeIncludeStoryFocusCharacters(
    documents,
    [extra],
    ["run-a:unit:focus", "run-b:unit:focus", "run-a:unit:weapon"],
  );
  assert.deepEqual(selected, [extra, focus]);
  assert.deepEqual(forgeIncludeStoryFocusCharacters(documents, selected, ["run-a:unit:focus"]), selected);
  const requested = [];
  const hydrated = await forgeHydrateStoryCharacters(selected, async (id) => {
    requested.push(id);
    return authored(id);
  });
  const prompt = forgeFormatStoryCharacters(legacy, hydrated);
  assert.deepEqual(requested, ["extra-card", "focus-card"]);
  assert.match(prompt, /backstory_TAIL_focus-card/);
  assert.match(prompt, /appearance_TAIL_extra-card/);
  assert.equal(documents[0].data, focus);
  assert.equal(focus.forgeCardCanon, undefined);
});

test("final prompt logging preserves complete canon, excludes forbidden fields, and honors UI/runtime debug overrides", async () => {
  const card = {
    ...authored("logged"),
    scenario: "DISALLOWED_SCENARIO",
    mes_example: "DISALLOWED_DIALOGUE",
    creatorNotes: "DISALLOWED_CREATOR_NOTES",
  };
  const hydrated = await forgeHydrateStoryCharacters([character({ cardId: "logged-card" })], async () => card);
  const messages = [
    { role: "system", content: "Final fitted story instructions" },
    { role: "user", content: forgeFormatStoryCharacters(legacy, hydrated) },
  ];
  const before = structuredClone(messages);
  const calls = [];
  const runtime = {
    isDebugAgentsEnabled: () => false,
    logger: { debugOverride: (...args) => calls.push(args) },
  };
  logForgeStoryPrompt(runtime, "story-beat", messages, { debugMode: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], true);
  assert.equal(calls[0][1], "[debug/gacha-forge/%s] Messages sent to the provider: %s");
  assert.equal(calls[0][2], "story-beat");
  assert.deepEqual(JSON.parse(calls[0][3]), messages);
  for (const field of fields) assert.ok(JSON.parse(calls[0][3])[1].content.includes(card[field]));
  assert.doesNotMatch(calls[0][3], /DISALLOWED_/);
  assert.deepEqual(messages, before);
  logForgeStoryPrompt({ ...runtime, isDebugAgentsEnabled: () => true }, "bond-plan", messages);
  assert.equal(calls[1][0], true);
  logForgeStoryPrompt(runtime, "story-plan", messages);
  assert.equal(calls[2][0], /^(1|true)$/iu.test(process.env.DEBUG_AGENTS || ""));
});

test("prompt logging avoids disabled serialization while preserving debug, override and legacy logger paths", () => {
  const previous = process.env.DEBUG_AGENTS;
  process.env.DEBUG_AGENTS = "false";
  try {
    let serialized = 0;
    const messages = [{ role: "user", content: "Final fitted text" }];
    Object.defineProperty(messages, "toJSON", {
      value: () => {
        serialized += 1;
        return ["serialized"];
      },
    });
    const calls = [];
    let enabled = false;
    const runtime = {
      logger: {
        isLevelEnabled: (level) => {
          assert.equal(level, "debug");
          return enabled;
        },
        debugOverride: (...args) => calls.push(args),
      },
    };
    logForgeStoryPrompt(runtime, "story-plan", messages);
    assert.equal(serialized, 0);
    assert.equal(calls.length, 0);
    enabled = true;
    logForgeStoryPrompt(runtime, "story-plan", messages);
    assert.equal(serialized, 1, "ordinary LOG_LEVEL=debug still serializes and logs");
    assert.equal(calls[0][0], false);
    enabled = false;
    logForgeStoryPrompt(runtime, "story-plan", messages, { debugMode: true });
    assert.equal(serialized, 2);
    assert.equal(calls[1][0], true);
    process.env.DEBUG_AGENTS = "true";
    logForgeStoryPrompt(runtime, "story-plan", messages);
    assert.equal(serialized, 3);
    assert.equal(calls[2][0], true);
    process.env.DEBUG_AGENTS = "false";
    enabled = undefined;
    logForgeStoryPrompt(runtime, "story-plan", messages);
    assert.equal(serialized, 4, "an unknown level result preserves normal debug logging");
    assert.equal(calls[3][0], false);
    delete runtime.logger.isLevelEnabled;
    logForgeStoryPrompt(runtime, "story-plan", messages);
    assert.equal(serialized, 5, "legacy hosts without level detection retain their normal debug path");
    assert.equal(calls[4][0], false);
  } finally {
    if (previous === undefined) delete process.env.DEBUG_AGENTS;
    else process.env.DEBUG_AGENTS = previous;
  }
});

test("prompt logging retains the existing debug/info path when a test host lacks debugOverride", () => {
  const calls = [];
  const runtime = {
    logger: {
      info: (...args) => calls.push({ level: "info", args }),
      debug: (...args) => calls.push({ level: "debug", args }),
    },
  };
  logForgeStoryPrompt(runtime, "story-beat", [{ role: "user", content: "Final fitted text" }], { debugMode: true });
  assert.equal(calls[0].level, "info");
  assert.deepEqual(JSON.parse(calls[0].args[2]), [{ role: "user", content: "Final fitted text" }]);
  logForgeStoryPrompt(runtime, "story-plan", []);
  assert.equal(calls[1].level, /^(1|true)$/iu.test(process.env.DEBUG_AGENTS || "") ? "info" : "debug");
});

test("shipped Character Story planner and beat prompt builders carry the full authored reference", async () => {
  const directory = await mkdtemp(join(tmpdir(), "marinara-forge-card-prompts-"));
  try {
    const path = join(directory, "server.mjs");
    const source = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
    // Like the existing story-boss proof, expose internals only in a disposable copy of the shipped bundle.
    await writeFile(path, source + "\nexport { mS as characterStoryPlan, bS as storyBeat, vu as characterContext };\n");
    const bundled = await import(pathToFileURL(path).href);
    const card = {
      ...authored("bundle"),
      scenario: "DISALLOWED_SOURCE_SCENARIO",
      mes_example: "DISALLOWED_SOURCE_EXAMPLE",
      first_mes: "DISALLOWED_SOURCE_GREETING",
      creatorNotes: "DISALLOWED_SOURCE_CREATOR_NOTES",
    };
    const [unit] = await forgeHydrateStoryCharacters([character({ cardId: "bundle-card" })], async () => card);
    const plan = bundled.characterStoryPlan({
      scenario: "Allowed world scenario",
      unit,
      protagonist: { name: "Mari" },
    });
    const beat = bundled.storyBeat(
      "Allowed world scenario",
      "A chapter about the same person",
      { title: "The meeting", goal: "Remember", guide: "She tells the protagonist what she remembered." },
      "",
      [],
      [],
      { name: "Mari" },
      { pool: bundled.characterContext([unit], true), index: "" },
    );
    for (const [label, messages] of [
      ["bond-plan", plan],
      ["beat", beat],
    ]) {
      const text = messages.map((message) => message.content).join("\n");
      for (const field of fields) assert.ok(text.includes(card[field]), `${label} contains the whole ${field}`);
      assert.doesNotMatch(text, /DISALLOWED_SOURCE_|GENERATED_DESCRIPTION_CONFLICT|GENERATED_PERSONALITY_CONFLICT/);
      const logged = [];
      logForgeStoryPrompt({ logger: { debugOverride: (...args) => logged.push(args) } }, label, messages, {
        debugMode: true,
      });
      assert.deepEqual(JSON.parse(logged[0][3]), messages);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rebuilt main focus, main beat and pronoun-only Character Story contexts read fresh cards without unit writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "marinara-forge-card-paths-"));
  const originalFetch = globalThis.fetch;
  let cleanup;
  try {
    const path = join(directory, "server.mjs");
    let source = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
    const anchors = source.match(/async function uh\([^)]*\)\{/gu) ?? [];
    assert.equal(anchors.length, 1, "Expose the real activation-local context functions through one disposable probe");
    source = source.replace(
      anchors[0],
      "forgeCardContextProbe={mainFocus:uh,sceneFocus:Lw,readCard:(id)=>Le().characterCard(id)};" + anchors[0],
    );
    await writeFile(
      path,
      "let forgeCardContextProbe;\n" +
        source +
        "\nexport { forgeCardContextProbe, gS as mainPlan, mS as characterStoryPlan, bS as storyBeat, forgeHydrateStoryCharacters as hydrate };\n",
    );
    const bundled = await import(pathToFileURL(path).href);
    const runId = "card-paths";
    const focusId = `${runId}:unit:focus`;
    const focus = character({ cardId: "card-focus" });
    const extra = character({ name: "Mira", cardId: "card-extra", rarity: 4 });
    const unitDocuments = [
      { id: focusId, packageId: "gacha-forge", kind: "unit", revision: 1, data: focus },
      { id: `${runId}:unit:extra`, packageId: "gacha-forge", kind: "unit", revision: 1, data: extra },
      {
        id: "another-run:unit:foreign",
        packageId: "gacha-forge",
        kind: "unit",
        revision: 1,
        data: character({ cardId: "foreign-card" }),
      },
    ];
    const snapshot = structuredClone(unitDocuments);
    const cards = new Map([
      ["card-focus", authored("focus-before")],
      ["card-extra", authored("extra")],
    ]);
    const cardReads = [];
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      assert.ok(
        url.pathname.startsWith("/api/characters/"),
        `No provider or unrelated Engine request: ${url.pathname}`,
      );
      const id = decodeURIComponent(url.pathname.slice("/api/characters/".length));
      cardReads.push(id);
      const card = cards.get(id);
      return {
        ok: !!card,
        status: card ? 200 : 404,
        async json() {
          return card
            ? {
                id,
                data: {
                  name: "Authored card identity",
                  description: card.description,
                  personality: card.personality,
                  extensions: { backstory: card.backstory, appearance: card.appearance },
                  scenario: "DISALLOWED_PATH_SCENARIO",
                  mes_example: "DISALLOWED_PATH_EXAMPLE",
                },
              }
            : { error: "not found" };
        },
      };
    };
    const writes = [];
    const warnings = [];
    let modelCalls = 0;
    const runtime = {
      persistence: {
        documents: {
          async list(packageId, kind) {
            assert.equal(packageId, "gacha-forge");
            return structuredClone(unitDocuments.filter((doc) => !kind || kind === doc.kind));
          },
          async getById() {
            return null;
          },
          async create(value) {
            writes.push(value);
            throw new Error("Context reads must not create documents");
          },
          async update(value) {
            writes.push(value);
            throw new Error("Context reads must not update documents");
          },
          async remove(value) {
            writes.push(value);
            throw new Error("Context reads must not remove documents");
          },
        },
      },
      logger: { info() {}, debug() {}, error() {}, warn: (...args) => warnings.push(args) },
      json: { parseJsonish: JSON.parse },
      languageModels: {
        async resolveForRequest() {
          modelCalls++;
          throw new Error("Card context adds no model calls");
        },
      },
    };
    cleanup = await bundled.activate({
      package: { id: "gacha-forge", version: "fixture" },
      api: {
        runtime,
        async registerPrivilegedRoutes(register) {
          await register({ get() {}, post() {} });
        },
      },
    });
    const probe = bundled.forgeCardContextProbe;
    assert.equal(typeof probe.mainFocus, "function");
    const world = { scenario: "Allowed world context", protagonist: { name: "Mari" }, images: { outfitCanon: false } };
    const assertCanon = (messages, card, label) => {
      const text = messages.map((message) => message.content).join("\n");
      for (const field of fields) assert.ok(text.includes(card[field]), `${label}: full ${field}`);
      assert.doesNotMatch(text, /DISALLOWED_PATH_|GENERATED_DESCRIPTION_CONFLICT|GENERATED_PERSONALITY_CONFLICT/);
    };
    const main = await probe.mainFocus(runId);
    assertCanon(bundled.mainPlan(world.scenario, 1, 3, world.protagonist, main), cards.get("card-focus"), "main focus");
    assert.deepEqual(cardReads.toSorted(), ["card-extra", "card-focus"]);
    cards.set("card-focus", authored("focus-edited"));
    const scene = await probe.sceneFocus(runId, `${focus.name} speaks with Mira.`, world);
    const beat = (pool) =>
      bundled.storyBeat(
        world.scenario,
        "A meeting",
        { title: "Remember", guide: "She tells the protagonist what she remembered.", goal: "Remember" },
        "",
        [],
        [],
        world.protagonist,
        pool,
      );
    assertCanon(beat(scene), cards.get("card-focus"), "main beat after card edit");
    assert.doesNotMatch(scene.pool, /TAIL_focus-before/);
    const [bondUnit] = await bundled.hydrate([focus], probe.readCard, runtime.logger);
    assertCanon(
      bundled.characterStoryPlan({ scenario: world.scenario, unit: bondUnit, protagonist: world.protagonist }),
      cards.get("card-focus"),
      "Character Story plan",
    );
    const forced = await probe.sceneFocus(runId, "She tells the protagonist what she remembered.", world, [
      focusId,
      "another-run:unit:foreign",
    ]);
    assert.deepEqual(forced.names, [focus.name]);
    assertCanon(beat(forced), cards.get("card-focus"), "pronoun-only Character Story beat");
    assert.ok(!cardReads.includes("foreign-card"));
    assert.equal(warnings.length, 0);
    cards.delete("card-focus");
    const missing = await probe.sceneFocus(runId, focus.name, world);
    assert.match(missing.pool, /GENERATED_DESCRIPTION_CONFLICT/);
    assert.match(missing.pool, /travelling coat/);
    assert.equal(warnings.length, 1);
    assert.equal(writes.length, 0);
    assert.equal(modelCalls, 0);
    assert.deepEqual(unitDocuments, snapshot);
  } finally {
    if (typeof cleanup === "function") await cleanup();
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});
