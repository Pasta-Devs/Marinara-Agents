// Otome Forge's generation core (M1): a JSON reply is parsed, checked by its schema and `normalize`, and gets exactly
// one repair turn; a refusal is a 422; every prompt is logged through debugOverride with care lines redacted; the
// per-run queue reads the cache again, so a request behind the writer never writes twice; and the background queue
// requeues a job only when admission refused it, so an admitted job never calls the model twice. #2039: a prompt
// that fits is sent as it is; on overflow its story memory gives way as GF's fitForgeMemoryPrompt has it (recalled
// details first, then only at the reply floor the oldest uncovered summaries), and one that still cannot fit, or that
// the Engine would trim, is a 413 `capacity` that sends nothing. A call sends its output size alone: no temperature,
// no JSON mode, nothing else, so the connection's own saved settings are what the Engine sends.
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { forgeMemoryContext } from "@forge-kit/story-memory-fit.mjs";
import { forgeStoryMemoryText } from "@forge-kit/story-memory.mjs";
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
  options: {
    debugAgents?: boolean;
    enabledLevels?: string[];
    maxOutputTokens?: number | null;
    maxContext?: number | null;
  } = {},
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
    maxTokens: 600,
    debugMode: false,
    lane: "foreground",
    ...overrides,
  };
}

const failsWith = (status: number, code: string) => (error: unknown) =>
  error instanceof OtomeForgeError && error.statusCode === status && error.code === code;

test("a cache mark is sent as it is, through the fit and the repair turn, for an hour, and debug mode logs what was cached (#2066)", async () => {
  const usage = { promptTokens: 40, cachedPromptTokens: 9000, cacheWritePromptTokens: 120 };
  const { deps, calls, logs } = await setup([
    { content: "not json", finishReason: "stop", usage },
    { content: '{"premise":"A masked ball."}', finishReason: "stop", usage },
  ]);
  const messages = [
    { role: "system" as const, content: "THE STORY: the shared context.", cacheBreakpoint: true },
    { role: "system" as const, content: "Reply with {premise}.", cacheBreakpoint: true },
    { role: "user" as const, content: "A premise, please." },
  ];
  await generateJson(deps, request({ messages, debugMode: true }));
  for (const call of calls) {
    assert.deepEqual(
      call.messages.slice(0, 3),
      messages,
      "both marks reach the Engine, and the part that changes has none",
    );
    // #2091: a chapter's calls come minutes apart, so a marked prompt asks for the hour-long cache.
    assert.equal((call.options as { cacheTtl?: string }).cacheTtl, "1h");
  }
  assert.equal(calls[1]!.messages.length, 5, "the repair turn adds its two messages after them");
  const cached = logs.filter((entry) => entry.level === "debugOverride" && /Prompt cache/u.test(entry.message));
  assert.equal(cached.length, 2);
  assert.deepEqual(cached[0]!.args, ["premise-suggest", 9000, 120, 40]);
  assert.equal(cached[0]!.override, true);

  // A prompt without marks is sent as before: no field added.
  const plain = await setup(['{"premise":"A masked ball."}']);
  await generateJson(plain.deps, request());
  assert.ok(plain.calls[0]!.messages.every((message) => !("cacheBreakpoint" in message)));
  assert.ok(!("cacheTtl" in plain.calls[0]!.options!), "nor a cache lifetime");
  assert.ok(!plain.logs.some((entry) => /Prompt cache/u.test(entry.message)), "nothing reported, nothing logged");
});

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
  // The output size alone (debugMode and signal are the Engine's own): the connection's settings decide the rest.
  assert.deepEqual(Object.keys(calls[0]!.options ?? {}).sort(), ["debugMode", "maxTokens", "signal"]);
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

// ── #2039: the story memory gives way as GF's fitForgeMemoryPrompt has it, and a prompt too big is a 413 ──

/** About `tokens` tokens of Latin text after a marker (the kit's estimate: a quarter of a token per character). */
const sized = (mark: string, tokens: number) => `${mark} ${"lamp ".repeat(Math.round((tokens * 4) / 5))}`.trim();

/**
 * A memory context as recallText builds it: the overview, the ranked details (Read Me's pick last), the recent canon
 * around the previous chapter (older summaries optional), and the decisions.
 */
function memoryOf({
  details = [] as Array<{ title: string; content: string; kind?: string }>,
  recent = [] as string[],
  optional = [] as string[],
  previous = "",
}) {
  return forgeMemoryContext(
    {
      overview: sized("OVERVIEW-MARK", 400),
      details: details.map(({ kind = "chapter", ...detail }) => ({ kind, ...detail })),
    },
    {
      prefix: [...recent, `# Previous chapter in full: Night 9\n${previous}`].join("\n\n"),
      optional,
      fate: `${"# Irrevocable player decisions"}\n- FATE-MARK: she kept his secret.`,
      renderMemory: (memory) => forgeStoryMemoryText(memory).trim(),
    },
  );
}

