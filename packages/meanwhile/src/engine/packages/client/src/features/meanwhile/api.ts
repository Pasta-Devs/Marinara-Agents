const API_ROOT = "/api/meanwhile";
const ADMIN_SECRET_STORAGE_KEY = "marinara_admin_secret";

export interface CircleStatus {
  ready: boolean;
  /** The daily model-call limit is used up. */
  paused: boolean;
  circleNow: string;
  nowWall: string;
  lastRunCircle: string;
  lastRunAt: number | null;
  nextDueAt: number | null;
  leaseUntil: number | null;
  failures: number;
  retryAt: number | null;
  lastError: string | null;
  dueReason: string | null;
}

export interface Circle {
  id: string;
  name: string;
  castIds: string[];
  setting: string;
  linkedChatIds: string[];
  sharedWorld: boolean;
  clock: { speed: number; timezone: string };
  pace: "cozy" | "eventful" | "dramatic";
  backgroundTimer: boolean;
  connectionId: string;
  status: CircleStatus;
}

export type CircleFields = Partial<
  Pick<
    Circle,
    "name" | "castIds" | "setting" | "linkedChatIds" | "sharedWorld" | "pace" | "backgroundTimer" | "connectionId"
  >
> & { timezone?: string };

function adminHeaders(): Record<string, string> {
  try {
    const secret = window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY)?.trim();
    return secret ? { "X-Admin-Secret": secret } : {};
  } catch {
    return {};
  }
}

/** Same-origin Engine request with the host's admin and CSRF headers. */
export async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const headers = new Headers(adminHeaders());
  if (method !== "GET") headers.set("x-marinara-csrf", "1");
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(url, {
    method,
    headers,
    cache: "no-store",
    credentials: "same-origin",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof payload?.error === "string" ? payload.error : response.statusText || "Request failed");
  }
  return response.json() as Promise<T>;
}

const api = <T>(path: string, method?: string, body?: unknown) => request<T>(`${API_ROOT}${path}`, method, body);

export const listCircles = () => api<{ circles: Circle[]; speedMax: number }>("/circles");
export const createCircle = (fields: CircleFields) => api<Circle>("/circles", "POST", fields);
export const updateCircle = (id: string, fields: CircleFields) => api<Circle>(`/circles/${id}`, "PATCH", fields);
export const deleteCircle = (id: string) => api<{ ok: true }>(`/circles/${id}`, "DELETE");
export const setCircleSpeed = (id: string, speed: number) => api<Circle>(`/circles/${id}/speed`, "POST", { speed });
export const setCircleTime = (id: string, wall: string) => api<Circle>(`/circles/${id}/time`, "POST", { wall });
export const runCircle = (id: string) => api<Circle>(`/circles/${id}/run`, "POST", {});
export const pingTabOpened = () => api<{ ok: true }>("/tab-opened", "POST", {});

// Engine lists for the pickers.
export interface NamedItem {
  id: string;
  name: string;
}

export async function listCharacters(): Promise<NamedItem[]> {
  const rows = await request<Array<{ id: string; data: unknown }>>("/api/characters");
  return rows.map((row) => {
    let data: unknown = row.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    const card = (data ?? {}) as { name?: unknown; data?: { name?: unknown } };
    const name = typeof card.name === "string" ? card.name : card.data?.name;
    return { id: row.id, name: typeof name === "string" && name ? name : "Unnamed" };
  });
}

export const listChats = () => request<NamedItem[]>("/api/chats");

/** Providers that cannot write a line of text. */
const NON_TEXT_PROVIDERS = new Set(["image_generation", "video_generation", "audio", "decision"]);

export async function listTextConnections(): Promise<NamedItem[]> {
  const rows = await request<Array<NamedItem & { provider: string }>>("/api/connections");
  return rows.filter((row) => !NON_TEXT_PROVIDERS.has(row.provider));
}

export interface TimelineEvent {
  id: string;
  cast: string[];
  weight: string;
  status: string;
  text: string;
  place?: string;
  day: string;
  time: string;
  until: string;
}

export interface Timeline {
  events: TimelineEvent[];
  now: Record<string, { activity: string; place: string | null; until: string } | null>;
  today: string;
  nowTime: string;
  dealt: { id: string; kind: string; cast: string[]; place: string; time: string }[];
}

export const getTimeline = (id: string) => api<Timeline>(`/circles/${id}/timeline`);

export interface HookCard {
  eventId: string;
  characterId: string;
  text: string;
  day: string;
  told: boolean;
  chats: NamedItem[];
}

export interface Home {
  hooks: HookCard[];
  diary: Record<string, { id: string; day: string; text: string }[]>;
}

export const getHome = (id: string) => api<Home>(`/circles/${id}/home`);
export const pickUp = (id: string, eventId: string, chatId: string) =>
  api<{ ok: true }>(`/circles/${id}/hooks/${eventId}/pick`, "POST", { chatId });
