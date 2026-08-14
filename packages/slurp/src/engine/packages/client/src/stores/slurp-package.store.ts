import { create } from "zustand";
import type { SlurpNavigationState } from "../components/slurp/slurp-navigation.types";

const PACKAGE_STATE_KEY = "marinara:slurp:ui";
const LEGACY_UI_STATE_KEY = "marinara:slurp:ui";

type PersistedSlurpState = {
  navigation?: SlurpNavigationState;
  viewerPersonaId?: string | null;
};

type SlurpPackageState = {
  conversationTimeZone: string;
  debugMode: boolean;
  reviewImagePromptsBeforeSend: boolean;
  navigation: SlurpNavigationState;
  viewerPersonaId: string | null;
  setNavigation: (navigation: SlurpNavigationState) => void;
  setViewerPersonaId: (id: string | null) => void;
};

function isSlurpNavigation(
  navigation: SlurpNavigationState | undefined,
): navigation is SlurpNavigationState {
  return navigation?.mode === "creator" || navigation?.mode === "creator-settings";
}

function readRecord(key: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(key) ?? "null",
    ) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function validatedPersistedState(
  state: Record<string, unknown>,
): PersistedSlurpState {
  const validated: PersistedSlurpState = {};
  if (
    state.navigation &&
    typeof state.navigation === "object" &&
    !Array.isArray(state.navigation)
  ) {
    const navigation = state.navigation as SlurpNavigationState;
    if (isSlurpNavigation(navigation)) {
      validated.navigation = navigation;
    }
  }
  if (
    typeof state.viewerPersonaId === "string" ||
    state.viewerPersonaId === null
  ) {
    validated.viewerPersonaId = state.viewerPersonaId;
  }
  return validated;
}

function readInitialState(): PersistedSlurpState {
  const packageState = readRecord(PACKAGE_STATE_KEY);
  if (packageState) return validatedPersistedState(packageState);
  const legacyEnvelope = readRecord(LEGACY_UI_STATE_KEY);
  const legacyState = legacyEnvelope?.state;
  if (
    !legacyState ||
    typeof legacyState !== "object" ||
    Array.isArray(legacyState)
  )
    return {};
  return validatedPersistedState(legacyState as Record<string, unknown>);
}

function persistSlurpState(
  state: Pick<
    SlurpPackageState,
    "navigation" | "viewerPersonaId"
  >,
) {
  try {
    window.localStorage.setItem(PACKAGE_STATE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing can refuse storage; the tab remains usable in memory.
  }
}

const initialState = typeof window === "undefined" ? {} : readInitialState();

export const useSlurpUIStore = create<SlurpPackageState>((set, get) => ({
  conversationTimeZone: "",
  debugMode: false,
  reviewImagePromptsBeforeSend: false,
  navigation: initialState.navigation ?? { mode: "creator", view: "hub" },
  viewerPersonaId: initialState.viewerPersonaId ?? null,
  setNavigation: (navigation) => {
    set({ navigation });
    persistSlurpState({
      navigation,
      viewerPersonaId: get().viewerPersonaId,
    });
  },
  setViewerPersonaId: (viewerPersonaId) => {
    set({ viewerPersonaId });
    persistSlurpState({
      navigation: get().navigation,
      viewerPersonaId,
    });
  },
}));

export function configureSlurpPackageState(props: Record<string, unknown>) {
  useSlurpUIStore.setState({
    conversationTimeZone:
      typeof props.conversationTimeZone === "string"
        ? props.conversationTimeZone
        : "",
    debugMode: props.debugMode === true,
    reviewImagePromptsBeforeSend: props.reviewImagePromptsBeforeSend === true,
  });
}
