// ──────────────────────────────────────────────
// Otome Forge: the look (Midnight, Pearl, or Follow system), kept on this device in `otome-forge:look:v1`
// ──────────────────────────────────────────────
// Browser storage may be missing or throw (private windows, blocked site data), so every access is guarded and the
// game falls back to following the system.
import { useCallback, useEffect, useState } from "react";
import type { Look } from "../theme/tokens";

export type LookPreference = Look | "system";

export const LOOK_STORAGE_KEY = "otome-forge:look:v1";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isPreference(value: unknown): value is LookPreference {
  return value === "midnight" || value === "pearl" || value === "system";
}

function readPreference(): LookPreference {
  try {
    const stored = window.localStorage.getItem(LOOK_STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function writePreference(preference: LookPreference) {
  try {
    window.localStorage.setItem(LOOK_STORAGE_KEY, preference);
  } catch {
    // Not saved; the choice still applies until the tab closes.
  }
}

function darkQuery(): MediaQueryList | null {
  try {
    return typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
  } catch {
    return null;
  }
}

export function useLook() {
  const [preference, setPreferenceState] = useState<LookPreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => darkQuery()?.matches ?? true);
  useEffect(() => {
    if (preference !== "system") return;
    const query = darkQuery();
    if (!query) return;
    const update = () => setSystemDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [preference]);
  const setPreference = useCallback((next: LookPreference) => {
    setPreferenceState(next);
    writePreference(next);
  }, []);
  const look: Look = preference === "system" ? (systemDark ? "midnight" : "pearl") : preference;
  return { look, preference, setPreference };
}