const withMemory = (memory: ReturnType<typeof memoryOf>) =>
  request({
    messages: [
      { role: "system", content: "Reply with {premise}." },
      { role: "user", content: `STORY MEMORY\n${memory.text}\n\nA premise, please.` },
    ],
    memory,
  });

test("a prompt that fits is sent as it is, with the whole reply budget; a long previous chapter goes in whole", async () => {
  const small = await setup(['{"premise":"x"}']);
  const memory = memoryOf({ details: [{ title: "A", content: sized("DETAIL-A", 500) }], previous: "PREVIOUS" });
  const sent = withMemory(memory);
  await generateJson(small.deps, sent);
  assert.deepEqual(small.calls[0]!.messages, sent.messages, "byte for byte");
  assert.equal(small.calls[0]!.options?.maxTokens, 4096, "the reply budget, the connection's own cap");
  // 15k tokens of previous chapter on a 128k model: no fixed cap cuts it any more.
  const wide = await setup(['{"premise":"x"}'], { maxOutputTokens: null, maxContext: 131_072 });
  const long = memoryOf({ previous: sized("PREVIOUS-START", 15_000) + " PREVIOUS-END" });
  await generateJson(wide.deps, withMemory(long));
  const user = wide.calls[0]!.messages.at(-1)!.content;
  assert.ok(user.includes(long.text), "the previous chapter in full");
  assert.equal(wide.calls[0]!.options?.maxTokens, OUTPUT_FLOOR + REASONING_HEADROOM);
});

test("on overflow the recalled details give way first, the lowest-ranked first, and the rest stays", async () => {
  // 32768 tokens, a 4096-token reply and the Engine's margin leave about 27950 for the prompt: 30500 asks two to go.
  const t = await setup(['{"premise":"x"}']);
  const memory = memoryOf({
    details: [
      { title: "A", content: sized("DETAIL-A", 2000) },
      { title: "B", content: sized("DETAIL-B", 2000) },
      { title: "Read Me", content: sized("READ-ME-C", 2000), kind: "chat" },
    ],
    previous: sized("PREVIOUS-MARK", 24_000),
  });
  await generateJson(t.deps, withMemory(memory));
  const user = t.calls[0]!.messages.at(-1)!.content;
  for (const kept of ["OVERVIEW-MARK", "DETAIL-A", "PREVIOUS-MARK", "FATE-MARK", "A premise, please."]) {
    assert.ok(user.includes(kept), `${kept} stays`);
  }
  assert.ok(!user.includes("READ-ME-C") && !user.includes("DETAIL-B"), "the Read Me pick, then the lowest-ranked");
  assert.equal(t.calls[0]!.options?.maxTokens, 4096, "with the whole reply budget");
  assert.ok(!Object.getOwnPropertySymbols(t.calls[0]!.messages[0]!).length, "the provider gets plain messages");
});

test("at the reply floor the oldest uncovered summary gives way, never the newest or the previous chapter", async () => {
  const t = await setup(['{"premise":"x"}'], { maxOutputTokens: null });
  const summaries = [1, 2, 3].map((n) => `# Recent canon summary: Night ${n + 5}\n${sized(`SUMMARY-${n}`, 3000)}`);
  const memory = memoryOf({
    recent: summaries,
    optional: summaries.slice(0, -1),
    previous: sized("PREVIOUS-MARK", 15_500),
  });
  await generateJson(t.deps, withMemory(memory));
  const user = t.calls[0]!.messages.at(-1)!.content;
  assert.ok(!user.includes("SUMMARY-1"), "the oldest summary went");
  for (const kept of ["SUMMARY-2", "SUMMARY-3", "PREVIOUS-MARK", "OVERVIEW-MARK", "FATE-MARK"]) {
    assert.ok(user.includes(kept), `${kept} stays`);
  }
  const maxTokens = t.calls[0]!.options!.maxTokens!;
  assert.ok(maxTokens >= OUTPUT_FLOOR && maxTokens < OUTPUT_FLOOR + REASONING_HEADROOM, `the floor kept: ${maxTokens}`);
});

