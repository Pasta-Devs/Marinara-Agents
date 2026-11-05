// React Query: the Engine's connections, characters, personas, lorebooks and fonts, for Story Writer's pickers and
// prompts. Rows are read defensively: the Engine stores flags as "true"/"false" strings and older routes return
// arrays where newer ones page.
import { useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api-client";
import type { PromptCharacter, PromptLoreEntry } from "../lib/story-writer/prompt";

export interface ConnectionOption {
  id: string;
  name: string;
  model: string;
  provider: string;
  isDefault: boolean;
  savedMaxTokens: number | null;
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
const MAX_CHARACTERS = 2_000;
const DETAIL_CHARS = 140;
const NON_TEXT_PROVIDERS = new Set(["image_generation", "video_generation", "audio_generation", "audio", "decision"]);
const EMPTY_CONNECTIONS: ConnectionOption[] = [];
const EMPTY_ITEMS: PickerItem[] = [];
const EMPTY_FONTS: string[] = [];

export const engineResourceKeys = {
  connections: ["story-writer", "engine", "connections"] as const,
  characters: ["story-writer", "engine", "characters"] as const,
  character: (id: string) => ["story-writer", "engine", "character", id] as const,
  personas: ["story-writer", "engine", "personas"] as const,
  lorebooks: ["story-writer", "engine", "lorebooks"] as const,
  fonts: ["story-writer", "engine", "fonts"] as const,
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

// The Engine serves avatarPath as a ready URL and renders it as <img src> unchanged.
function avatarUrlOf(value: unknown): string | null {
  return text(value).trim() || null;
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && error.status === 404;
}

// ── Connections ──

/** The `maxTokens` saved in a connection's default parameters (a JSON string in storage). */
export function readSavedMaxTokens(defaultParameters: unknown): number | null {
  let parsed = defaultParameters;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  const maxTokens = isRecord(parsed) ? parsed.maxTokens : null;
  return typeof maxTokens === "number" && Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : null;
}

function toConnectionOption(row: Row): ConnectionOption[] {
  const id = text(row.id);
  const provider = text(row.provider);
  if (!id || NON_TEXT_PROVIDERS.has(provider) || row.profileImportReviewRequired === "true") return [];
  return [
    {
      id,
      name: text(row.name).trim() || text(row.model) || id,
      model: text(row.model),
      provider,
      isDefault: row.isDefault === "true" || row.isDefault === true,
      savedMaxTokens: readSavedMaxTokens(row.defaultParameters),
    },
  ];
}

export function useStoryConnections(): { connections: ConnectionOption[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: engineResourceKeys.connections,
    queryFn: async () =>
      rowsOf(await api.get<unknown>("/connections"))
        .flatMap(toConnectionOption)
        .sort(byName),
    staleTime: STALE_TIME,
  });
  return { connections: query.data ?? EMPTY_CONNECTIONS, isLoading: query.isLoading };
}

/** The story's own connection while it exists, else the Engine's default, else the first one. */
export function resolveDefaultConnectionId(connections: ConnectionOption[], preferred: string | null): string | null {
  if (preferred && connections.some((connection) => connection.id === preferred)) return preferred;
  return (connections.find((connection) => connection.isDefault) ?? connections[0])?.id ?? null;
}

// ── Characters ──

async function fetchCharacterItems(): Promise<PickerItem[]> {
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
    for (const row of rows) {
      const id = text(row.id);
      const name = text(row.name).trim();
      if (id && name) {
        items.push({
          id,
          name,
          avatarUrl: avatarUrlOf(row.avatarPath),
          detail: detailOf(row.summary, row.description),
        });
      }
    }
    if (!isRecord(page) || page.hasMore !== true || rows.length === 0) break;
    offset += rows.length;
  }
  return items.slice(0, MAX_CHARACTERS);
}

export function useCharacterOptions(): { items: PickerItem[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: engineResourceKeys.characters,
    queryFn: fetchCharacterItems,
    staleTime: STALE_TIME,
  });
  return { items: query.data ?? EMPTY_ITEMS, isLoading: query.isLoading };
}

// ── Personas (one cached list serves both the picker and the prompt) ──

async function fetchPersonaRows(): Promise<Row[]> {
  return rowsOf(await api.get<unknown>("/characters/personas/list"));
}

function toPersonaItems(rows: Row[]): PickerItem[] {
  return rows
    .flatMap((row) => {
      const id = text(row.id);
      const name = text(row.name).trim();
      if (!id || !name) return [];
      return [{ id, name, avatarUrl: avatarUrlOf(row.avatarPath), detail: detailOf(row.summary, row.description) }];
    })
    .sort(byName);
}

export function usePersonaOptions(): { items: PickerItem[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: engineResourceKeys.personas,
    queryFn: fetchPersonaRows,
    staleTime: STALE_TIME,
    select: toPersonaItems,
  });
  return { items: query.data ?? EMPTY_ITEMS, isLoading: query.isLoading };
}

