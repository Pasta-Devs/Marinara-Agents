import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../../../lib/api-client.js";
import { setSlurpWorldOffsetMs } from "../../../../../shared/src/slp/slp-world-clock.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import { getSlurpBackupJob, type SlurpBackupJob } from "./slp-backup";

export type SlpCheckpoint = {
  id: string;
  kind: "manual" | "auto" | "safety";
  label: string;
  /** Real time it was written. */
  createdAt: string;
  /** World date it captured. */
  worldDate: string;
  worldNowMs: number;
  bytes: number;
  creators: number;
  posts: number;
  mediaFiles: number;
};

export type SlpWorldClock = {
  worldNow: string;
  realNow: string;
  offsetMs: number;
  epoch: number;
  maxSkipDays: number;
  autoCheckpointKeep: number;
  autoCheckpointKeepMax: number;
  checkpoints: SlpCheckpoint[];
};

const clockKey = () => [...slpKeys.settings(), "world-clock"] as const;

/**
 * The server's world date, read once and then every few minutes. It also hands the
 * offset to the shared clock, so every "now" on screen follows the world date.
 */
export function useSlpWorldClock() {
  const query = useQuery({
    queryKey: clockKey(),
    queryFn: () => api.get<SlpWorldClock>("/slurp2/world/clock"),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const offsetMs = query.data?.offsetMs;
  useEffect(() => {
    if (offsetMs !== undefined) setSlurpWorldOffsetMs(offsetMs);
  }, [offsetMs]);
  return query;
}

const jobFailed = (job: SlurpBackupJob): Error => new Error(job.error ?? job.detail);

/** One failed status read is not a verdict on the job: ask again a few times before giving up. */
async function readJobWithRetry(id: string): Promise<SlurpBackupJob> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await getSlurpBackupJob(id);
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 1000 * attempt));
    }
  }
}

/** Poll a timeline job (skip, checkpoint, restore) until it ends. Rejects with the server's reason. */
export async function waitForSlpTimelineJob(job: SlurpBackupJob, onProgress?: (job: SlurpBackupJob) => void) {
  let current = job;
  while (current.state !== "completed") {
    if (current.state === "error") throw jobFailed(current);
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    current = await readJobWithRetry(current.id);
    onProgress?.(current);
  }
  return current;
}

/** After the world date moved or a checkpoint came back, every cached screen is out of date. */
function useRefreshEverything() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["slurp"] }),
      queryClient.invalidateQueries({ queryKey: slpKeys.all }),
    ]);
  };
}

export function useSkipSlpWorldDays() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async (input: { days: number; onProgress?: (job: SlurpBackupJob) => void }) =>
      waitForSlpTimelineJob(
        await api.post<SlurpBackupJob>("/slurp2/world/clock/skip", { days: input.days }),
        input.onProgress,
      ),
    onSettled: refresh,
  });
}

export function useCreateSlpCheckpoint() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async (input: { label?: string; onProgress?: (job: SlurpBackupJob) => void }) =>
      waitForSlpTimelineJob(
        await api.post<SlurpBackupJob>("/slurp2/world/clock/checkpoints", { label: input.label }),
        input.onProgress,
      ),
    onSettled: refresh,
  });
}

export function useRestoreSlpCheckpoint() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: async (input: { id: string; onProgress?: (job: SlurpBackupJob) => void }) =>
      waitForSlpTimelineJob(
        await api.post<SlurpBackupJob>(`/slurp2/world/clock/checkpoints/${encodeURIComponent(input.id)}/restore`, {}),
        input.onProgress,
      ),
    onSettled: refresh,
  });
}

export function useDeleteSlpCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/slurp2/world/clock/checkpoints/${encodeURIComponent(id)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: clockKey() }),
  });
}

export function useSetSlpAutoCheckpointKeep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (autoCheckpointKeep: number) =>
      api.put<{ autoCheckpointKeep: number }>("/slurp2/world/clock/settings", { autoCheckpointKeep }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: clockKey() }),
  });
}
