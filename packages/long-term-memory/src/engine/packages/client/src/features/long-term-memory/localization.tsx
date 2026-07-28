import { createContext, useContext, useMemo, type ReactNode } from "react";
import englishCatalog from "./locales/en.json";

export type LtmLocalizationContext = {
  locale?: string;
  direction?: "ltr" | "rtl";
};

type TranslationValues = Record<
  string,
  string | number | boolean | null | undefined
>;
type TranslationCatalog = Record<string, string>;
export type LtmTranslationFunction = (
  key: string,
  values?: TranslationValues,
) => string;

const catalogs: Record<string, TranslationCatalog> = {
  en: Object.fromEntries(
    Object.entries(englishCatalog).filter(
      ([key, value]) => key !== "_meta" && typeof value === "string",
    ),
  ) as TranslationCatalog,
};
const pluralRulesByLocale = new Map<string, Intl.PluralRules>();

function normalizeLocale(locale?: string) {
  return locale?.trim().replaceAll("_", "-") || "en";
}

export function selectLtmPluralForm(locale: string, count: number) {
  let rules = pluralRulesByLocale.get(locale);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(locale);
    } catch {
      rules = new Intl.PluralRules("en");
    }
    pluralRulesByLocale.set(locale, rules);
  }
  return rules.select(count) === "one" ? ("one" as const) : ("other" as const);
}

function catalogForLocale(locale: string) {
  const exact = catalogs[locale] ?? catalogs[locale.toLowerCase()];
  if (exact) return exact;
  return catalogs[locale.split("-")[0]!.toLowerCase()] ?? catalogs.en;
}

function interpolate(message: string, values?: TranslationValues) {
  if (!values) return message;
  return message.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g, (token, name) => {
    const value = values[name];
    return value === null || value === undefined ? token : String(value);
  });
}

export function translateLtm(
  localization: LtmLocalizationContext | undefined,
  key: string,
  values?: TranslationValues,
) {
  const locale = normalizeLocale(localization?.locale);
  const catalog = catalogForLocale(locale);
  const message = catalog[key] ?? catalogs.en[key] ?? key;
  return interpolate(message, values);
}

type LtmLocalizationValue = {
  locale: string;
  direction: "ltr" | "rtl";
  t: LtmTranslationFunction;
};

const defaultLocalization: LtmLocalizationValue = {
  locale: "en",
  direction: "ltr",
  t: (key, values) => translateLtm(undefined, key, values),
};

const LocalizationContext =
  createContext<LtmLocalizationValue>(defaultLocalization);

export function LtmLocalizationProvider({
  localization,
  children,
}: {
  localization?: LtmLocalizationContext;
  children: ReactNode;
}) {
  const locale = normalizeLocale(localization?.locale);
  const direction = localization?.direction === "rtl" ? "rtl" : "ltr";
  const value = useMemo<LtmLocalizationValue>(
    () => ({
      locale,
      direction,
      t: (key, values) => translateLtm({ locale, direction }, key, values),
    }),
    [direction, locale],
  );
  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLtmTranslation() {
  return useContext(LocalizationContext);
}
