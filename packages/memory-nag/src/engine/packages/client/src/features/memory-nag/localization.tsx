import { createContext, useContext, useMemo, type ReactNode } from "react";
import arabicCatalog from "./locales/ar.json";
import germanCatalog from "./locales/de.json";
import englishCatalog from "./locales/en.json";
import spanishCatalog from "./locales/es.json";
import frenchCatalog from "./locales/fr.json";
import hindiCatalog from "./locales/hi.json";
import japaneseCatalog from "./locales/ja.json";
import koreanCatalog from "./locales/ko.json";
import polishCatalog from "./locales/pl.json";
import brazilianPortugueseCatalog from "./locales/pt-BR.json";
import russianCatalog from "./locales/ru.json";
import simplifiedChineseCatalog from "./locales/zh-Hans.json";
import type { MemoryNagLocalizationContext } from "./types";

type TranslationValues = Record<string, string | number | boolean | null | undefined>;
type TranslationCatalog = Record<string, string>;
type TranslationFunction = (key: string, values?: TranslationValues) => string;

function translationCatalog(catalog: Record<string, unknown>): TranslationCatalog {
  return Object.fromEntries(
    Object.entries(catalog).filter(([key, value]) => key !== "_meta" && typeof value === "string"),
  ) as TranslationCatalog;
}

const catalogs: Record<string, TranslationCatalog> = {
  ar: translationCatalog(arabicCatalog),
  de: translationCatalog(germanCatalog),
  en: translationCatalog(englishCatalog),
  es: translationCatalog(spanishCatalog),
  fr: translationCatalog(frenchCatalog),
  hi: translationCatalog(hindiCatalog),
  ja: translationCatalog(japaneseCatalog),
  ko: translationCatalog(koreanCatalog),
  pl: translationCatalog(polishCatalog),
  "pt-br": translationCatalog(brazilianPortugueseCatalog),
  ru: translationCatalog(russianCatalog),
  "zh-hans": translationCatalog(simplifiedChineseCatalog),
};

function normalizeLocale(locale?: string) {
  return locale?.trim().replaceAll("_", "-") || "en";
}

function catalogForLocale(locale: string) {
  const exact = catalogs[locale] ?? catalogs[locale.toLowerCase()];
  if (exact) return exact;
  return catalogs[locale.split("-")[0]!.toLowerCase()] ?? catalogs.en;
}

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message;
  return message.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g, (token, name) => {
    const value = values[name];
    return value === null || value === undefined ? token : String(value);
  });
}

export function translateMemoryNag(
  localization: MemoryNagLocalizationContext | undefined,
  key: string,
  values?: TranslationValues,
): string {
  const catalog = catalogForLocale(normalizeLocale(localization?.locale));
  return interpolate(catalog[key] ?? catalogs.en[key] ?? key, values);
}

const LocalizationContext = createContext<{
  direction: "ltr" | "rtl";
  t: TranslationFunction;
}>({ direction: "ltr", t: (key, values) => translateMemoryNag(undefined, key, values) });

export function MemoryNagLocalizationProvider({
  localization,
  children,
}: {
  localization?: MemoryNagLocalizationContext;
  children: ReactNode;
}) {
  const locale = normalizeLocale(localization?.locale);
  const direction = localization?.direction === "rtl" ? "rtl" : "ltr";
  const value = useMemo(
    () => ({ direction, t: (key: string, values?: TranslationValues) => translateMemoryNag({ locale }, key, values) }),
    [direction, locale],
  );
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
