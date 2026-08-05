import type { HistoryEntry, PhoneApp, PhoneBackground, PhonePage, PhoneOwner } from "./types";

const API_ROOT = "/api/virtual-phone";
const CSRF_HEADER = "x-marinara-csrf";
const INSTALL_STORAGE_PREFIX = "marinara-virtual-phone:";
const ADMIN_SECRET_STORAGE_KEY = "marinara_admin_secret";

function getAdminSecretHeader(): Record<string, string> {
  try {
    const secret = window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY)?.trim();
    return secret ? { "X-Admin-Secret": secret } : {};
  } catch {
    return {};
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
  return fallback;
}

export async function fetchApps(): Promise<{ apps: PhoneApp[]; defaults: string[] }> {
  const response = await fetch(`${API_ROOT}/apps`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: getAdminSecretHeader(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(await readError(response, "Could not load the app catalog."));
  return response.json() as Promise<{ apps: PhoneApp[]; defaults: string[] }>;
}

export async function fetchPage(input: {
  chatId?: string;
  appId: string;
  url?: string;
  connectionId?: string;
  chatConnectionId?: string;
  refresh?: boolean;
  lastAction?: string;
  formData?: Record<string, unknown>;
  pageHistory?: string;
  navHistory?: Array<{ url: string; title: string }>;
  context?: Record<string, unknown>;
  phoneOwner?: PhoneOwner;
  phoneIdentity?: string;
}): Promise<PhonePage> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`${API_ROOT}/page`, {
      method: "POST",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1", ...getAdminSecretHeader() },
      credentials: "same-origin",
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const result = (await response.json()) as PhonePage & { error?: string; message?: string };
    if (!response.ok) throw new Error(result.message || result.error || `The phone could not open that screen (${response.status}).`);
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

// ── Installed apps ────────────────────────────────────────────────────────
// Scoped per chat, phone owner, persona, and character set so phone state cannot leak.

export function phoneStorageIdentity(input: {
  chatId?: string;
  owner?: PhoneOwner;
  personaId?: string;
  characterIds?: string[];
}): string | null {
  const chatId = input.chatId?.trim() || "";
  if (!chatId) return null;
  const owner = input.owner ? `${input.owner.kind}:${input.owner.id}` : "chat:${chatId}";
  const persona = input.personaId?.trim() || "none";
  const characters = [...(input.characterIds || [])].map((id) => id.trim()).filter(Boolean).sort().join(",") || "none";
  return [chatId, owner, `persona:${persona}`, `characters:${characters}`].join("|");
}

function installKey(identity: string | null): string | null {
  return identity ? `${INSTALL_STORAGE_PREFIX}${identity}` : null;
}

export function readBackground(identity: string | null): PhoneBackground {
  const key = installKey(identity);
  if (!key) return "aurora";
  try {
    const value = window.localStorage.getItem(`${key}:background`);
    return value === "midnight" || value === "paper" || value === "ocean" || value === "sunset" ? value : "aurora";
  } catch {
    return "aurora";
  }
}

export function writeBackground(identity: string | null, background: PhoneBackground): void {
  const key = installKey(identity);
  if (!key) return;
  try {
    window.localStorage.setItem(`${key}:background`, background);
  } catch {
    // The preference remains active in memory for this session.
  }
}

export function readInstalled(identity: string | null, defaults: string[]): string[] {
  const key = installKey(identity);
  if (!key) return [...defaults];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(key) || "null");
    if (Array.isArray(saved)) return saved.filter((id): id is string => typeof id === "string");
  } catch {
    // A phone with default apps is better than no phone.
  }
  return [...defaults];
}

export function writeInstalled(identity: string | null, installed: string[]): void {
  const key = installKey(identity);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(installed));
  } catch {
    // Installs stay in memory for this session when storage is unavailable.
  }
}

// ── Session ───────────────────────────────────────────────────────────────

export function readSession(identity: string | null): { entries: HistoryEntry[]; index: number } | null {
  const key = installKey(identity);
  if (!key) return null;
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(`${key}:session`) || "null");
    if (!saved || typeof saved !== "object") return null;
    const record = saved as { entries?: unknown; index?: unknown };
    const entries = Array.isArray(record.entries)
      ? (record.entries.filter(
          (entry) =>
            entry && typeof entry === "object" &&
            typeof (entry as HistoryEntry).url === "string" &&
            typeof (entry as HistoryEntry).html === "string",
        ) as HistoryEntry[])
      : [];
    if (!entries.length) return null;
    const index = typeof record.index === "number" ? Math.min(Math.max(record.index, 0), entries.length - 1) : entries.length - 1;
    return { entries, index };
  } catch {
    return null;
  }
}

export function writeSession(identity: string | null, entries: HistoryEntry[], index: number): void {
  const key = installKey(identity);
  if (!key) return;
  try {
    // Keep the tail only; full page HTML adds up fast in localStorage.
    const tail = entries.slice(-8);
    window.localStorage.setItem(
      `${key}:session`,
      JSON.stringify({ entries: tail, index: Math.max(0, index - (entries.length - tail.length)) }),
    );
  } catch {
    // Non-fatal: history simply does not survive a reload.
  }
}
