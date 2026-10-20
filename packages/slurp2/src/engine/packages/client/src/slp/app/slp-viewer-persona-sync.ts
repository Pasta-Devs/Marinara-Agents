import { useEffect, useRef } from "react";
import { useSlurpUIStore } from "../base/state/slp-package-store";

// One persona browses Slurp on every device, so each shows the same inbox (#103). The pick lives
// in the settings: this browser follows a pick made on another device, and saves any pick made
// here (account switcher, scene handback, or a pick kept only for this browser before 0.3.46).
export function useSyncViewerPersona(
  serverPersonaId: string | null | undefined,
  saveViewerPersona: (settings: { viewerPersonaId: string }) => void,
) {
  const storedPersonaId = useSlurpUIStore((state) => state.viewerPersonaId);
  const setStoredPersonaId = useSlurpUIStore((state) => state.setViewerPersonaId);
  const seenServerPersonaId = useRef<string | null | undefined>(undefined);
  // The pick this browser last saved: a slower, older save response must not replace it.
  const lastSavedPersonaId = useRef<string | null>(null);
  useEffect(() => {
    if (serverPersonaId === undefined) return;
    if (seenServerPersonaId.current !== serverPersonaId) {
      seenServerPersonaId.current = serverPersonaId;
      if (serverPersonaId === lastSavedPersonaId.current) lastSavedPersonaId.current = null;
      if (serverPersonaId && !lastSavedPersonaId.current) return setStoredPersonaId(serverPersonaId);
    }
    if (storedPersonaId && storedPersonaId !== serverPersonaId) {
      lastSavedPersonaId.current = storedPersonaId;
      saveViewerPersona({ viewerPersonaId: storedPersonaId });
    }
  }, [saveViewerPersona, serverPersonaId, setStoredPersonaId, storedPersonaId]);
}
