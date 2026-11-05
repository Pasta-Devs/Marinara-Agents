// ──────────────────────────────────────────────
// Otome Forge: the story memory's status (GET /runs/:run/memory/status) and its Retry (POST .../memory/retry), shared
// by the banner on every screen of a story (components/MemoryBanner.tsx) and Settings' MemorySection
// ──────────────────────────────────────────────
// Polled as lib/memory-notice.ts memoryPollMs says: fast only while a retry runs (or upkeep runs with Settings' memory
// section open, `watching`), so a summary that fails in the background (after a date, a message thread, a scene's
// recall) shows within half a minute; the reader asks again as a chapter ends, and a saved setting (a new connection)
// asks again at once (hooks/use-run.ts useSaveSettings). The cache keeps memory-notice's `retrying` mark, so both
// places read a retry fast, whichever started it. No notice shows while a Retry request is on its way (`busy`) or the
// retry runs: the banner comes back only when it fails again.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOtomeApi } from "../api";
import { memoryNotice, memoryPollMs, nextMemoryView, type MemoryView } from "../lib/memory-notice";
import type { MemoryStatus } from "../shared/api-types";

export const memoryQueryKey = (runKey: string) => ["otome-forge", "memory", runKey] as const;

export function useMemoryStatus(runKey: string, { watching = false }: { watching?: boolean } = {}) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const path = `/runs/${encodeURIComponent(runKey)}/memory`;
  const queryKey = memoryQueryKey(runKey);
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      nextMemoryView(
        queryClient.getQueryData<MemoryView>(queryKey),
        (await otome.get<{ status: MemoryStatus }>(`${path}/status`)).status,
      ),
    refetchInterval: (current) => memoryPollMs(current.state.data, watching),
  });
  const [busy, setBusy] = useState(false);
  // Why the Retry request itself failed (no connection, the server unreachable), with the status it failed on.
  const [failure, setFailure] = useState<{ message: string; on: MemoryView | undefined } | null>(null);

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      // A status read already on its way would land after this answer and put the old failure back.
      await queryClient.cancelQueries({ queryKey });
      const { status } = await otome.post<{ status: MemoryStatus }>(`${path}/retry`);
      queryClient.setQueryData<MemoryView>(queryKey, (before) => nextMemoryView(before, status));
    } catch (error) {
      setFailure({ message: otome.errorMessage(error), on: queryClient.getQueryData<MemoryView>(queryKey) });
      void queryClient.invalidateQueries({ queryKey });
    } finally {
      setBusy(false);
    }
  };
  // It lasts while the status reads the same (the cache keeps an unchanged status's object, so a poll keeps it) and
  // goes once the status moves on: upkeep runs (a Retry from elsewhere), memory is well, or a new failure has its own
  // words. The next Retry clears it too.
  const error = failure && failure.on === query.data ? failure.message : null;

  return { query, status: query.data, notice: memoryNotice(query.data, busy), retry, busy, error };
}
