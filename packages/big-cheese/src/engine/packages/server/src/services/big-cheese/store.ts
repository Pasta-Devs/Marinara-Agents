// ──────────────────────────────────────────────
// Big Cheese: the run store on api.runtime.persistence.documents
// ──────────────────────────────────────────────
// One document per run, kind "run", id `big-cheese:run:<key>`. Writes to one run go through a queue and carry the
// revision the caller read, so two writers cannot overwrite each other.
import { randomBytes } from "node:crypto";
import type { CapabilityDocumentStore } from "@marinara-engine/shared";
import type { Cast } from "./cast.js";
import { z } from "zod";
import { migrate, migrate3, newRun, type Run as Game } from "./core/index.js";
import { KITS } from "./core/kits/index.js";
import type { PlaceKit } from "./core/kits/types.js";

export const PACKAGE_ID = "big-cheese";
export const SAVE_VERSION = 3;

/** Reads a v1 or v2 game (a run, or a copy in a Cheese Board snapshot) as v3. */
export function upgradeGame(game: Game, kitId: string): Game {
  const kit = Object.hasOwn(KITS, kitId) ? KITS[kitId as keyof typeof KITS].rules : null;
  const v = game.saveVersion as number;
  if (v >= SAVE_VERSION) return game;
  // Only the v1 step needs the kit's rules; v2 to v3 fills defaults without them.
  if (v === 1) return kit ? migrate3(migrate(game, kit)) : game;
  return migrate3(game);
}
const upgrade = (data: unknown): unknown => {
  const d = data as { saveVersion?: unknown; kitId?: string; game?: Game } | null;
  return typeof d?.saveVersion === "number" && d.saveVersion < SAVE_VERSION && d.game
    ? { ...d, saveVersion: SAVE_VERSION, game: upgradeGame(d.game, d.kitId ?? "") }
    : data;
};

// The words of a run, kept next to the rules-core state (route contract).
export interface SceneText {
  blueprint: string;
  title: string;
  room: string;
  people: string[];
  parts: {
    lines: { who: string; text: string }[];
    suggestions: { stance: string; text: string }[];
    summary: string;
    chosen?: string;
  }[];
  total: number;
  done: boolean;
  outcome?: string;
}
/** What the rooms and the grapevine wrote (place.ts). `day` and `evening` are the day indexes of the last batches. */
export interface PlaceText {
  day: number;
  evening: number;
  morning: { room: string; person: string; text: string }[];
  visit?: { room: string; lines: { person: string; text: string }[] };
  known: string[]; // relation keys the boss has heard about
  grapevine: Record<string, { source: string; text: string }>; // keyed by the ids in `game.grapevine`
}

export interface RunText {
  cards: Record<string, { line: string; answers: { stance: string; text: string }[]; source: "model" | "lite" }>;
  scenes: Record<string, SceneText>;
  feelings: Record<string, { person: string; band: string; line: string }[]>;
  place?: PlaceText;
}

export class BigCheeseError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const RUN_KEY = /^r-[0-9a-f]{12}$/;
const runDocId = (key: string) => `${PACKAGE_ID}:run:${key}`;

export const CreateRunBody = z.object({
  kitId: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(40),
  lite: z.boolean().optional(),
});

// `game` is the rules-core state; the core owns its shape, so the store only checks it is an object.
const RunData = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  revision: z.number().int().min(0),
  kitId: z.string(),
  createdAt: z.string(),
  lite: z.boolean(),
  text: z.custom<RunText>((v) => typeof v === "object" && v !== null && "scenes" in v),
  scene: z.string().nullable(),
  cast: z.custom<Cast>((v) => typeof v === "object" && v !== null && "people" in v).optional(),
  kit: z.custom<PlaceKit>((v) => typeof v === "object" && v !== null && "rooms" in v).optional(), // a frozen custom kit
  game: z.custom<Game>((v) => typeof v === "object" && v !== null && "clock" in v),
});
export type Run = z.infer<typeof RunData>;

