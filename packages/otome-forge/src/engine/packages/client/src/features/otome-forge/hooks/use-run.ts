// ──────────────────────────────────────────────
// Otome Forge: one run (GET /runs/:run → {view}), polled every 2 s while the forge is working
// ──────────────────────────────────────────────
// Polling runs while a step is running, or pending with nothing failed before it (SH/forge.ts forgeIsWorking): the
// text steps, and a paid paint the player asked for. It stops while the world waits on a failed step's Retry (whose
// answer patches the view and starts it again), and after a restart the server reports a step with no live owner as
// failed.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useOtomeApi } from "../api";
import { accentIsPlaceholder, sampleAccent } from "../lib/accent";
import type { RunView, SettingsInput, WorldView } from "../shared/api-types";
import { forgeIsWorking } from "../shared/forge";

const POLL_MS = 2_000;

export const runQueryKey = (runKey: string) => ["otome-forge", "run", runKey] as const;

/** GET /runs/:run, for useRun and for opening a story, which loads it before showing it. */
export const fetchRunView = async (otome: ReturnType<typeof useOtomeApi>, runKey: string) =>
  (await otome.get<{ view: RunView }>(`/runs/${encodeURIComponent(runKey)}`)).view;

export function useRun(runKey: string | null) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: runQueryKey(runKey ?? ""),
    enabled: !!runKey,
    queryFn: () => fetchRunView(otome, runKey ?? ""),
    refetchInterval: (query) => (query.state.data && forgeIsWorking(query.state.data.forge) ? POLL_MS : false),
  });
}

/** Writes a route's partial answer (a new forge, world or accent) into the cached view. */
export function patchRun(queryClient: QueryClient, runKey: string, patch: (view: RunView) => RunView) {
  queryClient.setQueryData<RunView>(runQueryKey(runKey), (view) => (view ? patch(view) : view));
}

/**
 * Once an LI's portrait exists, samples his accent from it and saves it, once per portrait. A failed sample or save
 * leaves the colour from his name; the next portrait or visit tries again.
 */
export function useSampledAccents(view: RunView | undefined) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!view) return;
    for (const li of view.lis) {
      const key = `${li.id} ${li.portrait}`;
      if (!li.portrait || !accentIsPlaceholder(li) || tried.current.has(key)) continue;
      tried.current.add(key);
      void sampleAccent(li.portrait).then(async (accent) => {
        if (!accent) return;
        try {
          const saved = await otome.post<{ accent: string }>(
            `/runs/${encodeURIComponent(view.runKey)}/lis/${encodeURIComponent(li.id)}/accent`,
            { accent },
          );
          patchRun(queryClient, view.runKey, (current) => ({
            ...current,
            lis: current.lis.map((item) => (item.id === li.id ? { ...item, accent: saved.accent } : item)),
          }));
        } catch (error) {
          console.warn("Otome Forge could not save an accent colour", error);
        }
      });
    }
  }, [otome, queryClient, view]);
}

/**
 * POST /runs/:run/settings for the Settings screens. Lowering a setting never needs the 18+ gate; raising one without
 * it is refused by the server (403 age-gate), and the screen shows why.
 */
export function useSaveSettings(runKey: string | null) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const save = async (input: SettingsInput, savedText: string): Promise<boolean> => {
    if (!runKey || busy) return false;
    setBusy(true);
    setStatus(null);
    try {
      const { world } = await otome.post<{ world: WorldView }>(`/runs/${encodeURIComponent(runKey)}/settings`, {
        ...input,
      });
      // The forge too: an image connection added here brings the cast's paint steps.
      patchRun(queryClient, runKey, (view) => ({ ...view, world: { ...view.world, ...world }, forge: world.forge }));
      setStatus({ error: false, text: savedText });
      return true;
    } catch (failure) {
      setStatus({ error: true, text: otome.errorMessage(failure) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { save, busy, status };
}

export type SaveSettings = ReturnType<typeof useSaveSettings>;
