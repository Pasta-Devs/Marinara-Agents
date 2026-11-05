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
    throw Object.assign(new Error(message || "Saucelings request failed"), { status: response.status });
  }
  return response.json() as Promise<TResponse>;
}

/** A request error in plain words: a failure the player can't read (no answer, a timeout, the Engine's own 500, a
 *  route that isn't there until a restart) gets a sentence, with the original kept as `details`. A message the
 *  server already wrote as a sentence is shown as it is. */
export function friendlyError(err: unknown, t: (key: string) => string): { message: string; details: string | null } {
  const raw = err instanceof Error ? err.message : "";
  const status = (err as { status?: unknown } | null)?.status;
  const name = err instanceof Error ? err.name : "";
  const key =
    name === "AbortError" || name === "TimeoutError"
      ? "saucelings.error.timeout"
      : err instanceof TypeError && status === undefined && /fetch|network|load failed/i.test(raw)
        ? "saucelings.error.network"
        : status === 502
          ? "saucelings.error.writing"
          : status === 404 && raw === "Not Found"
            ? "saucelings.error.restart"
            : typeof status === "number" && status >= 500 && (!raw || /^internal server error$/i.test(raw))
              ? "saucelings.error.engine"
              : null;
  if (key) return { message: t(key), details: raw || null };
  return { message: raw || t("saucelings.error.request"), details: null };
}

export function packageAssetUrl(packageId = "saucelings", assetPath: string, packageVersion?: string | null): string {
  const base = `/api/capability-packages/${encodeURIComponent(packageId)}/assets/${assetPath}`;
  return packageVersion ? `${base}?v=${encodeURIComponent(packageVersion)}` : base;
}
