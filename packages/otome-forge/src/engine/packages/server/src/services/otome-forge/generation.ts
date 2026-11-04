// ──────────────────────────────────────────────
// Otome Forge: the generation core. Every model call that expects JSON goes through generateJson.
// ──────────────────────────────────────────────
// 1. Connection: the request's own, else world.connections[job], else world.connections.narration; none is a 503.
// 2. Model: runtime.languageModels.resolveForRequest({connectionId}).
// 3. Fit, as GF's fitForgeMemoryPrompt does (the kit's own fitter): the request's maxTokens is what the reply itself
//    needs, and every call asks for GF's floor and reasoning headroom on top (outputBudget). A prompt that fits with
//    all of it is sent unchanged. Otherwise the story memory it carries (`memory`, recallText's context) gives way: its
//    recalls first, oldest first; then, only while the reply would get less than OUTPUT_FLOOR, its older uncovered
//    summaries, then the chapters it carries in full for want of a summary, each oldest first, and then the previous
//    chapter's earliest scenes. The timeline, the previous chapter's last scene and the newest summary always stay,
//    and nothing outside the memory is ever cut. A cached prompt's own canon
//    (S/story/canon.ts `cached`) is a context of its own, beside the recalls, and its summaries give way before the
//    cached part's, each part keeping its newest (#2091). A message's `cacheBreakpoint` (#2066) is sent as it is. A
//    prompt that still leaves the reply less than the floor (or the connection's own smaller cap) is a 413 `capacity`
//    before anything is sent, never a request the Engine would cut: its fitter would shrink the reply to 128 tokens,
//    then cut the rules. The margin kept is the Engine's (fitSafety) with some to spare, and model.fitContext checks the
//    result: any trim there is `capacity` too.
// 4. Log: logOtomePrompt (debugOverride in debug mode, `redact` strings replaced). In debug mode the reply's prompt
//    cache use is logged too, when the provider reports it.
// 5. Call: chatComplete with the reply's output size alone (the maintainer's rule): no temperature, no JSON mode, no
//    other sampling or reasoning setting, so what the connection saves (its temperature, its reasoning effort) is what
//    the Engine sends, and nothing of Otome's stands in for what it leaves unset. A prompt with cache marks also asks
//    for the hour-long cache (cacheTtl "1h", capability API 1.815; an older Engine ignores it and keeps the
//    connection's own cache time), so a chapter's plan, scenes and climax, minutes apart, read what the first wrote. A
//    background call holds its job's connection admission slot throughout; it names that connection and never takes a
//    second slot here.
// 6. Parse: parseJsonish, then the schema, then `normalize`. On failure exactly one repair turn (fitted the same way);
//    if that fails too, two declines are a 422 `declined` and anything else a 502 `bad-format`. A decline is an empty
//    reply, a content filter, or refusal wording in a reply that is not a JSON object (inside one it is a character's
//    own words). A reply cut off at the token limit is never parsed and never a decline. Text is never retried in any
//    other way.
//
// The foreground lane is serial per run: runForeground queues a task behind the run's earlier ones, and readOrGenerate
// re-reads the stored result inside the queue, so a request that lands behind the lookahead returns what it wrote
// instead of writing it twice. generateJson itself never queues: queue the task that calls it, or it would wait on
// itself.
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import {
  fitForgeMemoryPrompt,
  forgeComposeMemoryPrompt,
  type ForgeMemoryContext,
} from "@forge-kit/story-memory-fit.mjs";
import type { CapabilityResolvedLanguageModel, CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { ZodType } from "zod";
import type {
  GenerationJob,
  OtomeErrorCode,
  World,
} from "../../../../client/src/features/otome-forge/shared/api-types.js";
import { OtomeForgeError } from "./http.js";
import { worldId } from "./ids.js";
import { logOtomePrompt, type PromptMessage } from "./prompt-log.js";
import { normalizeWorld } from "./schemas/world.js";
import type { OtomeStore } from "./store.js";

export type OtomeMessage = PromptMessage;
export type GenerationLane = "foreground" | "background";
/** The codes generateJson fails with: 503 `no-connection`, 413 `capacity`, 422 `declined`, 502 `bad-format`. */
export type GenerationFailureCode = Extract<OtomeErrorCode, "no-connection" | "capacity" | "declined" | "bad-format">;

export interface GenerationDeps {
  runtime: Pick<CapabilityRuntimeHost, "languageModels" | "json" | "logger" | "isDebugAgentsEnabled">;
  store: Pick<OtomeStore, "readDoc">;
}

export interface GenerateJsonRequest<T extends object> {
  /** The run R whose world names the connection; null before a world exists (premise suggestions). */
  runId: string | null;
  job: GenerationJob;
  /** Names the prompt in the logs: `[debug/otome-forge/<label>]`. */
  label: string;
  messages: OtomeMessage[];
  /**
   * The story memory the messages carry (recallText's context, its `text` inserted as it is, and when `cached` its
   * recalls' text too): what the fit may leave out when the prompt does not fit (see the header). Without it nothing in
   * the prompt gives way.
   */
  memory?: ForgeMemoryContext & { recalls?: ForgeMemoryContext };
  schema: ZodType<T>;
  /**
   * What the schema cannot check (an adult age, no school role…): return the value, possibly fixed, or a string naming
   * the problem, or null. A string or null sends the one repair turn.
   */
  normalize?: (value: T) => T | string | null;
  /** What the reply itself needs; the call asks for outputBudget(maxTokens) so reasoning models have room to think. */
  maxTokens: number;
  debugMode: boolean;
  /**
   * foreground: the player is waiting (run the task through runForeground or readOrGenerate). background: inside a
   * background-queue job, which must pass `connectionId`, the connection its admission slot is held on.
   */
  lane: GenerationLane;
  /** Replaced by `[cycle state redacted]` in the logged prompt; the provider still receives them. */
  redact?: string[];
  /**
   * Asked before every provider call, the repair turn's included: false stops the request there with a 503, before
   * anything is logged or sent (P27 passes careLineAllowed, so a debug switch turned on mid-call holds the line back).
   */
  mayCall?: () => boolean;
  /** A connection id that wins over the world's (premise suggestions and background jobs name theirs directly). */
  connectionId?: string;
  signal?: AbortSignal;
}

export interface GenerateJsonResult<T> {
  value: T;
  connectionId: string;
  model: string;
}

/** The connection a job uses: its own, else narration's; null when the world names none. */
export function resolveConnectionId(world: Pick<World, "connections"> | null, job: GenerationJob): string | null {
  return world?.connections[job] || world?.connections.narration || null;
}

const REFUSAL =
  /\b(?:I(?:'|’)?m (?:not able|unable)|I (?:can(?:no|'|’)?t|cannot|won(?:'|’)t|am unable|am not able)|I must decline)\b[^.]{0,120}\b(?:write|continue|help|assist|comply|create|provide|produce|generate|engage)\b|\bagainst (?:my|the) (?:guidelines|content policy|usage polic(?:y|ies))\b/i;

/** Finish reasons that mean the reply stopped at its token limit (the Engine maps most providers to "length"). */
const CUT_OFF = new Set(["length", "max_tokens", "max_output_tokens"]);

/** GF's text budget (server.mjs `It`): at least this many output tokens for every text generation… */
export const OUTPUT_FLOOR = 8192;
/** …plus this much headroom, because a model that reasons by default spends its thinking inside maxTokens. */
export const REASONING_HEADROOM = 16_000;

// ponytail: a fixed headroom; a connection that caps output below the floor gets its cap (and a reply cut off there
// fails as bad-format). The upgrade path is GF's per-connection `learnedHeadroom`.
/**
 * The maxTokens every call sends: the reply's own need raised to the floor, plus the reasoning headroom, within the
 * connection's own output cap. The Engine adds thinking headroom only when the connection saved a reasoning effort.
 */
export function outputBudget(maxTokens: number, connectionCap: number | null): number {
  const budget = Math.max(OUTPUT_FLOOR, maxTokens) + REASONING_HEADROOM;
  return connectionCap && connectionCap > 0 ? Math.min(budget, connectionCap) : budget;
}

/** The Engine's per-message overhead (base-provider.ts MESSAGE_OVERHEAD_TOKENS), counted with the kit's estimator. */
const MESSAGE_TOKENS = 6;

const estimateMessages = (messages: readonly OtomeMessage[]) =>
  messages.reduce((sum, message) => sum + estimateTextTokens(message.content) + MESSAGE_TOKENS, 0);

/**
 * The prompt room kept free besides the reply: the Engine's own margin (base-provider.ts: max(500, 2% of the context))
 * with some room to spare, so the Engine's fitter never trims what this one fitted.
 */
export const fitSafety = (maxContext: number) => Math.max(512, Math.ceil(maxContext * 0.02)) + 64;

/** What a context of `maxContext` leaves the reply after these messages and fitSafety. */
export const promptRoom = (maxContext: number, messages: readonly OtomeMessage[]) =>
  maxContext - fitSafety(maxContext) - estimateMessages(messages);

type Attempt<T> = { ok: true; value: T } | { ok: false; declined: boolean; issues: string; content: string };

function check<T extends object>(
  request: GenerateJsonRequest<T>,
  parseJsonish: (raw: string) => unknown,
  content: string,
  finishReason: string,
): Attempt<T> {
  // Cut off: never parsed (the tolerant parser would close the JSON and keep half a field), never a decline, and not
  // shown back to the model in the repair turn.
  if (CUT_OFF.has(finishReason)) {
    return { ok: false, declined: false, issues: "the reply was cut off at the token limit", content: "" };
  }
  const text = content.trim();
  const filtered = finishReason === "content_filter";
  const fail = (issues: string, declined = filtered): Attempt<T> => ({ ok: false, declined, issues, content: text });
  if (!text) return fail("the reply was empty", true);
  let raw: unknown;
  try {
    raw = parseJsonish(text);
  } catch {
    raw = undefined;
  }
  // Refusal wording counts only outside a JSON object: inside one it is the character's own voice ("I can't let anyone
  // help me"), and a reply that parsed but fails its checks is a format problem.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("the reply was not one JSON object", filtered || REFUSAL.test(text.slice(0, 600)));
  }
  const parsed = request.schema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    );
  }
  const normalized = request.normalize ? request.normalize(parsed.data) : parsed.data;
  if (normalized === null) return fail("the reply did not pass the content checks");
  if (typeof normalized === "string") return fail(normalized);
  return { ok: true, value: normalized };
}

