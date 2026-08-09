import { create } from "zustand";
import type { NoodleNavigationState } from "../components/noodle/noodle-navigation.types";

const PACKAGE_STATE_KEY = "marinara:noodle:ui";
const LEGACY_UI_STATE_KEY = "marinara-engine-ui";

type PersistedNoodleState = {
  noodleNavigation?: NoodleNavigationState;
  noodleSelectedPersonaId?: string | null;
};

type NoodlePackageState = {
  conversationTimeZone: string;
  debugMode: boolean;
  reviewImagePromptsBeforeSend: boolean;
  noodleNavigation: NoodleNavigationState;
  noodleSelectedPersonaId: string | null;
  setNoodleNavigation: (navigation: NoodleNavigationState) => void;
  setNoodleSelectedPersonaId: (id: string | null) => void;
};

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
): PersistedNoodleState {
  const validated: PersistedNoodleState = {};
  if (
    state.noodleNavigation &&
    typeof state.noodleNavigation === "object" &&
    !Array.isArray(state.noodleNavigation)
  ) {
    validated.noodleNavigation =
      state.noodleNavigation as NoodleNavigationState;
  }
  if (
    typeof state.noodleSelectedPersonaId === "string" ||
    state.noodleSelectedPersonaId === null
  ) {
    validated.noodleSelectedPersonaId = state.noodleSelectedPersonaId;
  }
  return validated;
}

function readInitialState(): PersistedNoodleState {
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

function persistNoodleState(
  state: Pick<
    NoodlePackageState,
    "noodleNavigation" | "noodleSelectedPersonaId"
  >,
) {
  try {
    window.localStorage.setItem(PACKAGE_STATE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing can refuse storage; the tab remains usable in memory.
  }
}

const initialState = typeof window === "undefined" ? {} : readInitialState();

export const useUIStore = create<NoodlePackageState>((set, get) => ({
  conversationTimeZone: "",
  debugMode: false,
  reviewImagePromptsBeforeSend: false,
  noodleNavigation: initialState.noodleNavigation ?? {
    mode: "public",
    view: "home",
  },
  noodleSelectedPersonaId: initialState.noodleSelectedPersonaId ?? null,
  setNoodleNavigation: (noodleNavigation) => {
    set({ noodleNavigation });
    persistNoodleState({
      noodleNavigation,
      noodleSelectedPersonaId: get().noodleSelectedPersonaId,
    });
  },
  setNoodleSelectedPersonaId: (noodleSelectedPersonaId) => {
    set({ noodleSelectedPersonaId });
    persistNoodleState({
      noodleNavigation: get().noodleNavigation,
      noodleSelectedPersonaId,
    });
  },
}));

export function configureNoodlePackageState(props: Record<string, unknown>) {
  useUIStore.setState({
    conversationTimeZone:
      typeof props.conversationTimeZone === "string"
        ? props.conversationTimeZone
        : "",
    debugMode: props.debugMode === true,
    reviewImagePromptsBeforeSend: props.reviewImagePromptsBeforeSend === true,
  });
}
