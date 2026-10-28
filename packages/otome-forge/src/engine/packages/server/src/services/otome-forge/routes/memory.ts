// ──────────────────────────────────────────────
// Otome Forge: story memory status and Retry (shown only under Settings → Debug)
// ──────────────────────────────────────────────
// GET  /runs/:run/memory/status → {status}  the kit's memory status (phase ready | pending | stale | error |
//                                           context-unknown, with its reason and counts)
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
import { worldId } from "../ids.js";
import type { OtomeMemory } from "../memory/memory.js";
import { normalizeWorld } from "../schemas/world.js";
import type { OtomeStore } from "../store.js";

const NoFields = z.object({});

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
