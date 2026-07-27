import { randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import {
  ltmDebugEventSchema,
  type LtmDebugEvent,
  type LtmDebugPhase,
  type LtmDebugStatus,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { isEnoent } from "./ltm-utils.js";
import {
  getLongTermMemoryDirectories,
  getLongTermMemoryRoot,
} from "./paths.js";
import { logger } from "./package-runtime.js";
import { withLtmVaultLock } from "./vault-lock.js";

export type LtmDebugEventInput = Omit<
  LtmDebugEvent,
  "id" | "ts" | "operationId" | "error"
> & {
  operationId?: string;
  error?: unknown;
  root?: string;
};

export const LTM_DEBUG_MAX_EVENT_BYTES = 64 * 1024;
export const LTM_DEBUG_MAX_LOG_BYTES = 2 * 1024 * 1024;
const MAX_NESTED_STRING_LENGTH = 2_000;
const MAX_ARRAY_ITEMS = 80;
const MAX_OBJECT_KEYS = 80;
const MAX_OBJECT_DEPTH = 5;
const writes = new Map<string, Promise<void>>();

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function boundUnknown(value: unknown, depth = 0): unknown {
  if (typeof value === "string")
    return truncate(value, MAX_NESTED_STRING_LENGTH);
  if (value == null || typeof value === "boolean") return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : String(value);
  if (
    typeof value === "bigint" ||
    typeof value === "symbol" ||
    typeof value === "function"
  )
    return truncate(String(value), MAX_NESTED_STRING_LENGTH);
  if (depth >= MAX_OBJECT_DEPTH) return "[truncated]";
  if (Array.isArray(value))
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => boundUnknown(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, item]) => [
          truncate(key, 240),
          boundUnknown(item, depth + 1),
        ]),
    );
  return truncate(String(value), MAX_NESTED_STRING_LENGTH);
}

function serialize(error: unknown) {
  if (!(error instanceof Error))
    return { message: truncate(String(error), 2_000) };
  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  return {
    name: truncate(error.name, 120),
    message: truncate(error.message, 2_000),
    stack: error.stack ? truncate(error.stack, 6_000) : undefined,
    code: code ? truncate(code, 120) : undefined,
  };
}

function boundedFields(
  fields: Omit<LtmDebugEventInput, "root" | "operationId" | "error">,
) {
  return {
    ...fields,
    action: truncate(fields.action, 120),
    message:
      fields.message === undefined
        ? undefined
        : truncate(fields.message, 2_000),
    source:
      fields.source === undefined ? undefined : truncate(fields.source, 120),
    sourceId:
      fields.sourceId === undefined
        ? undefined
        : truncate(fields.sourceId, 240),
    mutationIds: fields.mutationIds?.slice(0, 100),
    counts: fields.counts
      ? Object.fromEntries(
          Object.entries(fields.counts)
            .slice(0, MAX_OBJECT_KEYS)
            .map(([key, value]) => [truncate(key, 240), value]),
        )
      : undefined,
    diagnostics: fields.diagnostics
      ?.slice(0, MAX_ARRAY_ITEMS)
      .map((item) => boundUnknown(item) as Record<string, unknown>),
    provider:
      fields.provider === undefined
        ? undefined
        : truncate(fields.provider, 120),
    model: fields.model === undefined ? undefined : truncate(fields.model, 240),
    details: fields.details
      ? (boundUnknown(fields.details) as Record<string, unknown>)
      : undefined,
    chatId:
      fields.chatId === undefined ? undefined : truncate(fields.chatId, 200),
    uiSummary:
      fields.uiSummary === undefined
        ? undefined
        : truncate(fields.uiSummary, 4_000),
  };
}

function compactEvent(event: LtmDebugEvent) {
  let bounded = event;
  let line = `${JSON.stringify(bounded)}\n`;
  if (Buffer.byteLength(line) <= LTM_DEBUG_MAX_EVENT_BYTES) return line;
  bounded = ltmDebugEventSchema.parse({
    ...bounded,
    diagnostics: bounded.diagnostics?.length
      ? [{ truncated: true }]
      : undefined,
    details: bounded.details ? { truncated: true } : undefined,
    uiSummary: bounded.uiSummary
      ? truncate(bounded.uiSummary, 1_000)
      : undefined,
    error: bounded.error
      ? {
          ...bounded.error,
          stack: bounded.error.stack ? "[truncated]" : undefined,
        }
      : undefined,
  });
  line = `${JSON.stringify(bounded)}\n`;
  if (Buffer.byteLength(line) <= LTM_DEBUG_MAX_EVENT_BYTES) return line;
  bounded = ltmDebugEventSchema.parse({
    id: bounded.id,
    ts: bounded.ts,
    operationId: bounded.operationId,
    phase: bounded.phase,
    action: bounded.action,
    status: bounded.status,
    ...(bounded.durationMs === undefined
      ? {}
      : { durationMs: bounded.durationMs }),
    ...(bounded.error
      ? {
          error: {
            name: bounded.error.name,
            message: truncate(bounded.error.message, 1_000),
            code: bounded.error.code,
          },
        }
      : {}),
  });
  line = `${JSON.stringify(bounded)}\n`;
  return line;
}

