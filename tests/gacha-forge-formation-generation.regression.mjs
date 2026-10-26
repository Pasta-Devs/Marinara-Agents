// Actual activated SDK conversion routes and observed chatComplete options; fixed local provider only.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createChapterRuntime,
  chapterRunId as runId,
  chapterUnitId as unitId,
} from "./fixtures/gacha-forge-chapter-runtime.mjs";
import { chatConnectionId } from "./fixtures/gacha-forge-chat-runtime.mjs";
import {
  FORGE_FORMATION_RULES,
  FORGE_FORMATION_ENGINE,
  FORGE_FORMATION_KIT_PROMPT,
  normalizeForgeFormationKit,
} from "../packages/gacha-forge/src/formation-combat-shared.mjs";

const kit = () => ({
  version: 1,
  preferredRow: "front",
  standard: {
    name: "Measured strike",
    description: "Strike one enemy.",
    effect: "damage",
    target: "enemy",
    power: 100,
    cost: 0,
    duration: 1,
  },
  ultimate: {
    name: "Lighthouse flare",
    description: "A decisive strike.",
    effect: "damage",
    target: "enemy",
    power: 200,
    cost: 4,
    elementCost: 2,
    duration: 1,
  },
  passive: {
    name: "Steady guard",
    description: "Stay ready.",
    effect: "shield",
    target: "self",
    power: 0,
    duration: 1,
    trigger: "turn_start",
    row: "both",
  },
  traits: [],
});
const baseAnswerTokens = 8192;
const existingReasoningReserve = 16000;
const expectedBudget = baseAnswerTokens + existingReasoningReserve;

