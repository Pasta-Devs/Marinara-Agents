import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { create } from "zustand";
import { api } from "../../lib/api-client";

/**
 * A translation shown under a post or comment. `text` is null while the provider is working. `asked` is false
 * when Noodle translated it automatically, so screen readers announce only the ones the reader asked for.
 */
export type NoodleTranslation = { source: string; text: string | null; asked: boolean };

/**
 * A finished translation. `target` is the provider and language it was made with, so new translator defaults
 * translate again. `shown` is the reader's choice: true after Translate, false after Hide, absent when Noodle
 * translated it automatically. A Hide before the translation arrived saves an empty `text`.
 */
type SavedTranslation = { source: string; target: string; text: string; shown?: boolean };

const SAVED_KEY = "marinara:noodle:translations";
// ponytail: kept in this browser only, the newest 300 plus whatever automatic translation showed since the
// page loaded, so another device or a cleared browser translates again. Store translations with their posts
// on the server if that extra cost starts to matter.
const SAVED_LIMIT = 300;
const AUTO_CONCURRENCY = 2;
const AUTO_ERROR_TOAST = "noodle-auto-translation";
const defaultsQueryKey = ["noodle", "translator-defaults"] as const;

/**
 * The POST /api/translate body for `text`, read from the translator defaults Marinara saves from a
 * chat's Translation settings, the way a new chat reads them for incoming messages. With nothing
 * saved, this is Marinara's own default for a new chat: Google Translate into English.
 */
function noodleTranslationRequest(text: string, savedDefaults: string | null | undefined) {
  let settings: Record<string, unknown> = {};
  try {
    const parsed: unknown = savedDefaults ? JSON.parse(savedDefaults) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) settings = parsed as Record<string, unknown>;
  } catch {
    // Unreadable defaults count as none.
  }
  const read = (key: string) => (typeof settings[key] === "string" ? (settings[key] as string).trim() : "");
  const provider = read("translationProvider");
  const prompt =
    settings.translationOutputPrompt === undefined ? settings.translationPrompt : settings.translationOutputPrompt;
  return {
    text,
    provider: ["ai", "deepl", "deeplx", "google"].includes(provider) ? provider : "google",
    targetLanguage: read("translationOutputTargetLang") || read("translationTargetLang") || "en",
    connectionId: read("translationConnectionId") || undefined,
    systemPrompt: typeof prompt === "string" ? prompt : undefined,
    deeplApiKey: read("translationDeeplApiKey") || undefined,
    deeplxUrl: read("translationDeeplxUrl") || undefined,
  };
}

const translationTarget = (savedDefaults: string | null) => {
  const { provider, targetLanguage } = noodleTranslationRequest("", savedDefaults);
  return `${provider}:${targetLanguage}`;
};

const readTranslatorDefaults = async () =>
  (await api.get<{ value: string | null }>("/app-settings/translator-defaults")).value ?? null;

function loadSaved(): Record<string, SavedTranslation> {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(SAVED_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, Partial<SavedTranslation>>).filter(
        ([, entry]) =>
          typeof entry?.source === "string" &&
          typeof entry.target === "string" &&
          typeof entry.text === "string" &&
          (entry.shown === undefined || typeof entry.shown === "boolean"),
      ),
    ) as Record<string, SavedTranslation>;
  } catch {
    // Private browsing or a damaged value: start without saved translations.
    return {};
  }
}

/** Shared by every card, so a translation survives a remount and shows wherever the post appears. */
const useTranslationStore = create<{
  saved: Record<string, SavedTranslation>;
  /** The request each translation in progress waits on; `auto` when the reader did not ask for it. */
  pending: Record<string, { source: string; request: number; auto: boolean }>;
}>(() => ({ saved: loadSaved(), pending: {} }));