async function resolveModel(deps: GenerationDeps, connectionId: string): Promise<CapabilityResolvedLanguageModel> {
  try {
    return await deps.runtime.languageModels.resolveForRequest({ connectionId });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new OtomeForgeError(503, `Otome Forge could not use connection ${connectionId}: ${reason}`, "no-connection");
  }
}

/**
 * The prompt as it is sent and the reply's maxTokens (step 3 of the header): `budget`, or less when the context leaves
 * less, never below the floor. A context nobody knows sends the prompt as it is, as the Engine would.
 */
function fitPrompt(
  model: CapabilityResolvedLanguageModel,
  prompt: OtomeMessage[],
  budget: number,
  label: string,
  memoryContext: number | null | undefined,
): { messages: OtomeMessage[]; maxTokens: number } {
  const known = [model.maxContext, memoryContext].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  const maxContext = known.length ? Math.floor(Math.min(...known)) : null;
  const floor = Math.min(OUTPUT_FLOOR, budget);
  const capacity = (why: string) =>
    new OtomeForgeError(
      413,
      `${label} does not fit the context window of ${model.model} (${maxContext ?? "unknown"} tokens): ${why}.`,
      "capacity",
    );
  const fit = fitForgeMemoryPrompt(prompt, {
    maxContext,
    maxTokens: budget,
    estimateMessages,
    safetyTokens: fitSafety(maxContext ?? 0),
    minOutputTokens: OUTPUT_FLOOR,
  });
  if (!fit.fits && fit.reason !== "context-unknown") throw capacity(fit.reason ?? "it does not fit");
  // Plain messages: the memory context stays here, out of the logs and the provider call. A cache mark goes along.
  const messages = fit.messages.map(({ role, content, cacheBreakpoint }) =>
    cacheBreakpoint ? { role, content, cacheBreakpoint } : { role, content },
  );
  if (maxContext === null) return { messages, maxTokens: budget };
  const maxTokens = Math.min(fit.maxTokens ?? budget, promptRoom(maxContext, messages));
  if (maxTokens < floor) throw capacity(`it leaves ${Math.max(0, maxTokens)} tokens for a reply that needs ${floor}`);
  // The Engine fits every request again; one that would trim it, or cut the reply below the floor, is never sent.
  const checked = model.fitContext(messages, { maxTokens });
  if (checked.trimmed || (checked.maxTokens ?? maxTokens) < floor) {
    throw capacity("the Engine would have to trim it");
  }
  return { messages, maxTokens: checked.maxTokens ?? maxTokens };
}

