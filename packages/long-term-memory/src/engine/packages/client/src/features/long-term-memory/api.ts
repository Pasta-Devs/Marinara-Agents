import type { QueryClient, QueryKey } from "@tanstack/react-query";

const CSRF_HEADER = "x-marinara-csrf";
const CSRF_HEADER_VALUE = "1";

export const API_ROOT = "/api/long-term-memory";

export const queryKeys = {
  root: ["long-term-memory"] as const,
  status: ["long-term-memory", "status"] as const,
  settings: ["long-term-memory", "settings"] as const,
  chatDefaults: ["long-term-memory", "chat-defaults"] as const,
  extractionSettings: ["long-term-memory", "extraction-settings"] as const,
  notes: ["long-term-memory", "notes"] as const,
  review: ["long-term-memory", "draft-review"] as const,
  pendingDrafts: ["long-term-memory", "pending-drafts"] as const,
  rejectedSuggestions: ["long-term-memory", "rejected-suggestions"] as const,
  integrity: ["long-term-memory", "integrity"] as const,
  preview: ["long-term-memory", "import-preview"] as const,
  lorebookPreview: ["long-term-memory", "lorebook-import-preview"] as const,
  activity: ["long-term-memory", "activity"] as const,
  scopeTargetsRoot: ["long-term-memory", "scope-targets"] as const,
  scopeTargets: (chatId: string | null | undefined) =>
    ["long-term-memory", "scope-targets", chatId] as const,
  lastInjection: (chatId: string | null | undefined) =>
    ["long-term-memory", "last-injection", chatId] as const,
} as const;

export async function request<TResponse, TBody = unknown>(
  path: string,
  method = "GET",
  body?: TBody,
  signal?: AbortSignal,
): Promise<TResponse> {
  const headers = new Headers();
  if (method !== "GET") headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers,
    cache: "no-store",
    signal,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    const message =
      typeof payload?.error === "string" ? payload.error : response.statusText;
    throw new Error(message || "Long-Term Memory request failed");
  }
  return response.json() as Promise<TResponse>;
}

export async function requestHost<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    const message =
      typeof payload?.error === "string" ? payload.error : response.statusText;
    throw new Error(message || "Marinara request failed");
  }
  return response.json() as Promise<TResponse>;
}

export async function requestAllNotes<T>(path: string): Promise<T[]> {
  const notes: T[] = [];
  for (let offset = 0; offset < 100_000; offset += 500) {
    const page = await request<T[]>(
      `${path}${path.includes("?") ? "&" : "?"}limit=500&offset=${offset}`,
    );
    notes.push(...page);
    if (page.length < 500) return notes;
  }
  const overflow = await request<T[]>(
    `${path}${path.includes("?") ? "&" : "?"}limit=500&offset=100000`,
  );
  if (overflow.length)
    throw new Error("Long-Term Memory note limit exceeded (100,000 notes)");
  return notes;
}

/** Invalidations must name each affected resource rather than clearing the package cache. */
export async function invalidateLtmQueries(
  client: QueryClient,
  keys: readonly QueryKey[],
): Promise<void> {
  await Promise.all(
    keys.map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