// ── Lorebooks ──

export function useLorebookOptions(): { items: PickerItem[]; isLoading: boolean } {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: engineResourceKeys.lorebooks,
    queryFn: async () => rowsOf(await api.get<unknown>("/lorebooks")).filter((row) => row.hiddenFromLibrary !== true),
    staleTime: STALE_TIME,
  });
  const rows = query.data;
  const items = useMemo(() => {
    if (!rows) return EMPTY_ITEMS;
    return rows
      .flatMap((row) => {
        const id = text(row.id);
        const name = text(row.name).trim();
        if (!id || !name) return [];
        const count = typeof row.entryCount === "number" ? row.entryCount : 0;
        const detail = detailOf(row.description) || t("generation.resources.lorebookEntries", { count });
        return [{ id, name, avatarUrl: null, detail }];
      })
      .sort(byName);
  }, [rows, t]);
  return { items, isLoading: query.isLoading };
}

// ── Fonts ──

/** The Engine's custom font families; the app has already registered their faces in document.fonts. */
export function useFontFamilies(): string[] {
  const query = useQuery({
    queryKey: engineResourceKeys.fonts,
    queryFn: async () => {
      const families = rowsOf(await api.get<unknown>("/fonts")).map((row) => text(row.family).trim());
      return [...new Set(families.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    },
    staleTime: STALE_TIME,
  });
  return query.data ?? EMPTY_FONTS;
}

// ── Prompt data (read at generation time) ──

function parseCharacterData(value: unknown): Row {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toPromptCharacter(row: unknown): PromptCharacter | null {
  if (!isRecord(row)) return null;
  const data = parseCharacterData(row.data);
  const extensions = isRecord(data.extensions) ? data.extensions : {};
  const name = text(data.name).trim() || text(row.name).trim();
  if (!name) return null;
  return {
    name,
    description: text(data.description),
    personality: text(data.personality),
    backstory: text(extensions.backstory),
    appearance: text(extensions.appearance),
    scenario: text(data.scenario),
    exampleDialogue: text(data.mes_example),
  };
}

/** Full character cards in the story's order; a character deleted since it was picked is skipped. */
export async function loadPromptCharacters(queryClient: QueryClient, ids: string[]): Promise<PromptCharacter[]> {
  const characters = await Promise.all(
    ids.map(async (id) => {
      try {
        const row = await queryClient.fetchQuery({
          queryKey: engineResourceKeys.character(id),
          queryFn: () => api.get<unknown>(`/characters/${encodeURIComponent(id)}`),
          staleTime: STALE_TIME,
        });
        return toPromptCharacter(row);
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    }),
  );
  return characters.filter((character): character is PromptCharacter => character !== null);
}

/** Persona cards in the story's order; a persona deleted since it was picked is skipped. */
export async function loadPromptPersonas(queryClient: QueryClient, ids: string[]): Promise<PromptCharacter[]> {
  if (ids.length === 0) return [];
  const rows = await queryClient.fetchQuery({
    queryKey: engineResourceKeys.personas,
    queryFn: fetchPersonaRows,
    staleTime: STALE_TIME,
  });
  const byId = new Map(rows.map((row) => [text(row.id), row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    const name = text(row?.name).trim();
    if (!row || !name) return [];
    return [
      {
        name,
        description: text(row.description),
        personality: text(row.personality),
        backstory: text(row.backstory),
        appearance: text(row.appearance),
        scenario: text(row.scenario),
        exampleDialogue: text(row.mes_example),
      },
    ];
  });
}

/**
 * The entries of the story's lorebooks that the Engine's own keyword scanner activates on `scanText` (constant entries
 * included). If the scan fails, the lorebook's enabled constant entries are used instead.
 */
export async function loadPromptLore(lorebookIds: string[], scanText: string): Promise<PromptLoreEntry[]> {
  const books = await Promise.all(
    lorebookIds.map(async (id) => {
      const path = `/lorebooks/${encodeURIComponent(id)}`;
      let entries: Row[];
      try {
        entries = rowsOf(await api.get<unknown>(`${path}/entries`));
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
      let activated: Set<string> | null = null;
      try {
        const result = await api.post<unknown>(`${path}/test`, { text: scanText });
        const list = isRecord(result) && Array.isArray(result.activated) ? result.activated : [];
        activated = new Set(list.filter(isRecord).map((entry) => text(entry.entryId)));
      } catch (error) {
        console.warn("[story-writer] Lorebook scan failed; using its constant entries", error);
      }
      return entries
        .filter((entry) => entry.enabled !== false)
        .filter((entry) => (activated ? activated.has(text(entry.id)) : entry.constant === true))
        .map((entry): PromptLoreEntry => ({
          name: text(entry.name),
          content: text(entry.content),
          order: typeof entry.order === "number" ? entry.order : 0,
          position: typeof entry.position === "number" ? entry.position : 0,
        }));
    }),
  );
  return books.flat();
}
