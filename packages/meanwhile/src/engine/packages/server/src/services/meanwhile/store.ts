import { createHash } from "node:crypto";
import type { CapabilityDocumentRecord, CapabilityRuntimeHost } from "@marinara-engine/shared";
import { BIG_KINDS, KINDS, type Seed } from "./deck.js";
import type { PlaceTags } from "./routine.js";
import { emptyMark, validTimezone, type Clock, type RunMark } from "./clock.js";

const PACKAGE_ID = "meanwhile";
const DOCUMENT_KIND = "meanwhile-state";
const PACES = ["cozy", "eventful", "dramatic"] as const;
export type Pace = (typeof PACES)[number];

export interface Circle {
  id: string;
  name: string;
  castIds: string[];
  setting: string;
  linkedChatIds: string[];
  sharedWorld: boolean;
  clock: Clock;
  lastRunCircle: string;
  pace: Pace;
  allowedKinds: string[];
  bigKindsAllowed: string[];
  connectionId: string; // "" until chosen; no run without it (decision D1)
  backgroundTimer: boolean;
  /** Slice 5: write what each character does now to their linked conversation chat. Off by default. */
  writeStatus: boolean;
  /** When writeStatus was turned on. The Circle that turned it on last owns a character's status. */
  statusSince: number;
  budgetCallsPerDay: number;
  connections: Record<string, { read: boolean; write: boolean }>;
}

/** Empty in slice 1. The shape is in plan/background-simulation-plan.md. */
export interface LifeEvent {
  id: string;
  circleId: string;
  start: string;
  end: string;
  createdAt: number;
  cast: string[];
  kind: string;
  weight: "routine" | "notable" | "major" | "summary";
  place?: string;
  text: string;
  source: "schedule" | "generated" | "chat" | "user" | "summary";
  status: "accepted" | "proposed" | "vetoed" | "stale";
  visibility: string;
  /** Deck card the beat came from. */
  seedId?: string;
  anchors?: { chatId: string; messageId: string }[];
  /** First-person diary lines and what each character wants to tell the user, by character id. */
  diary?: Record<string, string>;
  hook?: Record<string, string>;
  /** Short texts between two characters, made in the same beat call. */
  texts?: { from: string; to: string; time: string; text: string }[];
  /** Per chat id: when the hook went into that chat's prompt, and when the user asked to pick it up. */
  delivered?: Record<string, number>;
  pickedUp?: Record<string, number>;
  [key: string]: unknown;
}

/** Model calls and tokens for one Circle on one real (UTC) day. */
export interface Usage {
  realDay: string;
  circleId: string;
  calls: number;
  promptTokens: number;
  outputTokens: number;
}

/** A plan or stated fact from a linked chat that the beat call must honour. */
export interface PromiseRecord {
  id: string;
  circleId: string;
  characterId: string;
  text: string;
  /** Circle day, YYYY-MM-DD. */
  due: string;
  visibility: string;
  anchor: { chatId: string; messageId: string };
  /** Short hash of the anchor message text, to spot an edit. */
  hash: string;
  createdAt: number;
  status: "open" | "kept" | "dropped" | "stale";
}

/** A steer from the user: "this week Lily gets a job offer". The deck turns it into one seed inside its window. */
export interface Nudge {
  id: string;
  circleId: string;
  cast: string[];
  text: string;
  kind: string;
  withinDays: number;
  /** Circle time the nudge was made; day 1 of the window is this Circle day. */
  createdCircle: string;
  status: "open" | "used" | "expired";
  eventId?: string;
}

export const NUDGE_MAX_OPEN = 10;

export interface StatusSent {
  key: string;
  chatId: string;
  at: number;
}

export interface MeanwhileDocument {
  schemaVersion: 1;
  circles: Circle[];
  marks: RunMark[];
  events: LifeEvent[];
  placeTags: PlaceTags[];
  seeds: Seed[];
  /** "circleId:day" for each day already dealt, so a day with no seeds is not dealt again. */
  dealtDays: string[];
  /** "circleId:day" for every Circle day whose beat call is done. */
  beatDays: string[];
  usage: Usage[];
  promises: PromiseRecord[];
  /** chatId -> createdAt (ms) of the newest message the promise pass has read. */
  promisePass: Record<string, number>;
  /** characterId -> the last status written (`key` = chat|status|activity). `at` is 0 when the Engine kept a status set by hand. */
  statusSent: Record<string, StatusSent>;
  nudges: Nudge[];
}

