// ──────────────────────────────────────────────
// Otome Forge: story memory status and Retry (shown under Settings → Connections and Settings → Debug)
// ──────────────────────────────────────────────
// GET  /runs/:run/memory/status → {status}  the kit's memory status (phase ready | pending | stale | error |
//                                           context-unknown, with its reason and counts)
// GET  /runs/:run/memory/overview → {paragraphs}  the saved overview as plain paragraphs, [] before the first one
//                                           ("What happened so far…" while a chapter is planned, #2040): read as
//                                           saved, never written or summarized here; no source key leaves the server
// POST /runs/:run/memory/retry  → {status}  queues maintenance again on the background lane: a failed summary waits
//                                           for this tap and is never retried by itself; 503 `no-connection` when the
//                                           world names no connection to summarize with
import { z } from "zod";
import {
  OtomeForgeError,
  debugModeOf,
  parseBody,
  runParam,
  type Handle,
  type OtomeRequest,
  type OtomeRouter,
} from "../http.js";
import { memoryId, worldId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";

const NoFields = z.object({});

/** A line that is only a bold label, such as "**Choices:**" or "__Choices__:". */
const BOLD_LABEL = /^(\*\*|__)[^*_]+?(?::\1|\1:)$/u;
/** Markdown strong emphasis around some words, then single `*` or `_` emphasis that is not inside a word. */
const STRONG = /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/gu;
const EMPHASIS = /(?<![\p{L}\p{N}])([*_])(?=\S)(.+?)(?<=\S)\1(?![\p{L}\p{N}])/gu;

/**
 * The kit's saved overview (`${R}:memory` overview.content) as the player reads it: its paragraphs, with a leading
 * markdown heading or bullet marker, a line that is only a bold label and an echoed "Canon to date" heading dropped,
 * and markdown emphasis taken off its words; [] before the first overview. The text is otherwise as saved, whatever the
 * Heat. An overview is written as plain paragraphs since 0.6.19 (S/memory/memory.ts OVERVIEW_WORDING); this tidies one
 * saved before, until the background rebuild replaces it.
 */
export function overviewParagraphs(data: unknown): string[] {
  // A story rebuilding its overview in the new form (memory.ts) shows the earlier one, tidied, until the first lands.
  const saved = data as {
    overview?: { content?: unknown } | null;
    legacyOverview?: { content?: unknown } | null;
  } | null;
  const content = saved?.overview?.content || saved?.legacyOverview?.content;
  if (typeof content !== "string") return [];
  return content
    .split(/\n+/u)
    .map((line) => line.replace(/^\s*(?:#{1,6}|[-*•])\s+/u, "").trim())
    .filter((line) => !BOLD_LABEL.test(line))
    .map((line) => line.replace(STRONG, "$2").replace(EMPHASIS, "$2"))
    .filter((line) => line && line.replace(/:\s*$/u, "").toLowerCase() !== "canon to date");
}

export interface MemoryRouteDeps {
  store: Pick<OtomeStore, "readDoc">;
  handle: Handle;
  memory: Pick<OtomeMemory, "maintain" | "status">;
}

export function registerMemoryRoutes(router: OtomeRouter, { store, handle, memory }: MemoryRouteDeps): void {
  /** The run id of `:run`, or a 404 when the run has no world. */
  const runOf = async (request: OtomeRequest) => {
    const { runId } = runParam(request);
    if (!(await store.readDoc(worldId(runId), normalizeWorld))) {
      throw new OtomeForgeError(404, "No such Otome Forge run.", "not-found");
    }
    return runId;
  };

  router.get(
    "/runs/:run/memory/status",
    handle(async (request) => ({ status: await memory.status(await runOf(request)) })),
  );

  router.get(
    "/runs/:run/memory/overview",
    handle(async (request) => ({
      paragraphs: (await store.readDoc(memoryId(await runOf(request)), overviewParagraphs)) ?? [],
    })),
  );

  router.post(
    "/runs/:run/memory/retry",
    handle(async (request) => {
      parseBody(NoFields, request.body);
      const runId = await runOf(request);
      if (!(await memory.maintain({ runId, debugMode: debugModeOf(request) }))) {
        throw new OtomeForgeError(503, "No connection is set to summarize the story with.", "no-connection");
      }
      return { status: await memory.status(runId) };
    }),
  );
}
