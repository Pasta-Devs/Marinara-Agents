import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";

export type NoodlerFirstPostJob = {
  id: string;
  executionId: string;
  accountId: string;
  status: "queued" | "running" | "generated" | "skipped" | "failed";
  attempts: number;
  postId: string | null;
  error: string | null;
};
export function useEnqueueNoodlerFirstPosts() {
  return useMutation({
    mutationFn: (input: { executionId: string; accountIds: string[] }) =>
      api.post<{ jobs: NoodlerFirstPostJob[] }>("/slurp2/noodler/first-posts/enqueue", input),
  });
}
export function useNoodlerFirstPostStatus(executionId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...noodleKeys.noodlerRoot(), "first-posts", executionId ?? "none"],
    queryFn: () =>
      api.get<{ jobs: NoodlerFirstPostJob[]; complete: boolean }>(
        `/slurp2/noodler/first-posts/status?executionId=${encodeURIComponent(executionId!)}`,
      ),
    enabled: enabled && Boolean(executionId),
    staleTime: 0,
    refetchInterval: enabled && executionId ? 2_000 : false,
    refetchIntervalInBackground: false,
    retry: false,
  });
}
