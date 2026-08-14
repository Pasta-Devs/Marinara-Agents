import { create } from "zustand";
import type {
  SlurpNavigationState,
  SlurpSourceReference,
} from "../components/slurp/slurp-navigation.types";

const SLURP_STATE_KEY = "marinara:slurp:ui";

type PersistedSlurpState = {
  navigation?: SlurpNavigationState;
  selectedSource?: SlurpSourceReference | null;
  viewerPersonaId?: string | null;
};

type SlurpPackageState = {
  navigation: SlurpNavigationState;
  selectedSource: SlurpSourceReference | null;
  viewerPersonaId: string | null;
  setNavigation: (navigation: SlurpNavigationState) => void;
  setSelectedSource: (source: SlurpSourceReference | null) => void;
  setViewerPersonaId: (personaId: string | null) => void;
};

function readState(): PersistedSlurpState {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(SLURP_STATE_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const record = value as Record<string, unknown>;
    const navigation =
      record.navigation && typeof record.navigation === "object" && !Array.isArray(record.navigation)
        ? (record.navigation as SlurpNavigationState)
        : undefined;
    const selectedSource =
      record.selectedSource && typeof record.selectedSource === "object" && !Array.isArray(record.selectedSource)
        ? (record.selectedSource as SlurpSourceReference)
        : record.selectedSource === null
          ? null
          : undefined;
    return {
      navigation,
      selectedSource,
      viewerPersonaId:
        typeof record.viewerPersonaId === "string" || record.viewerPersonaId === null
          ? record.viewerPersonaId
          : undefined,
    };
  } catch {
    return {};
  }
}

function persist(state: Pick<SlurpPackageState, "navigation" | "selectedSource" | "viewerPersonaId">) {
  try {
    window.localStorage.setItem(SLURP_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage is optional. The current tab remains usable in memory.
  }
}

const initial = readState();

export const useSlurpPackageStore = create<SlurpPackageState>((set, get) => ({
  navigation: initial.navigation ?? { view: "home" },
  selectedSource: initial.selectedSource ?? null,
  viewerPersonaId: initial.viewerPersonaId ?? null,
  setNavigation: (navigation) => {
    set({ navigation });
    persist({ navigation, selectedSource: get().selectedSource, viewerPersonaId: get().viewerPersonaId });
  },
  setSelectedSource: (selectedSource) => {
    set({ selectedSource });
    persist({ navigation: get().navigation, selectedSource, viewerPersonaId: get().viewerPersonaId });
  },
  setViewerPersonaId: (viewerPersonaId) => {
    set({ viewerPersonaId });
    persist({ navigation: get().navigation, selectedSource: get().selectedSource, viewerPersonaId });
  },
}));
