// ──────────────────────────────────────────────
// Otome Forge: typed readers for the props the Engine's Home browser tab passes (HomeBrowserHub, CapabilityElement)
// ──────────────────────────────────────────────
// The host sets `element.capabilityProps` and redraws often, sometimes with unchanged values, so everything here is a
// pure read. OtomeForgeView reads them once per render and shares the result through OtomePropsContext.
import { createContext, useContext } from "react";

/** The Home browser's fullscreen control. */
export interface FullscreenControl {
  active: boolean;
  setActive: (active: boolean) => void;
  enterLabel?: string;
  exitLabel?: string;
}

export interface OtomeLocalization {
  locale: string;
  direction: "ltr" | "rtl";
}

export type OpenCharacter = (characterId: string, options?: { tab?: string }) => void;
export type OpenConnection = (connectionId: string) => void;

export interface OtomeProps {
  browserFullscreen: FullscreenControl | null;
  /** The conversation time zone the Engine is set to, else the browser's. Every request carries it. */
  timeZone: string;
  debugMode: boolean;
  reviewImagePromptsBeforeSend: boolean;
  openCharacter: OpenCharacter | null;
  openConnection: OpenConnection | null;
  localization: OtomeLocalization;
}

type RawProps = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function readFullscreen(props: RawProps): FullscreenControl | null {
  const control = props.browserFullscreen;
  if (!isRecord(control) || typeof control.setActive !== "function") return null;
  return {
    active: control.active === true,
    setActive: control.setActive as FullscreenControl["setActive"],
    enterLabel: typeof control.enterLabel === "string" ? control.enterLabel : undefined,
    exitLabel: typeof control.exitLabel === "string" ? control.exitLabel : undefined,
  };
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function readTimeZone(props: RawProps): string {
  const zone = props.conversationTimeZone;
  return typeof zone === "string" && zone.trim() ? zone.trim() : browserTimeZone();
}

export function readDebugMode(props: RawProps): boolean {
  return props.debugMode === true;
}

export function readReviewImagePrompts(props: RawProps): boolean {
  return props.reviewImagePromptsBeforeSend === true;
}

export function readOpenCharacter(props: RawProps): OpenCharacter | null {
  const open = props.openCharacter;
  return typeof open === "function" ? (open as OpenCharacter) : null;
}

export function readOpenConnection(props: RawProps): OpenConnection | null {
  const open = props.openConnection;
  return typeof open === "function" ? (open as OpenConnection) : null;
}

export function readLocalization(props: RawProps): OtomeLocalization {
  const context = isRecord(props.localization) ? props.localization : {};
  return {
    locale: typeof context.locale === "string" && context.locale ? context.locale : "en",
    direction: context.direction === "rtl" ? "rtl" : "ltr",
  };
}

export function readOtomeProps(props: RawProps): OtomeProps {
  return {
    browserFullscreen: readFullscreen(props),
    timeZone: readTimeZone(props),
    debugMode: readDebugMode(props),
    reviewImagePromptsBeforeSend: readReviewImagePrompts(props),
    openCharacter: readOpenCharacter(props),
    openConnection: readOpenConnection(props),
    localization: readLocalization(props),
  };
}

export const OtomePropsContext = createContext<OtomeProps | null>(null);

/** The host props, inside OtomeForgeView. */
export function useOtomeProps(): OtomeProps {
  const props = useContext(OtomePropsContext);
  if (!props) throw new Error("useOtomeProps is used outside OtomeForgeView");
  return props;
}