let runtime: CapabilityRuntimeHost | null = null;
let registration = 0;

export function configureMeanwhileRuntime(next: CapabilityRuntimeHost): () => void {
  const token = ++registration;
  runtime = next;
  return () => {
    if (registration === token) runtime = null;
  };
}

export function getMeanwhileRuntime(): CapabilityRuntimeHost {
  if (!runtime) throw new Error("Meanwhile runtime is not configured");
  return runtime;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function defaultCircle(id: string, now: number): Circle {
  return {
    id,
    name: "Circle",
    castIds: [],
    setting: "",
    linkedChatIds: [],
    sharedWorld: false,
    clock: { anchorCircle: new Date(now).toISOString(), anchorReal: now, speed: 1, timezone: "UTC" },
    lastRunCircle: new Date(now).toISOString(),
    pace: "cozy",
    allowedKinds: [],
    bigKindsAllowed: [],
    connectionId: "",
    backgroundTimer: false,
    writeStatus: false,
    statusSince: 0,
    budgetCallsPerDay: 12,
    connections: {},
  };
}

/** First problem in the editable fields of a request, or null. Fields that are absent are fine. */
export function circleFieldError(src: Record<string, unknown>): string | null {
  const has = (k: string) => k in src;
  for (const [key, known] of [
    ["allowedKinds", [...KINDS, "spicy"]],
    ["bigKindsAllowed", BIG_KINDS],
  ] as const) {
    const list = src[key];
    if (has(key) && (!Array.isArray(list) || list.some((k) => typeof k !== "string" || !known.includes(k)))) {
      return `Unknown kind in ${key}`;
    }
  }
  if (has("name") && (typeof src.name !== "string" || !src.name.trim() || src.name.trim().length > 80))
    return "Name must be 1 to 80 characters";
  if (has("setting") && (typeof src.setting !== "string" || src.setting.length > 600))
    return "Setting can have at most 600 characters";
  if (
    has("budgetCallsPerDay") &&
    !(
      typeof src.budgetCallsPerDay === "number" &&
      Number.isInteger(src.budgetCallsPerDay) &&
      src.budgetCallsPerDay >= 1 &&
      src.budgetCallsPerDay <= 200
    )
  ) {
    return "Budget must be a whole number from 1 to 200";
  }
  if (has("timezone") && !validTimezone(src.timezone)) return "Unknown time zone";
  if (has("connectionId") && (typeof src.connectionId !== "string" || src.connectionId.length > 200))
    return "Unknown model";
  return null;
}

/** Applies the editable fields of `src` over `base`. Unknown or invalid values keep the base. */
export function applyCircleFields(base: Circle, src: Record<string, unknown>): Circle {
  const text = (v: unknown, max: number, d: string) => (typeof v === "string" ? v.trim().slice(0, max) : d);
  const ids = (v: unknown, max: number, d: string[]) =>
    Array.isArray(v)
      ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 200))].slice(
          0,
          max,
        )
      : d;
  const budget = Number(src.budgetCallsPerDay);
  return {
    ...base,
    name: text(src.name, 80, base.name) || base.name,
    castIds: ids(src.castIds, 12, base.castIds),
    setting: text(src.setting, 600, base.setting),
    linkedChatIds: ids(src.linkedChatIds, 20, base.linkedChatIds),
    sharedWorld: typeof src.sharedWorld === "boolean" ? src.sharedWorld : base.sharedWorld,
    pace: PACES.find((p) => p === src.pace) ?? base.pace,
    allowedKinds: ids(src.allowedKinds, 30, base.allowedKinds),
    bigKindsAllowed: ids(src.bigKindsAllowed, 30, base.bigKindsAllowed),
    connectionId: text(src.connectionId, 200, base.connectionId),
    writeStatus: typeof src.writeStatus === "boolean" ? src.writeStatus : base.writeStatus,
    backgroundTimer: typeof src.backgroundTimer === "boolean" ? src.backgroundTimer : base.backgroundTimer,
    budgetCallsPerDay: Number.isFinite(budget)
      ? Math.max(1, Math.min(200, Math.round(budget)))
      : base.budgetCallsPerDay,
  };
}

