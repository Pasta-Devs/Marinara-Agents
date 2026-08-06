const API_ROOT = "/api/virtual-phone";
const CSRF_HEADER = "x-marinara-csrf";
const ADMIN_SECRET_STORAGE_KEY = "marinara_admin_secret";

function adminHeaders() {
  try {
    const secret = window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY)?.trim();
    return secret ? { "X-Admin-Secret": secret } : {};
  } catch {
    return {};
  }
}

export async function phoneRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(adminHeaders())) headers.set(name, value);
  if (init.method && init.method !== "GET") headers.set(CSRF_HEADER, "1");
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : response.statusText || "Phone request failed");
  }
  return payload as T;
}
