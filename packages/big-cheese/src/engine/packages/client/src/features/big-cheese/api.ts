// ──────────────────────────────────────────────
// Big Cheese: requests to the package's routes, through the Engine's API client
// ──────────────────────────────────────────────
import { api, ApiError } from "../../lib/api-client";

const PREFIX = "/big-cheese";

export interface RunSummary {
  id: string;
  newer: boolean;
  kitId?: string;
  week?: number;
  day?: number;
  updatedAt: string;
}

// Each key is a literal, so the locale validator finds it.
const ERROR_KEYS: Record<string, string> = {
  "bad-request": "ui.bigCheese.errors.badRequest",
  "not-found": "ui.bigCheese.errors.notFound",
  conflict: "ui.bigCheese.errors.conflict",
  "newer-save": "ui.bigCheese.errors.newerSave",
};

/** The localized message key for a failed request. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    const code = (error.payload as { code?: unknown } | undefined)?.code;
    if (typeof code === "string" && Object.hasOwn(ERROR_KEYS, code)) return ERROR_KEYS[code];
    if (error.status === 403) return "ui.bigCheese.errors.adminAccess";
  }
  return "ui.bigCheese.errors.unknown";
}

export const listRuns = () => api.get<{ runs: RunSummary[] }>(`${PREFIX}/runs`).then((r) => r.runs);
export const createRun = (kitId: string) => api.post<{ run: { id: string } }>(`${PREFIX}/runs`, { kitId });
export const deleteRun = (id: string) => api.delete<{ ok: true }>(`${PREFIX}/runs/${encodeURIComponent(id)}`);