function normalizeCircle(value: unknown): Circle | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) return null;
  const base = defaultCircle(value.id, Date.now());
  const clock = isRecord(value.clock) ? value.clock : {};
  const anchor = typeof clock.anchorCircle === "string" && Number.isFinite(Date.parse(clock.anchorCircle));
  const circle = applyCircleFields(base, value);
  return {
    ...circle,
    statusSince: typeof value.statusSince === "number" && Number.isFinite(value.statusSince) ? value.statusSince : 0,
    clock: {
      anchorCircle: anchor ? (clock.anchorCircle as string) : base.clock.anchorCircle,
      anchorReal:
        typeof clock.anchorReal === "number" && Number.isFinite(clock.anchorReal)
          ? clock.anchorReal
          : base.clock.anchorReal,
      speed: typeof clock.speed === "number" && Number.isFinite(clock.speed) && clock.speed >= 0 ? clock.speed : 1,
      timezone: validTimezone(clock.timezone) ? clock.timezone : "UTC",
    },
    lastRunCircle:
      typeof value.lastRunCircle === "string" && Number.isFinite(Date.parse(value.lastRunCircle))
        ? value.lastRunCircle
        : circle.clock.anchorCircle,
    connections: isRecord(value.connections) ? (value.connections as Circle["connections"]) : {},
  };
}

function normalizeMark(value: unknown): RunMark | null {
  if (!isRecord(value) || typeof value.circleId !== "string") return null;
  const base = emptyMark(value.circleId);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    ...base,
    leaseUntil: num(value.leaseUntil),
    failures: Math.max(0, Math.trunc(num(value.failures))),
    nextAt: num(value.nextAt),
    trigger: value.trigger === "tab" ? "tab" : null,
    lastRunAt: num(value.lastRunAt),
    lastWindow: isRecord(value.lastWindow) ? (value.lastWindow as unknown as RunMark["lastWindow"]) : null,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
  };
}

function normalizeNudge(value: unknown): Nudge | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.circleId !== "string") return null;
  const cast = Array.isArray(value.cast) ? value.cast.filter((x): x is string => typeof x === "string") : [];
  const days = value.withinDays;
  if (
    cast.length < 1 ||
    cast.length > 2 ||
    typeof value.text !== "string" ||
    !value.text ||
    value.text.length > 140 ||
    typeof value.kind !== "string" ||
    typeof days !== "number" ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 7 ||
    typeof value.createdCircle !== "string" ||
    !Number.isFinite(Date.parse(value.createdCircle))
  )
    return null;
  const status = value.status === "used" || value.status === "expired" ? value.status : "open";
  return {
    id: value.id,
    circleId: value.circleId,
    cast,
    text: value.text,
    kind: value.kind,
    withinDays: days,
    createdCircle: value.createdCircle,
    status,
    ...(typeof value.eventId === "string" ? { eventId: value.eventId } : {}),
  };
}

export function emptyMeanwhileDocument(): MeanwhileDocument {
  return {
    schemaVersion: 1,
    circles: [],
    marks: [],
    events: [],
    placeTags: [],
    seeds: [],
    dealtDays: [],
    beatDays: [],
    usage: [],
    promises: [],
    promisePass: {},
    statusSent: {},
    nudges: [],
  };
}

/** Stored texts that are not whole {from, to, time, text} strings with a real time are dropped. */
function cleanTexts(e: LifeEvent): LifeEvent {
  if (e.texts === undefined) return e;
  const texts = (Array.isArray(e.texts) ? e.texts : []).filter(
    (t) =>
      isRecord(t) &&
      [t.from, t.to, t.time, t.text].every((v) => typeof v === "string") &&
      Number.isFinite(Date.parse(t.time as string)),
  );
  const next = { ...e, texts };
  if (!texts.length) delete next.texts;
  return next;
}