test("a cached prompt's own canon gives way before the cached part's summaries (#2091)", async () => {
  const t = await setup(['{"premise":"x"}'], { maxOutputTokens: null });
  const older = `# Recent canon summary: Night 6\n${sized("MAIN-OLD", 3000)}`;
  const main = memoryOf({
    recent: [older, `# Recent canon summary: Night 8\n${sized("MAIN-NEW", 3000)}`],
    optional: [older],
    previous: sized("PREVIOUS-MARK", 15_500),
  });
  // The recalls' context (S/story/canon.ts `cached`): another love interest's own summaries, after the cached part.
  const own = `# Recent canon summary: Mireille's own route chapter\n${sized("OWN-OLD", 3000)}`;
  const recalls = forgeMemoryContext(
    { overview: "", details: [] },
    {
      prefix: [own, "# Recent canon summary: Mireille's next\nOWN-NEW"].join("\n\n"),
      optional: [own],
      renderMemory: (memory) => forgeStoryMemoryText(memory).trim(),
    },
  );
  await generateJson(
    t.deps,
    request({
      messages: [
        { role: "system", content: `STORY MEMORY\n${main.text}`, cacheBreakpoint: true },
        { role: "user", content: `${recalls.text}\n\nA premise, please.` },
      ],
      memory: { ...main, recalls },
    }),
  );
  const [context, task] = t.calls[0]!.messages.map((message) => message.content);
  assert.ok(!task!.includes("OWN-OLD"), "the own canon's older summary went first");
  assert.ok(task!.includes("OWN-NEW"));
  for (const kept of ["MAIN-OLD", "MAIN-NEW", "PREVIOUS-MARK"]) assert.ok(context!.includes(kept), `${kept} stays`);
});

test("a prompt whose required story cannot fit is a 413 `capacity` and is never sent", async () => {
  const t = await setup(['{"premise":"x"}']);
  const memory = memoryOf({ previous: sized("PREVIOUS-MARK", 30_000) });
  await assert.rejects(generateJson(t.deps, withMemory(memory)), failsWith(413, "capacity"));
  // Without any memory to give way the same holds: the Engine would cut the rules or the reply, so nothing goes.
  await assert.rejects(
    generateJson(t.deps, request({ messages: [{ role: "user", content: sized("HUGE", 30_000) }] })),
    failsWith(413, "capacity"),
  );
  // And a prompt the Engine's own fit would still trim is never sent either.
  const trimmed = await setup(['{"premise":"x"}']);
  const models = trimmed.runtime.languageModels as {
    resolveForRequest: typeof trimmed.runtime.languageModels.resolveForRequest;
  };
  const resolve = models.resolveForRequest.bind(models);
  models.resolveForRequest = async (value) => ({
    ...(await resolve(value)),
    fitContext: (messages, options) => ({
      messages,
      maxTokens: options?.maxTokens,
      estimatedTokensBefore: 2,
      estimatedTokensAfter: 1,
      trimmed: true,
    }),
  });
  await assert.rejects(generateJson(trimmed.deps, request()), failsWith(413, "capacity"));
  assert.equal(t.calls.length + trimmed.calls.length, 0, "no request was sent");
});

test("a repair turn that cannot fit reports the malformed reply, not `capacity`", async () => {
  // The first call fits; its long, malformed reply makes the repair turn too big for the window.
  const t = await setup([sized("NOT-JSON", 30_000)]);
  await assert.rejects(generateJson(t.deps, request()), failsWith(502, "bad-format"));
  assert.equal(t.calls.length, 1, "the repair turn that cannot fit is never sent");
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

test("a foreground job (the memory's Retry) goes ahead of the background jobs waiting on its connection", async () => {
  // Memory shares the queue with line packs, stickers, plush and the phone's daily: a Retry that joined the tail waited
  // for every one of them that admission let through, its banner already gone.
  const host = createFakeRuntime();
  const modes: string[] = [];
  const admission = {
    async run<T>(_connectionId: string, mode: { kind: string }, operation: () => Promise<T>): Promise<T> {
      modes.push(mode.kind);
      return operation();
    },
    isFailure: () => false,
  };
  const runtime = { logger: host.runtime.logger, integrations: { admission } } as unknown as Pick<
    CapabilityRuntimeHost,
    "integrations" | "logger"
  >;
  const queue = createBackgroundQueue(runtime);
  const order: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const job = (key: string, foreground = false) => ({
    key,
    connectionId: "conn-bg",
    foreground,
    run: async () => void order.push(key),
  });
  queue.ensure({ key: "running", connectionId: "conn-bg", run: async () => (order.push("running"), held) });
  for (const key of ["lines", "sticker", "memory"]) queue.ensure(job(key));
  await settle();
  assert.deepEqual(order, ["running"]);
  assert.deepEqual(
    ["running", "lines", "memory"].map((key) => queue.waiting(key)),
    [false, true, true],
    "a job admitted is not waiting; ones in the lane are",
  );

  // A Retry: a new foreground job goes ahead of the waiting ones; one already waiting, asked for, moves ahead too.
  assert.equal(queue.ensure(job("retry", true)), true);
  assert.equal(queue.ensure(job("memory", true)), false, "already queued");
  assert.deepEqual(
    ["retry", "memory"].map((key) => queue.waiting(key)),
    [false, false],
  );
  release();
  await settle();
  assert.deepEqual(order, ["running", "retry", "memory", "lines", "sticker"], "the running job finishes first");
  assert.deepEqual(modes, ["background", "foreground", "foreground", "background", "background"]);
  queue.dispose();
});
