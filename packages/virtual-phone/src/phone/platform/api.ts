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

/**
 * The chat the phone is open in. Generation routes need it to decide which chat a request is
 * about — a phone's chatScope is an array, and picking an index is how content ended up attributed
 * to whichever chat the phone happened to join first. Held here rather than threaded through every
 * app's props because it is ambient to the whole device and never varies per app.
 */
let activeChatId: string | null = null;

export function setActiveChatId(chatId: string | null) {
  activeChatId = chatId;
}

export async function phoneRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(adminHeaders())) headers.set(name, value);
  if (init.method && init.method !== "GET") headers.set(CSRF_HEADER, "1");
  if (init.body) headers.set("Content-Type", "application/json");
  const url = activeChatId && !path.includes("chatId=")
    ? `${path}${path.includes("?") ? "&" : "?"}chatId=${encodeURIComponent(activeChatId)}`
    : path;
  const response = await fetch(`${API_ROOT}${url}`, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : response.statusText || "Phone request failed");
  }
  return payload as T;
}

/**
 * Records something the owner did that the story should be able to react to. Fire and forget —
 * nothing in the UI should ever wait on it, and a failure to record is not worth interrupting
 * anyone over. Flushed as one line when the phone is put down (see the `/session` route).
 *
 * Only call this for things with consequence. "Opened Mail" is not consequence; "sent mail to the
 * harbour master" is.
 */
export function recordActivity(phoneId: string, text: string) {
  void phoneRequest(`/phones/${encodeURIComponent(phoneId)}/activity`, {
    method: "POST",
    body: JSON.stringify({ text }),
  }).catch(() => undefined);
}
