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
const pendingPhoneWrites = new Map<string, Set<Promise<unknown>>>();
const phoneAccessTokens = new Map<string, string>();

export function grantPhoneAccess(phoneId: string, token: string) {
  if (token) phoneAccessTokens.set(phoneId, token);
}

export function releasePhoneAccess(phoneId: string) {
  phoneAccessTokens.delete(phoneId);
}

function trackPhoneWrite<T>(phoneId: string, write: Promise<T>) {
  const pending = pendingPhoneWrites.get(phoneId) ?? new Set<Promise<unknown>>();
  pending.add(write);
  pendingPhoneWrites.set(phoneId, pending);
  void write.finally(() => {
    pending.delete(write);
    if (pending.size === 0) pendingPhoneWrites.delete(phoneId);
  }).catch(() => undefined);
  return write;
}

export async function waitForPhoneWrites(phoneId: string) {
  const pending = pendingPhoneWrites.get(phoneId);
  if (pending?.size) await Promise.allSettled([...pending]);
}

export function setActiveChatId(chatId: string | null) {
  activeChatId = chatId;
}

export async function phoneRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const encodedPhoneId = /\/phones\/([^/?]+)/u.exec(path)?.[1];
  if (encodedPhoneId) {
    const token = phoneAccessTokens.get(decodeURIComponent(encodedPhoneId));
    if (token) headers.set("X-Virtual-Phone-Access", token);
  }
  for (const [name, value] of Object.entries(adminHeaders())) headers.set(name, value);
  if (init.method && init.method !== "GET") headers.set(CSRF_HEADER, "1");
  if (init.body) headers.set("Content-Type", "application/json");
  const url = activeChatId && !path.includes("chatId=") && !path.startsWith("/api/")
    ? `${path}${path.includes("?") ? "&" : "?"}chatId=${encodeURIComponent(activeChatId)}`
    : path;
  const response = await fetch(url.startsWith("/api/") ? url : `${API_ROOT}${url}`, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : response.statusText || "Phone request failed");
  }
  return payload as T;
}

/**
 * Records something the user operating this phone did that the story should be able to react to.
 * The operator and owner may differ when the user has gained access to a character's phone. Fire and forget —
 * nothing in the UI should ever wait on it, and a failure to record is not worth interrupting
 * anyone over. Flushed as one line when the phone is put down (see the `/session` route).
 *
 * This becomes scene narration, so it must describe only the externally observable action. Never
 * put search terms, recipients, private message bodies, note text, locations, or screen contents
 * here. Explicit Show/Reference actions are the only bridge for private content.
 */
export function recordActivity(phoneId: string, text: string) {
  return trackPhoneWrite(phoneId, phoneRequest(`/phones/${encodeURIComponent(phoneId)}/activity`, {
    method: "POST",
    body: JSON.stringify({ text }),
  }));
}

export async function rememberWorldFact(phoneId: string, text: string, source: string) {
  return trackPhoneWrite(phoneId, phoneRequest(`/phones/${encodeURIComponent(phoneId)}/world-facts`, {
    method: "POST",
    body: JSON.stringify({ text, source }),
  }));
}
