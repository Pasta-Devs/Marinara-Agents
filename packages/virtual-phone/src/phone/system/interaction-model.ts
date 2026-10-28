export type PrincipalRef =
  | { kind: "persona" | "character"; id: string; name: string }
  | { kind: "user" | "system"; id: string };

export interface PhoneActors {
  actor: PrincipalRef;
  operator?: PrincipalRef;
  owner: PrincipalRef;
  holder?: PrincipalRef;
}

export type CanonLevel = "local" | "claim" | "canonical";
export type Audience =
  | { kind: "private" | "participants"; principalIds: string[] }
  | { kind: "network"; scope: string }
  | { kind: "public" };

export type PhoneEventSource = {
  kind: "user-ui" | "character-command" | "background" | "model-result" | "migration";
  messageId?: string;
  swipeIndex?: number;
  branchChatId?: string;
};

export interface PhoneEvent<T = unknown> {
  id: string;
  chatId: string;
  phoneId: string;
  appId: string;
  verb: string;
  actors: PhoneActors;
  audience: Audience;
  physicalObserverIds: string[];
  canon: CanonLevel;
  data: T;
  source: PhoneEventSource;
  occurredAt: string;
  recordedAt: string;
  effectiveAt?: string;
  processId?: string;
  idempotencyKey: string;
}

export interface KnowledgeClaim {
  id: string;
  chatId: string;
  knower: PrincipalRef;
  proposition: string;
  sourceEventId: string;
  sourceRecordId?: string;
  provenance: "observed" | "read" | "heard" | "sensor" | "web-claim" | "reported";
  confidence: "uncertain" | "claimed" | "reliable";
  privacy: Audience;
  acquiredAt: string;
  supersedes?: string;
}

export interface PhoneProcess<TState extends string = string> {
  id: string;
  chatId: string;
  phoneId: string;
  appId: string;
  kind: string;
  state: TState;
  previousState?: TState;
  participants: PrincipalRef[];
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  sourceEventId: string;
}

export interface PhoneInteractionLedger {
  events: PhoneEvent[];
  knowledge: KnowledgeClaim[];
  processes: PhoneProcess[];
}

export const PHONE_INTERACTION_LIMITS = Object.freeze({
  events: 1_000,
  knowledge: 2_000,
  processes: 500,
  id: 128,
  name: 120,
  verb: 96,
  proposition: 1_200,
  audiencePrincipals: 100,
  observers: 100,
  participants: 100,
  dataDepth: 6,
  dataKeys: 64,
  dataArray: 100,
  dataString: 2_000,
});

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function text(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, " ").slice(0, limit);
  return normalized || null;
}

