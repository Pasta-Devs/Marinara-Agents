import { create } from "zustand";
import type {
  SlurpNavigationState,
  SlurpSourceKind,
} from "../components/slurp/slurp-navigation.types";

export const SLURP_BROWSER_STATE_KEY = "marinara:slurp:ui";

type PersistedSlurpState = {
  navigation?: SlurpNavigationState;
  sourceKind?: SlurpSourceKind | null;
  sourceEntityId?: string | null;
  viewerPersonaId?: string | null;
};

export type SlurpPackageState = {
  navigation: SlurpNavigationState;
  sourceKind: SlurpSourceKind | null;
  sourceEntityId: string | null;
  /** Engine persona ID used for viewer-scoped state. */
  viewerPersonaId: string | null;
  setNavigation: (navigation: SlurpNavigationState) => void;
  setSourceKind: (sourceKind: SlurpSourceKind | null) => void;
  setSourceEntityId: (sourceEntityId: string | null) => void;
  setViewerPersonaId: (viewerPersonaId: string | null) => void;
};

function readRecord(): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SLURP_BROWSER_STATE_KEY) ?? "null",
    ) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readInitialState(): PersistedSlurpState {
  const state = readRecord();
  if (!state) return {};

  return {
    navigation:
      state.navigation &&
      typeof state.navigation === "object" &&
      !Array.isArray(state.navigation)
        ? (state.navigation as SlurpNavigationState)
        : undefined,
    sourceKind:
      state.sourceKind === "character" || state.sourceKind === "persona"
        ? state.sourceKind
        : null,
    sourceEntityId:
      typeof state.sourceEntityId === "string" && state.sourceEntityId.trim()
        ? state.sourceEntityId
        : null,
    viewerPersonaId:
      typeof state.viewerPersonaId === "string" && state.viewerPersonaId.trim()
        ? state.viewerPersonaId
        : null,
  };
}

function persistState(state: SlurpPackageState) {
  try {
    window.localStorage.setItem(
      SLURP_BROWSER_STATE_KEY,
      JSON.stringify({
        navigation: state.navigation,
        sourceKind: state.sourceKind,
        sourceEntityId: state.sourceEntityId,
        viewerPersonaId: state.viewerPersonaId,
      } satisfies PersistedSlurpState),
    );
  } catch {
    // The tab remains usable when browser storage is unavailable.
  }
}

const initialState =
  typeof window === "undefined" ? {} : readInitialState();

export const useSlurpUIStore = create<SlurpPackageState>((set, get) => ({
  navigation: initialState.navigation ?? { view: "home" },
  sourceKind: initialState.sourceKind ?? null,
  sourceEntityId: initialState.sourceEntityId ?? null,
  viewerPersonaId: initialState.viewerPersonaId ?? null,
  setNavigation: (navigation) => {
    set({ navigation });
    persistState(get());
  },
  setSourceKind: (sourceKind) => {
    set({ sourceKind, sourceEntityId: null });
    persistState(get());
  },
  setSourceEntityId: (sourceEntityId) => {
    set({ sourceEntityId });
    persistState(get());
  },
  setViewerPersonaId: (viewerPersonaId) => {
    set({ viewerPersonaId });
    persistState(get());
  },
}));
