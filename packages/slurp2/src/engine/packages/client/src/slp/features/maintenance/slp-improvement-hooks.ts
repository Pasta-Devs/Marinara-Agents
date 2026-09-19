import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";

export type SlurpImprovementProposal = {
  id: string;
  accountId: string;
  field: string;
  before: unknown;
  after: unknown;
  status: "pending" | "applied" | "dismissed" | "stale" | "error";
  error: string | null;
};
export type SlurpImprovementJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  mode: "missing" | "refresh" | "prefill";
  rebrand: boolean;
  accountIds: string[];
  modules: string[];
  completed: number;
  total: number;
  expectedModelCalls: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  proposals: SlurpImprovementProposal[];
};
export function useSlurpImprovementJobs(enabled: boolean) {
  return useQuery({
    queryKey: [...slpKeys.settings(), "improvement-jobs"] as const,
    queryFn: () => api.get<{ items: SlurpImprovementJob[] }>("/slurp2/backstage/improvement-jobs"),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.items.some((job) => job.status === "queued" || job.status === "running") ? 1000 : false,
  });
}
export function useCreateSlurpImprovementJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      accountIds: string[];
      mode: "missing" | "refresh" | "prefill";
      rebrand: boolean;
      modules: string[];
      connectionId?: string;
    }) => api.post<SlurpImprovementJob>("/slurp2/backstage/improvement-jobs", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...slpKeys.settings(), "improvement-jobs"] }),
  });
}
export function useApplySlurpImprovementProposals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, proposalIds }: { jobId: string; proposalIds: string[] }) =>
      api.post<{ applied: number; rejected: number; creators: number; createdTags: string[] }>(
        `/slurp2/backstage/improvement-jobs/${encodeURIComponent(jobId)}/apply`,
        { proposalIds },
      ),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [...slpKeys.settings(), "improvement-jobs"] }),
        qc.invalidateQueries({ queryKey: slpKeys.noodlerAccounts() }),
        qc.invalidateQueries({ queryKey: slpKeys.settings() }),
      ]),
  });
}
export function useSetSlurpImprovementJobState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, action }: { jobId: string; action: "cancel" | "resume" | "retry" }) =>
      api.post<SlurpImprovementJob>(`/slurp2/backstage/improvement-jobs/${encodeURIComponent(jobId)}/${action}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...slpKeys.settings(), "improvement-jobs"] }),
  });
}
export function useDismissSlurpImprovementProposals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, proposalIds }: { jobId: string; proposalIds: string[] }) =>
      api.post<{ dismissed: number }>(`/slurp2/backstage/improvement-jobs/${encodeURIComponent(jobId)}/dismiss`, {
        proposalIds,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...slpKeys.settings(), "improvement-jobs"] }),
  });
}