export function normalizeMeanwhile(value: unknown): MeanwhileDocument {
  if (!isRecord(value)) return emptyMeanwhileDocument();
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const circles = list(value.circles)
    .map(normalizeCircle)
    .filter((c): c is Circle => c !== null);
  const marks = list(value.marks)
    .map(normalizeMark)
    .filter((m): m is RunMark => m !== null);
  return {
    schemaVersion: 1,
    circles,
    marks: marks.filter((m) => circles.some((c) => c.id === m.circleId)),
    events: list(value.events)
      .filter((e): e is LifeEvent => isRecord(e) && typeof e.id === "string")
      .map(cleanTexts),
    placeTags: list(value.placeTags).filter(
      (t): t is PlaceTags => isRecord(t) && typeof t.characterId === "string" && isRecord(t.byActivity),
    ),
    dealtDays: list(value.dealtDays).filter((d): d is string => typeof d === "string"),
    beatDays: list(value.beatDays).filter((d): d is string => typeof d === "string"),
    promises: list(value.promises).filter(
      (p): p is PromiseRecord => isRecord(p) && typeof p.id === "string" && typeof p.circleId === "string",
    ),
    nudges: list(value.nudges)
      .map(normalizeNudge)
      .filter((n): n is Nudge => n !== null),
    statusSent: isRecord(value.statusSent) ? (value.statusSent as Record<string, StatusSent>) : {},
    promisePass: isRecord(value.promisePass) ? (value.promisePass as Record<string, number>) : {},
    usage: list(value.usage).filter(
      (u): u is Usage =>
        isRecord(u) && typeof u.realDay === "string" && typeof u.circleId === "string" && typeof u.calls === "number",
    ),
    seeds: list(value.seeds).filter(
      (s): s is Seed =>
        isRecord(s) && typeof s.id === "string" && typeof s.circleId === "string" && Array.isArray(s.cast),
    ),
  };
}

export function markOf(doc: MeanwhileDocument, circleId: string): RunMark {
  return doc.marks.find((m) => m.circleId === circleId) ?? emptyMark(circleId);
}

export function withMark(doc: MeanwhileDocument, mark: RunMark): MeanwhileDocument {
  return { ...doc, marks: [...doc.marks.filter((m) => m.circleId !== mark.circleId), mark] };
}

function documentId(): string {
  return createHash("sha256").update(`${PACKAGE_ID}\0${DOCUMENT_KIND}\0default`).digest("hex");
}

function isCreateConflict(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error.code === "FILE_UNIQUE_CONSTRAINT" && error.table === "capability_documents";
}

let writeQueue: Promise<void> = Promise.resolve();

function withWriteQueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.catch(() => undefined).then(task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function findDocument(): Promise<CapabilityDocumentRecord | null> {
  return getMeanwhileRuntime().persistence.documents.getById(PACKAGE_ID, documentId());
}

export async function readMeanwhile(): Promise<MeanwhileDocument> {
  return normalizeMeanwhile((await findDocument())?.data);
}

/** Read, change and save. Retries when another writer saved between the read and the write. */
export function updateMeanwhile(
  updater: (current: MeanwhileDocument) => MeanwhileDocument | Promise<MeanwhileDocument>,
): Promise<MeanwhileDocument> {
  return withWriteQueue(async () => {
    const documents = getMeanwhileRuntime().persistence.documents;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const doc = await findDocument();
      const next = normalizeMeanwhile(await updater(normalizeMeanwhile(doc?.data)));
      const now = new Date().toISOString();
      const base = {
        packageId: PACKAGE_ID,
        name: "Meanwhile",
        description: "Circles, run marks and life events",
        data: next,
        updatedAt: now,
      };
      if (!doc) {
        try {
          await documents.create({ id: documentId(), kind: DOCUMENT_KIND, createdAt: now, ...base });
          return next;
        } catch (error) {
          lastError = error;
          if (!isCreateConflict(error)) throw error;
          continue;
        }
      }
      if (await documents.update({ id: doc.id, expectedRevision: doc.revision, ...base })) return next;
    }
    throw lastError instanceof Error ? lastError : new Error("Meanwhile state changed while saving. Please try again.");
  });
}