function newestCompleteLines(content: string, byteBudget: number) {
  const lines = content.split("\n").filter(Boolean);
  const kept: string[] = [];
  let bytes = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = `${lines[index]}\n`;
    const lineBytes = Buffer.byteLength(line);
    if (bytes + lineBytes > byteBudget) break;
    kept.push(line);
    bytes += lineBytes;
  }
  return kept.reverse().join("");
}

async function appendBounded(path: string, line: string) {
  const lineBytes = Buffer.byteLength(line);
  const currentBytes = await stat(path).then(
    (info) => info.size,
    () => 0,
  );
  if (currentBytes + lineBytes <= LTM_DEBUG_MAX_LOG_BYTES) {
    await appendFile(path, line, "utf8");
    return;
  }
  const content = await readFile(path, "utf8").catch((error) => {
    if (isEnoent(error)) return "";
    throw error;
  });
  const replacement = `${newestCompleteLines(
    content,
    LTM_DEBUG_MAX_LOG_BYTES - lineBytes,
  )}${line}`;
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, replacement, "utf8");
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function queueWrite(path: string, operation: () => Promise<void>) {
  const previous = writes.get(path) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  writes.set(path, next);
  try {
    await next;
  } finally {
    if (writes.get(path) === next) writes.delete(path);
  }
}

function queueAppend(path: string, line: string) {
  return queueWrite(path, () => appendBounded(path, line));
}

export async function recordLtmDebugEvent(
  input: LtmDebugEventInput,
): Promise<LtmDebugEvent | null> {
  try {
    const {
      root = getLongTermMemoryRoot(),
      operationId = randomUUID(),
      error,
      ...fields
    } = input;
    const event = ltmDebugEventSchema.parse({
      id: randomUUID(),
      ts: new Date().toISOString(),
      operationId,
      ...boundedFields(fields),
      error: error ? serialize(error) : undefined,
    });
    const path = getLongTermMemoryDirectories(root).debugLog;
    await mkdir(dirname(path), { recursive: true });
    const line = compactEvent(event);
    await withLtmVaultLock(root, () => queueAppend(path, line));
    return ltmDebugEventSchema.parse(JSON.parse(line));
  } catch (error) {
    logger.warn(error, "[ltm] Failed to record debug event");
    return null;
  }
}
export async function withLtmDebugOperation<T>(
  base: Omit<LtmDebugEventInput, "status" | "durationMs">,
  operation: (operationId: string) => Promise<T>,
) {
  const operationId = base.operationId ?? randomUUID();
  const started = Date.now();
  await recordLtmDebugEvent({ ...base, operationId, status: "started" });
  try {
    const result = await operation(operationId);
    await recordLtmDebugEvent({
      ...base,
      operationId,
      status: "ok",
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    await recordLtmDebugEvent({
      ...base,
      operationId,
      status: "error",
      durationMs: Date.now() - started,
      error,
    });
    throw error;
  }
}
export async function readLtmDebugLog(
  filter: {
    limit?: number;
    operationId?: string;
    sourceNoteId?: string;
    draftId?: string;
    status?: LtmDebugStatus;
    phase?: LtmDebugPhase;
  } = {},
  root = getLongTermMemoryRoot(),
) {
  const content = await readFile(
    getLongTermMemoryDirectories(root).debugLog,
    "utf8",
  ).catch((e) => {
    if (isEnoent(e)) return "";
    throw e;
  });
  const events = content
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = ltmDebugEventSchema.safeParse(JSON.parse(line));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    })
    .filter(
      (event) =>
        !filter.operationId || event.operationId === filter.operationId,
    )
    .filter(
      (event) =>
        !filter.sourceNoteId || event.sourceNoteId === filter.sourceNoteId,
    )
    .filter((event) => !filter.draftId || event.draftId === filter.draftId)
    .filter((event) => !filter.status || event.status === filter.status)
    .filter((event) => !filter.phase || event.phase === filter.phase);
  return typeof filter.limit === "number"
    ? events.slice(-filter.limit)
    : events;
}
export async function exportLtmDebugLog(root = getLongTermMemoryRoot()) {
  return readFile(getLongTermMemoryDirectories(root).debugLog, "utf8").catch(
    (e) => {
      if (isEnoent(e)) return "";
      throw e;
    },
  );
}
export async function clearLtmDebugLog(root = getLongTermMemoryRoot()) {
  const path = getLongTermMemoryDirectories(root).debugLog;
  await mkdir(dirname(path), { recursive: true });
  await withLtmVaultLock(root, () => queueWrite(path, () => writeFile(path, "", "utf8")));
  return { cleared: true };
}
