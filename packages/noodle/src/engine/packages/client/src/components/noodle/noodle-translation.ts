import { useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../lib/api-client";

/** A translation shown under a post or comment. `text` is null while the provider is working. */
export type NoodleTranslation = { source: string; text: string | null };

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

async function translateNoodleText(text: string) {
  const defaults = await api.get<{ value: string | null }>("/app-settings/translator-defaults");
  const result = await api.post<{ translatedText: string }>(
    "/translate",
    noodleTranslationRequest(text, defaults.value),
  );
  return result.translatedText;
}

let lastRequest = 0;

/** Translations shown under posts and comments, keyed by post or comment id. */
export function useNoodleTranslations() {
  const { t: localizeUi } = useUiTranslation();
  const [shown, setShown] = useState<Record<string, NoodleTranslation>>({});
  // The request each shown translation waits on. Hiding forgets it, so an answer or error that arrives
  // after a hide, or after a newer request, changes nothing and shows no toast. A ref, because the
  // toast has to be decided outside a state update.
  const requests = useRef<Record<string, number>>({});
  const hide = (id: string) => {
    delete requests.current[id];
    setShown(({ [id]: _hidden, ...rest }) => rest);
  };
  return {
    /** Only a translation of this exact text, so an edited post or comment drops its old one. */
    read: (id: string, source: string): NoodleTranslation | null => (shown[id]?.source === source ? shown[id] : null),
    toggle: (id: string, source: string) => {
      if (shown[id]?.source === source) {
        hide(id);
        return;
      }
      const request = ++lastRequest;
      requests.current[id] = request;
      setShown((current) => ({ ...current, [id]: { source, text: null } }));
      translateNoodleText(source).then(
        (text) => {
          if (requests.current[id] === request) setShown((current) => ({ ...current, [id]: { source, text } }));
        },
        (error: unknown) => {
          if (requests.current[id] !== request) return;
          hide(id);
          toast.error(
            error instanceof Error && error.message
              ? error.message
              : localizeUi("ui.noodle.noodlepostcard.translationFailed"),
          );
        },
      );
    },
  };
}
