import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpSettings } from "../settings/slp-settings-contract.js";

/** Creators and arc types per tag, keyed by lower-cased tag. */
export function useSlurpDiscoveryTagUsage(enabled: boolean) {
  return useQuery({
    queryKey: [...slpKeys.settings(), "discovery-tag-usage"],
    queryFn: () =>
      api.get<{ creators: Record<string, number>; arcTypes: Record<string, number> }>("/slurp2/discovery-tags/usage"),
    enabled,
  });
}
/** Rename (`to` set) or delete (`to` null) a tag everywhere, Creator profiles included. */
export function useReplaceSlurpDiscoveryTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string | null }) =>
      to === null
        ? api.post<SlurpSettings>("/slurp2/discovery-tags/delete", { tag: from })
        : api.post<SlurpSettings>("/slurp2/discovery-tags/rename", { from, to }),
    onSuccess: (settings) => {
      queryClient.setQueryData(slpKeys.settings(), settings);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: [...slpKeys.settings(), "discovery-tag-usage"] }),
        queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
      ]);
    },
  });
}
