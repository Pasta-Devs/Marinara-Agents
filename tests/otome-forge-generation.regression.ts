// Otome Forge's generation core (M1): a JSON reply is parsed, checked by its schema and `normalize`, and gets exactly
// one repair turn; a refusal is a 422; every prompt is logged through debugOverride with care lines redacted; the
// per-run queue reads the cache again, so a request behind the writer never writes twice; and the background queue
// requeues a job only when admission refused it, so an admitted job never calls the model twice.
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import {
  BACKGROUND_RETRY_MAX_MS,
  BACKGROUND_RETRY_MIN_MS,
  createBackgroundQueue,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import {
  OUTPUT_FLOOR,
  REASONING_HEADROOM,
  generateJson,
  outputBudget,
  readOrGenerate,
  resolveConnectionId,
  runForeground,
  type GenerateJsonRequest,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import { OtomeForgeError } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  runIdOf,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { REDACTED } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompt-log.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import { createOtomeStore } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/store.ts";
import { createFakeDocuments, createFakeRuntime, type FakeReply } from "./fixtures/otome-forge-fakes.ts";

const RUN = runIdOf("r-gen-abcdef");
const Premise = z.object({ premise: z.string().min(1) });
type Premise = z.infer<typeof Premise>;
/** A stored premise; mutateDoc creates from `normalize(undefined)`. */
const normalizePremise = (data: unknown): Premise => {
  const parsed = Premise.safeParse(data);
  return parsed.success ? parsed.data : { premise: "" };
};

// The tests own DEBUG_AGENTS: the prompt logger reads it as well as the runtime's flag.
delete process.env.DEBUG_AGENTS;

async function setup(
  replies: FakeReply[],
  options: { debugAgents?: boolean; enabledLevels?: string[]; maxOutputTokens?: number | null } = {},
) {
  const fake = createFakeDocuments();
  const store = createOtomeStore(fake.documents);
  await store.mutateDoc(runDocTarget("world", worldId(RUN)), normalizeWorld, (world) => ({
    ...world,
    connections: { narration: "conn-narration", structured: "conn-structured" },
  }));
  const host = createFakeRuntime({ documents: fake.documents, replies, ...options });
  return { ...host, fake, store, deps: { runtime: host.runtime, store } };
}

function request(overrides: Partial<GenerateJsonRequest<Premise>> = {}): GenerateJsonRequest<Premise> {
  return {
    runId: RUN,
    job: "structured",
    label: "premise-suggest",
    messages: [
      { role: "system", content: "Reply with {premise}." },
      { role: "user", content: "A premise, please." },
    ],
    schema: Premise,
    temperature: 0.9,
    maxTokens: 600,
    debugMode: false,
    lane: "foreground",
    ...overrides,
  };
}

const failsWith = (status: number, code: string) => (error: unknown) =>
  error instanceof OtomeForgeError && error.statusCode === status && error.code === code;

test("a reply is parsed, checked by its schema and normalize, and gets exactly one repair turn", async () => {
  const { deps, calls } = await setup(['Sure! ```json\n{"premise": 42}\n```', '{"premise":"A masked ball."}']);
  const result = await generateJson(deps, request());
  assert.deepEqual(result, {
    value: { premise: "A masked ball." },
    connectionId: "conn-structured",
    model: "fake-model",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.connectionId, "conn-structured", "the job's own connection wins over narration");
  assert.deepEqual(calls[0]!.options?.responseFormat, { type: "json_object" });
  assert.equal(calls[0]!.options?.temperature, 0.9);
  assert.equal(calls[0]!.options?.maxTokens, 4096, "the budget, within the connection's own output cap");
  const repair = calls[1]!.messages;
  assert.deepEqual(repair.slice(0, 2), request().messages, "the repair turn keeps the prompt");
  assert.deepEqual(repair[2], { role: "assistant", content: 'Sure! ```json\n{"premise": 42}\n```' });
  assert.equal(repair[3]!.role, "user");
  assert.match(
    repair[3]!.content,
    /^That reply did not match the required format: premise: .+\. Reply again with ONLY the JSON object\.$/,
  );

  // `normalize` names what the schema cannot check; its words become the repair turn's reason.
  const named = await setup(['{"premise":"A boarding school."}', '{"premise":"A palace."}']);
  const normalized = await generateJson(
    named.deps,
    request({ normalize: (value) => (/school/i.test(value.premise) ? "premise: no school settings" : value) }),
  );
  assert.equal(normalized.value.premise, "A palace.");
  assert.match(named.calls[1]!.messages.at(-1)!.content, /premise: no school settings/);

  // Two bad replies: a 502, and never a third call.
  const bad = await setup(['{"premise":""}', "not json at all"]);
  await assert.rejects(generateJson(bad.deps, request()), failsWith(502, "bad-format"));
  assert.equal(bad.calls.length, 2);
});

test("a refusal on both attempts is a 422 `declined`; anything else is a 502", async () => {
  const refused = await setup(["I'm sorry, but I can't write that scene.", ""]);
  await assert.rejects(generateJson(refused.deps, request()), failsWith(422, "declined"));
  assert.equal(refused.calls.length, 2, "exactly one repair turn, even for a refusal");
  assert.equal(refused.calls[1]!.messages.at(-2)!.role, "assistant", "the refusal is shown back to the model");

  const empty = await setup(["", "   "]);
  await assert.rejects(generateJson(empty.deps, request()), failsWith(422, "declined"));
  assert.equal(empty.calls[1]!.messages.length, 3, "an empty reply adds no empty assistant turn");

  const mixed = await setup(["I cannot help with that request.", "{not json"]);
  await assert.rejects(generateJson(mixed.deps, request()), failsWith(502, "bad-format"));

  const recovered = await setup(["I won't continue this story.", '{"premise":"A storm at sea."}']);
  assert.equal((await generateJson(recovered.deps, request())).value.premise, "A storm at sea.");

  const filtered = await setup([
    { content: "", finishReason: "content_filter" },
    { content: '{"premise":"x"} trailing', finishReason: "content_filter" },
  ]);
  await assert.rejects(generateJson(filtered.deps, request({ normalize: () => null })), failsWith(422, "declined"));
});

test("refusal wording inside a JSON object is a character's voice: a reply that fails its checks there is a 502", async () => {
  // A complying reply whose own text says "I can't…": the schema fails (empty premise), then `normalize` refuses it.
  const voiced = JSON.stringify({ premise: "", lie: "I can't let anyone help me, or they'll get hurt." });
  const schema = await setup([voiced, voiced]);
  await assert.rejects(generateJson(schema.deps, request()), failsWith(502, "bad-format"));
  const checked = JSON.stringify({ premise: "Graduate student. I cannot let anyone help me." });
  const normalized = await setup([checked, checked]);
  await assert.rejects(
    generateJson(
      normalized.deps,
      request({ normalize: (value) => (/student/.test(value.premise) ? "no students" : value) }),
    ),
    failsWith(502, "bad-format"),
  );
});

test("a reply cut off at the token limit is never parsed or called a decline, and is not shown back", async () => {
  // The fake parser could read this one: a cut-off reply is refused before parsing, so half a field is never kept.
  const cut = await setup([
    { content: '{"premise":"The tide-city of"}', finishReason: "length" },
    '{"premise":"Whole."}',
  ]);
  assert.equal((await generateJson(cut.deps, request())).value.premise, "Whole.");
  assert.equal(cut.calls[1]!.messages.length, 3, "the repair turn carries no cut-off assistant text");
  assert.match(cut.calls[1]!.messages.at(-1)!.content, /cut off at the token limit/);

  // Two empty replies at the limit (a model that spent its budget thinking) are a format failure, not a refusal.
  const thinking = await setup([
    { content: "", finishReason: "length" },
    { content: "", finishReason: "max_tokens" },
  ]);
  await assert.rejects(generateJson(thinking.deps, request()), failsWith(502, "bad-format"));
});

test("every call asks for GF's output floor plus reasoning headroom, within the connection's own cap", async () => {
  assert.equal(outputBudget(600, null), OUTPUT_FLOOR + REASONING_HEADROOM);
  assert.equal(outputBudget(20_000, null), 20_000 + REASONING_HEADROOM);
  assert.equal(outputBudget(600, 4096), 4096);
  assert.equal(outputBudget(600, 0), OUTPUT_FLOOR + REASONING_HEADROOM, "no cap is no cap");
  const open = await setup(['{"not":"it"}', '{"premise":"x"}'], { maxOutputTokens: null });
  await generateJson(open.deps, request());
  assert.deepEqual(
    open.calls.map((call) => call.options?.maxTokens),
    [24_192, 24_192],
    "the repair turn gets the same room",
  );
});

test("a job without a connection is a 503 `no-connection`, and jobs fall back to narration", async () => {
  assert.equal(resolveConnectionId(null, "chat"), null);
  assert.equal(resolveConnectionId({ connections: { narration: "n" } }, "chat"), "n");
  assert.equal(resolveConnectionId({ connections: { narration: "n", chat: "c" } }, "chat"), "c");
  assert.equal(resolveConnectionId({ connections: { narration: "" } }, "structured"), null);

  const { deps, calls } = await setup(['{"premise":"x"}']);
  await assert.rejects(
    generateJson(deps, request({ runId: runIdOf("r-none-abcdef") })),
    failsWith(503, "no-connection"),
  );
  await assert.rejects(generateJson(deps, request({ runId: null })), failsWith(503, "no-connection"));
  assert.equal(calls.length, 0);
  // A named connection needs no world (premise suggestions run before one exists).
  const named = await generateJson(deps, request({ runId: null, connectionId: "conn-picked" }));
  assert.equal(named.connectionId, "conn-picked");

  const broken = await setup([]);
  broken.runtime.languageModels.resolveForRequest = async () => {
    throw new Error("Connection not found");
  };
  await assert.rejects(generateJson(broken.deps, request()), failsWith(503, "no-connection"));

  // The background lane must say which connection its admission slot is on.
  await assert.rejects(generateJson(deps, request({ lane: "background" })), RangeError);
});

test("every prompt is logged through debugOverride with redaction, and the provider still gets the text", async () => {
  const secret = "Day 3 of her cycle; cramps.";
  const messages = [
    { role: "system" as const, content: "Reply with {premise}." },
    { role: "user" as const, content: `Tonight she said: ${secret}` },
  ];
  const debug = await setup([`{"premise": 1, "echo": "${secret}"}`, '{"premise":"Tea."}']);
  await generateJson(debug.deps, request({ messages, debugMode: true, redact: [secret], label: "care-note" }));
  const prompts = debug.logs.filter((entry) => entry.level === "debugOverride");
  assert.deepEqual(
    prompts.map((entry) => [entry.override, entry.message, entry.args[0]]),
    [
      [true, "[debug/otome-forge/%s] Messages sent to the provider: %s", "care-note"],
      [true, "[debug/otome-forge/%s] Messages sent to the provider: %s", "care-note/repair"],
    ],
  );
  for (const entry of prompts) {
    assert.ok(!String(entry.args[1]).includes(secret), "the care line never reaches the log");
    assert.ok(String(entry.args[1]).includes(REDACTED));
  }
  assert.ok(debug.calls[0]!.messages[1]!.content.includes(secret), "the provider still receives it");

  // DEBUG_AGENTS turns the override on without the UI's debug mode.
  const agents = await setup(['{"premise":"x"}'], { debugAgents: true });
  await generateJson(agents.deps, request());
  assert.deepEqual(
    agents.logs.map((entry) => entry.override),
    [true],
  );

  // With the debug level on, the prompt is still logged at debug (override off).
  const levelled = await setup(['{"premise":"x"}'], { enabledLevels: ["debug"] });
  await generateJson(levelled.deps, request());
  assert.deepEqual(
    levelled.logs.map((entry) => [entry.level, entry.override]),
    [["debugOverride", false]],
  );

  // Neither debug mode nor the debug level: nothing is built or logged.
  const quiet = await setup(['{"premise":"x"}']);
  await generateJson(quiet.deps, request());
  assert.deepEqual(quiet.logs, []);
});

test("the per-run queue runs tasks in order and reads the cache again, so nothing is written twice", async () => {
  const { deps, calls, store, fake } = await setup(['{"premise":"Only once."}']);
  const id = `${RUN}:premise`;
  const normalize = normalizePremise;
  let generated = 0;
  const once = () =>
    readOrGenerate(
      RUN,
      () => store.readDoc(id, normalize),
      async () => {
        generated += 1;
        const { value } = await generateJson(deps, request());
        return store.mutateDoc({ id, kind: "premise", name: "Premise" }, normalize, () => value);
      },
    );
  const [first, second] = await Promise.all([once(), once()]);
  assert.deepEqual(first, { premise: "Only once." });
  assert.deepEqual(second, first, "the request behind the writer returns what it wrote");
  assert.equal(generated, 1);
  assert.equal(calls.length, 1);
  assert.equal(fake.rows.get(id)?.revision, 1, "one write");
  assert.deepEqual(await once(), first, "a later request reads the stored result");
  assert.equal(calls.length, 1);

  // Serial per run, and a failed task does not hold up the next.
  const order: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const a = runForeground(RUN, async () => {
    order.push("a:start");
    await gate;
    order.push("a:end");
    throw new Error("a failed");
  });
  const b = runForeground(RUN, async () => {
    order.push("b");
    return "b";
  });
  const other = runForeground(runIdOf("r-other-abcdef"), async () => {
    order.push("other run");
  });
  await other;
  assert.deepEqual(order, ["a:start", "other run"], "another run is not held up");
  release();
  await assert.rejects(a, /a failed/);
  assert.equal(await b, "b");
  assert.deepEqual(order, ["a:start", "other run", "a:end", "b"]);
});

type Outcome = "refuse" | "admit" | "admit-then-refuse";

/** A background queue over a scripted admission: each run takes the next outcome. */
function backgroundHost(outcomes: Outcome[]) {
  const host = createFakeRuntime();
  const busy = new Error("Connection conn-bg is not available for background generation.");
  const admitted: string[] = [];
  const admission = {
    async run<T>(connectionId: string, mode: { kind: string }, operation: () => Promise<T>): Promise<T> {
      assert.equal(mode.kind, "background");
      const outcome = outcomes.shift() ?? "admit";
      admitted.push(`${connectionId}:${outcome}`);
      if (outcome === "refuse") throw busy;
      const result = await operation();
      if (outcome === "admit-then-refuse") throw busy; // like a failed attempt accounting after the call
      return result;
    },
    isFailure: (error: unknown) => error === busy,
  };
  const runtime = { logger: host.runtime.logger, integrations: { admission } } as unknown as Pick<
    CapabilityRuntimeHost,
    "integrations" | "logger"
  >;
  return { queue: createBackgroundQueue(runtime), admitted, logs: host.logs };
}

/** Lets every queued promise chain settle (the mocked clock leaves setImmediate real). */
async function settle() {
  for (let round = 0; round < 25; round += 1) await new Promise((resolve) => setImmediate(resolve));
}

test("background admission refusals are requeued after at least 30 s, backing off to 5 min", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { deps, calls, store } = await setup(['{"premise":"Written in the background."}']);
  const { queue, admitted } = backgroundHost(["refuse", "refuse", "admit"]);
  const id = `${RUN}:summary`;
  const normalize = normalizePremise;
  const job = {
    key: id,
    connectionId: "conn-bg",
    async run() {
      if (await store.readDoc(id, normalize)) return;
      const { value } = await generateJson(deps, request({ lane: "background", connectionId: "conn-bg" }));
      await store.mutateDoc({ id, kind: "summary", name: "Summary" }, normalize, () => value);
    },
  };

  assert.equal(queue.ensure(job), true);
  assert.equal(queue.ensure(job), false, "a key already queued is not queued again");
  await settle();
  assert.deepEqual(admitted, ["conn-bg:refuse"]);

  t.mock.timers.tick(BACKGROUND_RETRY_MIN_MS - 1);
  await settle();
  assert.equal(admitted.length, 1, "nothing before 30 s");
  assert.equal(queue.ensure(job), false, "still queued while it backs off");
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(admitted, ["conn-bg:refuse", "conn-bg:refuse"]);

  t.mock.timers.tick(2 * BACKGROUND_RETRY_MIN_MS - 1);
  await settle();
  assert.equal(admitted.length, 2, "the second wait doubles");
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(admitted, ["conn-bg:refuse", "conn-bg:refuse", "conn-bg:admit"]);
  assert.equal(calls.length, 1, "refused attempts never reached the model");
  assert.equal(calls[0]!.connectionId, "conn-bg");
  assert.deepEqual(await store.readDoc(id, normalize), { premise: "Written in the background." });

  // Done: the key is free again, and the job sees its result and stops.
  assert.equal(queue.ensure(job), true);
  await settle();
  assert.equal(calls.length, 1);

  // The wait caps at 5 min.
  const capped = backgroundHost(Array.from({ length: 7 }, () => "refuse" as const));
  capped.queue.ensure({ key: "capped", connectionId: "conn-bg", run: async () => {} });
  await settle();
  for (const wait of [1, 2, 4, 8, 10, 10].map((step) =>
    Math.min(BACKGROUND_RETRY_MAX_MS, step * BACKGROUND_RETRY_MIN_MS),
  )) {
    const before = capped.admitted.length;
    t.mock.timers.tick(wait - 1);
    await settle();
    assert.equal(capped.admitted.length, before, `nothing before ${wait} ms`);
    t.mock.timers.tick(1);
    await settle();
    assert.equal(capped.admitted.length, before + 1, `the next attempt at ${wait} ms`);
  }
  capped.queue.dispose();
});

test("an admitted background job never calls the model twice, and one connection runs one job at a time", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { deps, calls } = await setup(['{"premise":"Once."}', '{"premise":""}', "nope"]);
  const { queue, admitted, logs } = backgroundHost(["admit-then-refuse", "admit"]);
  const generate = () => generateJson(deps, request({ lane: "background", connectionId: "conn-bg" }));

  // Admission fails after the job ran (its accounting, say): the queue must not run it again.
  queue.ensure({ key: "a", connectionId: "conn-bg", run: async () => void (await generate()) });
  await settle();
  t.mock.timers.tick(2 * BACKGROUND_RETRY_MAX_MS);
  await settle();
  assert.deepEqual(admitted, ["conn-bg:admit-then-refuse"]);
  assert.equal(calls.length, 1);

  // Any other failure is logged and dropped, never retried: the repair turn was its one second chance.
  queue.ensure({ key: "b", connectionId: "conn-bg", run: async () => void (await generate()) });
  await settle();
  t.mock.timers.tick(2 * BACKGROUND_RETRY_MAX_MS);
  await settle();
  assert.equal(calls.length, 3);
  assert.deepEqual(
    logs.filter((entry) => entry.level === "warn").map((entry) => entry.args[0]),
    ["a", "b"],
  );

  // One job at a time per connection; another connection is not held up.
  const order: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  queue.ensure({ key: "first", connectionId: "conn-bg", run: async () => (order.push("first"), held) });
  queue.ensure({ key: "second", connectionId: "conn-bg", run: async () => void order.push("second") });
  queue.ensure({ key: "elsewhere", connectionId: "conn-other", run: async () => void order.push("elsewhere") });
  await settle();
  assert.deepEqual(order, ["first", "elsewhere"]);
  release();
  await settle();
  assert.deepEqual(order, ["first", "elsewhere", "second"]);
  queue.dispose();
});
