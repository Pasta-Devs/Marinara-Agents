const API_ROOT = "/api/saucelings";
const CSRF_HEADER = "x-marinara-csrf";
const CSRF_HEADER_VALUE = "1";
const ADMIN_SECRET_STORAGE_KEY = "marinara_admin_secret";

function adminHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const secret = window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY)?.trim();
    return secret ? { "X-Admin-Secret": secret } : {};
  } catch {
    return {};
  }
}

export function saucelingsRequest<TResponse, TBody = unknown>(
  path: string,
  method = "GET",
  body?: TBody,
  signal?: AbortSignal,
): Promise<TResponse> {
  return marinaraRequest<TResponse, TBody>(`${API_ROOT}${path}`, method, body, signal);
}

/** A same-origin Engine request with the host's admin and CSRF headers. */
export async function marinaraRequest<TResponse, TBody = unknown>(
  url: string,
  method = "GET",
  body?: TBody,
  signal?: AbortSignal,
): Promise<TResponse> {
  const headers = new Headers(adminHeaders());
  if (method !== "GET") headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(url, {
    method,
    headers,
    signal,
    cache: "no-store",
    credentials: "same-origin",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : response.statusText;
    throw new Error(message || "Saucelings request failed");
  }
  return response.json() as Promise<TResponse>;
}

export function packageAssetUrl(packageId = "saucelings", assetPath: string, packageVersion?: string | null): string {
  const base = `/api/capability-packages/${encodeURIComponent(packageId)}/assets/${assetPath}`;
  return packageVersion ? `${base}?v=${encodeURIComponent(packageVersion)}` : base;
}