function optionalText(value: unknown, limit: number): string | undefined {
  return text(value, limit) ?? undefined;
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): T | null {
  return typeof value === "string" && values.includes(value as T) ? value as T : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function uniqueStrings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const normalized = text(candidate, PHONE_INTERACTION_LIMITS.id);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

/** Copies JSON-like input while dropping prototypes, unsupported values, and excessive content. */
export function normalizeInteractionData(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.normalize("NFC").slice(0, PHONE_INTERACTION_LIMITS.dataString);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (depth >= PHONE_INTERACTION_LIMITS.dataDepth) return null;
  if (Array.isArray(value)) {
    return value.slice(0, PHONE_INTERACTION_LIMITS.dataArray).map((item) => normalizeInteractionData(item, depth + 1));
  }
  const input = record(value);
  if (!input) return null;
  const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  let count = 0;
  for (const [rawKey, item] of Object.entries(input)) {
    if (count >= PHONE_INTERACTION_LIMITS.dataKeys) break;
    const key = text(rawKey, PHONE_INTERACTION_LIMITS.id);
    if (!key || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    output[key] = normalizeInteractionData(item, depth + 1);
    count += 1;
  }
  return output;
}

export function normalizePrincipal(value: unknown): PrincipalRef | null {
  const input = record(value);
  if (!input) return null;
  const kind = oneOf(input.kind, ["persona", "character", "user", "system"] as const);
  const id = text(input.id, PHONE_INTERACTION_LIMITS.id);
  if (!kind || !id) return null;
  if (kind === "persona" || kind === "character") {
    const name = text(input.name, PHONE_INTERACTION_LIMITS.name);
    return name ? { kind, id, name } : null;
  }
  return { kind, id };
}

export function normalizeAudience(value: unknown): Audience | null {
  const input = record(value);
  if (!input) return null;
  const kind = oneOf(input.kind, ["private", "participants", "network", "public"] as const);
  if (kind === "public") return { kind };
  if (kind === "network") {
    const scope = text(input.scope, PHONE_INTERACTION_LIMITS.id);
    return scope ? { kind, scope } : null;
  }
  if (kind === "private" || kind === "participants") {
    const principalIds = uniqueStrings(input.principalIds, PHONE_INTERACTION_LIMITS.audiencePrincipals);
    return principalIds.length ? { kind, principalIds } : null;
  }
  return null;
}

function normalizeActors(value: unknown): PhoneActors | null {
  const input = record(value);
  if (!input) return null;
  const actor = normalizePrincipal(input.actor);
  const owner = normalizePrincipal(input.owner);
  if (!actor || !owner) return null;
  const operator = normalizePrincipal(input.operator) ?? undefined;
  const holder = normalizePrincipal(input.holder) ?? undefined;
  return { actor, owner, ...(operator ? { operator } : {}), ...(holder ? { holder } : {}) };
}

function normalizeSource(value: unknown): PhoneEventSource | null {
  const input = record(value);
  if (!input) return null;
  const kind = oneOf(input.kind, ["user-ui", "character-command", "background", "model-result", "migration"] as const);
  if (!kind) return null;
  const messageId = optionalText(input.messageId, PHONE_INTERACTION_LIMITS.id);
  const branchChatId = optionalText(input.branchChatId, PHONE_INTERACTION_LIMITS.id);
  const swipeIndex = typeof input.swipeIndex === "number" && Number.isInteger(input.swipeIndex) && input.swipeIndex >= 0
    ? Math.min(input.swipeIndex, 10_000)
    : undefined;
  return { kind, ...(messageId ? { messageId } : {}), ...(swipeIndex !== undefined ? { swipeIndex } : {}), ...(branchChatId ? { branchChatId } : {}) };
}

export function normalizePhoneEvent(value: unknown): PhoneEvent | null {
  const input = record(value);
  if (!input) return null;
  const id = text(input.id, PHONE_INTERACTION_LIMITS.id);
  const chatId = text(input.chatId, PHONE_INTERACTION_LIMITS.id);
  const phoneId = text(input.phoneId, PHONE_INTERACTION_LIMITS.id);
  const appId = text(input.appId, PHONE_INTERACTION_LIMITS.id);
  const verb = text(input.verb, PHONE_INTERACTION_LIMITS.verb);
  const actors = normalizeActors(input.actors);
  const audience = normalizeAudience(input.audience);
  const canon = oneOf(input.canon, ["local", "claim", "canonical"] as const);
  const source = normalizeSource(input.source);
  const occurredAt = timestamp(input.occurredAt);
  const recordedAt = timestamp(input.recordedAt);
  const idempotencyKey = text(input.idempotencyKey, PHONE_INTERACTION_LIMITS.id);
  if (!id || !chatId || !phoneId || !appId || !verb || !actors || !audience || !canon || !source || !occurredAt || !recordedAt || !idempotencyKey) return null;
  const effectiveAt = timestamp(input.effectiveAt) ?? undefined;
  const processId = optionalText(input.processId, PHONE_INTERACTION_LIMITS.id);
  return {
    id, chatId, phoneId, appId, verb, actors, audience,
    physicalObserverIds: uniqueStrings(input.physicalObserverIds, PHONE_INTERACTION_LIMITS.observers),
    canon, data: normalizeInteractionData(input.data), source, occurredAt, recordedAt,
    ...(effectiveAt ? { effectiveAt } : {}), ...(processId ? { processId } : {}), idempotencyKey,
  };
}

export function normalizeKnowledgeClaim(value: unknown): KnowledgeClaim | null {
  const input = record(value);
  if (!input) return null;
  const id = text(input.id, PHONE_INTERACTION_LIMITS.id);
  const chatId = text(input.chatId, PHONE_INTERACTION_LIMITS.id);
  const knower = normalizePrincipal(input.knower);
  const proposition = text(input.proposition, PHONE_INTERACTION_LIMITS.proposition);
  const sourceEventId = text(input.sourceEventId, PHONE_INTERACTION_LIMITS.id);
  const provenance = oneOf(input.provenance, ["observed", "read", "heard", "sensor", "web-claim", "reported"] as const);
  const confidence = oneOf(input.confidence, ["uncertain", "claimed", "reliable"] as const);
  const privacy = normalizeAudience(input.privacy);
  const acquiredAt = timestamp(input.acquiredAt);
  if (!id || !chatId || !knower || !proposition || !sourceEventId || !provenance || !confidence || !privacy || !acquiredAt) return null;
  const sourceRecordId = optionalText(input.sourceRecordId, PHONE_INTERACTION_LIMITS.id);
  const supersedes = optionalText(input.supersedes, PHONE_INTERACTION_LIMITS.id);
  return { id, chatId, knower, proposition, sourceEventId, ...(sourceRecordId ? { sourceRecordId } : {}), provenance, confidence, privacy, acquiredAt, ...(supersedes ? { supersedes } : {}) };
}

export function normalizePhoneProcess(value: unknown): PhoneProcess | null {
  const input = record(value);
  if (!input) return null;
  const id = text(input.id, PHONE_INTERACTION_LIMITS.id);
  const chatId = text(input.chatId, PHONE_INTERACTION_LIMITS.id);
  const phoneId = text(input.phoneId, PHONE_INTERACTION_LIMITS.id);
  const appId = text(input.appId, PHONE_INTERACTION_LIMITS.id);
  const kind = text(input.kind, PHONE_INTERACTION_LIMITS.verb);
  const state = text(input.state, PHONE_INTERACTION_LIMITS.verb);
  const createdAt = timestamp(input.createdAt);
  const updatedAt = timestamp(input.updatedAt);
  const sourceEventId = text(input.sourceEventId, PHONE_INTERACTION_LIMITS.id);
  if (!id || !chatId || !phoneId || !appId || !kind || !state || !createdAt || !updatedAt || !sourceEventId) return null;
  const participants = Array.isArray(input.participants)
    ? input.participants.map(normalizePrincipal).filter((item): item is PrincipalRef => item !== null).slice(0, PHONE_INTERACTION_LIMITS.participants)
    : [];
  const previousState = optionalText(input.previousState, PHONE_INTERACTION_LIMITS.verb);
  const dueAt = timestamp(input.dueAt) ?? undefined;
  const normalizedData = normalizeInteractionData(input.data);
  const data = record(normalizedData) ?? {};
  return { id, chatId, phoneId, appId, kind, state, ...(previousState ? { previousState } : {}), participants, data, createdAt, updatedAt, ...(dueAt ? { dueAt } : {}), sourceEventId };
}

function normalizeBounded<T>(value: unknown, normalize: (item: unknown) => T | null, key: (item: T) => string, limit: number): T[] {
  if (!Array.isArray(value)) return [];
  const latest = new Map<string, T>();
  for (const raw of value) {
    const item = normalize(raw);
    if (!item) continue;
    const identity = key(item);
    // Delete before setting so a replacement counts as the newest occurrence for retention.
    latest.delete(identity);
    latest.set(identity, item);
  }
  return [...latest.values()].slice(-limit);
}

export function normalizePhoneEvents(value: unknown): PhoneEvent[] {
  return normalizeBounded(value, normalizePhoneEvent, (event) => event.idempotencyKey, PHONE_INTERACTION_LIMITS.events);
}

export function normalizeKnowledgeClaims(value: unknown): KnowledgeClaim[] {
  return normalizeBounded(value, normalizeKnowledgeClaim, (claim) => claim.id, PHONE_INTERACTION_LIMITS.knowledge);
}

export function normalizePhoneProcesses(value: unknown): PhoneProcess[] {
  return normalizeBounded(value, normalizePhoneProcess, (process) => process.id, PHONE_INTERACTION_LIMITS.processes);
}

export function normalizePhoneInteractionLedger(value: unknown): PhoneInteractionLedger {
  const input = record(value) ?? {};
  return {
    events: normalizePhoneEvents(input.events),
    knowledge: normalizeKnowledgeClaims(input.knowledge),
    processes: normalizePhoneProcesses(input.processes),
  };
}

export function appendPhoneEvent(events: readonly PhoneEvent[], event: PhoneEvent): PhoneEvent[] {
  return normalizeBounded([...events, event], normalizePhoneEvent, (item) => item.idempotencyKey, PHONE_INTERACTION_LIMITS.events);
}

export function appendKnowledgeClaim(claims: readonly KnowledgeClaim[], claim: KnowledgeClaim): KnowledgeClaim[] {
  return normalizeBounded([...claims, claim], normalizeKnowledgeClaim, (item) => item.id, PHONE_INTERACTION_LIMITS.knowledge);
}

export function upsertPhoneProcess(processes: readonly PhoneProcess[], process: PhoneProcess): PhoneProcess[] {
  return normalizeBounded([...processes, process], normalizePhoneProcess, (item) => item.id, PHONE_INTERACTION_LIMITS.processes);
}
