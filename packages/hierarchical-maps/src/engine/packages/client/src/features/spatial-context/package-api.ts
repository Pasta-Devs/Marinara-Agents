import { CSRF_HEADER, CSRF_HEADER_VALUE } from "@marinara-engine/shared";

const API_BASE = "/api";

export class PackageApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "PackageApiError";
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const value = (payload as Record<string, unknown>).error;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const message = (value as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers = new Headers();
  if (method !== "GET") headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new PackageApiError(response.status, errorMessage(payload, response.statusText), payload);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const packageApi = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, "POST", body);
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, "PUT", body);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, "PATCH", body);
  },
};