useTranslationStore.subscribe(({ saved }, previous) => {
  if (saved === previous.saved) return;
  try {
    globalThis.localStorage?.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {
    // Full or refused storage keeps translations for this visit only.
  }
});

// Posts and comments automatic translation has shown since the page loaded. Their translations outlive the
// limit, so a long timeline keeps the ones still on screen instead of paying for them again on the next visit.
const autoShown = new Set<string>();

/** End the request for `id`, saving its translation as the newest entry when there is one. */
function settle(id: string, entry: SavedTranslation | null) {
  useTranslationStore.setState(({ saved, pending }) => {
    const { [id]: _settled, ...stillPending } = pending;
    if (!entry) return { pending: stillPending };
    const { [id]: _previous, ...rest } = saved;
    const next: Record<string, SavedTranslation> = { ...rest, [id]: entry };
    let extra = Object.keys(next).length - SAVED_LIMIT;
    for (const oldest of Object.keys(next)) {
      if (extra <= 0) break;
      if (oldest === id || autoShown.has(oldest)) continue;
      delete next[oldest];
      extra -= 1;
    }
    return { saved: next, pending: stillPending };
  });
}

/** Forget every saved translation, for when Noodle's posts are deleted. */
export function forgetNoodleTranslations() {
  useTranslationStore.setState({ saved: {}, pending: {} });
}

let lastRequest = 0;
const autoQueue: Array<() => Promise<void>> = [];
let autoRunning = 0;
// Automatic translations that failed this visit, so a broken translator is not asked again on every render.
const autoFailures = new Set<string>();

function runAutoQueue() {
  while (autoRunning < AUTO_CONCURRENCY && autoQueue.length > 0) {
    const job = autoQueue.shift()!;
    autoRunning += 1;
    void job().finally(() => {
      autoRunning -= 1;
      runAutoQueue();
    });
  }
}

/**
 * Translate `source` for `id`. A hide or a newer request replaces the pending request, so an answer or error
 * that arrives after it changes nothing and shows no toast. Automatic requests wait in a small queue; a reader's
 * own request goes out at once.
 */
function requestTranslation(
  id: string,
  source: string,
  options: { defaults: () => Promise<string | null>; shown?: true; onError: (error: unknown) => void },
) {
  const request = ++lastRequest;
  useTranslationStore.setState(({ pending }) => ({
    pending: { ...pending, [id]: { source, request, auto: !options.shown } },
  }));
  const current = () => useTranslationStore.getState().pending[id]?.request === request;
  const job = async () => {
    if (!current()) return;
    try {
      const defaults = await options.defaults();
      const body = noodleTranslationRequest(source, defaults);
      const { translatedText } = await api.post<{ translatedText: string }>("/translate", body);
      if (current())
        settle(id, { source, target: translationTarget(defaults), text: translatedText, shown: options.shown });
    } catch (error) {
      if (!current()) return;
      settle(id, null);
      options.onError(error);
    }
  };
  if (options.shown) void job();
  else {
    autoQueue.push(job);
    runAutoQueue();
  }
}

/** Drop the automatic translations still waiting or under way, for when automatic translation is turned off. */
export function stopNoodleAutoTranslations() {
  autoQueue.length = 0;
  const { pending } = useTranslationStore.getState();
  if (Object.values(pending).some((wait) => wait.auto))
    useTranslationStore.setState({
      pending: Object.fromEntries(Object.entries(pending).filter(([, wait]) => !wait.auto)),
    });
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * Translations shown under posts and comments, keyed by post or comment id. `autoItems` lists the
 * [id, text] pairs to translate without being asked; null when automatic translation is off.
 */
export function useNoodleTranslations(autoItems: ReadonlyArray<readonly [string, string]> | null) {
  const { t: localizeUi } = useUiTranslation();
  const failedText = localizeUi("ui.noodle.noodlepostcard.translationFailed");
  const queryClient = useQueryClient();
  const { data: defaults } = useQuery({ queryKey: defaultsQueryKey, queryFn: readTranslatorDefaults });
  const target = defaults === undefined ? null : translationTarget(defaults);
  const saved = useTranslationStore((state) => state.saved);
  const pending = useTranslationStore((state) => state.pending);
  const auto = autoItems !== null;

  /** Only a translation of this exact text, in the current language, so an edited post or comment drops it. */
  const usable = (id: string, source: string) => {
    const entry = saved[id];
    return entry?.source === source && (target === null || entry.target === target) ? entry : null;
  };
  const read = (id: string, source: string): NoodleTranslation | null => {
    const wait = pending[id];
    if (wait?.source === source) return { source, text: null, asked: !wait.auto };
    const entry = usable(id, source);
    if (!entry || entry.shown === false) return null;
    if (entry.shown) return { source, text: entry.text, asked: true };
    // Automatic ones show while automatic translation is on, except text that came back unchanged because it
    // was already in the target language.
    return auto && entry.text.trim() !== source.trim() ? { source, text: entry.text, asked: false } : null;
  };

  const autoKey = autoItems ? JSON.stringify(autoItems) : "";
  useEffect(() => {
    if (!autoKey || defaults === undefined) return;
    const currentTarget = translationTarget(defaults);
    for (const [id, source] of JSON.parse(autoKey) as Array<[string, string]>) {
      autoShown.add(id);
      const { saved: savedNow, pending: pendingNow } = useTranslationStore.getState();
      const entry = savedNow[id];
      const failure = `${currentTarget}\n${id}\n${source}`;
      if (pendingNow[id]?.source === source || autoFailures.has(failure)) continue;
      // A hidden translation stays hidden in every language until its text changes.
      if (entry?.source === source && (entry.shown === false || entry.target === currentTarget)) continue;
      requestTranslation(id, source, {
        defaults: async () => defaults,
        onError: (error) => {
          autoFailures.add(failure);
          toast.error(errorMessage(error, failedText), { id: AUTO_ERROR_TOAST });
        },
      });
    }
  }, [autoKey, defaults, failedText]);

  return {
    read,
    /** Show or hide the translation of `source`; showing reuses a saved translation before asking again. */
    toggle: (id: string, source: string) => {
      const entry = usable(id, source);
      // Hiding a translation that has not arrived yet is remembered too, so automatic translation skips it.
      if (pending[id]?.source === source) settle(id, { source, target: target ?? "", text: "", shown: false });
      else if (entry && read(id, source)) settle(id, { ...entry, shown: false });
      else if (entry?.text) settle(id, { ...entry, shown: true });
      else
        requestTranslation(id, source, {
          defaults: () => queryClient.fetchQuery({ queryKey: defaultsQueryKey, queryFn: readTranslatorDefaults }),
          shown: true,
          onError: (error) => toast.error(errorMessage(error, failedText)),
        });
    },
  };
}
