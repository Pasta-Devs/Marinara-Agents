// ──────────────────────────────────────────────
// Otome Forge: the Engine's connections, characters and personas, for setup and Settings (Story Writer's pattern)
// ──────────────────────────────────────────────
// Rows are read defensively: the Engine stores flags as "true"/"false" strings, and older routes return arrays where
// newer ones page. Characters are paged until `hasMore` clears.
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

export interface ConnectionOption {
  id: string;
  name: string;
  model: string;
  provider: string;
  isDefault: boolean;
}

export interface PickerItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  detail: string;
}

type Row = Record<string, unknown>;

const STALE_TIME = 30_000;
// The catalog route caps a page at 100 rows; a library past 2,000 characters lists its first 2,000 by name.
const CHARACTER_PAGE_SIZE = 100;
export const MAX_CHARACTERS = 2_000;
const DETAIL_CHARS = 140;
const NON_TEXT_PROVIDERS = new Set(["image_generation", "video_generation", "audio_generation", "audio", "decision"]);
const IMAGE_PROVIDER = "image_generation";
const AUDIO_PROVIDER = "audio_generation";

export const engineResourceKeys = {
  connections: ["otome-forge", "engine", "connections"] as const,
  characters: ["otome-forge", "engine", "characters"] as const,
  personas: ["otome-forge", "engine", "personas"] as const,
};

function isRecord(value: unknown): value is Row {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function rowsOf(value: unknown): Row[] {
  const list = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.items) ? value.items : [];
  return list.filter(isRecord);
}

function detailOf(...values: unknown[]): string {
  const value = values.map((candidate) => text(candidate).replace(/\s+/g, " ").trim()).find(Boolean) ?? "";
  return value.length > DETAIL_CHARS ? `${value.slice(0, DETAIL_CHARS - 1).trimEnd()}…` : value;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

function toItem(row: Row): PickerItem[] {
  const id = text(row.id);
  const name = text(row.name).trim();
  if (!id || !name) return [];
  // The Engine serves avatarPath as a ready URL.
  return [{ id, name, avatarUrl: text(row.avatarPath).trim() || null, detail: detailOf(row.summary, row.description) }];
}

// ── Connections ──

export interface ConnectionLists {
  text: ConnectionOption[];
  image: ConnectionOption[];
  /** Audio connections that make music (`provider === "audio_generation"`, music on). */
  music: ConnectionOption[];
}

const NO_CONNECTIONS: ConnectionLists = { text: [], image: [], music: [] };

function toConnectionLists(rows: Row[]): ConnectionLists {
  const lists: ConnectionLists = { text: [], image: [], music: [] };
  for (const row of rows) {
    const id = text(row.id);
    const provider = text(row.provider);
    if (!id || row.profileImportReviewRequired === "true") continue;
    const option: ConnectionOption = {
      id,
      name: text(row.name).trim() || text(row.model) || id,
      model: text(row.model),
      provider,
      isDefault: row.isDefault === "true" || row.isDefault === true,
    };
    if (provider === IMAGE_PROVIDER) lists.image.push(option);
    else if (provider === AUDIO_PROVIDER) {
      if (row.audioMusic === "true" || row.audioMusic === true) lists.music.push(option);
    } else if (!NON_TEXT_PROVIDERS.has(provider)) lists.text.push(option);
  }
  lists.text.sort(byName);
  lists.image.sort(byName);
  lists.music.sort(byName);
  return lists;
}

/** Text connections (for the story's jobs), image connections and music connections. */
export function useConnections() {
  const query = useQuery({
    queryKey: engineResourceKeys.connections,
    queryFn: async () => rowsOf(await api.get<unknown>("/connections")),
    staleTime: STALE_TIME,
    select: toConnectionLists,
  });
  return { ...(query.data ?? NO_CONNECTIONS), isLoading: query.isLoading, isError: query.isError };
}

/** The Engine's default text connection, else the first one. */
export function defaultTextConnectionId(connections: ConnectionOption[]): string {
  return (connections.find((connection) => connection.isDefault) ?? connections[0])?.id ?? "";
}

// ── Characters (paged) and personas ──

async function fetchCharacters(): Promise<PickerItem[]> {
  const items: PickerItem[] = [];
  let offset = 0;
  while (offset < MAX_CHARACTERS) {
    const params = new URLSearchParams({
      limit: String(CHARACTER_PAGE_SIZE),
      offset: String(offset),
      sort: "name-asc",
    });
    const page = await api.get<unknown>(`/characters/catalog?${params.toString()}`);
    const rows = rowsOf(page);
    items.push(...rows.flatMap(toItem));
    if (!isRecord(page) || page.hasMore !== true || rows.length === 0) break;
    offset += rows.length;
  }
  return items.slice(0, MAX_CHARACTERS);
}

const NO_ITEMS: PickerItem[] = [];

export function useCharacterOptions() {
  const query = useQuery({ queryKey: engineResourceKeys.characters, queryFn: fetchCharacters, staleTime: STALE_TIME });
  return {
    items: query.data ?? NO_ITEMS,
    isLoading: query.isLoading,
    isError: query.isError,
    isSuccess: query.isSuccess,
  };
}

const toPersonaItems = (rows: Row[]) => rows.flatMap(toItem).sort(byName);

export function usePersonaOptions() {
  const query = useQuery({
    queryKey: engineResourceKeys.personas,
    queryFn: async () => rowsOf(await api.get<unknown>("/characters/personas/list")),
    staleTime: STALE_TIME,
    select: toPersonaItems,
  });
  return {
    items: query.data ?? NO_ITEMS,
    isLoading: query.isLoading,
    isError: query.isError,
    isSuccess: query.isSuccess,
  };
}
