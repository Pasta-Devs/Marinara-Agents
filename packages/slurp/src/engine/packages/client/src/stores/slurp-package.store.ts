import { create } from "zustand";
import type { SlurpNavigationState } from "../components/slurp/slurp-navigation.types";

const PACKAGE_STATE_KEY = "marinara:slurp:package-ui";

type PersistedSlurpState = {
  navigation?: SlurpNavigationState;
  viewerPersonaId?: string | null;
  onboardingState?: SlurpOnboardingState;
};

export type SlurpOnboardingState = "unseen" | "entered" | "completed";

type SlurpPackageState = {
  conversationTimeZone: string;
  debugMode: boolean;
  reviewImagePromptsBeforeSend: boolean;
  navigation: SlurpNavigationState;
  viewerPersonaId: string | null;
  onboardingState: SlurpOnboardingState;
  setNavigation: (navigation: SlurpNavigationState) => void;
  setViewerPersonaId: (id: string | null) => void;
  setOnboardingState: (state: SlurpOnboardingState) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSlurpNavigation(value: unknown): value is SlurpNavigationState {
  if (!isRecord(value)) return false;
  if (value.mode === "creator-settings") {
    return (
      (value.tab === undefined || value.tab === "creator") &&
      (value.section === undefined ||
        ["general", "creators", "images", "audience", "advanced"].includes(value.section as string)) &&
      (value.returnTo === undefined || isSlurpNavigation(value.returnTo))
    );
  }
  if (value.mode !== "creator" || typeof value.view !== "string") return false;
  switch (value.view) {
    case "hub":
      return value.onboarding === undefined || typeof value.onboarding === "boolean";
    case "search":
      return true;
    case "profile":
      return (
        (value.accountId === null || typeof value.accountId === "string") &&
        (value.connection === undefined ||
          value.connection === null ||
          value.connection === "followers" ||
          value.connection === "following") &&
        (value.edit === undefined || typeof value.edit === "boolean") &&
        (value.returnToSettings === undefined || isSlurpNavigation(value.returnToSettings))
      );
    case "profiles":
      return value.returnToSettings === undefined || isSlurpNavigation(value.returnToSettings);
    case "create-profile":
      return (
        typeof value.sourceAccountId === "string" &&
        (value.returnToSettings === undefined || isSlurpNavigation(value.returnToSettings))
      );
    default:
      return false;
  }
}

function readRecord(key: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function validatedPersistedState(state: Record<string, unknown>): PersistedSlurpState {
  const validated: PersistedSlurpState = {};
  if (state.navigation && typeof state.navigation === "object" && !Array.isArray(state.navigation)) {
    if (isSlurpNavigation(state.navigation)) validated.navigation = state.navigation;
  }
  if (typeof state.viewerPersonaId === "string" || state.viewerPersonaId === null) {
    validated.viewerPersonaId = state.viewerPersonaId;
  }
  if (
    state.onboardingState === "unseen" ||
    state.onboardingState === "entered" ||
    state.onboardingState === "completed"
  ) {
    validated.onboardingState = state.onboardingState;
  }
  return validated;
}

function readInitialState(): PersistedSlurpState {
  const packageState = readRecord(PACKAGE_STATE_KEY);
  if (packageState) return validatedPersistedState(packageState);
  return {};
}

function persistSlurpState(state: Pick<SlurpPackageState, "navigation" | "viewerPersonaId" | "onboardingState">) {
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
  onboardingState: initialState.onboardingState ?? "unseen",
  setNavigation: (navigation) => {
    set({ navigation });
    persistSlurpState({
      navigation,
      viewerPersonaId: get().viewerPersonaId,
      onboardingState: get().onboardingState,
    });
  },
  setViewerPersonaId: (viewerPersonaId) => {
    set({ viewerPersonaId });
    persistSlurpState({
      navigation: get().navigation,
      viewerPersonaId,
      onboardingState: get().onboardingState,
    });
  },
  setOnboardingState: (onboardingState) => {
    set({ onboardingState });
    persistSlurpState({
      navigation: get().navigation,
      viewerPersonaId: get().viewerPersonaId,
      onboardingState,
    });
  },
}));

export function configureSlurpPackageState(props: Record<string, unknown>) {
  useSlurpUIStore.setState({
    conversationTimeZone: typeof props.conversationTimeZone === "string" ? props.conversationTimeZone : "",
    debugMode: props.debugMode === true,
    reviewImagePromptsBeforeSend: props.reviewImagePromptsBeforeSend === true,
  });
}
