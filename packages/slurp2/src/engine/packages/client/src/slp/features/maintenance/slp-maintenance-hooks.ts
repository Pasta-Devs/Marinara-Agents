import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpSettings } from "../settings/slp-settings-contract.js";

export type SlurpAutopurgeResult = {
  cutoff: string;
  deletedPosts: number;
  removedPostMedia: number;
  removedMessageMedia: number;
  nextRunAt: string | null;
};
export type SlurpAutopurgePreview = {
  cutoff: string;
  affectedPosts: number;
  postsToDelete: number;
  postMediaFiles: number;
  messageMediaFiles: number;
  estimatedReclaimableBytes: number;
};
export type SlurpMaintenanceSummary = {
  generatedAt: string;
  operations: { backup: boolean; deletion: boolean; account: boolean; mutation: boolean };
  content: { creators: number; posts: number; interactions: number; messages: number };
  media: { files: number; bytes: number };
  unused: {
    preparedPosts: number;
    attempts: number;
    runs: number;
    improvementJobs: number;
    improvementProposals: number;
  };
};
export function useRunSlurpAutopurge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SlurpAutopurgeResult>("/slurp2/autopurge/run", {}),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: slpKeys.settings() });
      void queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() });
      return result;
    },
  });
}
export function useSlurpMaintenanceSummary(enabled: boolean) {
  return useQuery({
    queryKey: [...slpKeys.settings(), "maintenance-summary"] as const,
    queryFn: () => api.get<SlurpMaintenanceSummary>("/slurp2/maintenance/summary"),
    enabled,
    staleTime: 15_000,
  });
}
export function useSlurpAutopurgePreview(settings: SlurpSettings | undefined, enabled: boolean) {
  const input = settings
    ? {
        autopurgeRetentionValue: settings.autopurgeRetentionValue,
        autopurgeRetentionUnit: settings.autopurgeRetentionUnit,
        autopurgeKeepPosts: settings.autopurgeKeepPosts,
        autopurgeIncludeMessageMedia: settings.autopurgeIncludeMessageMedia,
      }
    : null;
  return useQuery({
    queryKey: [...slpKeys.settings(), "autopurge-preview", input] as const,
    queryFn: () => api.post<SlurpAutopurgePreview>("/slurp2/autopurge/preview", input!),
    enabled: enabled && Boolean(input),
    staleTime: 10_000,
  });
}
export function useDeleteAllSlurpData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ deletedCreators: number; deletedPosts: number }>("/slurp2/data"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.all }),
  });
}
export function useDeleteUnusedSlurpData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<{ deletedPreparedPosts: number; deletedAttempts: number; deletedRuns: number }>("/slurp2/data/unused"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.all }),
  });
}
