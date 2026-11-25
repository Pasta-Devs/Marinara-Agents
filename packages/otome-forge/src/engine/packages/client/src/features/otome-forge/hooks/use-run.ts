// ──────────────────────────────────────────────
// Otome Forge: one run (GET /runs/:run → {view}), polled every 2 s while forging, free sprite cleanup or a sticker
// (#2044) is working
// ──────────────────────────────────────────────
// Polling runs while a step is running, or pending with nothing failed before it (SH/forge.ts forgeIsWorking): the
// text steps, and a paid paint the player asked for. It stops while the world waits on a failed step's Retry (whose
// answer patches the view and starts it again), and after a restart the server reports a step with no live owner as
// failed. 0.47.1: also while Your cast's paints go on in the background (castPainting), wherever the player is.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useOtomeApi } from "../api";
import { ACCENT_SAMPLER_VERSION, accentIsPlaceholder, castAccentFor, sampleAccent } from "../lib/accent";
import type { RunCastMember, RunView, SettingsInput, WorldView } from "../shared/api-types";
import { forgeIsWorking } from "../shared/forge";
import { memoryQueryKey, recallQueryKey } from "./use-memory";

const POLL_MS = 2_000;

export const runQueryKey = (runKey: string) => ["otome-forge", "run", runKey] as const;
/** A love interest's spoiler-gated bible (BibleView); the cast's intimacy fill refreshes it too. */
export const bibleQueryKey = (runKey: string, li: string) => ["otome-forge", "bible", runKey, li] as const;

/** GET /runs/:run, for useRun and for opening a story, which loads it before showing it. */
export const fetchRunView = async (otome: ReturnType<typeof useOtomeApi>, runKey: string) =>
  (await otome.get<{ view: RunView }>(`/runs/${encodeURIComponent(runKey)}`)).view;

/** 0.47.1: a look or a set of faces is being painted (the server says `stopped` once a restart left one pending). */
export const castPainting = (view: RunView) =>
  [view.player, ...view.lis, ...(view.friends ?? [])].some(
    (person) => person.art?.state === "pending" || ("facesPaint" in person && person.facesPaint?.state === "pending"),
  );

export function useRun(runKey: string | null) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: runQueryKey(runKey ?? ""),
    enabled: !!runKey,
    queryFn: () => fetchRunView(otome, runKey ?? ""),
    refetchInterval: (query) =>
      query.state.data &&
      (query.state.data.cutoutsPending ||
        query.state.data.stickersPending ||
        forgeIsWorking(query.state.data.forge) ||
        castPainting(query.state.data))
        ? POLL_MS
        : false,
  });
}

/** Writes a route's partial answer (a new forge, world or accent) into the cached view. */
export function patchRun(queryClient: QueryClient, runKey: string, patch: (view: RunView) => RunView) {
  queryClient.setQueryData<RunView>(runQueryKey(runKey), (view) => (view ? patch(view) : view));
}

/** #2475: writes `changes` into the love interest or friend `id` of the cached view (Your cast edits both alike). */
export function patchCastMember(
  queryClient: QueryClient,
  runKey: string,
  id: string,
  changes: (person: RunCastMember) => Partial<RunCastMember>,
) {
  patchRun(queryClient, runKey, (view) => ({
    ...view,
    lis: view.lis.map((li) => (li.id === id ? { ...li, ...changes(li) } : li)),
    ...(view.friends
      ? { friends: view.friends.map((friend) => (friend.id === id ? { ...friend, ...changes(friend) } : friend)) }
      : {}),
  }));
}

/**
 * Once an LI's (or, #2475, a friend's) portrait exists, samples his accent from it and saves it, once per portrait. A failed sample or save
 * leaves the colour from his name; the next portrait or visit tries again.
 * The picks are made distinct against each other, not against the view the pass started with: every stale LI is
 * sampled in one pass, so `picked` carries the colours already chosen (and not yet saved) synchronously, before the
 * POST, and a pick that fails gives its colour back.
 */
export function useSampledAccents(view: RunView | undefined) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const tried = useRef(new Set<string>());
  /** li id → the accent chosen for it in this page, saved or still in flight. */
  const picked = useRef(new Map<string, string>());
  useEffect(() => {
    if (!view) return;
    for (const li of [...view.lis, ...(view.friends ?? [])]) {
      const key = `${li.id} ${li.portrait}`;
      if (!li.portrait || !accentIsPlaceholder(li) || tried.current.has(key)) continue;
      tried.current.add(key);
      void sampleAccent(li.portrait).then(async (sampled) => {
        if (!sampled) return;
        // No two name plates alike: his own colour unless it reads as one the rest of the cast already has. The siblings'
        // latest cached accents come first, then this page's choices, so a pick made a moment ago counts even before its
        // POST lands.
        const latest = queryClient.getQueryData<RunView>(runQueryKey(view.runKey)) ?? view;
        const accent = castAccentFor(li, sampled, [...latest.lis, ...(latest.friends ?? [])], picked.current);
        picked.current.set(li.id, accent);
        try {
          const saved = await otome.post<{ accent: string }>(
            `/runs/${encodeURIComponent(view.runKey)}/lis/${encodeURIComponent(li.id)}/accent`,
            { accent, sampler: ACCENT_SAMPLER_VERSION },
          );
          picked.current.set(li.id, saved.accent);
          patchCastMember(queryClient, view.runKey, li.id, () => ({
            accent: saved.accent,
            accentSampler: ACCENT_SAMPLER_VERSION,
          }));
        } catch (error) {
          // Its colour goes back to the cast, so a later pick may take it.
          picked.current.delete(li.id);
          console.warn("Otome Hearth could not save an accent colour", error);
        }
      });
    }
  }, [otome, queryClient, view]);
}

/**
 * POST /runs/:run/settings for the Settings screens. Lowering a setting never needs the 18+ gate; raising one without
 * it is refused by the server (403 age-gate), and the screen shows why. A save reads the memory status again.
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
      // And the story memory's status: a connection given here ends its "no connection" banner at once. Another
      // embedding model rebuilds the recall index, so its status is read again too.
      void queryClient.invalidateQueries({ queryKey: memoryQueryKey(runKey) });
      void queryClient.invalidateQueries({ queryKey: recallQueryKey(runKey) });
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
