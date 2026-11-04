import { createHash } from "node:crypto";
import type { CapabilityDocumentRecord, CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { Seed } from "./deck.js";
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
  [key: string]: unknown;
}

export interface MeanwhileDocument {
  schemaVersion: 1;
  circles: Circle[];
  marks: RunMark[];
  events: LifeEvent[];
  placeTags: PlaceTags[];
  seeds: Seed[];
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
    budgetCallsPerDay: 12,
    connections: {},
  };
}

/** First problem in the editable fields of a request, or null. Fields that are absent are fine. */
export function circleFieldError(src: Record<string, unknown>): string | null {
  const has = (k: string) => k in src;
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

export function emptyMeanwhileDocument(): MeanwhileDocument {
  return { schemaVersion: 1, circles: [], marks: [], events: [], placeTags: [], seeds: [] };
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
    events: list(value.events).filter((e): e is LifeEvent => isRecord(e) && typeof e.id === "string"),
    placeTags: list(value.placeTags).filter(
      (t): t is PlaceTags => isRecord(t) && typeof t.characterId === "string" && isRecord(t.byActivity),
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
