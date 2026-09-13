import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  LtmInteropPreviewResponse,
  LtmLorebookPreviewResponse,
  LtmSourceDetailsRequest,
  LtmSourceDetailsResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export function mergeSourcePreviewPages(pages: LtmInteropPreviewResponse[] | undefined) {
  const last = pages?.at(-1);
  if (!last) return undefined;
  const samples = [
    ...new Map(pages!.flatMap((page) => page.samples).map((sample) => [sample.sourceId, sample])).values(),
  ];
  const importedCount = samples.filter((sample) => sample.status === "imported").length;
  return { ...last, samples, scanned: samples.length, importedCount, draftable: samples.length - importedCount };
}

export function mergeLorebookPreviewPages(pages: LtmLorebookPreviewResponse[] | undefined) {
  const last = pages?.at(-1);
  if (!last) return undefined;
  const merged = new Map<string, LtmLorebookPreviewResponse["books"][number]>();
  for (const page of pages!)
    for (const book of page.books) {
      const entries = new Map((merged.get(book.id)?.entries ?? []).map((entry) => [entry.id, entry]));
      for (const entry of book.entries) {
        const candidates = [
          ...new Map(
            [...(entries.get(entry.id)?.candidates ?? []), ...entry.candidates].map((candidate) => [
              candidate.sourceId,
              candidate,
            ]),
          ).values(),
        ];
        entries.set(entry.id, { ...entry, candidates, candidateCount: candidates.length });
      }
      const values = [...entries.values()];
      const candidates = values.flatMap((entry) => entry.candidates);
      const imported = candidates.filter((candidate) => candidate.status === "imported").length;
      merged.set(book.id, {
        ...book,
        entries: values,
        counts: {
          entries: values.length,
          candidates: candidates.length,
          imported,
          pending: candidates.length - imported,
        },
      });
    }
  const books = [...merged.values()];
  const counts = books.reduce(
    (sum, book) => ({
      books: sum.books + 1,
      entries: sum.entries + book.counts.entries,
      candidates: sum.candidates + book.counts.candidates,
      imported: sum.imported + book.counts.imported,
      pending: sum.pending + book.counts.pending,
    }),
    { books: 0, entries: 0, candidates: 0, imported: 0, pending: 0 },
  );
  return { ...last, books, counts };
}

const CSRF_HEADER = "x-marinara-csrf";
const CSRF_HEADER_VALUE = "1";
const ADMIN_SECRET_STORAGE_KEY = "marinara_admin_secret";
const MAX_NOTE_IDS_PER_REQUEST = 100;

export const API_ROOT = "/api/long-term-memory";

export const queryKeys = {
  root: ["long-term-memory"] as const,
  status: ["long-term-memory", "status"] as const,
  settings: ["long-term-memory", "settings"] as const,
  chatDefaults: ["long-term-memory", "chat-defaults"] as const,
  extractionSettings: ["long-term-memory", "extraction-settings"] as const,
  notes: ["long-term-memory", "notes"] as const,
  review: ["long-term-memory", "draft-review"] as const,
  pendingDrafts: ["long-term-memory", "pending-drafts"] as const,
  rejectedSuggestions: ["long-term-memory", "rejected-suggestions"] as const,
  integrity: ["long-term-memory", "integrity"] as const,
  preview: ["long-term-memory", "import-preview"] as const,
  lorebookPreview: ["long-term-memory", "lorebook-import-preview"] as const,
  activity: ["long-term-memory", "activity"] as const,
  scopeTargetsRoot: ["long-term-memory", "scope-targets"] as const,
  localCharactersRoot: ["long-term-memory", "local-characters"] as const,
  lastInjectionRoot: ["long-term-memory", "last-injection"] as const,
  scopeTargets: (chatId: string | null | undefined) => ["long-term-memory", "scope-targets", chatId] as const,
  localCharacters: (chatId: string | null | undefined) => ["long-term-memory", "local-characters", chatId] as const,
  lastInjection: (chatId: string | null | undefined) => ["long-term-memory", "last-injection", chatId] as const,
} as const;