export function createRunStore(documents: CapabilityDocumentStore) {
  const queues = new Map<string, Promise<unknown>>();
  function enqueue<T>(key: string, job: () => Promise<T>): Promise<T> {
    const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(job);
    queues.set(key, next);
    void next.finally(() => queues.get(key) === next && queues.delete(key)).catch(() => undefined);
    return next;
  }

  const keyOf = (key: unknown) => {
    if (typeof key === "string" && RUN_KEY.test(key)) return key;
    throw new BigCheeseError(404, "No such run.", "not-found");
  };

  async function read(key: string) {
    const record = await documents.getById(PACKAGE_ID, runDocId(key));
    if (!record) throw new BigCheeseError(404, "No such run.", "not-found");
    const saved = (record.data as { saveVersion?: unknown } | null)?.saveVersion;
    if (typeof saved === "number" && saved > SAVE_VERSION) {
      throw new BigCheeseError(409, "This run was saved by a newer Big Cheese.", "newer-save");
    }
    const run = RunData.safeParse(upgrade(record.data));
    if (!run.success) throw new BigCheeseError(500, "This run cannot be read.", "unreadable");
    return { record, run: run.data };
  }

  return {
    /** Title-card summaries, newest first. A run saved by a newer version is listed as `newer`. */
    async list() {
      const records = await documents.list(PACKAGE_ID, "run");
      return records
        .map((record) => {
          const key = record.id.slice(`${PACKAGE_ID}:run:`.length);
          const saved = (record.data as { saveVersion?: unknown } | null)?.saveVersion;
          if (typeof saved === "number" && saved > SAVE_VERSION) {
            return { id: key, newer: true as const, updatedAt: record.updatedAt };
          }
          const run = RunData.safeParse(upgrade(record.data));
          if (!run.success) return null;
          const { kitId, createdAt, game } = run.data;
          const { week, day } = game.clock;
          return { id: key, newer: false as const, kitId, week, day, createdAt, updatedAt: record.updatedAt };
        })
        .filter((summary) => summary !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async create(
      kitId: string,
      lite = false,
      prepare?: (game: Game) => Promise<Pick<Run, "text" | "scene">>,
      cast?: Cast,
    ) {
      const kit = Object.hasOwn(KITS, kitId) ? KITS[kitId as keyof typeof KITS].rules : undefined;
      if (!kit) throw new BigCheeseError(400, "Unknown place.", "bad-request");
      const key = `r-${randomBytes(6).toString("hex")}`;
      const at = new Date().toISOString();
      const game = newRun(kit, randomBytes(4).readUInt32LE(0));
      // Core text (thread titles) names a swapped slot by its cast name.
      for (const [pid, c] of Object.entries(cast?.people ?? {}))
        if (Object.hasOwn(game.people, pid)) game.people[pid].name = c.name;
      const first = (await prepare?.(game)) ?? { text: { cards: {}, scenes: {}, feelings: {} }, scene: null };
      const run: Run = {
        saveVersion: SAVE_VERSION,
        revision: 0,
        kitId,
        createdAt: at,
        lite,
        game,
        ...(cast && { cast }),
        ...first,
      };
      await documents.create({
        id: runDocId(key),
        packageId: PACKAGE_ID,
        kind: "run",
        name: "Big Cheese run",
        description: "",
        data: run,
        createdAt: at,
        updatedAt: at,
      });
      return { id: key, ...run };
    },

    async get(key: unknown) {
      const id = keyOf(key);
      return { id, ...(await read(id)).run };
    },

    /** Applies `change` to the run if `expectedRevision` is still current, else a 409. Bumps the revision. */
    update(key: unknown, expectedRevision: number, change: (run: Run) => Run) {
      const id = keyOf(key);
      return enqueue(id, async () => {
        const { record, run } = await read(id);
        if (run.revision !== expectedRevision) {
          throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
        }
        const next: Run = { ...change(run), saveVersion: SAVE_VERSION, revision: run.revision + 1 };
        const saved = await documents.update({
          id: record.id,
          packageId: PACKAGE_ID,
          expectedRevision: record.revision,
          name: record.name,
          description: record.description,
          data: next,
          updatedAt: new Date().toISOString(),
        });
        if (!saved) throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
        return { id, ...next };
      });
    },

    /** Deletes a run even when a newer version saved it. */
    remove(key: unknown) {
      const id = keyOf(key);
      return enqueue(id, async () => {
        const record = await documents.getById(PACKAGE_ID, runDocId(id));
        if (!record) throw new BigCheeseError(404, "No such run.", "not-found");
        if (!(await documents.remove(PACKAGE_ID, record.id, record.revision))) {
          throw new BigCheeseError(409, "The run changed. Try again.", "conflict");
        }
      });
    },
  };
}

export type RunStore = ReturnType<typeof createRunStore>;