async function fixture(mode = "classic") {
  const f = await createChapterRuntime();
  // Align the resolved SDK ceiling with this suite's existing explicit HTTP capacity.
  f.transport.maxContext = 262144;
  const originalFetch = globalThis.fetch;
  const parameters = {
    reasoningEffort: "max",
    verbosity: "high",
    enabledParameters: { reasoningEffort: true, verbosity: true },
  };
  globalThis.fetch = async (input, options) => {
    if (new URL(input).pathname === "/api/connections")
      return Response.json([
        {
          id: chatConnectionId,
          provider: "custom",
          model: "controlled-same-main-model",
          maxContext: 262144,
          defaultParameters: parameters,
        },
      ]);
    return originalFetch(input, options);
  };
  // Match the public transaction contract when conversion workers commit concurrently.
  const transact = f.persistence.transaction;
  let tail = Promise.resolve();
  f.persistence.transaction = (operation) => {
    const pending = tail.then(() => transact(operation));
    tail = pending.catch(() => {});
    return pending;
  };
  const run = f.docs.get("index").data.runs[0];
  run.combat = { mode, revision: 0 };
  f.transport.stage = "formation";
  f.transport.reply = () => JSON.stringify(kit());
  f.transport.completionOptions = [];
  f.calls.length = 0;
  f.resolved.length = 0;
  const status = async () => {
    let response;
    for (let attempt = 0; attempt < 100; attempt++) {
      response = (await f.post("/combat-mode/status")).body;
      if (["committed", "failed", "cancelled"].includes(response.conversion?.status)) return response;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.fail(`Conversion did not settle: ${JSON.stringify(response)}`);
  };
  const assertRequests = (reasoning = parameters.reasoningEffort, from = 0) => {
    const options = f.transport.completionOptions.slice(from);
    assert.ok(options.length, "Actual package called the selected resolved model");
    for (const request of options) {
      assert.equal(request.maxTokens, expectedBudget, "8192 answer tokens plus the existing16000 reasoning reserve");
      assert.equal(request.reasoningEffort, reasoning, "Preserve the selected connection's current reasoning setting");
      assert.equal(request.verbosity, "high");
      assert.ok(
        request.signal instanceof AbortSignal,
        "Preserve cancellation rather than turning conversion into detached work",
      );
    }
    assert.ok(f.resolved.every((request) => request.connectionId === chatConnectionId));
    assert.ok(f.calls.every((call) => call.body.model === "controlled-same-main-model"));
  };
  return { ...f, run, parameters, status, assertRequests };
}

test("actual initial Formation conversion reserves8192 answer tokens plus existing reasoning headroom", async () => {
  const f = await fixture();
  try {
    const before = structuredClone(f.docs.get(unitId).data);
    assert.equal((await f.post("/combat-mode/switch", { targetMode: "formation", confirmed: true })).body.ok, true);
    const state = await f.status();
    assert.equal(state.conversion.status, "committed", JSON.stringify(state));
    assert.equal(f.transport.completionOptions.length, 1);
    f.assertRequests();
    assert.equal(f.transport.completionOptions[0].temperature, 0.8);
    assert.ok(normalizeForgeFormationKit(f.docs.get(unitId).data.formationKit));
    for (const [key, value] of Object.entries(before)) assert.deepEqual(f.docs.get(unitId).data[key], value);
    const prompt = JSON.stringify(f.calls[0].body.messages);
    assert.ok(prompt.includes("CURRENT_AUTHORED_CARD_CANON"));
    assert.ok(!prompt.includes("DISALLOWED_CARD_SCENARIO"));
  } finally {
    await f.close();
  }
});

test("actual explicit retry uses the same output budget and the connection's latest reasoning setting", async () => {
  const f = await fixture();
  try {
    f.transport.reply = () => '{"preferredRow":"front","standard":';
    assert.equal((await f.post("/combat-mode/switch", { targetMode: "formation", confirmed: true })).body.ok, true);
    const failed = await f.status();
    assert.equal(failed.conversion.status, "failed");
    assert.equal(f.run.combat.mode, "classic");
    assert.equal(f.transport.completionOptions.length, 2, "Existing bounded format repair remains unchanged");
    f.assertRequests("max");
    const priorCalls = f.transport.completionOptions.length;
    f.parameters.reasoningEffort = "high";
    f.transport.reply = () => JSON.stringify(kit());
    assert.equal((await f.post("/combat-mode/retry", { jobId: failed.conversion.id, confirmed: true })).body.ok, true);
    const state = await f.status();
    assert.equal(state.conversion.status, "committed", JSON.stringify(state));
    assert.equal(f.transport.completionOptions.length, priorCalls + 1);
    f.assertRequests("high", priorCalls);
    assert.equal(f.transport.completionOptions.at(-1).temperature, 0.8);
  } finally {
    await f.close();
  }
});

test("actual new-unit ensure repair shares the conversion budget without regenerating ready units", async () => {
  const f = await fixture("formation");
  try {
    f.docs.get(unitId).data.formationKit = kit();
    f.docs.get(unitId).data.formationKitPrompt = FORGE_FORMATION_KIT_PROMPT;
    const newId = `${runId}:unit:briar`;
    f.seed(newId, "unit", {
      kind: "character",
      name: "Briar",
      affinity: "Wind",
      description: "A lighthouse gardener.",
      personality: "Patient.",
    });
    f.session().roster[newId] = { level: 20, bondFights: 0 };
    const reply = (
      await f.post("/battle", {
        chapter: 2,
        combatIndex: 0,
        difficulty: "normal",
        expectedFormationEngine: FORGE_FORMATION_ENGINE,
        expectedFormationRules: FORGE_FORMATION_RULES,
      })
    ).body;
    assert.equal(reply.error, "combat-conversion-in-progress");
    const state = await f.status();
    assert.equal(state.conversion.status, "committed", JSON.stringify(state));
    assert.equal(f.transport.completionOptions.length, 1);
    f.assertRequests();
    assert.equal(f.transport.completionOptions[0].temperature, 0.8);
    assert.ok(JSON.stringify(f.calls[0].body.messages).includes("Briar"));
    assert.deepEqual(f.docs.get(unitId).data.formationKit, kit());
    assert.ok(normalizeForgeFormationKit(f.docs.get(newId).data.formationKit));
  } finally {
    await f.close();
  }
});

test("actual conversion parses leniently: budgets clamp, a four-star loses a signature, and kits are stamped", async () => {
  const f = await fixture();
  try {
    f.docs.get(unitId).data.rarity = 4;
    f.transport.reply = () =>
      JSON.stringify({
        ...kit(),
        preferredRow: "Front",
        standard: { ...kit().standard, power: 999, effect: "Strike" },
        ultimate: { ...kit().ultimate, elementCost: 0 },
        traits: ["solo_front"],
      });
    assert.equal((await f.post("/combat-mode/switch", { targetMode: "formation", confirmed: true })).body.ok, true);
    const state = await f.status();
    assert.equal(state.conversion.status, "committed", JSON.stringify(state));
    assert.equal(f.transport.completionOptions.length, 1, "a fixable kit never costs a paid retry");
    const saved = f.docs.get(unitId).data;
    assert.equal(saved.formationKitPrompt, FORGE_FORMATION_KIT_PROMPT);
    assert.equal(saved.formationKit.preferredRow, "front");
    assert.equal(saved.formationKit.standard.effect, "damage");
    assert.equal(saved.formationKit.standard.power, 100, "a free Normal skill keeps the 100% budget");
    assert.equal(saved.formationKit.ultimate.elementCost, 1);
    assert.deepEqual(saved.formationKit.traits, []);
    const prompt = f.calls[0].body.messages[0].content;
    for (const phrase of [
      "up to three Front Row fighters and up to three Back Row supports",
      "ARCHETYPE",
      "VERY STRONG passive",
      "No arbitrary code",
      "Hold",
    ])
      assert.ok(prompt.includes(phrase), phrase);
  } finally {
    await f.close();
  }
});
