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
  fastForward: { running: boolean; dayIndex: number; days: number };
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
  allowedKinds: string[];
  bigKindsAllowed: string[];
  /** Big events count right away instead of waiting for the user. */
  bigAuto?: boolean;
  budgetCallsPerDay: number;
  backgroundTimer: boolean;
  writeStatus: boolean;
  surprise: boolean;
  /** Hidden events a character has not told yet (surprise mode). */
  toHear: number;
  /** Hooks no chat has told yet. */
  newHooks: number;
  /** Characters whose status another Circle writes. */
  statusElsewhere: { characterId: string; circle: string; note: string }[];
  connectionId: string;
  status: CircleStatus;
  /** Big events that wait for the user. */
  waiting: number;
}

export type CircleFields = Partial<
  Pick<
    Circle,
    | "name"
    | "castIds"
    | "setting"
    | "linkedChatIds"
    | "sharedWorld"
    | "pace"
    | "backgroundTimer"
    | "writeStatus"
    | "surprise"
    | "connectionId"
    | "allowedKinds"
    | "bigKindsAllowed"
    | "bigAuto"
    | "budgetCallsPerDay"
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
  avatarUrl?: string;
  /** A character card scenario, used to prefill the setting. */
  scenario?: string;
}

export async function listCharacters(): Promise<NamedItem[]> {
  const rows = await request<Array<{ id: string; data: unknown; avatarPath?: unknown }>>("/api/characters");
  return rows.map((row) => {
    let data: unknown = row.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    const card = (data ?? {}) as { name?: unknown; data?: { name?: unknown; scenario?: unknown } };
    const name = typeof card.name === "string" ? card.name : card.data?.name;
    const scenario = card.data?.scenario;
    return {
      id: row.id,
      name: typeof name === "string" && name ? name : "Unnamed",
      avatarUrl: avatarSrc(row.avatarPath),
      scenario: typeof scenario === "string" && scenario.trim() ? scenario.trim().slice(0, 600) : undefined,
    };
  });
}

export interface ChatItem extends NamedItem {
  characterIds?: unknown;
  lastMessageAt?: string | null;
  updatedAt?: string;
}

export const listChats = () => request<ChatItem[]>("/api/chats");

/** The Engine serves an avatar from a path, a bare file name or a full URL. */
function avatarSrc(path: unknown): string | undefined {
  if (typeof path !== "string" || !path.trim()) return undefined;
  const trimmed = path.trim();
  if (/^(\/api\/|https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  const file = trimmed.split(/[\\/]/u).filter(Boolean).pop();
  return file ? `/api/avatars/file/${encodeURIComponent(file)}` : undefined;
}

/** Providers that cannot write a line of text. */
const NON_TEXT_PROVIDERS = new Set(["image_generation", "video_generation", "audio", "decision"]);

export async function listTextConnections(): Promise<Array<NamedItem & { model?: string }>> {
  const [rows, accounts] = await Promise.all([
    request<Array<NamedItem & { provider: string; model?: string; accountId?: string | null }>>("/api/connections"),
    // A connection whose account is switched off cannot run. Without the account list, nothing is hidden.
    request<Array<{ id: string; enabled: boolean }>>("/api/connection-accounts").catch(() => []),
  ]);
  const off = new Set(accounts.filter((account) => account.enabled === false).map((account) => account.id));
  return rows.filter((row) => !NON_TEXT_PROVIDERS.has(row.provider) && !(row.accountId && off.has(row.accountId)));
}

export interface TimelineEvent {
  id: string;
  cast: string[];
  weight: string;
  status: string;
  text: string;
  place?: string;
  kind?: string;
  day: string;
  time: string;
  until: string;
}

export interface Timeline {
  events: TimelineEvent[];
  now: Record<string, { activity: string; place: string | null; until: string } | null>;
  today: string;
  statusSent: Record<string, { chatId: string; at: number }>;
  nowTime: string;
  dealt: { id: string; kind: string; cast: string[]; place: string; time: string }[];
}

export const getTimeline = (id: string) => api<Timeline>(`/circles/${id}/timeline`);

export interface HookCard {
  eventId: string;
  characterId: string;
  text: string;
  day: string;
  time: string;
  told: boolean;
  chats: NamedItem[];
}

export interface Home {
  hooks: HookCard[];
  diary: Record<string, { id: string; day: string; time: string; text: string }[]>;
  waiting: { id: string; cast: string[]; kind: string; text: string; day: string; time: string }[];
}

export const getHome = (id: string) => api<Home>(`/circles/${id}/home`);
export const pickUp = (id: string, eventId: string, chatId: string) =>
  api<{ ok: true }>(`/circles/${id}/hooks/${eventId}/pick`, "POST", { chatId });

/** Fast forward: `{ days }` (1 to 7) or `{ hours }`. */
export type Span = { days: number } | { hours: number };
export interface Estimate {
  days: number;
  calls: number;
  left: number;
  overBudget: boolean;
  /** Days the Circle was already behind, covered by one summary. */
  missed: number;
}

export const previewFastForward = (id: string, span: Span) =>
  api<Estimate>(`/circles/${id}/fast-forward/preview`, "POST", span);
export const fastForward = (id: string, span: Span, allowOverBudget: boolean) =>
  api<Circle>(`/circles/${id}/fast-forward`, "POST", { ...span, allowOverBudget });
export const cancelFastForward = (id: string) => api<{ ok: boolean }>(`/circles/${id}/fast-forward/cancel`, "POST", {});

export const acceptEvent = (id: string, eventId: string) =>
  api<{ ok: true }>(`/circles/${id}/events/${eventId}/accept`, "POST", {});
export const vetoEvent = (id: string, eventId: string) =>
  api<{ ok: true }>(`/circles/${id}/events/${eventId}/veto`, "POST", {});
export const editEvent = (id: string, eventId: string, text: string) =>
  api<{ ok: true }>(`/circles/${id}/events/${eventId}`, "PATCH", { text });

export interface WidgetData {
  hooks: { eventId: string; circleId: string; circleName: string; characterId: string; text: string }[];
  quiet: { id: string; name: string; lastRunCircle: string; timezone: string; toHear: number }[];
}
export const getWidget = () => api<WidgetData>("/widget");

export interface PromiseItem {
  id: string;
  characterId: string;
  text: string;
  due: string;
  status: "open" | "kept" | "dropped" | "stale";
  visibility: string;
}
export const getPromises = (id: string) => api<{ promises: PromiseItem[] }>(`/circles/${id}/promises`);

export interface NudgeItem {
  id: string;
  cast: string[];
  text: string;
  kind: string;
  withinDays: number;
  status: "open" | "used" | "expired";
  /** The event a used nudge turned into. */
  event?: { text: string; day: string };
}

export const getNudges = (id: string) => api<{ nudges: NudgeItem[] }>(`/circles/${id}/nudges`);
export const createNudge = (id: string, nudge: { cast: string[]; text: string; kind: string; withinDays: number }) =>
  api<NudgeItem>(`/circles/${id}/nudges`, "POST", nudge);
export const deleteNudge = (id: string, nudgeId: string) =>
  api<{ ok: true }>(`/circles/${id}/nudges/${nudgeId}`, "DELETE");

export interface PhoneThread {
  a: string;
  b: string;
  texts: { from: string; text: string; time: string }[];
}

export interface Paper {
  id: string;
  weekStart: string;
  title: string;
  items: { headline: string; text: string }[];
}

export const getPapers = (id: string) => api<{ papers: Paper[] }>(`/circles/${id}/papers`);

export const getPhone = (id: string) => api<{ threads: PhoneThread[] }>(`/circles/${id}/phone`);
