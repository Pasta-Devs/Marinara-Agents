import { createContext, useContext, useMemo, type ReactNode } from "react";
import englishCatalog from "./locales/en.json";

export type SpatialMapLocalizationContext = {
  locale?: string;
  direction?: "ltr" | "rtl";
};

type TranslationCatalog = Record<string, string>;
type SpatialMapLocalizationValue = {
  locale: string;
  direction: "ltr" | "rtl";
  t: (key: string) => string;
};

const english = Object.fromEntries(
  Object.entries(englishCatalog).filter(([key, value]) => key !== "_meta" && typeof value === "string"),
) as TranslationCatalog;

const SpatialMapLocalization = createContext<SpatialMapLocalizationValue>({
  locale: "en",
  direction: "ltr" as const,
  t: (key: string) => english[key] ?? key,
});

export function SpatialMapLocalizationProvider({
  localization,
  children,
}: {
  localization?: SpatialMapLocalizationContext;
  children: ReactNode;
}) {
  const locale = localization?.locale?.trim().replaceAll("_", "-") || "en";
  const direction = localization?.direction === "rtl" ? "rtl" : "ltr";
  const value = useMemo<SpatialMapLocalizationValue>(
    () => ({
      locale,
      direction,
      t: (key: string) => english[key] ?? key,
    }),
    [direction, locale],
  );
  return <SpatialMapLocalization.Provider value={value}>{children}</SpatialMapLocalization.Provider>;
}

export function useSpatialMapTranslation() {
  return useContext(SpatialMapLocalization);
}
