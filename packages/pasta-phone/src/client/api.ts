// ──────────────────────────────────────────────
// Pasta Phone — minimal API client
// Same shape as the Engine's own package API helper: fetch against /api with the
// CSRF header on writes. Kept package-owned rather than imported from another
// package's source tree, so Pasta Phone does not depend on Maps internals.
// ──────────────────────────────────────────────
const CSRF_HEADER = "x-marinara-csrf";
const CSRF_VALUE = "1";

export class PhoneApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "PhoneApiError";
  }
}

function messageFrom(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const value = (payload as Record<string, unknown>).error;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers = new Headers();
  if (method !== "GET") headers.set(CSRF_HEADER, CSRF_VALUE);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new PhoneApiError(response.status, messageFrom(payload, response.statusText));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const phoneApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, "POST", body),
  delete: <T>(path: string) => request<T>(path, "DELETE"),
};
