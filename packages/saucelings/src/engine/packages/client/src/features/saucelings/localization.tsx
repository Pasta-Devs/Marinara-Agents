import { createContext, useContext, useMemo, type ReactNode } from "react";
import englishCatalog from "./locales/en.json";
import type { SaucelingLocalizationContext } from "../../../../shared/src/features/agents/saucelings/types.js";

type TranslationValues = Record<string, string | number | boolean | null | undefined>;
type TranslationCatalog = Record<string, string>;
type TranslationFunction = (key: string, values?: TranslationValues) => string;

const enCatalog = Object.fromEntries(
  Object.entries(englishCatalog).filter(([key, value]) => key !== "_meta" && typeof value === "string"),
) as TranslationCatalog;

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message;
  return message.replaceAll(/\{\{([A-Za-z0-9_]+)\}\}/g, (token, name) => {
    const value = values[name];
    return value === null || value === undefined ? token : String(value);
  });
}

export function translateSaucelings(
  _localization: SaucelingLocalizationContext | undefined,
  key: string,
  values?: TranslationValues,
): string {
  return interpolate(enCatalog[key] ?? key, values);
}

const LocalizationContext = createContext<{
  direction: "ltr" | "rtl";
  t: TranslationFunction;
}>({
  direction: "ltr",
  t: (key, values) => translateSaucelings(undefined, key, values),
});

export function SaucelingsLocalizationProvider({
  localization,
  children,
}: {
  localization?: SaucelingLocalizationContext;
  children: ReactNode;
}) {
  const direction: "ltr" | "rtl" = localization?.direction === "rtl" ? "rtl" : "ltr";
  const value = useMemo(
    () => ({
      direction,
      t: (key: string, values?: TranslationValues) => translateSaucelings(localization, key, values),
    }),
    [direction, localization],
  );
  return (
    <LocalizationContext.Provider value={value}>
      <div dir={direction} style={{ display: "contents" }}>
        {children}
      </div>
    </LocalizationContext.Provider>
  );
}

export function useSaucelingsTranslation() {
  return useContext(LocalizationContext);
}
