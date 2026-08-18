import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { mkdir, readdir, readFile, rm, unlink } from "node:fs/promises";
import { z } from "zod";
import {
  ltmEventSchema,
  ltmNoteIdSchema,
  type LtmEvent,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { isEnoent } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, safeJoin } from "./paths.js";
import { logger } from "./package-runtime.js";

const MAX_ACTIVITY_EVENTS = 100;
const activityIndexStateSchema = z.object({ version: z.literal(1) }).strict();

function activityIndexStatePath(root: string) {
  return safeJoin(getLongTermMemoryDirectories(root).indexes, "activity-state.json");
}

function activityPath(root: string, noteId: string) {
  return safeJoin(getLongTermMemoryDirectories(root).indexes, `activity/${ltmNoteIdSchema.parse(noteId)}.json`);
}

async function readActivityFile(root: string, noteId: string) {
  try {
    const value = JSON.parse(await readFile(activityPath(root, noteId), "utf8"));
    return Array.isArray(value)
      ? value.flatMap((event) => {
          const parsed = ltmEventSchema.safeParse(event);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  } catch (error) {
    if (isEnoent(error)) return [];
    logger.error(error, `[ltm] Activity index could not be read for ${noteId}`);
    return [];
  }
}

export async function readLtmActivityEvents(root: string, noteId: string, limit: number) {
  const events = await readActivityFile(root, noteId);
  return events.slice(-limit).reverse();
}

export async function appendLtmActivityEvents(root: string, events: readonly LtmEvent[]) {
  const grouped = new Map<string, LtmEvent[]>();
  for (const event of events) {
    if (!event.target) continue;
    const current = grouped.get(event.target) ?? [];
    current.push(event);
    grouped.set(event.target, current);
  }
  for (const [noteId, incoming] of grouped) {
    const existing = await readActivityFile(root, noteId);
    const seen = new Set(existing.map((event) => event.id));
    const next = [...existing, ...incoming.filter((event) => !seen.has(event.id))].slice(-MAX_ACTIVITY_EVENTS);
    await writeJsonAtomic(activityPath(root, noteId), next);
  }
}

export async function rebuildLtmActivityIndex(root: string) {
  const grouped = new Map<string, LtmEvent[]>();
  try {
    const lines = createInterface({
      input: createReadStream(getLongTermMemoryDirectories(root).eventLog),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = ltmEventSchema.safeParse(JSON.parse(line));
        if (!parsed.success || !parsed.data.target) continue;
        const events = grouped.get(parsed.data.target) ?? [];
        events.push(parsed.data);
        grouped.set(parsed.data.target, events.slice(-MAX_ACTIVITY_EVENTS));
      } catch {
        // Historical JSONL may contain malformed lines.
      }
    }
  } catch (error) {
    if (!isEnoent(error)) throw error;
  }

  const dirs = getLongTermMemoryDirectories(root);
  await rm(dirs.activityIndex, { recursive: true, force: true });
  await mkdir(dirs.activityIndex, { recursive: true });
  for (const [noteId, events] of grouped) await writeJsonAtomic(activityPath(root, noteId), events);
  await writeJsonAtomic(activityIndexStatePath(root), { version: 1 });
}

export async function ensureLtmActivityIndex(root: string) {
  let state: unknown = null;
  try {
    state = await readJsonFile<unknown>(activityIndexStatePath(root), null);
  } catch {
    // Rebuild a malformed derived index from the durable event log.
  }
  if (!activityIndexStateSchema.safeParse(state).success) await rebuildLtmActivityIndex(root);
}

export async function pruneLtmActivityIndex(root: string, cutoff: number) {
  const dirs = getLongTermMemoryDirectories(root);
  for (const entry of await readdir(dirs.activityIndex, { withFileTypes: true }).catch((error) => {
    if (isEnoent(error)) return [];
    throw error;
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const noteId = entry.name.slice(0, -5);
    const events = await readActivityFile(root, noteId);
    const retained = events.filter((event) => Date.parse(event.ts) >= cutoff);
    if (retained.length) await writeJsonAtomic(activityPath(root, noteId), retained);
    else
      await unlink(activityPath(root, noteId)).catch((error) => {
        if (!isEnoent(error)) throw error;
      });
  }
}
