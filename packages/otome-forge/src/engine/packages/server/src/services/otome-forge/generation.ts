// ──────────────────────────────────────────────
// Otome Forge: the generation core. Every model call that expects JSON goes through generateJson.
// ──────────────────────────────────────────────
// 1. Connection: the request's own, else world.connections[job], else world.connections.narration; none is a 503.
// 2. Model: runtime.languageModels.resolveForRequest({connectionId}).
// 3. Fit: model.fitContext(messages, {maxTokens: outputBudget(...)}): the request's maxTokens is what the reply itself
//    needs; every call asks for GF's floor and reasoning headroom on top (outputBudget).
// 4. Log: logOtomePrompt (debugOverride in debug mode, `redact` strings replaced).
// 5. Call: chatComplete with responseFormat json_object (a hint only; Anthropic and Google ignore it), directly on
//    both lanes. A background call runs inside a background-queue job, which holds the connection's admission slot
//    for the whole job (both attempts), so it names that job's connection and never takes a second slot here.
// 6. Parse: parseJsonish, then the schema, then `normalize`. On failure exactly one repair turn; if that fails too, two
//    declines are a 422 `declined` and anything else a 502 `bad-format`. A decline is an empty reply, a content
//    filter, or refusal wording in a reply that is not a JSON object (inside one it is a character's own words). A
//    reply cut off at the token limit is never parsed and never a decline. Text is never retried in any other way.
//
// The foreground lane is serial per run: runForeground queues a task behind the run's earlier ones, and readOrGenerate
// re-reads the stored result inside the queue, so a request that lands behind the lookahead returns what it wrote
// instead of writing it twice. generateJson itself never queues: queue the task that calls it, or it would wait on
// itself.
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
/** The codes generateJson fails with: 503 `no-connection`, 422 `declined`, 502 `bad-format`. */
export type GenerationFailureCode = Extract<OtomeErrorCode, "no-connection" | "declined" | "bad-format">;

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
  schema: ZodType<T>;
  /**
   * What the schema cannot check (an adult age, no school role…): return the value, possibly fixed, or a string naming
   * the problem, or null. A string or null sends the one repair turn.
   */
  normalize?: (value: T) => T | string | null;
  temperature: number;
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

// ponytail: a fixed headroom, and no capacity error when a connection caps output below the floor (the Engine caps
// it, and a reply cut off there fails as bad-format); the upgrade path is GF's per-connection `learnedHeadroom` and
// its `generation-output-capacity` error.
/**
 * The maxTokens every call sends: the reply's own need raised to the floor, plus the reasoning headroom, within the
 * connection's own output cap. The Engine adds thinking headroom only when the connection saved a reasoning effort.
 */
export function outputBudget(maxTokens: number, connectionCap: number | null): number {
  const budget = Math.max(OUTPUT_FLOOR, maxTokens) + REASONING_HEADROOM;
  return connectionCap && connectionCap > 0 ? Math.min(budget, connectionCap) : budget;
}

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
  const complete = async (messages: OtomeMessage[], label: string) => {
    if (request.mayCall && !request.mayCall()) {
      throw new OtomeForgeError(503, `${request.label} was held back before it was sent.`);
    }
    const fitted = model.fitContext(messages, { maxTokens: budget });
    const sent = fitted.messages as OtomeMessage[];
    logOtomePrompt(runtime, label, sent, { debugMode: request.debugMode, redact: request.redact });
    const reply = await model.chatComplete(sent, {
      temperature: request.temperature,
      maxTokens: fitted.maxTokens ?? budget,
      debugMode: request.debugMode,
      signal: request.signal,
      responseFormat: { type: "json_object" },
    });
    return check(request, runtime.json.parseJsonish, reply.content ?? "", reply.finishReason);
  };

  const first = await complete(request.messages, request.label);
  if (first.ok) return { value: first.value, connectionId, model: model.model };

  const note = `That reply did not match the required format: ${first.issues}. Reply again with ONLY the JSON object.`;
  const repair: OtomeMessage[] = first.content
    ? [...request.messages, { role: "assistant", content: first.content }, { role: "user", content: note }]
    : [...request.messages, { role: "user", content: note }];
  const second = await complete(repair, `${request.label}/repair`);
  if (second.ok) return { value: second.value, connectionId, model: model.model };

  if (first.declined && second.declined) {
    throw new OtomeForgeError(422, `The model declined ${request.label}.`, "declined");
  }
  throw new OtomeForgeError(
    502,
    `The model's reply for ${request.label} did not match: ${second.issues}`,
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