export const ltmScopeTargetsKey = (chatId: string | null | undefined) =>
  [...queryKeys.scopeTargets(chatId), "all-chats"] as const;

function getAdminSecretHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const secret = window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY)?.trim();
    return secret ? { "X-Admin-Secret": secret } : {};
  } catch {
    return {};
  }
}

export function requestRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(getAdminSecretHeader())) {
    headers.set(name, value);
  }
  return fetch(`${API_ROOT}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function request<TResponse, TBody = unknown>(
  path: string,
  method = "GET",
  body?: TBody,
  signal?: AbortSignal,
): Promise<TResponse> {
  const headers = new Headers();
  if (method !== "GET") headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const response = await requestRaw(path, {
    method,
    headers,
    signal,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: unknown;
      code?: unknown;
    } | null;
    const message = typeof payload?.error === "string" ? payload.error : response.statusText;
    const error = new Error(message || "Long-Term Memory request failed");
    Object.assign(error, { status: response.status });
    if (typeof payload?.code === "string") Object.assign(error, { code: payload.code });
    throw error;
  }
  return response.json() as Promise<TResponse>;
}

export async function requestHost<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    const message = typeof payload?.error === "string" ? payload.error : response.statusText;
    throw new Error(message || "Marinara request failed");
  }
  return response.json() as Promise<TResponse>;
}

export async function requestAllNotes<T>(path: string): Promise<T[]> {
  const notes: T[] = [];
  for (let offset = 0; offset < 100_000; offset += 500) {
    const page = await request<T[]>(`${path}${path.includes("?") ? "&" : "?"}limit=500&offset=${offset}`);
    notes.push(...page);
    if (page.length < 500) return notes;
  }
  const overflow = await request<T[]>(`${path}${path.includes("?") ? "&" : "?"}limit=500&offset=100000`);
  if (overflow.length) throw new Error("Long-Term Memory note limit exceeded (100,000 notes)");
  return notes;
}

export async function requestNotesByIds<T extends { id: string }>(
  ids: readonly string[],
  signal?: AbortSignal,
  allowMissing = false,
) {
  const requestedIds = [...new Set(ids)];
  if (!requestedIds.length) return [] as T[];
  const notesById = new Map<string, T>();
  for (let offset = 0; offset < requestedIds.length; offset += MAX_NOTE_IDS_PER_REQUEST) {
    const params = new URLSearchParams({
      ids: requestedIds.slice(offset, offset + MAX_NOTE_IDS_PER_REQUEST).join(","),
    });
    const notes = await request<T[]>(`/notes?${params}`, "GET", undefined, signal);
    for (const note of notes) notesById.set(note.id, note);
  }
  const missingIds = requestedIds.filter((id) => !notesById.has(id));
  if (missingIds.length && !allowMissing)
    throw new Error(
      `Long-Term Memory context unavailable for ${missingIds.length} note${missingIds.length === 1 ? "" : "s"}.`,
    );
  return requestedIds.flatMap((id) => {
    const note = notesById.get(id);
    return note ? [note] : [];
  });
}

/** Source previews can span several pages; detail requests retain the server's 100-ID limit. */
export async function fetchSourceDetails(
  body: LtmSourceDetailsRequest,
  signal?: AbortSignal,
): Promise<LtmSourceDetailsResponse> {
  const result: LtmSourceDetailsResponse = { source: body.source, details: [], missingSourceIds: [] };
  const sourceIds = [...new Set(body.sourceIds)];
  for (let offset = 0; offset < sourceIds.length; offset += MAX_NOTE_IDS_PER_REQUEST) {
    const page = await request<LtmSourceDetailsResponse>(
      "/import/source-details",
      "POST",
      {
        ...body,
        sourceIds: sourceIds.slice(offset, offset + MAX_NOTE_IDS_PER_REQUEST),
      },
      signal,
    );
    result.details.push(...page.details);
    result.missingSourceIds.push(...page.missingSourceIds);
  }
  return result;
}

/** Invalidations must name each affected resource rather than clearing the package cache. */
export async function invalidateLtmQueries(client: QueryClient, keys: readonly QueryKey[]): Promise<void> {
  await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}