/** Debug mode only: how much of the prompt the provider read from or wrote to its cache, when it says (#2066). */
function logCacheUse(
  runtime: GenerationDeps["runtime"],
  label: string,
  debugMode: boolean,
  usage: { promptTokens?: number; cachedPromptTokens?: number; cacheWritePromptTokens?: number } | undefined,
) {
  const debug = debugMode || runtime.isDebugAgentsEnabled();
  if (!usage || (usage.cachedPromptTokens === undefined && usage.cacheWritePromptTokens === undefined)) return;
  if (!debug && runtime.logger.isLevelEnabled?.("debug") === false) return;
  runtime.logger.debugOverride(
    debug,
    "[debug/otome-forge/%s] Prompt cache: %d tokens read, %d written (the provider counts %d prompt tokens).",
    label,
    usage.cachedPromptTokens ?? 0,
    usage.cacheWritePromptTokens ?? 0,
    usage.promptTokens ?? 0,
  );
}

/** One JSON reply from the job's connection, validated; see the file header for every step. */
export async function generateJson<T extends object>(
  deps: GenerationDeps,
  request: GenerateJsonRequest<T>,
): Promise<GenerateJsonResult<T>> {
  if (request.lane === "background" && !request.connectionId) {
    throw new RangeError(`Background generation ${request.label} must name its job's connection`);
  }
  const world =
    request.connectionId || !request.runId ? null : await deps.store.readDoc(worldId(request.runId), normalizeWorld);
  const connectionId = request.connectionId || resolveConnectionId(world, request.job);
  if (!connectionId) {
    throw new OtomeForgeError(503, `No connection is set for the ${request.job} job.`, "no-connection");
  }
  const model = await resolveModel(deps, connectionId);
  const { runtime } = deps;

  const budget = outputBudget(request.maxTokens, model.maxOutputTokens);
  // The memory context rides on the first message, so the repair turn (the same messages and two more) carries it too.
  // The recalls' context goes first: the fitter leaves out the first context's optional blocks first, so what follows
  // the cached part (a cached prompt's own canon, S/story/canon.ts) gives way before the cached part does (#2091).
  const messages = request.memory
    ? forgeComposeMemoryPrompt(() => request.messages, [request.memory.recalls, request.memory].filter(Boolean))
    : request.messages;
  const mayCall = () => {
    request.signal?.throwIfAborted();
    if (request.mayCall && !request.mayCall()) {
      throw new OtomeForgeError(503, `${request.label} was held back before it was sent.`);
    }
  };
  const complete = async (prompt: OtomeMessage[], label: string) => {
    mayCall();
    const fitted = fitPrompt(model, prompt, budget, label, request.memory?.maxContext);
    const sent = fitted.messages;
    logOtomePrompt(runtime, label, sent, { debugMode: request.debugMode, redact: request.redact });
    // The output size alone (see the header); debugMode and signal are the Engine's own, never sent on. A prompt with
    // cache marks asks for the hour-long cache (capability API 1.815): a chapter's calls come minutes apart.
    const options = {
      maxTokens: fitted.maxTokens,
      debugMode: request.debugMode,
      signal: request.signal,
      ...(sent.some((message) => message.cacheBreakpoint) ? { cacheTtl: "1h" as const } : {}),
    };
    const reply = await model.chatComplete(sent, options);
    logCacheUse(runtime, label, request.debugMode, reply.usage);
    return check(request, runtime.json.parseJsonish, reply.content ?? "", reply.finishReason);
  };

  const first = await complete(messages, request.label);
  if (first.ok) return { value: first.value, connectionId, model: model.model };

  const note = `That reply did not match the required format: ${first.issues}. Reply again with ONLY the JSON object.`;
  const repair: OtomeMessage[] = first.content
    ? [...messages, { role: "assistant", content: first.content }, { role: "user", content: note }]
    : [...messages, { role: "user", content: note }];
  // A repair turn that cannot fit (the prompt plus that long, malformed reply) reports what went wrong, the reply,
  // rather than a `capacity` the first call already passed.
  const second = await complete(repair, `${request.label}/repair`).catch((error: unknown) => {
    if (error instanceof OtomeForgeError && error.code === "capacity") return null;
    throw error;
  });
  if (second?.ok) return { value: second.value, connectionId, model: model.model };

  if (first.declined && (!second || second.declined)) {
    throw new OtomeForgeError(422, `The model declined ${request.label}.`, "declined");
  }
  throw new OtomeForgeError(
    502,
    `The model's reply for ${request.label} did not match: ${second?.issues ?? first.issues}`,
    "bad-format",
  );
}

// ── Foreground lane: one serial queue per run ──

const queues = new Map<string, Promise<unknown>>();

/** Runs `task` after every earlier foreground task of the run has settled. */
export function runForeground<T>(runId: string, task: () => Promise<T>): Promise<T> {
  const result = (queues.get(runId) ?? Promise.resolve()).then(task);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  queues.set(runId, tail);
  void tail.then(() => {
    if (queues.get(runId) === tail) queues.delete(runId);
  });
  return result;
}

/**
 * GF's readOrGenerate: the stored result when there is one, otherwise `generate` in the run's queue, which first reads
 * again so a task queued behind the one that wrote it never writes it twice. `generate` should save what it returns.
 */
export async function readOrGenerate<T>(
  runId: string,
  read: () => Promise<T | null>,
  generate: () => Promise<T>,
): Promise<T> {
  const stored = await read();
  if (stored !== null) return stored;
  return runForeground(runId, async () => (await read()) ?? (await generate()));
}
