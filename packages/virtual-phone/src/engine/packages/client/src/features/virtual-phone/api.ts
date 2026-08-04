import type { HistoryEntry, PhoneApp, PhonePage } from "./types";

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
}): Promise<PhonePage> {
  const response = await fetch(`${API_ROOT}/page`, {
    method: "POST",
    headers: { "content-type": "application/json", [CSRF_HEADER]: "1", ...getAdminSecretHeader() },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as PhonePage & { error?: string; message?: string };
  if (!response.ok) throw new Error(result.message || result.error || `The phone could not open that screen (${response.status}).`);
  return result;
}

// ── Installed apps ────────────────────────────────────────────────────────
// Scoped per chat so one roleplay's phone is not another roleplay's phone.

function installKey(chatId: string | undefined): string | null {
  const trimmed = typeof chatId === "string" ? chatId.trim() : "";
  return trimmed ? `${INSTALL_STORAGE_PREFIX}${trimmed}` : null;
}

export function readInstalled(chatId: string | undefined, defaults: string[]): string[] {
  const key = installKey(chatId);
  if (!key) return [...defaults];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(key) || "null");
    if (Array.isArray(saved)) return saved.filter((id): id is string => typeof id === "string");
  } catch {
    // A phone with default apps is better than no phone.
  }
  return [...defaults];
}

export function writeInstalled(chatId: string | undefined, installed: string[]): void {
  const key = installKey(chatId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(installed));
  } catch {
    // Installs stay in memory for this session when storage is unavailable.
  }
}

// ── Session ───────────────────────────────────────────────────────────────

export function readSession(chatId: string | undefined): { entries: HistoryEntry[]; index: number } | null {
  const key = installKey(chatId);
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

export function writeSession(chatId: string | undefined, entries: HistoryEntry[], index: number): void {
  const key = installKey(chatId);
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
