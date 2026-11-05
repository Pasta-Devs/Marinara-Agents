// ──────────────────────────────────────────────
// Otome Forge: the `otome-forge:index` document (the run list, the 18+ confirmation, the last visit)
// ──────────────────────────────────────────────
// Schemas use only the zod API v3 and v4 share: the server bundle gets the Engine's zod 4, the tests run zod 3.
// Each field is read on its own and a bad or missing one takes its default. A run entry is dropped only when its run key
// is invalid or repeated: POST /index/opened writes the normalized index back, so dropping a run for a bad title would
// leave its documents in storage with no way to reach them.
import { z } from "zod";
import type { OtomeIndex, OtomeRunEntry } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { isRunKey } from "../ids.js";

const TITLE_MAX = 200;

const AgeGate = z.object({ confirmedAt: z.string() });

function field(data: unknown, key: string): unknown {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>)[key] : undefined;
}

const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

export function normalizeIndex(data: unknown): OtomeIndex {
  const runs: OtomeRunEntry[] = [];
  const rawRuns = field(data, "runs");
  for (const raw of Array.isArray(rawRuns) ? rawRuns : []) {
    const runKey = field(raw, "runKey");
    if (!isRunKey(runKey) || runs.some((run) => run.runKey === runKey)) continue;
    const title = field(raw, "title");
    runs.push({
      runKey,
      title: typeof title === "string" ? title.slice(0, TITLE_MAX) : runKey,
      createdAt: stringOrNull(field(raw, "createdAt")) ?? "",
      lastPlayedAt: stringOrNull(field(raw, "lastPlayedAt")),
    });
  }
  const activeRun = stringOrNull(field(data, "activeRun"));
  const ageGate = AgeGate.safeParse(field(data, "ageGate"));
  return {
    version: 1,
    runs,
    activeRun: activeRun && runs.some((run) => run.runKey === activeRun) ? activeRun : null,
    ageGate: ageGate.success ? { confirmedAt: ageGate.data.confirmedAt } : null,
    lastOpenedAt: stringOrNull(field(data, "lastOpenedAt")),
  };
}

/** POST /index/opened takes no fields of its own (timeZone and debugMode ride along and are dropped). */
export const IndexOpenedBody = z.object({});
