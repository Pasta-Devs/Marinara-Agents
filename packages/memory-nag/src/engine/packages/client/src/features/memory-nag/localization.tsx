import { createContext, useContext, useMemo, type ReactNode } from "react";
import englishCatalog from "./locales/en.json";
import type { MemoryNagLocalizationContext } from "./types";

type TranslationValues = Record<string, string | number | boolean | null | undefined>;
type TranslationCatalog = Record<string, string>;
type TranslationFunction = (key: string, values?: TranslationValues) => string;

const english = Object.fromEntries(
  Object.entries(englishCatalog).filter(([key, value]) => key !== "_meta" && typeof value === "string"),
) as TranslationCatalog;

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message;
  return message.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g, (token, name) => {
    const value = values[name];
    return value === null || value === undefined ? token : String(value);
  });
}

export function translateMemoryNag(key: string, values?: TranslationValues): string {
  return interpolate(english[key] ?? key, values);
}

const LocalizationContext = createContext<{
  direction: "ltr" | "rtl";
  t: TranslationFunction;
}>({ direction: "ltr", t: translateMemoryNag });

export function MemoryNagLocalizationProvider({
  localization,
  children,
}: {
  localization?: MemoryNagLocalizationContext;
  children: ReactNode;
}) {
  const direction = localization?.direction === "rtl" ? "rtl" : "ltr";
  const value = useMemo(() => ({ direction, t: translateMemoryNag }), [direction]);
  return (
    <LocalizationContext.Provider value={value}>
      <div dir={direction} style={{ display: "contents" }}>
        {children}
      </div>
    </LocalizationContext.Provider>
  );
}

export function useMemoryNagTranslation() {
  return useContext(LocalizationContext);
}
